// QA harness: fake wx storage (JSON-serialised like the real one) + "reload" = clear require cache, re-require with SAME storage.
// Only reads business code; never modifies it.
const path = require('path');
const MP = path.resolve(__dirname, '../../miniprogram');
const store = { mem: {}, failSet: null, failGet: null, failRemove: null, sets: [] };
function installWx() {
  global.wx = {
    getStorageSync: k => { if (store.failGet) { const e = store.failGet(k); if (e) throw e; } return k in store.mem ? JSON.parse(store.mem[k]) : ''; },
    setStorageSync: (k, v) => {
      if (store.failSet) { const e = store.failSet(k, v); if (e) throw (e === true ? new Error('setStorageSync:fail exceed storage max size') : e); }
      store.sets.push(k); store.mem[k] = JSON.stringify(v);
    },
    removeStorageSync: k => { if (store.failRemove) { const e = store.failRemove(k); if (e) throw e; } delete store.mem[k]; },
    getStorageInfoSync: () => ({ keys: Object.keys(store.mem) }),
    showToast() {}, showModal() {}, vibrateShort() {},
  };
}
function clearCache() { Object.keys(require.cache).forEach(k => { if (k.startsWith(MP)) delete require.cache[k]; }); }
// Local-time clock helper: start at y-m-d h:mi local, advance 1s per call.
let t = 0;
function setNow(y, m, d, h = 10, mi = 0) { t = new Date(y, m - 1, d, h, mi, 0).getTime(); }
// (Re)load the app modules against the current storage, like a cold start. Returns {repo, status}.
function boot({ init = true } = {}) {
  installWx(); clearCache();
  const repo = require(path.join(MP, 'utils/repo'));
  repo._setClock(() => (t += 1000));
  const status = init ? repo.init() : null;
  return { repo, status, S: require(path.join(MP, 'utils/storage')), D: require(path.join(MP, 'utils/date')) };
}
function fresh(seed = {}, at = [2026, 10, 17, 10, 0]) {
  store.mem = {}; store.failSet = null; store.failGet = null; store.failRemove = null; store.sets = [];
  Object.keys(seed).forEach(k => { store.mem[k] = JSON.stringify(seed[k]); });
  setNow(...at);
  return boot();
}
const snapshot = () => JSON.parse(JSON.stringify(store.mem));
const raw = k => (k in store.mem ? JSON.parse(store.mem[k]) : undefined);
// Invariant checker for one workout (order 0..n-1, index 1..k per exercise, FK integrity, header summary == recomputed).
function checkWorkout(id) {
  const errs = [];
  const h = (raw('fit_workouts') || []).find(w => w.id === id);
  const d = raw('fit_workout_' + id);
  if (!h) return ['header missing'];
  if (!d) return ['detail missing'];
  const orders = d.exercises.map(e => e.order).sort((a, b) => a - b);
  orders.forEach((o, i) => { if (o !== i) errs.push('order not 0..n-1: ' + orders); });
  const weIds = new Set(d.exercises.map(e => e.id));
  d.exercises.forEach(e => { if (e.workoutId !== id) errs.push('we.workoutId mismatch'); });
  d.sets.forEach(s => { if (!weIds.has(s.workoutExerciseId)) errs.push('dangling set ' + s.id); });
  d.exercises.forEach(e => {
    const idx = d.sets.filter(s => s.workoutExerciseId === e.id).map(s => s.index).sort((a, b) => a - b);
    idx.forEach((v, i) => { if (v !== i + 1) errs.push('index not contiguous for ' + e.id + ': ' + idx); });
  });
  const cnt = d.sets.filter(s => s.done === true && s.type === 'normal');
  const vol = Math.round(cnt.reduce((a, s) => a + (s.weightKg || 0) * s.reps, 0) * 10) / 10;
  if (h.exerciseCount !== d.exercises.length) errs.push(`exerciseCount ${h.exerciseCount} != ${d.exercises.length}`);
  if (h.setCount !== cnt.length) errs.push(`setCount ${h.setCount} != ${cnt.length}`);
  if (h.volumeKg !== vol) errs.push(`volumeKg ${h.volumeKg} != ${vol}`);
  d.sets.forEach(s => { if (s.done && !(s.reps >= 1)) errs.push('done set with reps<1'); if (!s.done && s.doneAt !== null) errs.push('undone set has doneAt'); });
  if (h.status === 'completed' && !h.completedAt) errs.push('completed without completedAt');
  if (h.status === 'draft' && h.completedAt !== null) errs.push('draft with completedAt');
  return errs;
}
// Seeded RNG
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
module.exports = { MP, store, fresh, boot, setNow, snapshot, raw, checkWorkout, rng, installWx, clearCache };
