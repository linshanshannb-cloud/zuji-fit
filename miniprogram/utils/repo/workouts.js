const S = require('../storage');
const K = require('./keys');
const V = require('./validate');
const M = require('./model');
const C = require('./core');
const { newId } = require('./ids');
const exRepo = require('./exercises');

// In-memory (unsaved) draft (DATA_MODEL §4 rule 1). Persisted on first addExercise(s); discarded otherwise.
let pending = null;
const isPending = id => !!pending && pending.id === id;
function getPending() { return pending ? Object.assign({}, pending) : null; }
function discardPending() { pending = null; }
// ---------- raw IO
function headers() { return S.getTyped(K.WORKOUTS, 'array', []); } // corrupt -> [] for display, writes refused
function detailOf(id) {
  const key = K.workoutDetail(id), d = S.getTyped(key, 'object', null);
  if (d && !(Array.isArray(d.exercises) && Array.isArray(d.sets))) S.markCorrupt(key, d); // malformed: keep raw, block writes
  return d && Array.isArray(d.exercises) && Array.isArray(d.sets) ? d : { workoutId: id, exercises: [], sets: [] };
}
function findHeader(id) { const h = headers().find(w => w.id === id); if (!h) C.raise('NOT_FOUND', '训练不存在'); return h; }
// Write order (§8): detail first, then headers.
// If the header write fails, the detail is rolled back to `prevDetail` (undefined = key did not exist) so a failed
// operation leaves storage exactly as before (QA S3).
function commit(header, detail, patch, prevDetail) {
  const h = Object.assign({}, header, patch || {}, M.computeSummary(detail), { updatedAt: C.now() });
  const key = K.workoutDetail(h.id), list = M.sortWorkouts(headers().filter(w => w.id !== h.id).concat([h]));
  S.set(key, detail);
  try { S.set(K.WORKOUTS, list); }
  catch (e) {
    try { if (prevDetail === undefined) S.remove(key); else S.set(key, prevDetail); } catch (e2) { /* launch self-heal recomputes headers */ }
    throw e;
  }
  return h;
}
// Load-modify-commit helper for detail mutations.
function mutate(workoutId, fn) {
  return C.guard(() => {
    C.writable();
    const header = findHeader(workoutId);
    const prev = S.get(K.workoutDetail(workoutId), undefined);
    const detail = detailOf(workoutId);
    const res = fn(detail, header) || {};
    const h = commit(header, res.detail || detail, res.patch, prev);
    return C.ok(res.data !== undefined ? res.data : h);
  });
}
function findWE(detail, weId) { const we = detail.exercises.find(e => e.id === weId); if (!we) C.raise('NOT_FOUND', '动作不存在'); return we; }
function findSet(detail, setId) { const s = detail.sets.find(x => x.id === setId); if (!s) C.raise('NOT_FOUND', '组不存在'); return s; }
const replaceIn = (arr, item) => arr.map(x => (x.id === item.id ? item : x));

