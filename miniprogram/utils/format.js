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
// 0秒 / 45秒 / 1分钟 / 1分30秒 / 60分钟
function dur(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(n / 60), s = n % 60;
  if (m <= 0) return n + '秒';
  return s ? m + '分' + s + '秒' : m + '分钟';
}
// Reps best: "60kg×10". Time best: "45秒" or "10kg × 1分30秒". Null -> "".
function bestLabel(b) {
  if (!b) return '';
  const timed = b.mode === 'time' || (b.durationSec != null && b.reps == null);
  if (timed) {
    const text = dur(b.durationSec);
    const w = typeof b.weightKg === 'number' ? b.weightKg : 0;
    return w > 0 ? kg(w) + 'kg × ' + text : text;
  }
  return kg(b.weightKg) + 'kg×' + (b.reps || 0);
}
// Volume is meaningless for a time-only record, so hide a 0 kg figure once any timed work exists.
function showVolume(volumeKg, timeSec) {
  return (Number(volumeKg) || 0) > 0 || (Number(timeSec) || 0) <= 0;
}
function strengthStats(exerciseCount, setCount, volumeKg, timeSec) {
  const stats = [{ v: exerciseCount, k: '动作' }, { v: setCount, k: '组' }];
  if (showVolume(volumeKg, timeSec)) stats.push({ v: thousands(volumeKg || 0), k: '容量 kg' });
  if ((Number(timeSec) || 0) > 0) stats.push({ v: dur(timeSec), k: '累计时长' });
  return stats;
}
function strengthMeta(exerciseCount, setCount, volumeKg, timeSec) {
  const bits = [exerciseCount + ' 动作', setCount + ' 组'];
  if (showVolume(volumeKg, timeSec)) bits.push(thousands(volumeKg || 0) + ' kg');
  if ((Number(timeSec) || 0) > 0) bits.push(dur(timeSec));
  return bits.join(' · ');
}
function strengthSummary(exerciseCount, setCount, volumeKg, timeSec) {
  const bits = [exerciseCount + ' 个动作', setCount + ' 组'];
  if (showVolume(volumeKg, timeSec)) bits.push(thousands(volumeKg || 0) + ' kg');
  if ((Number(timeSec) || 0) > 0) bits.push(dur(timeSec));
  return bits.join(' · ');
}
module.exports = { dateLabel, md, mdSlash, kg, fixed1, thousands, signed, hm, lastTwo, capFirst, dur, bestLabel, showVolume, strengthStats, strengthMeta, strengthSummary };
