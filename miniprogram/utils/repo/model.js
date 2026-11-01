// Pure entity helpers (no storage).
const { round1 } = require('./validate');
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isCountable = s => isObj(s) && s.done === true && s.type === 'normal';
const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
// Missing / unknown mode is reps. Old records have no mode field and are never migrated.
function modeOf(ex) { return ex && ex.mode === 'time' ? 'time' : 'reps'; }
function computeSummary(detail) {
  const exercises = (detail && Array.isArray(detail.exercises) ? detail.exercises : []).filter(isObj);
  const setsAll = (detail && Array.isArray(detail.sets) ? detail.sets : []).filter(isObj);
  const ids = {}; const modeBy = {};
  exercises.forEach(e => { if (e.id) { ids[e.id] = true; modeBy[e.id] = modeOf(e); } });
  const sets = setsAll.filter(s => ids[s.workoutExerciseId] && isCountable(s)); // orphan / damaged sets are not shown, so not counted
  const repsSets = sets.filter(s => modeBy[s.workoutExerciseId] !== 'time');
  const timeSets = sets.filter(s => modeBy[s.workoutExerciseId] === 'time');
  return { exerciseCount: exercises.length, setCount: sets.length,
    volumeKg: round1(repsSets.reduce((t, s) => t + (typeof s.weightKg === 'number' ? s.weightKg : 0) * (typeof s.reps === 'number' ? s.reps : 0), 0)),
    timeSec: timeSets.reduce((t, s) => t + (typeof s.durationSec === 'number' && s.durationSec > 0 ? s.durationSec : 0), 0) };
}
const byOrder = (a, b) => num(a && a.order) - num(b && b.order);
const byIndex = (a, b) => num(a && a.index) - num(b && b.index);
const sortWorkouts = list => (Array.isArray(list) ? list : []).filter(isObj).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
function renumberExercises(exs) { return (exs || []).filter(isObj).slice().sort(byOrder).map((e, i) => Object.assign({}, e, { order: i })); }
function renumberSets(sets, weId) {
  let i = 0;
  const list = (sets || []).filter(isObj);
  const mine = list.filter(s => s.workoutExerciseId === weId).sort(byIndex).map(s => Object.assign({}, s, { index: ++i }));
  return list.filter(s => s.workoutExerciseId !== weId).concat(mine);
}
// Assemble a view: exercises sorted with nested sets (copies; storage stays flat). Null elements are skipped, never thrown on.
function assemble(header, detail, resolveExercise) {
  const exercisesIn = detail && Array.isArray(detail.exercises) ? detail.exercises : [];
  const setsIn = detail && Array.isArray(detail.sets) ? detail.sets : [];
  const exercises = exercisesIn.filter(isObj).slice().sort(byOrder).map(we => {
    const ex = resolveExercise ? resolveExercise(we.exerciseId) : null;
    return Object.assign({}, we, { displayName: (ex && !ex.unknown && ex.nameZh) || we.nameSnapshot || '未知动作', exercise: ex,
      sets: setsIn.filter(s => isObj(s) && s.workoutExerciseId === we.id).sort(byIndex) });
  });
  return Object.assign({}, header, { exercises });
}
function defaultWorkoutName(date) { const [, m, d] = String(date || '').split('-').map(Number); return `${m}月${d}日训练`; }

