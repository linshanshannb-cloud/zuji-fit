// Page-level checks for unsaved edits, replace cancel, and missing/corrupt detail UI.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let mem, failSet, toasts, modals, modalAnswer, stack, lastDef;

function installWx() {
  global.setTimeout = fn => { fn(); return 1; };
  global.clearTimeout = () => {};
  global.setInterval = () => 1;
  global.clearInterval = () => {};
  global.wx = {
    getStorageSync: k => (k in mem ? JSON.parse(mem[k]) : ''),
    setStorageSync: (k, v) => {
      if (failSet) { const e = failSet(k, v); if (e) throw (e === true ? new Error('setStorageSync:fail exceed storage max size') : e); }
      mem[k] = JSON.stringify(v);
    },
    removeStorageSync: k => { delete mem[k]; },
    getStorageInfoSync: () => ({ keys: Object.keys(mem) }),
    showToast: o => toasts.push(o.title),
    showModal: o => {
      ['confirmText', 'cancelText'].forEach(k => { if (o[k] && [...o[k]].length > 4) throw new Error('modal button > 4 chars: ' + o[k]); });
      modals.push(o);
      const a = modalAnswer || { confirm: true, cancel: false };
      modalAnswer = null;
      if (o.success) o.success(Object.assign({ confirm: false, cancel: false }, a));
    },
    showActionSheet: () => { throw new Error('unexpected action sheet'); },
    vibrateShort() {},
    navigateTo(o) { return open(o.url); },
    redirectTo(o) { close(); return open(o.url); },
    navigateBack() { close(); const top = stack[stack.length - 1]; if (top && top.onShow) top.onShow(); },
    getWindowInfo: () => ({ windowWidth: 375, statusBarHeight: 20 }),
    getSystemInfoSync: () => ({ windowWidth: 375, statusBarHeight: 20 }),
    getMenuButtonBoundingClientRect: () => ({ left: 280, top: 24, height: 32 }),
  };
  global.getCurrentPages = () => stack;
  global.Page = def => { lastDef = def; };
  global.Component = def => { lastDef = def; };
  global.App = def => { global.__app = def; def.onLaunch.call(def); };
  global.getApp = () => global.__app;
}
function setPath(obj, p, v) {
  const parts = String(p).replace(/\[(\d+)\]/g, '.$1').split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    o[parts[i]] = Array.isArray(o[parts[i]]) ? o[parts[i]].slice() : Object.assign({}, o[parts[i]]);
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = v;
}
function clearMp() {
  Object.keys(require.cache).forEach(k => { if (k.startsWith(ROOT) && !k.includes(`${path.sep}tests${path.sep}`)) delete require.cache[k]; });
}
function boot() {
  mem = {}; failSet = null; toasts = []; modals = []; modalAnswer = null; stack = [];
  clearMp();
  installWx();
  require(path.join(ROOT, 'app.js'));
  require(path.join(ROOT, 'utils/ui'))._resetFails();
  require(path.join(ROOT, 'utils/edit-buffer')).resetAll();
  return require(path.join(ROOT, 'utils/repo'));
}
function instantiate(route) {
  const file = path.join(ROOT, route + '.js');
  delete require.cache[require.resolve(file)];
  require(file);
  const inst = Object.create(lastDef);
  inst.route = route;
  inst.data = JSON.parse(JSON.stringify(lastDef.data || {}));
  inst.setData = function (d) { Object.keys(d).forEach(k => setPath(this.data, k, d[k])); };
  inst.selectComponent = () => ({ show() {}, start() {}, hide() {} });
  return inst;
}
function open(url) {
  const [route, qs] = url.replace(/^\//, '').split('?');
  const query = {};
  (qs || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); query[k] = decodeURIComponent(v || ''); });
  const p = instantiate(route);
  stack.push(p);
  if (p.onLoad) p.onLoad(query);
  if (p.onShow) p.onShow();
  return p;
}
function close() { const p = stack.pop(); if (p && p.onUnload) p.onUnload(); }
const store = k => (k in mem ? JSON.parse(mem[k]) : undefined);
const ev = (dataset, detail) => ({ currentTarget: { dataset }, detail: detail || {} });
function draft(repo) {
  const r = repo.workouts.createDraft({ exerciseIds: ['0025'] });
  const v = repo.workouts.getWorkout(r.data.id);
  return { id: r.data.id, we: v.exercises[0].id, set: v.exercises[0].sets[0].id };
}

