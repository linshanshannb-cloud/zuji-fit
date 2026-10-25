const test = require('node:test'); const assert = require('node:assert');
const { fresh } = require('./helpers');
const K = require('../utils/repo/keys');

test('#1/#6 saveBody: weight required, invalid input errors, normalization', () => {
  const { repo } = fresh(); repo.init();
  const e = repo.body.saveBody({ date: '2026-10-10', bodyFatPct: 18 });
  assert.deepStrictEqual([e.code, e.message], ['WEIGHT_REQUIRED', '请填写体重']);
  assert.strictEqual(repo.body.saveBody({ date: '2026-10-10' }).code, 'WEIGHT_REQUIRED');
  assert.strictEqual(repo.body.saveBody({ weightKg: 'abc' }).code, 'INVALID_BODY_WEIGHT');
  assert.strictEqual(repo.body.saveBody({ weightKg: 0 }).code, 'INVALID_BODY_WEIGHT');
  assert.strictEqual(repo.body.saveBody({ weightKg: 701 }).code, 'INVALID_BODY_WEIGHT');
  assert.strictEqual(repo.body.saveBody({ weightKg: 70, bodyFatPct: 101 }).code, 'INVALID_BODY_FAT');
  assert.strictEqual(repo.body.saveBody({ weightKg: 70, waistCm: 'x' }).code, 'INVALID_WAIST');
  assert.match(repo.body.saveBody({ weightKg: 70, waistCm: 301 }).message, /0–300 cm/);
  const r = repo.body.saveBody({ date: '2026-10-10', weightKg: '72.46', bodyFatPct: '', waistCm: ' ' }).data;
  assert.match(r.id, /^b_/);
  assert.deepStrictEqual([r.weightKg, r.bodyFatPct, r.waistCm, r.note, r.extra], [72.5, null, null, '', null]);
  assert.strictEqual(repo.body.saveBody({ date: '2026-10-18', weightKg: 70 }).code, 'FUTURE_DATE');
  assert.strictEqual(repo.body.saveBody({ weightKg: 700 }).data.date, '2026-10-17');
});

test('saveBody same date merges; invalid never nulls old value; extra untouched', () => {
  const { repo, be } = fresh({ fit_meta: { schemaVersion: 1 }, fit_body: [{ id: 'b_m', date: '2026-10-05', weightKg: null, bodyFatPct: null, waistCm: 80, note: '', extra: { chestCm: 98 }, createdAt: 1, updatedAt: 1 }] });
  repo.init();
  const a = repo.body.saveBody({ date: '2026-10-10', weightKg: 72, waistCm: 80 }).data;
  repo.body.saveBody({ date: '2026-10-01', weightKg: 73 });
  const b = repo.body.saveBody({ date: '2026-10-10', bodyFatPct: 18.2, waistCm: '', note: ' 空腹 ' });
  assert.strictEqual(b.merged, true); assert.strictEqual(b.data.id, a.id); assert.strictEqual(b.data.createdAt, a.createdAt);
  assert.deepStrictEqual([b.data.weightKg, b.data.bodyFatPct, b.data.waistCm, b.data.note], [72, 18.2, 80, '空腹']);
  assert.strictEqual(repo.body.saveBody({ date: '2026-10-10', waistCm: 'abc' }).code, 'INVALID_WAIST');
  assert.strictEqual(repo.body.getBodyByDate('2026-10-10').waistCm, 80, 'old value intact');
  assert.ok(repo.body.saveBody({ date: '2026-10-10', note: '只改备注' }).ok);
  // migrated record without weight: updateBody without weightKg keeps null; with blank weight -> error
  assert.ok(repo.body.updateBody('b_m', { note: 'x', waistCm: 81 }).ok);
  assert.strictEqual(repo.body.getBody('b_m').weightKg, null);
  assert.strictEqual(repo.body.updateBody('b_m', { weightKg: '' }).code, 'WEIGHT_REQUIRED');
  assert.ok(!repo.body.bodySeries('weightKg', 'all').points.some(p => p.date === '2026-10-05'), 'excluded from weight chart');
  // same-day saveBody with empty weight keeps old weight
  assert.strictEqual(repo.body.saveBody({ date: '2026-10-10', weightKg: '', waistCm: 79 }).data.weightKg, 72);
  repo.body.saveBody({ date: '2026-10-10', waistCm: 80 });
  // migrated record without weight: saveBody merge must supply weight
  assert.strictEqual(repo.body.saveBody({ date: '2026-10-05', waistCm: 79 }).code, 'WEIGHT_REQUIRED');
  const m = repo.body.saveBody({ date: '2026-10-05', weightKg: 71 }).data;
  assert.deepStrictEqual([m.weightKg, m.waistCm, m.extra], [71, 81, { chestCm: 98 }]);
  assert.deepStrictEqual(be.data[K.BODY].map(r => r.date), ['2026-10-01', '2026-10-05', '2026-10-10']);
});

