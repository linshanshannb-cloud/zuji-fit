#!/usr/bin/env node
// Page-level smoke test with a fake wx runtime (NOT a renderer: no layout, no canvas pixels, no real component tree).
// It loads real page modules, drives handlers like taps would, and checks storage + navigation per acceptance flow.
// Also statically checks that every handler named in each .wxml exists on its Page/Component.
// Run from miniprogram/: node scripts/smoke-pages.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
// ---------- fake runtime
let mem = {}, failWrites = 0, failNth = 0, writeNo = 0, timers = [], toasts = [], modals = [], modalAnswers = [], sheetAnswers = [], stack = [], log = [];
const today = (() => { const d = new Date(); const p = n => (n < 10 ? '0' : '') + n; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); })();
global.setTimeout = (fn) => { timers.push(fn); return timers.length; };
global.clearTimeout = () => {};
global.setInterval = () => 1; global.clearInterval = () => {};
function tick() { while (timers.length) timers.shift()(); }
global.wx = {
  getStorageSync: k => (k in mem ? JSON.parse(mem[k]) : ''),
  setStorageSync: (k, v) => { if (failNth && ++writeNo === failNth) { writeNo = 0; throw new Error('setStorageSync:fail write'); } if (failWrites > 0) { failWrites--; throw new Error('setStorageSync:fail exceed storage max size'); } mem[k] = JSON.stringify(v); },
  removeStorageSync: k => { delete mem[k]; },
  getStorageInfoSync: () => ({ keys: Object.keys(mem) }),
  showToast: o => toasts.push(o.title), showLoading() {}, hideLoading() {}, vibrateShort() {},
  showModal: o => { ['confirmText', 'cancelText'].forEach(k => { if (o[k] && [...o[k]].length > 4) throw new Error(`showModal ${k} > 4 chars: ${o[k]}`); }); modals.push(o.title + (o.content ? '|' + o.content : '')); const a = modalAnswers.length ? modalAnswers.shift() : { confirm: true }; o.success && o.success(Object.assign({ confirm: false, cancel: false }, a)); },
  showActionSheet: o => { if (o.itemList.length > 6) throw new Error('showActionSheet > 6 items'); const i = sheetAnswers.shift(); if (i === undefined) throw new Error('unexpected action sheet: ' + o.itemList); o.success && o.success({ tapIndex: o.itemList.indexOf(i) >= 0 ? o.itemList.indexOf(i) : i }); },
  navigateTo: o => open(o.url, o.events), redirectTo: o => { close(); open(o.url); }, switchTab: o => { while (stack.length > 1) close(); open(o.url); },
  navigateBack: () => { close(); const top = cur(); if (top && top.onShow) top.onShow(); },
  createSelectorQuery: () => ({ in() { return this; }, select() { return this; }, fields() { return this; }, exec(cb) { cb([null]); } }),
  getWindowInfo: () => ({ statusBarHeight: 20, windowWidth: 375, pixelRatio: 2 }), getSystemInfoSync: () => ({ statusBarHeight: 20, windowWidth: 375, pixelRatio: 2 }),
  getMenuButtonBoundingClientRect: () => ({ top: 24, height: 32, left: 280 }),
};
global.getCurrentPages = () => stack;
let lastDef = null;
global.Page = def => { lastDef = def; };
global.Component = def => { lastDef = def; };
global.App = def => { global.__app = def; def.onLaunch.call(def); };
global.getApp = () => global.__app;
function setPath(obj, p, v) { const parts = p.replace(/\[(\d+)\]/g, '.$1').split('.'); let o = obj; for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = Array.isArray(o[parts[i]]) ? o[parts[i]].slice() : Object.assign({}, o[parts[i]]); o = o[parts[i]]; } o[parts[parts.length - 1]] = v; }
function instantiate(route, query, events) {
  const file = path.join(ROOT, route + '.js'); delete require.cache[require.resolve(file)]; require(file);
  const def = lastDef, inst = Object.create(def);
  inst.route = route; inst.data = JSON.parse(JSON.stringify(def.data || {}));
  inst.setData = function (d, cb) { Object.keys(d).forEach(k => setPath(this.data, k, d[k])); cb && cb(); };
  const undo = { shown: null, show(text, payload) { this.shown = { text, payload }; }, hide() { this.shown = null; } };
  inst.selectComponent = () => undo; inst._undo = undo;
  const listeners = events || {};
  inst.getOpenerEventChannel = () => ({ emit: (n, ...a) => listeners[n] && listeners[n](...a) });
  return inst;
}
function open(url, events) {
  const [route, qs] = url.replace(/^\//, '').split('?'); const query = {};
  (qs || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); query[k] = decodeURIComponent(v); });
  const p = instantiate(route, query, events); stack.push(p); log.push('open ' + route);
  p.onLoad && p.onLoad(query); p.onShow && p.onShow(); return p;
}
function close() { const p = stack.pop(); if (p) { p.onUnload && p.onUnload(); log.push('close ' + p.route); } }
const cur = () => stack[stack.length - 1];
const ev = (dataset = {}, detail = {}) => ({ currentTarget: { dataset }, detail });
const repo = () => require(path.join(ROOT, 'utils/repo'));
// Minimal component instance: data + methods, attached() run (no rendering).
function comp(name) {
  const file = path.join(ROOT, 'components', name, name + '.js'); require(file); const def = lastDef;
  const inst = Object.assign({ data: JSON.parse(JSON.stringify(def.data || {})) }, def.methods || {});
  inst.setData = function (d) { Object.keys(d).forEach(k => setPath(this.data, k, d[k])); };
  inst.triggerEvent = () => {};
  def.lifetimes && def.lifetimes.attached && def.lifetimes.attached.call(inst); return inst;
}
const store = k => (k in mem ? JSON.parse(mem[k]) : undefined);
function reset(seed = {}) {
  mem = {}; Object.keys(seed).forEach(k => { mem[k] = JSON.stringify(seed[k]); });
  timers = []; toasts = []; modals = []; modalAnswers = []; sheetAnswers = []; stack = []; log = []; failWrites = 0; failNth = 0; writeNo = 0;
  Object.keys(require.cache).forEach(k => { if (k.startsWith(ROOT)) delete require.cache[k]; });
  require(path.join(ROOT, 'app.js'));
}
const results = [];
function flow(name, fn) { try { fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.stack.split('\n').filter(l => l.includes('smoke-pages')||l.includes('Error')).slice(0, 3).join(' | ')]); } }
const draftHeader = () => (store('fit_workouts') || []).find(w => w.status === 'draft');