// ---------- queries
function getDraft() { return headers().find(w => w.status === 'draft') || null; }
function getHeader(id) { if (isPending(id)) return Object.assign({ persisted: false }, pending); return headers().find(w => w.id === id) || null; }
// Full view with nested exercises/sets; summaries recomputed (authoritative per §4.4).
function getWorkout(id) {
  const h = getHeader(id); if (!h) return null;
  const d = isPending(id) ? { workoutId: id, exercises: [], sets: [] } : detailOf(id);
  return M.assemble(Object.assign({}, h, M.computeSummary(d), { displayName: h.name || M.defaultWorkoutName(h.date) }), d, exRepo.get);
}
function listWorkouts({ status = 'completed', from = '', to = '' } = {}) {
  return headers().filter(w => (!status || w.status === status) && (!from || w.date >= from) && (!to || w.date <= to))
    .map(w => Object.assign({}, w, { displayName: w.name || M.defaultWorkoutName(w.date) }));
}
const workoutsOn = date => listWorkouts({ from: date, to: date });
// Training-day marks: completed workouts with ≥1 exercise (migrated empty workouts stay stored but don't mark the day).
function completedDates(from, to) { const m = {}; listWorkouts({ from, to }).forEach(w => { if (w.exerciseCount > 0) m[w.date] = (m[w.date] || 0) + 1; }); return m; }
// Best done normal set of one WorkoutExercise: max weight, tie -> more reps.
function bestSet(sets) {
  let b = null;
  sets.forEach(s => { if (!M.isCountable(s)) return; const w = s.weightKg == null ? 0 : s.weightKg;
    if (!b || w > b.weightKg || (w === b.weightKg && s.reps > b.reps)) b = { weightKg: w, reps: s.reps }; });
  return b;
}
// Calendar summary cards for a day (completed only, by createdAt): header + duration + first 3 exercises with best set.
function daySummaries(date) {
  return workoutsOn(date).map(w => {
    const v = getWorkout(w.id), detailMissing = S.get(K.workoutDetail(w.id), undefined) === undefined;
    return Object.assign({}, w, {
      durationMin: w.startedAt && w.completedAt ? Math.max(1, Math.round((w.completedAt - w.startedAt) / 60000)) : null,
      detailMissing,
      top: v.exercises.slice(0, 3).map(e => ({ name: e.displayName, sets: e.sets.filter(M.isCountable).length, best: bestSet(e.sets) })),
      more: Math.max(0, v.exercises.length - 3) });
  });
}
// 我的最佳 (§P6): heaviest done normal set across completed workouts (tie -> more reps).
function personalBest(exerciseId) {
  let best = null;
  headers().filter(w => w.status === 'completed').forEach(w => {
    const d = detailOf(w.id);
    d.exercises.filter(e => e.exerciseId === exerciseId).forEach(e => {
      const b = bestSet(d.sets.filter(s => s.workoutExerciseId === e.id));
      if (b && (!best || b.weightKg > best.weightKg || (b.weightKg === best.weightKg && b.reps > best.reps))) best = Object.assign({ date: w.date, workoutId: w.id }, b);
    });
  });
  return best;
}
function referencedExerciseIds() {
  const s = {}; headers().forEach(w => detailOf(w.id).exercises.forEach(e => { s[e.exerciseId] = true; })); return s;
}