test('updateBody: replace/clear optional, weight required, invalid errors, date move/conflict; deleteBody', () => {
  const { repo } = fresh(); repo.init();
  const a = repo.body.saveBody({ date: '2026-10-10', weightKg: 72, waistCm: 80 }).data;
  repo.body.saveBody({ date: '2026-10-11', weightKg: 71 });
  assert.strictEqual(repo.body.updateBody(a.id, { waistCm: '' }).data.waistCm, null);
  assert.strictEqual(repo.body.updateBody(a.id, { weightKg: '' }).code, 'WEIGHT_REQUIRED');
  assert.strictEqual(repo.body.updateBody(a.id, { weightKg: 'abc' }).code, 'INVALID_BODY_WEIGHT');
  assert.strictEqual(repo.body.updateBody(a.id, { bodyFatPct: 150 }).code, 'INVALID_BODY_FAT');
  assert.strictEqual(repo.body.getBody(a.id).weightKg, 72, 'unchanged after errors');
  assert.strictEqual(repo.body.updateBody(a.id, { date: '2026-10-11' }).code, 'DATE_CONFLICT');
  assert.strictEqual(repo.body.updateBody(a.id, { date: '2026-10-05', note: '' }).data.date, '2026-10-05');
  assert.deepStrictEqual(repo.body.listBody().map(r => r.date), ['2026-10-05', '2026-10-11']);
  assert.strictEqual(repo.body.updateBody('x', {}).code, 'NOT_FOUND');
  assert.ok(repo.body.deleteBody(a.id).ok); assert.strictEqual(repo.body.listBody().length, 1);
  assert.strictEqual(repo.body.deleteBody(a.id).code, 'NOT_FOUND');
  assert.deepStrictEqual(repo.body.bodyDates(), { '2026-10-11': true });
});

test('bodySeries 30/90/all + bodyStats: window bounds, null gaps not fabricated, delta vs previous (may be outside range)', () => {
  const { repo } = fresh(); repo.init();
  const save = (date, o) => assert.ok(repo.body.saveBody(Object.assign({ date }, o)).ok, date);
  save('2026-01-01', { weightKg: 80 });
  save('2026-07-20', { weightKg: 76 });
  save('2026-07-19', { weightKg: 77 });
  save('2026-09-18', { weightKg: 74 });
  save('2026-09-17', { weightKg: 75, waistCm: 83 });
  save('2026-10-01', { weightKg: 73.4, waistCm: 82 });
  save('2026-10-17', { weightKg: 72, bodyFatPct: 18 });
  const s30 = repo.body.bodySeries('weightKg', 30);
  assert.deepStrictEqual([s30.from, s30.to], ['2026-09-18', '2026-10-17']);
  assert.deepStrictEqual(s30.points.map(p => p.date), ['2026-09-18', '2026-10-01', '2026-10-17']);
  const s90 = repo.body.bodySeries('weightKg', 90);
  assert.strictEqual(s90.from, '2026-07-20'); assert.strictEqual(s90.points.length, 5);
  const all = repo.body.bodySeries('weightKg', 'all');
  assert.strictEqual(all.from, '2026-01-01'); assert.strictEqual(all.points.length, 7);
  assert.deepStrictEqual(repo.body.bodySeries('bodyFatPct', 'all').points, [{ date: '2026-10-17', value: 18 }], 'no fabricated fat points');
  assert.deepStrictEqual(repo.body.bodySeries('waistCm', 30).points, [{ date: '2026-10-01', value: 82 }]);
  const st = repo.body.bodyStats('weightKg', 30);
  assert.deepStrictEqual([st.current.value, st.previous.value, st.delta], [72, 73.4, -1.4]);
  const w30 = repo.body.bodyStats('waistCm', 30);
  assert.deepStrictEqual([w30.current.value, w30.previous.date, w30.delta], [82, '2026-09-17', -1], 'previous outside range');
  assert.strictEqual(repo.body.bodyStats('bodyFatPct', 30).delta, null);
  assert.throws(() => repo.body.bodySeries('chest', 30));
  const L = repo.series.chartLayout(s30, 329, 200);
  assert.strictEqual(L.points.length, 3); assert.strictEqual(L.points[0].x, 40); assert.strictEqual(L.points[2].x, 317);
  assert.deepStrictEqual(repo.series.chartLayout({ from: 'a', to: 'a', points: [] }, 1, 1).points, []);
});

test('chart Y ticks: nice steps, distinct labels, bounds contain data (REVIEW M6)', () => {
  const { niceScale, chartLayout } = require('../utils/repo/series');
  for (const [a, b] of [[68.2, 68.8], [70, 70], [60, 90], [18.1, 18.4], [0.5, 250], [80, 81], [45.3, 120.7]]) {
    const r = niceScale(a, b);
    assert.ok(r.lo <= a && r.hi >= b && r.lo >= 0, `${a}-${b}`);
    const L = chartLayout({ from: '2026-10-01', to: '2026-10-02', points: [{ date: '2026-10-01', value: a }, { date: '2026-10-02', value: b }] }, 300, 200);
    const labels = L.ticks.map(t => t.label);
    assert.strictEqual(new Set(labels).size, labels.length, labels.join(','));
    assert.ok(labels.length >= 3 && labels.length <= 5, labels.join(','));
    L.points.forEach(p => assert.ok(p.y >= L.pad.t - 0.01 && p.y <= 200 - L.pad.b + 0.01));
  }
});

test('chart bubble clamped inside the canvas (REVIEW M5)', () => {
  const { bubblePos } = require('../utils/repo/series');
  const b = bubblePos({ x: 318, y: 5 }, 330, 180, 150, 't');
  assert.ok(b.left >= 0 && b.left + 150 <= 330); assert.ok(b.top >= 0);
  assert.strictEqual(bubblePos({ x: 2, y: 100 }, 330, 180, 150, 't').left, 0);
});