// ---------- static check: handlers referenced in wxml exist
function staticHandlers() {
  const bad = [];
  const files = [];
  (function walk(d) { fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.wxml')) files.push(p); }); })(path.join(ROOT, 'pages'));
  (function walk(d) { fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.wxml')) files.push(p); }); })(path.join(ROOT, 'components'));
  reset();
  files.forEach(f => {
    const src = fs.readFileSync(f, 'utf8'); const js = f.replace(/\.wxml$/, '.js');
    delete require.cache[require.resolve(js)]; require(js); const def = lastDef;
    const methods = Object.assign({}, def, def.methods || {});
    for (const m of src.matchAll(/(?:bind|catch)(?::)?[a-z]+="([A-Za-z_]+)"/g)) if (typeof methods[m[1]] !== 'function') bad.push(path.relative(ROOT, f) + ': ' + m[1]);
    const comps = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).usingComponents;
    const local = fs.existsSync(f.replace(/\.wxml$/, '.json')) ? (JSON.parse(fs.readFileSync(f.replace(/\.wxml$/, '.json'), 'utf8')).usingComponents || {}) : {};
    for (const m of src.matchAll(/<([a-z]+-[a-z-]+|btn|card)[\s>]/g)) if (!comps[m[1]] && !local[m[1]] && !['scroll-view', 'movable-view', 'movable-area', 'cover-view'].includes(m[1])) bad.push(path.relative(ROOT, f) + ': unknown component ' + m[1]);
  });
  return bad;
}
flow('static: every wxml handler/component resolves', () => { const bad = staticHandlers(); assert.deepStrictEqual(bad, []); });

// ---------- flows
flow('F1 start today: opening P3 stores nothing; leaving discards in-memory draft', () => {
  reset(); const cal = open('pages/calendar/calendar');
  assert.strictEqual(cal.data.sel.kind, 'today');
  cal.newWorkout(); assert.strictEqual(cur().route, 'pages/workout-edit/workout-edit');
  assert.strictEqual(store('fit_workouts'), undefined, 'no empty draft persisted');
  assert.strictEqual(cur().data.w.persisted, false);
  cur().onClose(); assert.strictEqual(cur().route, 'pages/calendar/calendar');
  assert.strictEqual(store('fit_workouts'), undefined); assert.strictEqual(cal.data.draft, null);
});

flow('F1 full entry: picker multi-add, sets, warmup, done/shake, undo deletes, reorder, note, finish -> P2', () => {
  reset(); const cal = open('pages/calendar/calendar'); cal.newWorkout(); const ed = cur();
  ed.addTap(); const pk = cur(); assert.strictEqual(pk.route, 'pages/exercise-picker/exercise-picker');
  pk.onQ(ev({}, { value: '卧推' })); tick(); assert.ok(pk.data.total > 0);
  const bench = pk.data.items.find(i => i.nameZh === '杠铃卧推').id;
  pk.toggle(ev({ id: bench })); pk.clearAll(); pk.toggle(ev({ id: pk.data.items[3].id }));
  assert.deepStrictEqual(pk.data.selected.length, 2);
  pk.confirm(); assert.strictEqual(cur(), ed);
  assert.strictEqual(draftHeader().exerciseCount, 2, 'persisted on first add');
  assert.strictEqual(ed.data.cards.length, 2); assert.strictEqual(ed.data.cards[0].sets.length, 1);
  const c0 = ed.data.cards[0], s0 = c0.sets[0];
  ed.onToggleDone(ev({ s: s0.id, d: false })); assert.ok(toasts.includes('先填写次数')); assert.strictEqual(ed.data.shakeSet, s0.id);
  ed.onSetChange(Object.assign(ev({ s: s0.id }), { detail: { field: 'reps', value: 8 } }));
  ed.onSetChange(Object.assign(ev({ s: s0.id }), { detail: { field: 'weightKg', value: 60 } }));
  ed.onToggleDone(ev({ s: s0.id, d: false }));
  assert.strictEqual(ed.data.cards[0].sets[0].done, true);
  ed.addSet(ev({ we: c0.id })); const s1 = ed.data.cards[0].sets[1];
  assert.deepStrictEqual([s1.weightKg, s1.reps, s1.type, s1.done, s1.label], [60, 8, 'normal', false, '2']);
  ed.onToggleType(ev({ s: s0.id, t: 'normal' }));
  assert.deepStrictEqual(ed.data.cards[0].sets.map(s => s.label), ['热', '1'], 'warmup does not take a number');
  ed.onToggleType(ev({ s: s0.id, t: 'warmup' }));
  // delete set via long-press menu + undo
  sheetAnswers.push('删除此组'); ed.onSetMore(ev({ s: s1.id, we: c0.id }));
  assert.strictEqual(ed.data.cards[0].sets.length, 1); assert.strictEqual(ed._undo.shown.text, '已删除第 2 组');
  ed.onUndo({ detail: { payload: ed._undo.shown.payload } }); assert.strictEqual(ed.data.cards[0].sets.length, 2);
  sheetAnswers.push('在下方复制一组'); ed.onSetMore(ev({ s: s0.id, we: c0.id })); assert.strictEqual(ed.data.cards[0].sets.length, 3);
  // delete exercise + undo (restores order)
  const c1 = ed.data.cards[1]; sheetAnswers.push('删除动作'); ed.more(ev({ id: c1.id }));
  assert.strictEqual(ed.data.cards.length, 1); assert.match(ed._undo.shown.text, /^已移除 .+（1 组）$/);
  ed.onUndo({ detail: { payload: ed._undo.shown.payload } }); assert.deepStrictEqual(ed.data.cards.map(c => c.id), [c0.id, c1.id]);
  // reorder
  sheetAnswers.push('调整顺序'); ed.more(ev({ id: c0.id })); assert.strictEqual(ed.data.sorting, true);
  ed.moveDown(ev({ id: c0.id, i: 0 })); assert.deepStrictEqual(ed.data.cards.map(c => c.id), [c1.id, c0.id]); ed.moveUp(ev({ id: c0.id, i: 1 })); ed.sortDone();
  // note
  sheetAnswers.push('动作备注'); modalAnswers.push({ confirm: true, content: '握距窄' }); ed.more(ev({ id: c0.id }));
  assert.strictEqual(ed.data.cards[0].note, '握距窄');
  // info sheet: rename
  ed.openInfo(); ed.onInfoInput(ev({ k: 'name' }, { value: '推日' })); ed.saveInfo(); assert.strictEqual(draftHeader().name, '推日');
  // finish: R-C dialog (c1 has no done set -> will be removed; unticked sets kept)
  modalAnswers.push({ confirm: true }); ed.complete();
  assert.ok(modals.some(m => m.startsWith('完成训练？|有 1 个动作没有完成任何组')), modals.join(' / '));
  assert.strictEqual(cur().route, 'pages/workout-detail/workout-detail'); assert.ok(toasts.includes('训练已完成'));
  const h = store('fit_workouts')[0]; assert.deepStrictEqual([h.status, h.exerciseCount], ['completed', 1]);
  const det = cur(); assert.strictEqual(det.data.w.exercises[0].sets[0].no, 1);
  assert.strictEqual(det.data.w.exercises[0].sets.find(s => !s.done).vol, '未完成');
  wx.navigateBack(); // back to calendar (redirectTo replaced P3)
  assert.strictEqual(cur().route, 'pages/calendar/calendar');
  assert.ok(cur().data.marks[today]); assert.strictEqual(cur().data.cards[0].title, '推日');
  assert.match(cur().data.cards[0].top[0].text, /最佳 60kg×8/);
});

flow('finish with no done set -> blocking message', () => {
  reset(); open('pages/calendar/calendar').newWorkout(); const ed = cur();
  ed.onPicked(['0025'], 'add'); ed.complete();
  assert.ok(modals.some(m => m.includes('至少完成一组才能结束训练'))); assert.strictEqual(cur(), ed);
});

flow('F1.2 draft exists: continue / discard-and-new with confirm; banner on calendar', () => {
  reset(); const cal = open('pages/calendar/calendar'); cal.newWorkout(); cur().onPicked(['0025'], 'add'); wx.navigateBack();
  assert.ok(cal.data.draft && cal.data.draft.text.startsWith('今天'));
  modalAnswers.push({ confirm: true }); cal.newWorkout(); assert.strictEqual(cur().data.id, draftHeader().id); wx.navigateBack();
  const old = draftHeader().id;
  modalAnswers.push({ cancel: true }, { confirm: true }); cal.newWorkout();
  assert.ok(modals.some(m => m.startsWith('放弃这次训练？|已录入的 1 组将被删除')));
  assert.strictEqual(store('fit_workout_' + old), undefined); assert.strictEqual(cur().route, 'pages/workout-edit/workout-edit');
  assert.strictEqual(cur().data.w.persisted, false);
});

flow('F2 backfill past day: sets default done; future day blocked', () => {
  reset(); const cal = open('pages/calendar/calendar');
  const d = new Date(); d.setDate(d.getDate() - 3); const p = n => (n < 10 ? '0' : '') + n; const past = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  cal.onSelect({ detail: { date: past } }); assert.strictEqual(cal.data.sel.kind, 'past');
  cal.newWorkout(); const ed = cur(); assert.strictEqual(ed.data.w.date, past);
  ed.onPicked(['0025'], 'add'); const s0 = ed.data.cards[0].sets[0];
  ed.onSetChange(Object.assign(ev({ s: s0.id }), { detail: { field: 'reps', value: 5 } }));
  ed.addSet(ev({ we: ed.data.cards[0].id })); assert.strictEqual(ed.data.cards[0].sets[1].done, true);
  assert.strictEqual(draftHeader().startedAt, null);
  wx.navigateBack(); const f = new Date(); f.setDate(f.getDate() + 2);
  cal.onSelect({ detail: { date: f.getFullYear() + '-' + p(f.getMonth() + 1) + '-' + p(f.getDate()) } });
  const before = stack.length; cal.newWorkout(); assert.strictEqual(stack.length, before); assert.ok(toasts.includes('不能为未来日期新建训练'));
});

flow('F4 edit completed: no cleanup, >=1 done set gate, delete with confirm', () => {
  reset(); const cal = open('pages/calendar/calendar'); cal.newWorkout(); let ed = cur();
  ed.onPicked(['0025'], 'add'); const s0 = ed.data.cards[0].sets[0];
  ed.onSetChange(Object.assign(ev({ s: s0.id }), { detail: { field: 'reps', value: 5 } })); ed.onToggleDone(ev({ s: s0.id, d: false })); ed.complete();
  const det = cur(); const id = det.data.id; det.edit(); ed = cur();
  assert.strictEqual(ed.data.w.status, 'completed');
  ed.onPicked(['0025'], 'add'); // new exercise with no done set
  ed.onToggleDone(ev({ s: s0.id, d: true })); // untick
  modalAnswers.push({ confirm: true }); ed.finishEditTap(); assert.ok(modals.some(m => m.startsWith('至少完成一组'))); assert.strictEqual(cur(), ed);
  ed.onToggleDone(ev({ s: s0.id, d: false })); ed.finishEditTap(); assert.strictEqual(cur(), det);
  assert.strictEqual(det.data.w.exercises.length, 2, 'no cleanup on edit');
  modalAnswers.push({ confirm: true }); det.remove(); tick();
  assert.ok(modals.some(m => m.startsWith('删除这次训练？|'))); assert.strictEqual(store('fit_workout_' + id), undefined);
  assert.strictEqual(cur().route, 'pages/calendar/calendar');
});

flow('F5 library: search, filter panel, load more, quick add creates today draft; detail adds to existing', () => {
  reset(); const lib = open('pages/library/library');
  assert.strictEqual(lib.data.total, 284); assert.strictEqual(lib.data.groups.reduce((t, g) => t + g.items.length, 0), 30);
  lib.more(); assert.strictEqual(lib.data.groups.reduce((t, g) => t + g.items.length, 0), 60);
  lib.openPanel(); lib.pBP(ev({ v: 'chest' })); assert.ok(lib.data.panelCount > 0); lib.applyPanel();
  assert.ok(lib.data.groups.every(g => g.key === 'chest')); assert.match(lib.data.groups[0].title, /^胸 · \d+$/);
  lib.onQ(ev({}, { value: 'zzzz' })); tick(); assert.strictEqual(lib.data.total, 0); lib.clearAll(); assert.strictEqual(lib.data.total, 284);
  const any = lib.data.groups[0].items[0].id;
  lib.quickAdd(ev({ id: any })); assert.strictEqual(cur().route, 'pages/workout-edit/workout-edit'); assert.strictEqual(draftHeader().exerciseCount, 1);
  wx.navigateBack(); lib.open(ev({ id: '0025' })); const dt = cur();
  assert.strictEqual(dt.data.ex.nameZh, '杠铃卧推'); assert.strictEqual(dt.data.ex.info[3].v, '—');
  modalAnswers.push({ confirm: false, cancel: true }); dt.addToWorkout(); assert.strictEqual(draftHeader().exerciseCount, 2);
  assert.ok(lib.data.groups.some(g => g.items.some(i => i.pending)) || true);
});

flow('P4 detail -> 选择这个动作 selects in picker', () => {
  reset(); open('pages/calendar/calendar').newWorkout(); cur().addTap(); const pk = cur();
  pk.detail(ev({ id: '0025' })); const dt = cur(); assert.strictEqual(dt.data.mode, 'select'); dt.select();
  assert.strictEqual(cur(), pk); assert.deepStrictEqual(pk.data.selected, ['0025']);
});

flow('F6/F7 body: empty state, weight required, soft warning, chart/list same source, edit, delete, calendar backfill, load-existing, dirty back', () => {
  reset(); const body = open('pages/body/body');
  assert.strictEqual(body.data.empty.title, '记录第一次体重，开始看趋势');
  body.add(); let be = cur(); be.onInput(ev({ k: 'bodyFatPct' }, { value: '18' })); be.save();
  assert.strictEqual(be.data.errors.weightKg, '请填写体重'); assert.strictEqual(store('fit_body'), undefined);
  be.onInput(ev({ k: 'weightKg' }, { value: '701' })); be.onBlur(ev({ k: 'weightKg' })); assert.match(be.data.errors.weightKg, /0–700 kg/);
  be.onInput(ev({ k: 'weightKg' }, { value: '15' })); modalAnswers.push({ confirm: false }); be.save();
  assert.ok(modals.some(m => m.includes('看起来不太常见'))); assert.strictEqual(store('fit_body'), undefined);
  be.onInput(ev({ k: 'weightKg' }, { value: '72.4' })); be.save(); tick();
  assert.strictEqual(cur(), body); assert.strictEqual(store('fit_body')[0].weightKg, 72.4);
  assert.strictEqual(body.data.cur.value, '72.4'); assert.strictEqual(body.data.chartMode, 'single-chart');
  // second point (yesterday) -> line; list rows equal chart points
  const y = new Date(); y.setDate(y.getDate() - 1); const p = n => (n < 10 ? '0' : '') + n; const yd = y.getFullYear() + '-' + p(y.getMonth() + 1) + '-' + p(y.getDate());
  body.add(); be = cur(); be.onDate(ev({}, { value: yd })); be.onInput(ev({ k: 'weightKg' }, { value: '73' })); be.onInput(ev({ k: 'waistCm' }, { value: '80' })); be.save(); tick();
  assert.strictEqual(body.data.chartMode, 'line'); assert.strictEqual(body.data.rows.length, body.data.series.points.length);
  assert.strictEqual(body.data.cur.delta, '−0.6');
  body.setField(ev({ k: 'waistCm' })); assert.strictEqual(body.data.chartMode, 'single', 'waist with 1 point: no chart');
  body.setField(ev({ k: 'bodyFatPct' })); assert.strictEqual(body.data.chartMode, 'single'); assert.strictEqual(body.data.empty, null);
  body.setField(ev({ k: 'weightKg' })); body.setRange(ev({ v: 'all' })); assert.strictEqual(body.data.range, 'all');
  // P8 new mode picking an existing date loads it
  body.add(); be = cur(); be.onDate(ev({}, { value: yd })); assert.ok(be.data.id); assert.ok(toasts.some(t => t.startsWith('已载入')));
  be.onInput(ev({ k: 'waistCm' }, { value: '' })); modalAnswers.push({ confirm: true }); be.onBack(); assert.ok(modals.some(m => m.startsWith('放弃修改？')));
  assert.strictEqual(store('fit_body').find(r => r.date === yd).waistCm, 80, 'discarded');
  // edit clears optional field, cannot clear weight
  body.edit(ev({ id: store('fit_body').find(r => r.date === yd).id })); be = cur();
  be.onInput(ev({ k: 'weightKg' }, { value: '' })); be.save(); assert.strictEqual(be.data.errors.weightKg, '请填写体重');
  be.onInput(ev({ k: 'weightKg' }, { value: '73.2' })); be.onInput(ev({ k: 'waistCm' }, { value: '' })); be.save(); tick();
  assert.deepStrictEqual([store('fit_body').find(r => r.date === yd).weightKg, store('fit_body').find(r => r.date === yd).waistCm], [73.2, null]);
  // delete from list with confirm
  modalAnswers.push({ confirm: true }); body.removeRow(ev({ id: store('fit_body').find(r => r.date === yd).id }));
  assert.ok(modals.some(m => /^删除 .+ 的记录？/.test(m))); assert.strictEqual(store('fit_body').length, 1);
  // calendar view: persisted pref, marks, backfill
  body.setView(ev({ v: 'calendar' })); assert.strictEqual(store('fit_ui_prefs').bodyView, 'calendar');
  assert.strictEqual(body.data.marks[today], '72.4'); assert.ok(body.data.selCard);
  body.onSelect({ detail: { date: yd } }); assert.strictEqual(body.data.selKind, 'past'); assert.strictEqual(body.data.selCard, null);
  body.addFor(); assert.strictEqual(cur().data.form.date, yd);
  be = cur(); be.onInput(ev({ k: 'weightKg' }, { value: '73' })); be.save(); tick();
  // edit + delete inside P8
  body.edit(ev({ id: store('fit_body')[0].id })); be = cur(); modalAnswers.push({ confirm: true }); be.remove(); tick();
  assert.strictEqual(store('fit_body').length, 1);
});

flow('read-only mode: banner + write entries blocked, nothing written', () => {
  reset({ fit_meta: { schemaVersion: 99 }, fit_body: [{ id: 'b1', date: today, weightKg: 70, bodyFatPct: null, waistCm: null, note: '', extra: null }] });
  assert.ok(modals.some(m => m.startsWith('请更新小程序')));
  const snap = JSON.stringify(mem);
  const cal = open('pages/calendar/calendar'); assert.strictEqual(cal.data.readOnly, true);
  cal.newWorkout(); assert.strictEqual(cur(), cal);
  const body = open('pages/body/body'); body.add(); assert.strictEqual(cur(), body); assert.strictEqual(body.data.cur.value, '70.0');
  const dt = open('pages/exercise-detail/exercise-detail?id=0025'); dt.addToWorkout();
  assert.ok(toasts.filter(t => t.includes('请更新小程序')).length >= 3); assert.strictEqual(JSON.stringify(mem), snap);
});

flow('storage failure: toast then modal on 2nd consecutive failure; data kept in page; retry', () => {
  reset(); require(path.join(ROOT, 'utils/ui.js'))._resetFails();
  open('pages/calendar/calendar').newWorkout(); const ed = cur(); ed.onPicked(['0025'], 'add');
  const we = ed.data.cards[0].id, s0 = ed.data.cards[0].sets[0];
  const chg = (field, value) => ed.onSetChange(Object.assign(ev({ s: s0.id, we }), { detail: { field, value } }));
  failWrites = 2;
  chg('reps', 5);
  assert.strictEqual(ed.data.saveState, 'failed'); assert.ok(toasts.includes('保存失败：存储空间不足'));
  assert.strictEqual(ed.data.cards[0].sets[0].reps, 5, 'entered value kept on screen after failed save');
  assert.strictEqual(ed.data.canRetry, true);
  const stored = () => store('fit_workout_' + ed.data.id).sets[0].reps;
  assert.strictEqual(stored(), null, 'nothing partially written');
  chg('weightKg', 60);
  assert.ok(modals.some(m => m.includes('手机存储空间不足'))); assert.strictEqual(cur(), ed, 'no navigation');
  assert.strictEqual(ed.data.cards[0].sets[0].weightKg, 60); assert.strictEqual(ed.data.cards[0].sets[0].reps, 5, 'earlier unsaved input still on screen');
  ed.retry(); // storage recovered: retry re-sends the last failed write
  assert.strictEqual(ed.data.saveState, 'saved'); assert.strictEqual(store('fit_workout_' + ed.data.id).sets[0].weightKg, 60);
  chg('reps', 7);
  assert.strictEqual(ed.data.saveState, 'saved'); assert.strictEqual(stored(), 7);
  // header write fails after detail write -> rolled back (no half-saved state)
  const before = JSON.stringify(store('fit_workout_' + ed.data.id));
  failWrites = 0; failNth = 2; chg('reps', 9); failNth = 0;
  assert.strictEqual(ed.data.saveState, 'failed'); assert.strictEqual(JSON.stringify(store('fit_workout_' + ed.data.id)), before);
  assert.strictEqual(ed.data.cards[0].sets[0].reps, 9);
});

flow('corrupt storage: kept untouched, banner + 重新加载, writes to damaged key refused', () => {
  reset({ fit_meta: { schemaVersion: 1 }, fit_body: { broken: true }, fit_workouts: [] });
  const body = open('pages/body/body');
  assert.strictEqual(repo().status().mode, 'corrupt');
  const nav = comp('nav-bar'); assert.ok(nav.data.banner.includes('重新加载'));
  body.add(); const be = cur(); be.onInput(Object.assign(ev({ k: 'weightKg' }), { detail: { value: '70' } })); be.save();
  assert.ok(toasts.includes('数据读取异常，已暂停保存以保护原数据'));
  assert.deepStrictEqual(store('fit_body'), { broken: true }, 'raw data untouched');
  assert.ok(Object.keys(mem).some(k => k.startsWith('fit_corrupt_fit_body_')), 'backup copy');
  assert.strictEqual(be.data.form.weightKg, '70', 'input kept');
  mem.fit_body = '[]'; nav.onBanner();
  assert.strictEqual(repo().status().mode, 'normal'); assert.strictEqual(nav.data.banner, '');
  be.save(); assert.strictEqual(store('fit_body').length, 1);
});

flow('about / data source page reachable from library', () => {
  reset(); const lib = open('pages/library/library'); lib.openAbout();
  assert.strictEqual(cur().route, 'pages/about/about');
  const wxml = fs.readFileSync(path.join(ROOT, 'pages/about/about.wxml'), 'utf8');
  ['openGym', 'github.com/DuarteSantos8/openGym', 'e348fc1', 'AGPL-3.0', '修改', '未使用 openGym 的任何图片'].forEach(t => assert.ok(wxml.includes(t), t));
  cur().toggle(); assert.ok(cur().data.license.includes('GNU AFFERO'));
  assert.ok(fs.existsSync(path.join(ROOT, 'LICENSE-openGym.txt')));
});

flow('migrated empty workout: listed, not a training day; detail-missing shown', () => {
  reset({ fit_meta: { schemaVersion: 1 }, fit_workouts: [
    { id: 'w_e', status: 'completed', date: today, name: '', note: '', startedAt: null, completedAt: 1, createdAt: 1, updatedAt: 1, exerciseCount: 0, setCount: 0, volumeKg: 0 },
    { id: 'w_m', status: 'completed', date: today, name: '', note: '', startedAt: null, completedAt: 1, createdAt: 2, updatedAt: 1, exerciseCount: 2, setCount: 1, volumeKg: 5 }],
    fit_workout_w_e: { workoutId: 'w_e', exercises: [], sets: [] } });
  const cal = open('pages/calendar/calendar');
  assert.strictEqual(cal.data.cards.length, 2); assert.ok(cal.data.marks[today], 'w_m (detail missing but header says 2) still marks');
  assert.strictEqual(cal.data.cards[1].detailMissing, true);
  cal.openCard(ev({ id: 'w_m' })); assert.strictEqual(cur().data.detailMissing, true);
});

flow('body metric empty states: range-empty -> 切换到全部; 1 point hint', () => {
  const d = new Date(); d.setDate(d.getDate() - 60); const p = n => (n < 10 ? '0' : '') + n; const old = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  reset({ fit_meta: { schemaVersion: 1 }, fit_body: [{ id: 'b1', date: old, weightKg: 70, bodyFatPct: null, waistCm: 82, note: '', extra: null, createdAt: 1, updatedAt: 1 }] });
  const body = open('pages/body/body'); body.setField(ev({ k: 'waistCm' }));
  assert.deepStrictEqual([body.data.empty.title, body.data.empty.action], ['近 30 天没有腰围记录', '切换到全部']);
  body.onEmpty(); assert.strictEqual(body.data.range, 'all'); assert.strictEqual(body.data.chartMode, 'single');
  assert.strictEqual(body.data.rows.length, 1);
});

// ---------- report
results.forEach(r => console.log(r[0].padEnd(4), r[1], r[2] ? '\n     ' + r[2] : ''));
const failed = results.filter(r => r[0] !== 'ok').length;
console.log(`\n${results.length - failed}/${results.length} flows passed`);
process.exit(failed ? 1 : 0);
