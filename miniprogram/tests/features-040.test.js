// 0.4.0：肌群分类、组间歇偏好与计时、左滑判定、倒计时组件。
const test = require('node:test'); const assert = require('node:assert');
const M = require('../utils/muscle');
const R = require('../utils/rest');
const { fresh } = require('./helpers');

test('muscle: mapping covers all built-in exercises; glutes split from legs', () => {
  const data = require('../data/exercises.js').list;
  const tabs = M.tabs(data);
  assert.strictEqual(tabs[0].key, ''); assert.strictEqual(tabs[0].count, data.length);
  assert.strictEqual(tabs.slice(1).reduce((a, t) => a + t.count, 0), data.length, 'every exercise in exactly one group');
  assert.strictEqual(M.groupOf({ bodyPart: 'legs', target: 'glutes' }), 'glutes');
  assert.strictEqual(M.groupOf({ bodyPart: 'legs', target: 'quads' }), 'legs');
  assert.strictEqual(M.groupOf({ bodyPart: 'core', target: 'abs' }), 'core');
  assert.strictEqual(M.groupOf({ bodyPart: 'cardio' }), 'other');
  assert.strictEqual(M.groupOf({ unknown: true }), 'other');
  assert.ok(tabs.every(t => t.count > 0));
  assert.deepStrictEqual(tabs.map(t => t.zh).slice(1, 4), ['胸', '背', '肩']);
});

test('rest prefs: default 90, per-exercise override, clamp, reset', () => {
  const { repo } = fresh();
  assert.strictEqual(repo.rest.getDefault(), 90);
  assert.strictEqual(repo.rest.getFor('0025'), 90);
  repo.rest.setDefault(120); assert.strictEqual(repo.rest.getFor('0025'), 120);
  repo.rest.setFor('0025', 61); assert.strictEqual(repo.rest.getFor('0025'), 60, 'rounded to 5s');
  assert.strictEqual(repo.rest.getOverride('0047'), 0);
  repo.rest.setFor('0025', 9999); assert.strictEqual(repo.rest.getFor('0025'), R.MAX);
  repo.rest.setDefault(1); assert.strictEqual(repo.rest.getDefault(), R.MIN);
  repo.rest.setFor('0025', 0); assert.strictEqual(repo.rest.getFor('0025'), R.MIN, 'falls back to default');
  assert.deepStrictEqual(repo.rest.overrides(), {});
});

test('rest timer math: timestamp based, ±15s, never negative', () => {
  const t0 = 1000000;
  let t = R.start(90, t0);
  assert.strictEqual(R.remaining(t, t0), 90);
  assert.strictEqual(R.remaining(t, t0 + 30500), 60, 'background 30.5s → calibrated');
  t = R.adjust(t, 15, t0 + 30500); assert.strictEqual(R.remaining(t, t0 + 30500), 75);
  t = R.adjust(t, -15, t0 + 30500); t = R.adjust(t, -100, t0 + 30500); assert.strictEqual(R.remaining(t, t0 + 30500), 0);
  assert.strictEqual(R.remaining(R.start(10, t0), t0 + 999999), 0);
  assert.strictEqual(R.fmt(90), '1:30'); assert.strictEqual(R.fmt(5), '0:05');
});

function loadComp(rel) {
  let def; global.Component = d => { def = d; };
  delete require.cache[require.resolve(rel)]; const mod = require(rel);
  const inst = Object.assign({}, def.methods);
  inst.data = Object.assign({}, def.data); inst.events = [];
  inst.triggerEvent = (n, d) => inst.events.push([n, d]);
  inst.setData = function (d) { Object.assign(this.data, d); };
  return { inst, mod };
}

test('swipe-cell: horizontal intent, snap open/close, delete emits', () => {
  const { inst, mod } = loadComp('../components/swipe-cell/swipe-cell.js');
  assert.ok(mod._decide(-30, 5)); assert.ok(!mod._decide(-5, 0)); assert.ok(!mod._decide(-20, 30));
  assert.strictEqual(mod._settle(-40, 0), -mod._W); assert.strictEqual(mod._settle(-10, 0), 0);
  inst.ts({ touches: [{ clientX: 300, clientY: 100 }] });
  inst.tm({ touches: [{ clientX: 240, clientY: 104 }] });
  assert.ok(inst.data.x < 0); inst.te(); assert.strictEqual(inst.data.x, -mod._W);
  inst.onDel(); assert.deepStrictEqual(inst.events, [['delete', undefined]]); assert.strictEqual(inst.data.x, 0);
  // vertical scroll does not move
  inst.ts({ touches: [{ clientX: 300, clientY: 100 }] }); inst.tm({ touches: [{ clientX: 290, clientY: 160 }] }); inst.te();
  assert.strictEqual(inst.data.x, 0);
  // disabled
  inst.data.disabled = true; inst.ts({ touches: [{ clientX: 300, clientY: 100 }] }); inst.tm({ touches: [{ clientX: 200, clientY: 100 }] });
  assert.strictEqual(inst.data.x, 0);
});

test('rest-timer component: counts by timestamp, +/-15, vibrateLong at 0, skip', t => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: 0 });
  let buzz = 0; global.wx = { vibrateLong() { buzz++; } };
  const { inst } = loadComp('../components/rest-timer/rest-timer.js');
  inst.start(30, 'x');
  assert.strictEqual(inst.data.label, '0:30'); assert.strictEqual(inst.data.visible, true);
  t.mock.timers.tick(10000); assert.strictEqual(inst.data.left, 20);
  inst.plus(); assert.strictEqual(inst.data.left, 35);
  inst.minus(); inst.minus(); assert.strictEqual(inst.data.left, 5);
  t.mock.timers.tick(5000); assert.strictEqual(buzz, 1); assert.strictEqual(inst.data.finished, true);
  assert.ok(inst.events.some(e => e[0] === 'done'));
  t.mock.timers.tick(3000); assert.strictEqual(inst.data.visible, false, 'auto hides');
  inst.start(60); inst.skip(); assert.strictEqual(inst.data.visible, false); assert.ok(inst.events.some(e => e[0] === 'skip'));
  t.mock.timers.tick(70000); assert.strictEqual(buzz, 1, 'no buzz after skip');
});

test('card: cover = poster > illustration (main package only), video badge, placeholder initial', () => {
  const C = require('../utils/card');
  const z = (k, v) => v + '!';
  const a = C.cardOf({ id: '1', nameZh: '杠铃卧推', poster: '/assets/video-posters/1.jpg', illustration: 'assets/exercises/1.png', video: 'cloud://x', equipment: 'barbell' }, z, '胸');
  assert.strictEqual(a.img, '/assets/video-posters/1.jpg'); assert.ok(a.hasVideo); assert.strictEqual(a.equip, 'barbell!'); assert.strictEqual(a.part, '胸');
  const b = C.cardOf({ id: '2', nameZh: '平板支撑', illustration: 'assets/exercises/2.png' }, z, '核心/腹');
  assert.strictEqual(b.img, '/assets/exercises/2.png'); assert.ok(!b.hasVideo);
  const c = C.cardOf({ id: '3', nameZh: '卷腹' }, z, '');
  assert.strictEqual(c.img, ''); assert.strictEqual(c.initial, '卷');
  const data = require('../data/exercises.js').list;
  assert.ok(data.every(e => !C.cardOf(e, z).img || /^\/assets\/(video-posters|exercises)\//.test(C.cardOf(e, z).img)), 'only main-package assets');
});