// Structural checks for records already inside an array/object of the right outer shape.
// A failing record is identified and left out of the clean view; callers must not write the clean view back over the raw key.
function issue(kind, path, raw) { return { kind, path, raw }; }
// Absent / blank id is missing_id. A present value of the wrong type is a type error (the raw value is kept on the issue).
function idIssue(value, path) {
  if (typeof value === 'string' && value) return null;
  if (value === undefined || value === null || value === '') return issue('missing_id', path, value);
  return issue('type', path, value);
}
function inspectHeader(h, path) {
  if (!isObj(h)) return { ok: false, issues: [issue('empty', path, h)] };
  const issues = [];
  const id = idIssue(h.id, path + '.id'); if (id) issues.push(id);
  if ('status' in h && h.status !== 'draft' && h.status !== 'completed') issues.push(issue('type', path + '.status', h.status));
  if ('date' in h && typeof h.date !== 'string') issues.push(issue('type', path + '.date', h.date));
  if ('name' in h && typeof h.name !== 'string') issues.push(issue('type', path + '.name', h.name));
  if ('note' in h && typeof h.note !== 'string') issues.push(issue('type', path + '.note', h.note));
  ['exerciseCount', 'setCount', 'volumeKg', 'timeSec', 'createdAt', 'updatedAt'].forEach(k => {
    if (k in h && typeof h[k] !== 'number') issues.push(issue('type', path + '.' + k, h[k]));
  });
  ['startedAt', 'completedAt'].forEach(k => {
    if (k in h && h[k] !== null && typeof h[k] !== 'number') issues.push(issue('type', path + '.' + k, h[k]));
  });
  return { ok: issues.length === 0, issues };
}
function inspectExercise(e, path) {
  if (!isObj(e)) return { ok: false, issues: [issue('empty', path, e)] };
  const issues = [];
  const id = idIssue(e.id, path + '.id'); if (id) issues.push(id);
  if (typeof e.exerciseId !== 'string') issues.push(issue('type', path + '.exerciseId', e.exerciseId));
  if ('order' in e && typeof e.order !== 'number') issues.push(issue('type', path + '.order', e.order));
  if ('note' in e && typeof e.note !== 'string') issues.push(issue('type', path + '.note', e.note));
  if ('nameSnapshot' in e && typeof e.nameSnapshot !== 'string') issues.push(issue('type', path + '.nameSnapshot', e.nameSnapshot));
  if ('workoutId' in e && typeof e.workoutId !== 'string') issues.push(issue('type', path + '.workoutId', e.workoutId));
  if ('mode' in e && e.mode !== 'reps' && e.mode !== 'time') issues.push(issue('type', path + '.mode', e.mode));
  return { ok: issues.length === 0, issues };
}
function inspectSet(s, path, exerciseIds) {
  if (!isObj(s)) return { ok: false, issues: [issue('empty', path, s)] };
  const issues = [];
  const id = idIssue(s.id, path + '.id'); if (id) issues.push(id);
  const parent = idIssue(s.workoutExerciseId, path + '.workoutExerciseId');
  if (parent) issues.push(parent);
  else if (exerciseIds && !exerciseIds[s.workoutExerciseId]) issues.push(issue('orphan', path, s.workoutExerciseId));
  if ('index' in s && typeof s.index !== 'number') issues.push(issue('type', path + '.index', s.index));
  if ('weightKg' in s && s.weightKg !== null && typeof s.weightKg !== 'number') issues.push(issue('type', path + '.weightKg', s.weightKg));
  if ('reps' in s && s.reps !== null && typeof s.reps !== 'number') issues.push(issue('type', path + '.reps', s.reps));
  if ('durationSec' in s && s.durationSec !== null && typeof s.durationSec !== 'number') issues.push(issue('type', path + '.durationSec', s.durationSec));
  if ('type' in s && s.type !== 'normal' && s.type !== 'warmup') issues.push(issue('type', path + '.type', s.type));
  if ('done' in s && typeof s.done !== 'boolean') issues.push(issue('type', path + '.done', s.done));
  if ('doneAt' in s && s.doneAt !== null && typeof s.doneAt !== 'number') issues.push(issue('type', path + '.doneAt', s.doneAt));
  return { ok: issues.length === 0, issues };
}
function splitRecords(list, inspect, prefix) {
  const good = [], issues = [];
  (Array.isArray(list) ? list : []).forEach((item, i) => {
    const r = inspect(item, prefix + '[' + i + ']');
    if (r.ok) good.push(item); else issues.push.apply(issues, r.issues);
  });
  return { list: good, issues };
}
function inspectDetail(detail) {
  const issues = [];
  const exercises = [];
  const exIds = {};
  const exIn = detail && Array.isArray(detail.exercises) ? detail.exercises : [];
  const setIn = detail && Array.isArray(detail.sets) ? detail.sets : [];
  exIn.forEach((e, i) => {
    const r = inspectExercise(e, 'exercises[' + i + ']');
    if (r.ok) { exercises.push(e); exIds[e.id] = true; }
    else issues.push.apply(issues, r.issues);
  });
  const sets = [];
  setIn.forEach((s, i) => {
    const r = inspectSet(s, 'sets[' + i + ']', exIds);
    if (r.ok) sets.push(s);
    else issues.push.apply(issues, r.issues);
  });
  return { ok: issues.length === 0, issues, exercises, sets };
}
module.exports = { isCountable, modeOf, computeSummary, byOrder, byIndex, sortWorkouts, renumberExercises, renumberSets, assemble, defaultWorkoutName,
  isObj, inspectHeader, inspectExercise, inspectSet, splitRecords, inspectDetail };
