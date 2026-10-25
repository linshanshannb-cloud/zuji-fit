// Pure migrations. migrate_0_to_1(v0, now) -> { workouts, details: {id: detail}, body, meta }
const { newId } = require('./ids');
const { computeSummary } = require('./model');
const V = require('./validate');
const D = require('../date');

function setWeight(w) { const r = V.validateSetWeight(w); return r.ok ? r.value : null; }
function setReps(x) { const r = V.validateReps(x); return r.ok ? r.value : null; } // >999 / non-integer / negative -> null
const extraCm = v => V.normalizeWaist(v); // 0<x<=300, 1dp, else null

function migrate_0_to_1(v0, now) {
  const oldW = Array.isArray(v0.workouts) ? v0.workouts : [];
  const oldB = Array.isArray(v0.body) ? v0.body : [];
  const workouts = [], details = {};
  oldW.forEach((w, wi) => {
    if (!w || !D.isValid(String(w.date || ''))) return; // unusable without a date
    const id = w.id ? String(w.id) : newId('w_', now);
    const exercises = [], sets = [];
    (w.exercises || []).forEach((e, i) => {
      const we = { id: newId('we_', now), workoutId: id, exerciseId: String(e.exerciseId == null ? '' : e.exerciseId), order: i, note: '', nameSnapshot: String(e.name || '') };
      exercises.push(we);
      (e.sets || []).forEach((s, j) => sets.push({ id: newId('s_', now), workoutExerciseId: we.id, index: j + 1,
        weightKg: setWeight(s.weight), reps: setReps(s.reps), type: 'normal', done: setReps(s.reps) >= 1, doneAt: null })); // DATA_MODEL §9.2: done = reps >= 1 (null/0 reps -> not done)
    });
    const detail = { workoutId: id, exercises, sets };
    details[id] = detail;
    workouts.push(Object.assign({ id, status: 'completed', date: w.date, name: '', note: String(w.note || '').trim(),
      startedAt: null, completedAt: now, createdAt: now + wi /* keep v0 order stable within a day */, updatedAt: now }, computeSummary(detail)));
  });
  workouts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
  const byDate = {};
  oldB.forEach(r => {
    if (!r || !D.isValid(String(r.date || ''))) return;
    const extra = {};
    [['chest', 'chestCm'], ['hip', 'hipCm'], ['arm', 'armCm']].forEach(([a, b]) => { const v = extraCm(r[a]); if (v !== null) extra[b] = v; });
    const rec = { id: r.id ? String(r.id) : newId('b_', now), date: r.date,
      weightKg: V.normalizeBodyWeight(r.weight), bodyFatPct: V.normalizeBodyFat(r.bodyFat), waistCm: V.normalizeWaist(r.waist),
      note: '', extra: Object.keys(extra).length ? extra : null, createdAt: now, updatedAt: now };
    // Keep records even if all 3 metrics are null but extra has data (don't lose history); drop fully empty ones.
    if (rec.weightKg == null && rec.bodyFatPct == null && rec.waistCm == null && !rec.extra) return;
    byDate[r.date] = rec; // v0 was already one-per-date; last wins defensively
  });
  const body = Object.keys(byDate).sort().map(k => byDate[k]);
  return { workouts, details, body, meta: { schemaVersion: 1, createdAt: now, migratedAt: now, migratedFrom: 0 } };
}
// Registry for future versions: MIGRATIONS[v] migrates v -> v+1 (operating on a full snapshot).
const MIGRATIONS = {};
module.exports = { migrate_0_to_1, MIGRATIONS };
