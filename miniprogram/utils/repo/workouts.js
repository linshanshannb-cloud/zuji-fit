const S = require('../storage');
const K = require('./keys');
const V = require('./validate');
const M = require('./model');
const C = require('./core');
const { newId } = require('./ids');
const exRepo = require('./exercises');
const E = require('../exercises');

// In-memory (unsaved) draft (DATA_MODEL §4 rule 1). Persisted on first addExercise(s); discarded otherwise.
let pending = null;
const isPending = id => !!pending && pending.id === id;
function getPending() { return pending ? Object.assign({}, pending) : null; }
function discardPending() { pending = null; }
// ---------- raw IO
// Outer shape is checked by storage. Records inside a well-typed array can still be null, id-less, or the wrong type.
// Those are marked corrupt (writes refused, raw kept) and omitted from the clean view so queries don't throw.
function headerView() {
  const raw = S.getTyped(K.WORKOUTS, 'array', null);
  if (raw == null) return { list: [], issues: [] };
  const split = M.splitRecords(raw, M.inspectHeader, 'workouts');
  if (split.issues.length) S.markCorrupt(K.WORKOUTS, raw, split.issues);
  return split;
}
function headers() { return headerView().list; }
function loadDetail(id) {
  const key = K.workoutDetail(id);
  const raw = S.get(key, undefined);
  if (S.getHealth().unreadableKeys.includes(key)) {
    return { key, missing: false, blocked: true, detail: { workoutId: id, exercises: [], sets: [] },
      integrity: { ok: false, issues: [{ kind: 'unreadable', path: key }] } };
  }
  if (raw === undefined) {
    return { key, missing: true, blocked: true, detail: null, integrity: { ok: false, issues: [{ kind: 'missing', path: key }] } };
  }
  if (typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.exercises) || !Array.isArray(raw.sets)) {
    const issues = [{ kind: 'shape', path: key }];
    S.markCorrupt(key, raw, issues);
    return { key, missing: false, blocked: true, detail: { workoutId: id, exercises: [], sets: [] }, integrity: { ok: false, issues } };
  }
  const integrity = M.inspectDetail(raw);
  if (!integrity.ok) {
    S.markCorrupt(key, raw, integrity.issues);
    return { key, missing: false, blocked: true, detail: { workoutId: id, exercises: integrity.exercises, sets: integrity.sets }, integrity };
  }
  return { key, missing: false, blocked: false, detail: raw, integrity };
}
function detailOf(id) {
  const st = loadDetail(id);
  return st.detail || { workoutId: id, exercises: [], sets: [] };
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
    const st = loadDetail(workoutId);
    // Missing detail is not an empty workout: writing one would invent history and hide the loss.
    if (st.missing) C.raise('DETAIL_MISSING', '训练详情丢失，已暂停编辑');
    if (st.blocked) C.raise('DATA_CORRUPT', '数据读取异常，已暂停保存以保护原数据');
    const prev = S.get(K.workoutDetail(workoutId), undefined);
    const detail = st.detail;
    const res = fn(detail, header) || {};
    const h = commit(header, res.detail || detail, res.patch, prev);
    return C.ok(res.data !== undefined ? res.data : h);
  });
}
function findWE(detail, weId) { const we = (detail.exercises || []).find(e => e && e.id === weId); if (!we) C.raise('NOT_FOUND', '动作不存在'); return we; }
function findSet(detail, setId) { const s = (detail.sets || []).find(x => x && x.id === setId); if (!s) C.raise('NOT_FOUND', '组不存在'); return s; }
const replaceIn = (arr, item) => arr.map(x => (x.id === item.id ? item : x));