// ---------- workout lifecycle
// createDraft: builds the header (id/startedAt/createdAt fixed now). With exerciseIds -> persisted immediately;
// without -> held in memory until the first addExercise(s) (no empty drafts in storage).
function createDraft({ date, name = '', note = '', startTimer, exerciseIds = [] } = {}) {
  return C.guard(() => {
    C.writable();
    const existing = getDraft();
    if (existing) return C.fail('DRAFT_EXISTS', '已有未完成的训练，继续还是放弃？', { data: existing });
    const t = C.now(), d = C.check(V.validateDate(date || C.today(), { today: C.today() }));
    const h = { id: newId('w_', t), status: 'draft', date: d, name: C.check(V.validateText(name, V.LIMITS.workoutName)),
      note: C.check(V.validateText(note, V.LIMITS.workoutNote)),
      startedAt: (startTimer === undefined ? d === C.today() : startTimer) ? t : null, completedAt: null, createdAt: t, updatedAt: t,
      exerciseCount: 0, setCount: 0, volumeKg: 0 };
    if (!exerciseIds.length) { pending = h; return C.ok(Object.assign({ persisted: false }, h)); }
    const detail = { workoutId: h.id, exercises: [], sets: [] };
    exerciseIds.forEach(eid => appendExercise(detail, h, eid));
    pending = null;
    return C.ok(commit(h, detail));
  });
}
function updateWorkout(id, patch = {}) {
  if (isPending(id)) {
    return C.guard(() => {
      const p = {};
      if ('date' in patch) { p.date = C.check(V.validateDate(patch.date, { today: C.today() })); }
      if ('name' in patch) p.name = C.check(V.validateText(patch.name, V.LIMITS.workoutName));
      if ('note' in patch) p.note = C.check(V.validateText(patch.note, V.LIMITS.workoutNote));
      pending = Object.assign({}, pending, p);
      return C.ok(Object.assign({ persisted: false }, pending));
    });
  }
  return mutate(id, () => {
    const p = {};
    if ('date' in patch) p.date = C.check(V.validateDate(patch.date, { today: C.today() }));
    if ('name' in patch) p.name = C.check(V.validateText(patch.name, V.LIMITS.workoutName));
    if ('note' in patch) p.note = C.check(V.validateText(patch.note, V.LIMITS.workoutNote));
    return { patch: p };
  });
}
// draft -> completed (§4.3): drop exercises with no done set; require ≥1 left.
function completeWorkout(id) {
  return mutate(id, (detail, header) => {
    if (header.status !== 'draft') C.raise('NOT_DRAFT', '只有进行中的训练可以完成');
    const keep = detail.exercises.filter(we => detail.sets.some(s => s.workoutExerciseId === we.id && s.done === true));
    if (!keep.length) C.raise('NO_DONE_SETS', '至少完成一组');
    const keepIds = {}; keep.forEach(e => { keepIds[e.id] = true; });
    const nd = { workoutId: id, exercises: M.renumberExercises(keep), sets: detail.sets.filter(s => keepIds[s.workoutExerciseId]) };
    return { detail: Object.assign({}, detail, nd), patch: { status: 'completed', completedAt: C.now() } };
  });
}
// R-C pre-check for the confirm dialog. Pure read.
function completionCheck(id) {
  const h = getHeader(id); if (!h) return null;
  const d = detailOf(id);
  const doneSets = d.sets.filter(s => s.done === true).length;
  const empty = d.exercises.slice().sort(M.byOrder).filter(we => !d.sets.some(s => s.workoutExerciseId === we.id && s.done === true));
  const emptyIds = {}; empty.forEach(e => { emptyIds[e.id] = true; });
  return { status: h.status, doneSets, canFinish: doneSets > 0,
    willRemove: h.status === 'draft' ? empty.map(e => e.nameSnapshot) : [], // drafts only (lead decision §9#9)
    exercisesWithoutDone: empty.map(e => e.nameSnapshot),
    undoneSets: d.sets.filter(s => !s.done && (h.status !== 'draft' || !emptyIds[s.workoutExerciseId])).length };
}
// 完成训练 / 完成编辑. draft -> completeWorkout (prune). completed -> require ≥1 done set, no pruning, completedAt unchanged.
function finalizeWorkout(id) {
  const h = getHeader(id);
  if (!h) return C.fail('NOT_FOUND', '训练不存在');
  if (isPending(id)) return C.fail('NO_DONE_SETS', '至少完成一组才能结束训练');
  if (h.status === 'draft') return completeWorkout(id);
  // Completed: never re-runs cleanup (DATA_MODEL §4.3). ≥1 done set is a UI gate only (lead #9); data is already saved.
  return mutate(id, detail => {
    if (!detail.sets.some(s => s.done === true)) C.raise('NO_DONE_SETS', '至少完成一组才能保存');
    return {};
  });
}
// Delete (§8): remove header first, then detail key.
function deleteWorkout(id) {
  return C.guard(() => {
    C.writable(); findHeader(id);
    S.set(K.WORKOUTS, headers().filter(w => w.id !== id));
    try { S.remove(K.workoutDetail(id)); } catch (e) { /* orphan cleaned at next launch */ }
    return C.ok(true);
  });
}
function discardDraft() { if (pending) { pending = null; if (!getDraft()) return C.ok(true); } const d = getDraft(); return d ? deleteWorkout(d.id) : C.ok(false); }

