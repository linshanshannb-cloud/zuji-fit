// Pure date helpers. Dates are 'YYYY-MM-DD' strings in local time.
const pad = n => (n < 10 ? '0' : '') + n;
function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function today() { return fmt(new Date()); }
function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function isValid(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && fmt(parse(s)) === s; }
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); } // m: 1-12
function addMonths(y, m, delta) { const t = y * 12 + (m - 1) + delta; return { year: Math.floor(t / 12), month: (t % 12) + 1 }; }
// 6x7 grid, weeks start Monday. Each cell {date, day, inMonth}
function monthGrid(y, m) {
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(y, m - 1, 1 - offset + i);
    cells.push({ date: fmt(d), day: d.getDate(), inMonth: d.getMonth() === m - 1 });
  }
  return cells;
}
function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); }
// 1x7 row containing date s, weeks start Monday. Same cell shape as monthGrid (inMonth always true).
function weekGrid(s) {
  const d = parse(s), offset = (d.getDay() + 6) % 7, cells = [];
  for (let i = 0; i < 7; i++) {
    const c = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset + i);
    cells.push({ date: fmt(c), day: c.getDate(), inMonth: true });
  }
  return cells;
}
module.exports = { pad, fmt, today, parse, isValid, daysInMonth, addMonths, monthGrid, addDays, weekGrid };
