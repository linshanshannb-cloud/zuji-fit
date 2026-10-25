// Logic-level tests for components (no renderer): undo-toast replacement & 5s timeout, set-row stepper clamping, calendar cells.
const test = require('node:test'); const assert = require('node:assert');
function load(rel, props = {}) {
  let def; global.Component = d => { def = d; };
  global.wx = { showToast: o => { (global.__toasts = global.__toasts || []).push(o.title); }, vibrateShort() {} };
  delete require.cache[require.resolve(rel)]; require(rel);
  const inst = Object.assign({}, def.methods);
  inst.data = Object.assign({}, def.data || {}, Object.fromEntries(Object.entries(def.properties || {}).map(([k, v]) => [k, v && v.value !== undefined ? v.value : undefined])), props);
  inst.events = []; inst.triggerEvent = (n, d) => inst.events.push([n, d]);
  inst.setData = function (d) { Object.assign(this.data, d); if (def.observers) Object.keys(def.observers).forEach(k => { if (k.split(',').map(x => x.trim()).some(x => x in d)) def.observers[k].call(this, d[k]); }); };
  return inst;
}
test('undo-toast: newest replaces previous; undo emits payload once; auto-hide after 5s', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const u = load('../components/undo-toast/undo-toast.js');
  u.show('a', { n: 1 }); u.show('b', { n: 2 });
  assert.strictEqual(u.data.text, 'b');
  u.onUndo(); assert.deepStrictEqual(u.events, [['undo', { payload: { n: 2 } }]]); assert.strictEqual(u.data.visible, false);
  u.onUndo(); assert.strictEqual(u.events.length, 1, 'no double undo');
  u.show('c', 1); t.mock.timers.tick(4999); assert.strictEqual(u.data.visible, true); t.mock.timers.tick(1); assert.strictEqual(u.data.visible, false);
});
test('set-row: steps ±2.5/±1, clamps 0..999.9 / 999, truncates reps decimals', () => {
  const r = load('../components/set-row/set-row.js');
  r.setData({ set: { weightKg: 997.5, reps: 998, type: 'normal', done: false } });
  r.onStep({ currentTarget: { dataset: { f: 'weightKg', d: '1' } } }); r.onStep({ currentTarget: { dataset: { f: 'weightKg', d: '1' } } });
  assert.deepStrictEqual(r.events.slice(-1)[0], ['change', { field: 'weightKg', value: 999.9 }]);
  r.onStep({ currentTarget: { dataset: { f: 'reps', d: '1' } } }); r.onStep({ currentTarget: { dataset: { f: 'reps', d: '1' } } });
  assert.deepStrictEqual(r.events.slice(-1)[0], ['change', { field: 'reps', value: 999 }]);
  r.setData({ set: { weightKg: null, reps: null } });
  r.onStep({ currentTarget: { dataset: { f: 'weightKg', d: '-1' } } }); assert.deepStrictEqual(r.events.slice(-1)[0][1], { field: 'weightKg', value: 0 });
  r.onBlur({ currentTarget: { dataset: { f: 'reps' } }, detail: { value: '8.7' } }); assert.deepStrictEqual(r.events.slice(-1)[0][1], { field: 'reps', value: 8 });
  r.onBlur({ currentTarget: { dataset: { f: 'weightKg' } }, detail: { value: '1200' } }); assert.deepStrictEqual(r.events.slice(-1)[0][1], { field: 'weightKg', value: 999.9 });
  assert.ok(global.__toasts.includes('重量最大 999.9 kg'));
  r.onBlur({ currentTarget: { dataset: { f: 'weightKg' } }, detail: { value: '' } }); assert.deepStrictEqual(r.events.slice(-1)[0][1], { field: 'weightKg', value: null });
});
test('month-calendar: states for selected/today/future/marks', () => {
  const c = load('../components/month-calendar/month-calendar.js');
  c.setData({ year: 2026, month: 10, selected: '2026-10-15', today: '2026-10-17', marks: { '2026-10-15': true, '2026-10-16': '72.4' } });
  c.build();
  const by = d => c.data.cells.find(x => x.date === d);
  assert.deepStrictEqual([by('2026-10-15').sel, by('2026-10-15').mark], [true, '•']);
  assert.strictEqual(by('2026-10-16').mark, '72.4'); assert.strictEqual(by('2026-10-17').isToday, true); assert.strictEqual(by('2026-10-18').future, true);
  c.onTouchStart({ touches: [{ clientX: 300 }] }); c.onTouchEnd({ changedTouches: [{ clientX: 100 }] });
  assert.deepStrictEqual(c.events.slice(-1)[0], ['shift', { delta: 1 }]);
});
test('month-calendar v0.5: week view = 7 cells of the selected week (cross-month not greyed); toggle; training cell lines', () => {
  const c = load('../components/month-calendar/month-calendar.js');
  c.setData({ year: 2026, month: 10, selected: '2026-10-01', today: '2026-10-17', view: 'week', rich: true,
    info: { '2026-09-29': { tags: [{ id: 'p0', text: '胸', kind: 'part' }, { id: 'a0', text: '跑步', kind: 'aero' }], more: 0 }, '2026-10-02': { rest: true } } });
  assert.deepStrictEqual(c.data.cells.map(x => x.day), [28, 29, 30, 1, 2, 3, 4]);
  assert.ok(c.data.cells.every(x => x.inMonth));
  const by = d => c.data.cells.find(x => x.date === d);
  assert.deepStrictEqual([by('2026-09-29').train, by('2026-09-29').part, by('2026-09-29').aero, by('2026-09-29').showDot], [true, '胸', '跑步', false]);
  assert.deepStrictEqual([by('2026-10-02').rest, by('2026-10-02').train], [true, false]);
  c.onToggle(); assert.deepStrictEqual(c.events.slice(-1)[0], ['toggle', { view: 'month' }]);
  c.setData({ view: 'month' }); assert.strictEqual(c.data.cells.length, 42);
  c.onToggle(); assert.deepStrictEqual(c.events.slice(-1)[0], ['toggle', { view: 'week' }]);
  c.prev(); assert.deepStrictEqual(c.events.slice(-1)[0], ['shift', { delta: -1 }]);
});