// ---------- exercises within a workout
function resolveAddable(exerciseId) {
  const ex = exRepo.get(exerciseId);
  if (ex.unknown) C.raise('UNKNOWN_EXERCISE', '动作不存在');
  if (ex.archived) C.raise('ARCHIVED_EXERCISE', '该动作已删除，不能再添加');
  return ex;
}
// Appends WorkoutExercise + 1 empty set (weight/reps null) to a detail in place (§F1.4).
function appendExercise(detail, header, exerciseId) {
  const ex = resolveAddable(exerciseId);
  detail.exercises = M.renumberExercises(detail.exercises);
  const we = { id: newId('we_', C.now()), workoutId: header.id, exerciseId: ex.id, order: detail.exercises.length, note: '', nameSnapshot: ex.nameZh };
  detail.exercises.push(we);
  detail.sets.push({ id: newId('s_', C.now()), workoutExerciseId: we.id, index: 1, weightKg: null, reps: null, type: 'normal', done: false, doneAt: null });
  return we;
}
function addExercises(workoutId, exerciseIds) {
  if (isPending(workoutId)) { // first add: persist header (createdAt/startedAt unchanged) + detail
    const h = pending;
    if (!exerciseIds.length) return C.fail('EMPTY_SELECTION', '请选择动作');
    const r = C.guard(() => {
      C.writable();
      if (getDraft()) return C.fail('DRAFT_EXISTS', '已有未完成的训练', { data: getDraft() });
      const detail = { workoutId: h.id, exercises: [], sets: [] };
      const added = exerciseIds.map(eid => appendExercise(detail, h, eid));
      commit(h, detail);
      return C.ok(added);
    });
    if (r.ok) pending = null;
    return r;
  }
  return mutate(workoutId, (detail, header) => {
    exerciseIds.forEach(resolveAddable); // validate all before changing anything
    const d = { workoutId, exercises: detail.exercises.slice(), sets: detail.sets.slice() };
    const added = exerciseIds.map(id => appendExercise(d, header, id));
    return { detail: Object.assign({}, detail, d), data: added };
  });
}
function addExercise(workoutId, exerciseId) {
  const r = addExercises(workoutId, [exerciseId]);
  return r.ok ? C.ok(r.data[0]) : r;
}
// Add to current draft, or create today's draft (§F5). data: { workoutId, created }
function addToCurrentDraft(exerciseId) {
  const d = getDraft();
  pending = null;
  if (d) { const r = addExercise(d.id, exerciseId); return r.ok ? C.ok({ workoutId: d.id, created: false, workoutExercise: r.data }) : r; }
  const r = createDraft({ date: C.today(), exerciseIds: [exerciseId] });
  return r.ok ? C.ok({ workoutId: r.data.id, created: true }) : r;
}
function replaceExercise(workoutId, weId, exerciseId) {
  return mutate(workoutId, detail => {
    const ex = resolveAddable(exerciseId);
    const we = Object.assign({}, findWE(detail, weId), { exerciseId: ex.id, nameSnapshot: ex.nameZh });
    return { detail: Object.assign({}, detail, { exercises: replaceIn(detail.exercises, we) }), data: we };
  });
}
// Returns { exercise, sets } snapshot for undo (restoreExercise).
function removeExercise(workoutId, weId) {
  return mutate(workoutId, detail => {
    const we = findWE(detail, weId);
    const removed = { exercise: Object.assign({}, we), sets: detail.sets.filter(s => s.workoutExerciseId === weId) };
    return { detail: Object.assign({}, detail, { exercises: M.renumberExercises(detail.exercises.filter(e => e.id !== weId)),
      sets: detail.sets.filter(s => s.workoutExerciseId !== weId) }), data: removed };
  });
}
function restoreExercise(workoutId, removed) {
  return mutate(workoutId, detail => {
    if (detail.exercises.some(e => e.id === removed.exercise.id)) C.raise('ALREADY_RESTORED', '已恢复');
    const list = M.renumberExercises(detail.exercises);
    list.splice(Math.min(removed.exercise.order, list.length), 0, removed.exercise);
    return { detail: Object.assign({}, detail, { exercises: list.map((e, i) => Object.assign({}, e, { order: i })), sets: detail.sets.concat(removed.sets) }) };
  });
}
// orderedIds must be a permutation of the workout's WorkoutExercise ids.
function reorderExercises(workoutId, orderedIds) {
  return mutate(workoutId, detail => {
    const ids = detail.exercises.map(e => e.id);
    if (!Array.isArray(orderedIds) || orderedIds.length !== ids.length || new Set(orderedIds).size !== ids.length || !orderedIds.every(i => ids.includes(i)))
      C.raise('INVALID_ORDER', '排序数据不完整');
    const exercises = orderedIds.map((id, i) => Object.assign({}, detail.exercises.find(e => e.id === id), { order: i }));
    return { detail: Object.assign({}, detail, { exercises }) };
  });
}
function moveExercise(workoutId, weId, toIndex) {
  const v = getWorkout(workoutId); if (!v) return C.fail('NOT_FOUND', '训练不存在');
  const ids = v.exercises.map(e => e.id), from = ids.indexOf(weId);
  if (from < 0) return C.fail('NOT_FOUND', '动作不存在');
  const to = Math.max(0, Math.min(ids.length - 1, toIndex));
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  return reorderExercises(workoutId, ids);
}
function updateExerciseNote(workoutId, weId, note) {
  return mutate(workoutId, detail => {
    const we = Object.assign({}, findWE(detail, weId), { note: C.check(V.validateText(note, V.LIMITS.weNote)) });
    return { detail: Object.assign({}, detail, { exercises: replaceIn(detail.exercises, we) }), data: we };
  });
}