test('A failed weight survives reps, add-set, leave and return; retry writes all of it', () => {
  const repo = boot();
  const d = draft(repo);
  const ed = open('/pages/workout-edit/workout-edit?id=' + d.id);
  failSet = () => new Error('setStorageSync:fail write');
  ed.onSetChange(ev({ s: d.set, we: d.we }, { field: 'weightKg', value: 50 }));
  failSet = null;
  assert.strictEqual(ed.data.saveState, 'failed');
  assert.strictEqual(ed.data.canRetry, true);
  assert.strictEqual(ed.data.cards[0].sets[0].weightKg, 50);
  assert.ok(toasts.includes('保存失败，请重试'));
  assert.ok(!toasts.some(t => /空间|缓存/.test(t)));
  ed.onSetChange(ev({ s: d.set, we: d.we }, { field: 'reps', value: 8 }));
  ed.addSet(ev({ we: d.we }));
  assert.strictEqual(ed.data.saveState, 'failed', 'a later success must not show 已自动保存');
  assert.strictEqual(ed.data.cards[0].sets[0].weightKg, 50);
  assert.strictEqual(ed.data.cards[0].sets[0].reps, 8);
  assert.strictEqual(ed.data.cards[0].sets.length, 2);
  const storedSet = () => store('fit_workout_' + d.id).sets.find(s => s.id === d.set);
  assert.strictEqual(storedSet().weightKg, null);
  assert.strictEqual(storedSet().reps, 8);
  assert.strictEqual(store('fit_workout_' + d.id).sets.length, 2);
  modalAnswer = { confirm: false, cancel: true };
  ed.complete();
  assert.ok(modals.some(m => m.title === '还有未保存的修改' && /没写入/.test(m.content)));
  assert.strictEqual(repo.workouts.getHeader(d.id).status, 'draft');
  assert.strictEqual(storedSet().weightKg, null);
  modalAnswer = { confirm: false, cancel: true };
  ed.onClose();
  assert.strictEqual(stack.length, 0);
  const back = open('/pages/workout-edit/workout-edit?id=' + d.id);
  assert.strictEqual(back.data.cards[0].sets[0].weightKg, 50);
  assert.strictEqual(back.data.cards[0].sets[0].reps, 8);
  assert.strictEqual(back.data.cards[0].sets.length, 2);
  assert.strictEqual(back.data.saveState, 'failed');
  back.retry();
  assert.strictEqual(back.data.saveState, 'saved');
  assert.strictEqual(storedSet().weightKg, 50);
  assert.strictEqual(storedSet().reps, 8);
  assert.strictEqual(store('fit_workout_' + d.id).sets.length, 2);
});

test('A two failed fields and a failed add-set all retry; failure UI keeps the typed values', () => {
  const repo = boot();
  const d = draft(repo);
  const ed = open('/pages/workout-edit/workout-edit?id=' + d.id);
  failSet = () => new Error('setStorageSync:fail write');
  ed.onSetChange(ev({ s: d.set, we: d.we }, { field: 'weightKg', value: 40 }));
  ed.onSetChange(ev({ s: d.set, we: d.we }, { field: 'reps', value: 6 }));
  ed.addSet(ev({ we: d.we }));
  assert.strictEqual(ed.data.cards[0].sets[0].weightKg, 40);
  assert.strictEqual(ed.data.cards[0].sets[0].reps, 6);
  assert.strictEqual(ed.data.cards[0].sets.length, 2);
  assert.strictEqual(store('fit_workout_' + d.id).sets.length, 1);
  assert.ok(modals.some(m => m.content && !/空间|缓存|清理/.test(m.content)));
  const snap = JSON.stringify(ed.data.cards[0].sets.map(s => [s.weightKg, s.reps]));
  failSet = null;
  ed.retry();
  assert.strictEqual(ed.data.saveState, 'saved');
  const sets = store('fit_workout_' + d.id).sets;
  assert.strictEqual(sets.length, 2);
  const first = sets.find(s => s.id === d.set);
  assert.strictEqual(first.weightKg, 40);
  assert.strictEqual(first.reps, 6);
  assert.notStrictEqual(snap, '');
  void repo;
});

