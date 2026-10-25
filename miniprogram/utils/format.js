// Display formatting per PRODUCT_SPEC §8. Pure.
const D = require('./date');
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function dateLabel(s, today = D.today()) {
  const d = D.parse(s), sameYear = s.slice(0, 4) === today.slice(0, 4);
  return (sameYear ? '' : d.getFullYear() + '年') + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()];
}
function md(s) { const d = D.parse(s); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
function mdSlash(s) { const d = D.parse(s); return (d.getMonth() + 1) + '/' + d.getDate(); }
// weight: up to 1 decimal, no trailing .0
function kg(v) { if (v === null || v === undefined || v === '') return ''; return String(Math.round(Number(v) * 10) / 10); }
// body values: always 1 decimal
function fixed1(v) { return v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toFixed(1); }
function thousands(v) { const n = Math.round(Number(v) * 10) / 10; const [i, f] = String(n).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : ''); }
function signed(v) { if (v === null || v === undefined) return ''; const r = Math.round(v * 10) / 10; return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r).toFixed(1); }
function hm(ts) { const d = new Date(ts); return D.pad(d.getHours()) + ':' + D.pad(d.getMinutes()); }
function lastTwo(name) { const s = String(name || '').replace(/[（(].*$/, '').trim(); return s.slice(-2) || '—'; }
function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
module.exports = { dateLabel, md, mdSlash, kg, fixed1, thousands, signed, hm, lastTwo, capFirst };