// ---------- sets
function addSet(workoutId, weId, init = {}) {
  return mutate(workoutId, (detail, header) => {
    findWE(detail, weId);
    const mine = detail.sets.filter(s => s.workoutExerciseId === weId).sort(M.byIndex);
    const last = mine[mine.length - 1];
    const s = { id: newId('s_', C.now()), workoutExerciseId: weId, index: mine.length + 1,
      weightKg: 'weightKg' in init ? C.check(V.validateSetWeight(init.weightKg)) : last ? last.weightKg : null,
      reps: 'reps' in init ? C.check(V.validateReps(init.reps)) : last ? last.reps : null,
      type: init.type === 'warmup' ? 'warmup' : 'normal', done: false, doneAt: null };
    // §F2: backfilled workouts (no startedAt) default new sets to done when reps are known.
    const wantDone = 'done' in init ? !!init.done : header.startedAt == null;
    if (wantDone && s.reps >= 1) { s.done = true; s.doneAt = C.now(); }
    return { detail: Object.assign({}, detail, { sets: M.renumberSets(detail.sets, weId).concat([s]) }), data: s };
  });
}
function updateSet(workoutId, setId, patch = {}) {
  return mutate(workoutId, detail => {
    const s = Object.assign({}, findSet(detail, setId));
    if ('weightKg' in patch) s.weightKg = C.check(V.validateSetWeight(patch.weightKg));
    if ('reps' in patch) s.reps = C.check(V.validateReps(patch.reps));
    if ('type' in patch) { if (patch.type !== 'normal' && patch.type !== 'warmup') C.raise('INVALID_TYPE', '组类型无效'); s.type = patch.type; }
    if (s.done && !(s.reps >= 1)) C.raise('REPS_REQUIRED', '已完成的组次数需 ≥ 1');
    return { detail: Object.assign({}, detail, { sets: replaceIn(detail.sets, s) }), data: s };
  });
}
function setSetDone(workoutId, setId, done) {
  return mutate(workoutId, detail => {
    const s = Object.assign({}, findSet(detail, setId));
    if (done && !(s.reps >= 1)) C.raise('REPS_REQUIRED', '请先填写次数');
    s.done = !!done; s.doneAt = done ? C.now() : null;
    return { detail: Object.assign({}, detail, { sets: replaceIn(detail.sets, s) }), data: s };
  });
}
// Returns the removed set (with its index) for undo (restoreSet).
function deleteSet(workoutId, setId) {
  return mutate(workoutId, detail => {
    const s = findSet(detail, setId);
    return { detail: Object.assign({}, detail, { sets: M.renumberSets(detail.sets.filter(x => x.id !== setId), s.workoutExerciseId) }), data: Object.assign({}, s) };
  });
}
// Re-insert a set at its original position (shifting later sets).
function insertSetAt(sets, s, index) {
  const mine = sets.filter(x => x.workoutExerciseId === s.workoutExerciseId).sort(M.byIndex);
  mine.splice(Math.max(0, Math.min(index - 1, mine.length)), 0, s);
  return sets.filter(x => x.workoutExerciseId !== s.workoutExerciseId).concat(mine.map((x, i) => Object.assign({}, x, { index: i + 1 })));
}
function restoreSet(workoutId, removed) {
  return mutate(workoutId, detail => {
    findWE(detail, removed.workoutExerciseId);
    if (detail.sets.some(x => x.id === removed.id)) C.raise('ALREADY_RESTORED', '已恢复');
    return { detail: Object.assign({}, detail, { sets: insertSetAt(detail.sets, Object.assign({}, removed), removed.index) }) };
  });
}
// 在下方复制一组: same weight/reps/type, not done (backfill rule applies).
function duplicateSet(workoutId, setId) {
  return mutate(workoutId, (detail, header) => {
    const src = findSet(detail, setId);
    const s = { id: newId('s_', C.now()), workoutExerciseId: src.workoutExerciseId, index: src.index + 1, weightKg: src.weightKg, reps: src.reps, type: src.type, done: false, doneAt: null };
    if (header.startedAt == null && s.reps >= 1) { s.done = true; s.doneAt = C.now(); }
    return { detail: Object.assign({}, detail, { sets: insertSetAt(detail.sets, s, s.index) }), data: s };
  });
}
// Launch self-heal: recompute derived header fields from details (detail is authoritative, DATA_MODEL §4.4).
function healHeaders() {
  const list = headers(); let changed = false;
  if (S.getHealth().corruptKeys.includes(K.WORKOUTS) || S.getHealth().unreadableKeys.includes(K.WORKOUTS)) return false;
  const next = list.map(h => {
    const raw = S.get(K.workoutDetail(h.id), undefined);
    if (raw === undefined) return h; // detail missing: keep header as is (UI shows 训练详情丢失)
    const d = detailOf(h.id); if (S.getHealth().corruptKeys.includes(K.workoutDetail(h.id))) return h;
    const sum = M.computeSummary(d);
    if (sum.exerciseCount !== h.exerciseCount || sum.setCount !== h.setCount || sum.volumeKg !== h.volumeKg) { changed = true; return Object.assign({}, h, sum); }
    return h;
  });
  if (changed) S.set(K.WORKOUTS, next);
  return changed;
}
module.exports = { healHeaders, getPending, discardPending, daySummaries, personalBest, completionCheck, finalizeWorkout, addExercises, addToCurrentDraft, replaceExercise, restoreExercise, restoreSet, duplicateSet,
  getDraft, getHeader, getWorkout, listWorkouts, workoutsOn, completedDates, referencedExerciseIds,
  createDraft, updateWorkout, completeWorkout, deleteWorkout, discardDraft,
  addExercise, removeExercise, reorderExercises, moveExercise, updateExerciseNote,
  addSet, updateSet, setSetDone, deleteSet, _headers: headers };
