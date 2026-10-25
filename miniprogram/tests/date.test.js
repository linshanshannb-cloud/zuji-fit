const test = require('node:test'); const assert = require('node:assert');
const d = require('../utils/date');
test('fmt/parse roundtrip', () => { assert.strictEqual(d.fmt(d.parse('2026-02-03')), '2026-02-03'); });
test('isValid', () => { assert.ok(d.isValid('2024-02-29')); assert.ok(!d.isValid('2026-02-29')); assert.ok(!d.isValid('2026-2-1')); });
test('daysInMonth', () => { assert.strictEqual(d.daysInMonth(2024, 2), 29); assert.strictEqual(d.daysInMonth(2026, 12), 31); });
test('addMonths wraps years', () => { assert.deepStrictEqual(d.addMonths(2026, 12, 1), { year: 2027, month: 1 }); assert.deepStrictEqual(d.addMonths(2026, 1, -1), { year: 2025, month: 12 }); });
test('monthGrid Monday start', () => {
  const g = d.monthGrid(2026, 10); // 2026-10-01 is Thursday
  assert.strictEqual(g.length, 42); assert.strictEqual(g[0].date, '2026-09-28'); assert.strictEqual(g[3].date, '2026-10-01');
  assert.strictEqual(g.filter(c => c.inMonth).length, 31);
});
test('addDays crosses month / year / leap day', () => {
  assert.strictEqual(d.addDays('2026-10-31', 1), '2026-11-01'); assert.strictEqual(d.addDays('2026-01-03', -7), '2025-12-27');
  assert.strictEqual(d.addDays('2024-02-28', 1), '2024-02-29'); assert.strictEqual(d.addDays('2026-10-15', 0), '2026-10-15');
});
test('weekGrid: Monday start, 7 cells, cross-month week all inMonth', () => {
  const w = d.weekGrid('2026-10-01'); // Thursday
  assert.deepStrictEqual(w.map(c => c.date), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.ok(w.every(c => c.inMonth)); assert.deepStrictEqual(w.map(c => c.day), [28, 29, 30, 1, 2, 3, 4]);
  assert.strictEqual(d.weekGrid('2026-10-18')[0].date, '2026-10-12', 'Sunday belongs to the week starting the previous Monday');
  assert.strictEqual(d.weekGrid('2026-10-12')[6].date, '2026-10-18');
  // the week of any date is a row of its month's 6x7 grid
  const g = d.monthGrid(2026, 10).map(c => c.date), wk = d.weekGrid('2026-10-31').map(c => c.date);
  assert.ok(wk.every(x => g.includes(x)));
});