// ---------- queries
function getDraft() { return headers().find(w => w.status === 'draft') || null; }
function getHeader(id) { if (isPending(id)) return Object.assign({ persisted: false }, pending); return headers().find(w => w.id === id) || null; }
// Full view with nested exercises/sets; summaries recomputed (authoritative per §4.4).
function stamp(view, st) {
  view.detailMissing = !!(st && st.missing);
  view.detailCorrupt = !!(st && st.blocked && !st.missing);
  view.integrity = st && st.integrity ? st.integrity : { ok: true, issues: [] };
  return view;
}
function getWorkout(id) {
  const h = getHeader(id); if (!h) return null;
  if (isPending(id)) {
    const d = { workoutId: id, exercises: [], sets: [] };
    return stamp(M.assemble(Object.assign({}, h, M.computeSummary(d), { displayName: h.name || M.defaultWorkoutName(h.date) }), d, exRepo.get), null);
  }
  const st = loadDetail(id);
  const d = st.detail || { workoutId: id, exercises: [], sets: [] };
  // Keep the index summary when the detail key is absent so the header is not presented as a real empty workout.
  const summary = st.missing
    ? { exerciseCount: h.exerciseCount || 0, setCount: h.setCount || 0, volumeKg: h.volumeKg || 0, timeSec: h.timeSec || 0 }
    : M.computeSummary(d);
  return stamp(M.assemble(Object.assign({}, h, summary, { displayName: h.name || M.defaultWorkoutName(h.date) }), d, exRepo.get), st);
}
function listWorkouts({ status = 'completed', from = '', to = '' } = {}) {
  return headers().filter(w => (!status || w.status === status) && (!from || w.date >= from) && (!to || w.date <= to))
    .map(w => Object.assign({}, w, { displayName: w.name || M.defaultWorkoutName(w.date) }));
}
const workoutsOn = date => listWorkouts({ from: date, to: date });
// Training-day marks: completed workouts with ≥1 exercise (migrated empty workouts stay stored but don't mark the day).
function completedDates(from, to) { const m = {}; listWorkouts({ from, to }).forEach(w => { if (w.exerciseCount > 0) m[w.date] = (m[w.date] || 0) + 1; }); return m; }
// Best done normal set of one WorkoutExercise, scored in that exercise's mode.
// reps: heaviest, tie -> more reps. time: longest, tie -> heavier. Warmup / undone ignored.
function bestSet(sets, mode) {
  let b = null;
  (sets || []).forEach(s => {
    if (!M.isCountable(s)) return;
    const w = typeof s.weightKg === 'number' ? s.weightKg : 0;
    if (mode === 'time') {
      const dur = typeof s.durationSec === 'number' ? s.durationSec : 0;
      if (dur < 1) return;
      if (!b || dur > b.durationSec || (dur === b.durationSec && w > b.weightKg)) b = { weightKg: w, durationSec: dur, mode: 'time' };
    } else {
      const reps = typeof s.reps === 'number' ? s.reps : 0;
      if (!b || w > b.weightKg || (w === b.weightKg && reps > b.reps)) b = { weightKg: w, reps };
    }
  });
  return b;
}
function betterReps(b, best) { return b && (!best || b.weightKg > best.weightKg || (b.weightKg === best.weightKg && b.reps > best.reps)); }
function betterTime(b, best) { return b && (!best || b.durationSec > best.durationSec || (b.durationSec === best.durationSec && b.weightKg > best.weightKg)); }
// Calendar summary cards for a day (completed only, by createdAt): header + duration + first 3 exercises with best set.
function daySummaries(date) {
  return workoutsOn(date).map(w => {
    const v = getWorkout(w.id) || { exercises: [], detailMissing: true, detailCorrupt: false };
    return Object.assign({}, w, {
      durationMin: w.startedAt && w.completedAt ? Math.max(1, Math.round((w.completedAt - w.startedAt) / 60000)) : null,
      detailMissing: !!v.detailMissing,
      detailCorrupt: !!v.detailCorrupt,
      timeSec: v.timeSec || 0,
      top: (v.exercises || []).slice(0, 3).map(e => { const mode = M.modeOf(e); return { name: e.displayName, mode, sets: e.sets.filter(M.isCountable).length, best: bestSet(e.sets, mode) }; }),
      more: Math.max(0, (v.exercises || []).length - 3) });
  });
}
// 我的最佳: per mode, so a timed hold is never compared with a rep set.
// preferMode picks that mode when it has data, otherwise the only mode that does. Omitted -> reps, else time.
function personalBest(exerciseId, preferMode) {
  let repsBest = null, timeBest = null;
  headers().filter(w => w.status === 'completed').forEach(w => {
    const d = detailOf(w.id);
    (d.exercises || []).filter(e => e && e.exerciseId === exerciseId).forEach(e => {
      const sets = (d.sets || []).filter(s => s && s.workoutExerciseId === e.id);
      if (M.modeOf(e) === 'time') {
        const b = bestSet(sets, 'time');
        if (betterTime(b, timeBest)) timeBest = Object.assign({ date: w.date, workoutId: w.id }, b);
      } else {
        const b = bestSet(sets, 'reps');
        if (betterReps(b, repsBest)) repsBest = Object.assign({ date: w.date, workoutId: w.id }, b);
      }
    });
  });
  if (preferMode === 'time') return timeBest || repsBest;
  if (preferMode === 'reps') return repsBest || timeBest;
  return repsBest || timeBest;
}
function referencedExerciseIds() {
  const s = {};
  headers().forEach(w => {
    const raw = S.get(K.workoutDetail(w.id), undefined);
    const exercises = raw && Array.isArray(raw.exercises) ? raw.exercises : [];
    exercises.forEach(e => { if (e && typeof e.exerciseId === 'string' && e.exerciseId) s[e.exerciseId] = true; });
  });
  return s;
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
  if (isPending(id)) return { status: h.status, doneSets: 0, canFinish: false, willRemove: [], exercisesWithoutDone: [], undoneSets: 0, detailMissing: false, detailCorrupt: false };
  const st = loadDetail(id);
  if (st.missing) return { status: h.status, detailMissing: true, detailCorrupt: false, doneSets: 0, canFinish: false, willRemove: [], exercisesWithoutDone: [], undoneSets: 0 };
  const d = st.detail;
  const doneSets = d.sets.filter(s => s && s.done === true).length;
  const empty = d.exercises.slice().sort(M.byOrder).filter(we => !d.sets.some(s => s && s.workoutExerciseId === we.id && s.done === true));
  const emptyIds = {}; empty.forEach(e => { emptyIds[e.id] = true; });
  return { status: h.status, doneSets, canFinish: doneSets > 0, detailMissing: false, detailCorrupt: !!st.blocked,
    willRemove: h.status === 'draft' ? empty.map(e => e.nameSnapshot) : [], // drafts only (lead decision §9#9)
    exercisesWithoutDone: empty.map(e => e.nameSnapshot),
    undoneSets: d.sets.filter(s => s && !s.done && (h.status !== 'draft' || !emptyIds[s.workoutExerciseId])).length };
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
  const we = { id: newId('we_', C.now()), workoutId: header.id, exerciseId: ex.id, order: detail.exercises.length, note: '', nameSnapshot: ex.nameZh, mode: E.defaultMode(ex) };
  detail.exercises.push(we);
  detail.sets.push({ id: newId('s_', C.now()), workoutExerciseId: we.id, index: 1, weightKg: null, reps: null, durationSec: null, type: 'normal', done: false, doneAt: null });
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
    const prev = findWE(detail, weId);
    const changing = prev.exerciseId !== ex.id;
    const we = Object.assign({}, prev, { exerciseId: ex.id, nameSnapshot: ex.nameZh });
    let sets = detail.sets;
    // Cross-exercise replace keeps the set rows (and warm-up/normal type) but does not carry weight, reps, duration, or done.
    // The new exercise's default mode is adopted. Replacing with itself only refreshes nameSnapshot.
    if (changing) {
      we.mode = E.defaultMode(ex);
      sets = detail.sets.map(s => (s.workoutExerciseId === weId
        ? Object.assign({}, s, { weightKg: null, reps: null, durationSec: null, done: false, doneAt: null }) : s));
    }
    return { detail: Object.assign({}, detail, { exercises: replaceIn(detail.exercises, we), sets }), data: we };
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
function canComplete(mode, s) {
  return mode === 'time' ? (typeof s.durationSec === 'number' && s.durationSec >= 1) : s.reps >= 1;
}
function addSet(workoutId, weId, init = {}) {
  return mutate(workoutId, detail => {
    const we = findWE(detail, weId);
    const mode = M.modeOf(we);
    const mine = detail.sets.filter(s => s.workoutExerciseId === weId).sort(M.byIndex);
    const last = mine[mine.length - 1];
    const s = { id: newId('s_', C.now()), workoutExerciseId: weId, index: mine.length + 1,
      weightKg: 'weightKg' in init ? C.check(V.validateSetWeight(init.weightKg)) : last ? last.weightKg : null,
      reps: 'reps' in init ? C.check(V.validateReps(init.reps)) : last ? last.reps : null,
      durationSec: 'durationSec' in init ? C.check(V.validateDuration(init.durationSec)) : (last && last.durationSec != null ? last.durationSec : null),
      type: init.type === 'warmup' ? 'warmup' : 'normal', done: false, doneAt: null };
    // 加一组不继承上一组的完成勾选，补录同样从空勾开始。调用方显式 done:true 仍可勾上。
    // 时长倒计时结束只勾选正在计的那一组，不走这里。
    if (init.done && canComplete(mode, s)) { s.done = true; s.doneAt = C.now(); }
    return { detail: Object.assign({}, detail, { sets: M.renumberSets(detail.sets, weId).concat([s]) }), data: s };
  });
}
function updateSet(workoutId, setId, patch = {}) {
  return mutate(workoutId, detail => {
    const s = Object.assign({}, findSet(detail, setId));
    if ('weightKg' in patch) s.weightKg = C.check(V.validateSetWeight(patch.weightKg));
    if ('reps' in patch) s.reps = C.check(V.validateReps(patch.reps));
    if ('durationSec' in patch) s.durationSec = C.check(V.validateDuration(patch.durationSec));
    if ('type' in patch) { if (patch.type !== 'normal' && patch.type !== 'warmup') C.raise('INVALID_TYPE', '组类型无效'); s.type = patch.type; }
    if (s.done && !canComplete(M.modeOf(findWE(detail, s.workoutExerciseId)), s)) {
      const time = M.modeOf(findWE(detail, s.workoutExerciseId)) === 'time';
      C.raise(time ? 'DURATION_REQUIRED' : 'REPS_REQUIRED', time ? '请输入时长' : '已完成的组次数需 ≥ 1');
    }
    return { detail: Object.assign({}, detail, { sets: replaceIn(detail.sets, s) }), data: s };
  });
}
function setSetDone(workoutId, setId, done) {
  return mutate(workoutId, detail => {
    const s = Object.assign({}, findSet(detail, setId));
    const time = M.modeOf(findWE(detail, s.workoutExerciseId)) === 'time';
    if (done && !canComplete(time ? 'time' : 'reps', s)) C.raise(time ? 'DURATION_REQUIRED' : 'REPS_REQUIRED', time ? '请输入时长' : '请先填写次数');
    s.done = !!done; s.doneAt = done ? C.now() : null;
    return { detail: Object.assign({}, detail, { sets: replaceIn(detail.sets, s) }), data: s };
  });
}
// Switch an exercise between reps and time. Values already entered are kept.
// A done set that lacks the new mode's number is un-ticked (never silently stored as 0).
function setExerciseMode(workoutId, weId, mode) {
  return mutate(workoutId, detail => {
    if (mode !== 'reps' && mode !== 'time') C.raise('INVALID_MODE', '计组方式无效');
    const prev = findWE(detail, weId);
    if (M.modeOf(prev) === mode) return { data: { mode, reset: 0 } };
    let reset = 0;
    const sets = detail.sets.map(s => {
      if (!s || s.workoutExerciseId !== weId || s.done !== true) return s;
      if (canComplete(mode, s)) return s;
      reset++;
      return Object.assign({}, s, { done: false, doneAt: null });
    });
    const we = Object.assign({}, prev, { mode });
    return { detail: Object.assign({}, detail, { exercises: replaceIn(detail.exercises, we), sets }), data: { mode, reset } };
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
    const mode = M.modeOf(findWE(detail, src.workoutExerciseId));
    const s = { id: newId('s_', C.now()), workoutExerciseId: src.workoutExerciseId, index: src.index + 1, weightKg: src.weightKg, reps: src.reps, durationSec: src.durationSec != null ? src.durationSec : null, type: src.type, done: false, doneAt: null };
    if (header.startedAt == null && mode !== 'time' && s.reps >= 1) { s.done = true; s.doneAt = C.now(); }
    return { detail: Object.assign({}, detail, { sets: insertSetAt(detail.sets, s, s.index) }), data: s };
  });
}
// 再练一次：把一条力量训练的动作顺序和组结构复制到某一天（默认今天，本地日历日）。
// 与「从模板追加」一样：不覆盖已有训练、不把同名动作并成一组。和模板不同的是重量、次数/时长、组类型会带上。
// 完成勾选和计时一律清空。训练备注、动作备注不带。组间歇存在动作偏好里，不挂在单次训练上；组上若已有 restSec 则原样带上。
function repeatName(header) {
  const base = (header.name && String(header.name).trim()) || M.defaultWorkoutName(header.date);
  return C.check(V.validateText(('复制：' + base).slice(0, V.LIMITS.workoutName), V.LIMITS.workoutName));
}
function planFrom(detail) {
  const exercises = (detail.exercises || []).filter(M.isObj).slice().sort(M.byOrder);
  if (!exercises.length) C.raise('EMPTY_WORKOUT', '这次训练没有动作，不能复制');
  exercises.forEach(e => {
    if (typeof e.exerciseId !== 'string' || !e.exerciseId) C.raise('UNKNOWN_EXERCISE', '动作不存在，不能复制');
    resolveAddable(e.exerciseId);
  });
  return exercises.map(e => ({
    exerciseId: e.exerciseId,
    mode: M.modeOf(e),
    sets: (detail.sets || []).filter(s => M.isObj(s) && s.workoutExerciseId === e.id).slice().sort(M.byIndex).map(s => {
      const row = {
        weightKg: C.check(V.validateSetWeight(s.weightKg)),
        reps: C.check(V.validateReps(s.reps)),
        durationSec: C.check(V.validateDuration(s.durationSec)),
        type: s.type === 'warmup' ? 'warmup' : 'normal',
      };
      if (typeof s.restSec === 'number' && isFinite(s.restSec)) row.restSec = s.restSec;
      return row;
    }),
  }));
}
function writePlan(detail, header, plan) {
  const added = [];
  plan.forEach(item => {
    const ex = resolveAddable(item.exerciseId);
    detail.exercises = M.renumberExercises(detail.exercises);
    const we = {
      id: newId('we_', C.now()), workoutId: header.id, exerciseId: ex.id, order: detail.exercises.length,
      note: '', nameSnapshot: ex.nameZh, mode: item.mode === 'time' ? 'time' : 'reps',
    };
    detail.exercises.push(we);
    item.sets.forEach((src, i) => {
      const s = {
        id: newId('s_', C.now()), workoutExerciseId: we.id, index: i + 1,
        weightKg: src.weightKg, reps: src.reps, durationSec: src.durationSec, type: src.type, done: false, doneAt: null,
      };
      if ('restSec' in src) s.restSec = src.restSec;
      detail.sets.push(s);
    });
    added.push(we);
  });
  return added;
}
function appendPlan(workoutId, plan) {
  const st = loadDetail(workoutId);
  if (st.missing) C.raise('DETAIL_MISSING', '今天的训练详情丢失，不能追加');
  if (st.blocked) C.raise('DATA_CORRUPT', '今天的训练记录已损坏，不能追加');
  return mutate(workoutId, detail => {
    const d = {
      workoutId: detail.workoutId,
      exercises: detail.exercises.map(e => Object.assign({}, e)),
      sets: detail.sets.map(s => Object.assign({}, s)),
    };
    const added = writePlan(d, { id: workoutId }, plan);
    return { detail: d, data: added.length };
  });
}
function repeatFrom(sourceId, opts = {}) {
  return C.guard(() => {
    C.writable();
    const day = C.check(V.validateDate(opts.date || C.today(), { today: C.today() }));
    const header = findHeader(sourceId);
    const st = loadDetail(sourceId);
    if (st.missing) C.raise('DETAIL_MISSING', '训练详情丢失，不能复制');
    if (st.blocked) C.raise('DATA_CORRUPT', '记录已损坏，不能复制');
    const plan = planFrom(st.detail);
    const draft = getDraft();
    if (draft && draft.date === day) {
      const r = appendPlan(draft.id, plan);
      if (!r.ok) return r;
      return C.ok({ mode: 'append', workoutId: draft.id, added: plan.length });
    }
    if (pending && pending.date === day) {
      if (draft) return C.fail('DRAFT_EXISTS', '已有未完成的训练，继续还是放弃？', { data: draft });
      const detail = { workoutId: pending.id, exercises: [], sets: [] };
      writePlan(detail, pending, plan);
      const h = commit(pending, detail);
      pending = null;
      return C.ok({ mode: 'append', workoutId: h.id, added: plan.length });
    }
    const doneToday = workoutsOn(day);
    if (doneToday.length) {
      const target = doneToday[doneToday.length - 1];
      const r = appendPlan(target.id, plan);
      if (!r.ok) return r;
      return C.ok({ mode: 'append', workoutId: target.id, added: plan.length });
    }
    const blocker = draft || (pending ? Object.assign({ persisted: false }, pending) : null);
    if (blocker) return C.fail('DRAFT_EXISTS', '已有未完成的训练，继续还是放弃？', { data: blocker });
    const t = C.now();
    const h = {
      id: newId('w_', t), status: 'draft', date: day, name: repeatName(header), note: '',
      startedAt: day === C.today() ? t : null, completedAt: null, createdAt: t, updatedAt: t,
      exerciseCount: 0, setCount: 0, volumeKg: 0,
    };
    const detail = { workoutId: h.id, exercises: [], sets: [] };
    writePlan(detail, h, plan);
    pending = null;
    commit(h, detail);
    return C.ok({ mode: 'create', workoutId: h.id, added: plan.length });
  });
}

// Launch self-heal: recompute derived header fields from details (detail is authoritative, DATA_MODEL §4.4).
function healHeaders() {
  const list = headers();
  if (S.getHealth().corruptKeys.includes(K.WORKOUTS) || S.getHealth().unreadableKeys.includes(K.WORKOUTS)) return false;
  let changed = false;
  const next = list.map(h => {
    const st = loadDetail(h.id);
    if (st.missing || st.blocked) return h; // missing or damaged detail: do not invent or rewrite it
    const sum = M.computeSummary(st.detail);
    const haveTime = typeof h.timeSec === 'number' ? h.timeSec : 0;
    // A reps-only record with no timeSec is already correct (0). Don't rewrite it just to add the field.
    if (sum.exerciseCount !== h.exerciseCount || sum.setCount !== h.setCount || sum.volumeKg !== h.volumeKg || haveTime !== sum.timeSec) { changed = true; return Object.assign({}, h, sum); }
    return h;
  });
  if (changed) S.set(K.WORKOUTS, next);
  return changed;
}
module.exports = { healHeaders, getPending, discardPending, daySummaries, personalBest, completionCheck, finalizeWorkout, addExercises, addToCurrentDraft, replaceExercise, restoreExercise, restoreSet, duplicateSet,
  getDraft, getHeader, getWorkout, listWorkouts, workoutsOn, completedDates, referencedExerciseIds,
  createDraft, updateWorkout, completeWorkout, deleteWorkout, discardDraft, repeatFrom,
  addExercise, removeExercise, reorderExercises, moveExercise, updateExerciseNote, setExerciseMode,
  addSet, updateSet, setSetDone, deleteSet, _headers: headers };