test('E quota modal names storage space and does not clear the unsaved input', () => {
  boot();
  const d = draft(require(path.join(ROOT, 'utils/repo')));
  const ed = open('/pages/workout-edit/workout-edit?id=' + d.id);
  failSet = () => true;
  ed.onSetChange(ev({ s: d.set, we: d.we }, { field: 'weightKg', value: 70 }));
  ed.onSetChange(ev({ s: d.set, we: d.we }, { field: 'reps', value: 9 }));
  assert.ok(toasts.some(t => t.includes('存储空间不足')));
  assert.ok(modals.some(m => /手机存储空间不足/.test(m.content) && /清理微信缓存/.test(m.content)));
  assert.strictEqual(ed.data.cards[0].sets[0].weightKg, 70);
  assert.strictEqual(ed.data.cards[0].sets[0].reps, 9);
  assert.strictEqual(store('fit_workout_' + d.id).sets[0].weightKg, null);
  assert.strictEqual(ed.data.saveState, 'failed');
});

test('D cancel replace changes nothing; confirm clears scores but keeps the set row', () => {
  const repo = boot();
  const d = draft(repo);
  repo.workouts.updateSet(d.id, d.set, { weightKg: 60, reps: 8 });
  repo.workouts.setSetDone(d.id, d.set, true);
  repo.workouts.updateSet(d.id, d.set, { type: 'warmup' });
  const ed = open('/pages/workout-edit/workout-edit?id=' + d.id);
  const n = modals.length;
  ed.onPicked(['0025'], 'replace', d.we);
  assert.strictEqual(modals.length, n, 'replacing with the same exercise does not ask or clear');
  assert.strictEqual(store('fit_workout_' + d.id).sets[0].weightKg, 60);
  assert.strictEqual(store('fit_workout_' + d.id).sets[0].done, true);
  const before = JSON.stringify(store('fit_workout_' + d.id));
  modalAnswer = { confirm: false, cancel: true };
  ed.onPicked(['0294'], 'replace', d.we);
  assert.ok(modals.some(m => m.title === '替换这个动作？'));
  assert.strictEqual(JSON.stringify(store('fit_workout_' + d.id)), before, 'cancel must not write');
  modalAnswer = { confirm: true, cancel: false };
  ed.onPicked(['0294'], 'replace', d.we);
  const detail = store('fit_workout_' + d.id);
  assert.strictEqual(detail.exercises[0].exerciseId, '0294');
  assert.strictEqual(detail.sets.length, 1);
  assert.strictEqual(detail.sets[0].type, 'warmup');
  assert.strictEqual(detail.sets[0].weightKg, null);
  assert.strictEqual(detail.sets[0].reps, null);
  assert.strictEqual(detail.sets[0].done, false);
});

test('C detail page and editor stay read-only until the detail key is restored', () => {
  const repo = boot();
  const d = draft(repo);
  repo.workouts.updateSet(d.id, d.set, { weightKg: 45, reps: 5 });
  const key = 'fit_workout_' + d.id;
  const detail = store(key);
  const header = JSON.stringify(store('fit_workouts'));
  delete mem[key];
  const page = open('/pages/workout-detail/workout-detail?id=' + d.id);
  assert.strictEqual(page.data.detailMissing, true);
  assert.strictEqual(page.data.w.exercises.length, 0);
  assert.strictEqual(page.data.w.stats[0].v, 1);
  page.edit();
  assert.ok(toasts.some(t => t.includes('只能查看')));
  assert.strictEqual(stack.length, 1);
  assert.strictEqual(JSON.stringify(store('fit_workouts')), header);
  const ed = open('/pages/workout-edit/workout-edit?id=' + d.id);
  assert.strictEqual(ed.data.readOnly, true);
  assert.strictEqual(ed.data.detailMissing, true);
  ed.addTap();
  ed.onSetChange(ev({ s: 'missing', we: 'missing' }, { field: 'weightKg', value: 1 }));
  assert.strictEqual(mem[key], undefined);
  assert.strictEqual(JSON.stringify(store('fit_workouts')), header);
  mem[key] = JSON.stringify(detail);
  ed.reload();
  assert.strictEqual(ed.data.detailMissing, false);
  assert.strictEqual(ed.data.readOnly, false);
  assert.strictEqual(ed.data.cards[0].sets[0].weightKg, 45);
  page.load();
  assert.strictEqual(page.data.detailMissing, false);
  assert.strictEqual(page.data.w.exercises.length, 1);
  assert.strictEqual(page.data.w.exercises[0].sets[0].w, '45');
});
