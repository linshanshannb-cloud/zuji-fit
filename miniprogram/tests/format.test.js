const test = require('node:test'); const assert = require('node:assert');
const F = require('../utils/format');
test('format helpers', () => {
  assert.strictEqual(F.dateLabel('2026-10-17', '2026-10-17'), '10月17日 周六');
  assert.strictEqual(F.dateLabel('2025-12-30', '2026-10-17'), '2025年12月30日 周二');
  assert.strictEqual(F.kg(60), '60'); assert.strictEqual(F.kg(62.5), '62.5'); assert.strictEqual(F.kg(null), '');
  assert.strictEqual(F.fixed1(78), '78.0'); assert.strictEqual(F.thousands(4320), '4,320'); assert.strictEqual(F.thousands(1234567.5), '1,234,567.5');
  assert.strictEqual(F.signed(-0.6), '−0.6'); assert.strictEqual(F.signed(1), '+1.0'); assert.strictEqual(F.signed(null), '');
  assert.strictEqual(F.lastTwo('杠铃卧推'), '卧推'); assert.strictEqual(F.capFirst('barbell bench press'), 'Barbell bench press');
});
test('prefs best-effort', () => {
  const { repo } = require('./helpers').fresh(); repo.init();
  assert.strictEqual(repo.prefs.get('bodyView', 'chart'), 'chart');
  assert.ok(repo.prefs.set('bodyView', 'calendar')); assert.strictEqual(repo.prefs.get('bodyView'), 'calendar');
});
test('bodyRows: same source as chart, newest first, deltas', () => {
  const { repo } = require('./helpers').fresh(); repo.init();
  repo.body.saveBody({ date: '2026-08-01', weightKg: 75 });
  repo.body.saveBody({ date: '2026-10-01', weightKg: 73 });
  repo.body.saveBody({ date: '2026-10-10', weightKg: 72.4 });
  const rows = repo.body.bodyRows('weightKg', 30);
  assert.deepStrictEqual(rows.map(r => [r.date, r.value, r.delta]), [['2026-10-10', 72.4, -0.6], ['2026-10-01', 73, -2]]);
  assert.strictEqual(rows.length, repo.body.bodySeries('weightKg', 30).points.length);
});
