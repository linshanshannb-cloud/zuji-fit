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
function knownKg(volumeKg) { return typeof volumeKg === 'number' && isFinite(volumeKg); }
function showVolume(volumeKg, timeSec) {
  return knownKg(volumeKg) && ((Number(volumeKg) || 0) > 0 || (Number(timeSec) || 0) <= 0);
}
function volumeBit(volumeKg, timeSec) {
  if (!knownKg(volumeKg)) return '重量缺失';
  if (!showVolume(volumeKg, timeSec)) return '';
  return thousands(volumeKg) + ' kg';
}
function strengthStats(exerciseCount, setCount, volumeKg, timeSec) {
  const stats = [
    { role: 'exercises', v: exerciseCount, k: '动作' },
    { role: 'sets', v: setCount, k: '组' },
  ];
  if (!knownKg(volumeKg)) stats.push({ role: 'volume', v: '缺失', k: '总训练重量', hint: '没有可核对的组数据' });
  else if (showVolume(volumeKg, timeSec)) stats.push({ role: 'volume', v: thousands(volumeKg), unit: 'kg', k: '总训练重量', hint: '累计负重，不是体重' });
  if ((Number(timeSec) || 0) > 0) stats.push({ role: 'timed', v: dur(timeSec), k: '计时组累计', hint: '不含休息' });
  return stats;
}
function strengthBits(exerciseCount, setCount, volumeKg, timeSec, exWord) {
  const bits = [exerciseCount + exWord, setCount + ' 组'];
  const vol = volumeBit(volumeKg, timeSec);
  if (vol) bits.push(vol);
  if ((Number(timeSec) || 0) > 0) bits.push('计时 ' + dur(timeSec));
  return bits.join(' · ');
}
function strengthMeta(exerciseCount, setCount, volumeKg, timeSec) {
  return strengthBits(exerciseCount, setCount, volumeKg, timeSec, ' 动作');
}
function strengthSummary(exerciseCount, setCount, volumeKg, timeSec) {
  return strengthBits(exerciseCount, setCount, volumeKg, timeSec, ' 个动作');
}
// Wall clock from draft start to finish. Rest and gaps are included. Missing or reversed timestamps are not guessed.
function sessionMinutes(startedAt, completedAt) {
  if (typeof startedAt !== 'number' || typeof completedAt !== 'number') return null;
  if (!isFinite(startedAt) || !isFinite(completedAt) || completedAt < startedAt) return null;
  return Math.max(1, Math.round((completedAt - startedAt) / 60000));
}
function sessionLine(startedAt, completedAt) {
  if (typeof startedAt !== 'number' || !isFinite(startedAt)) return '补录';
  const start = hm(startedAt) + ' 开始';
  const min = sessionMinutes(startedAt, completedAt);
  if (min == null) return start;
  return start + ' · 训练用时 ' + min + ' 分钟（含休息）';
}
// Calendar strength card. Same volume rule as the detail. Session minutes stay separate from timed-set totals.
function strengthCardSub(volumeKg, timeSec, durationMin) {
  const bits = [];
  const vol = volumeBit(volumeKg, timeSec);
  if (vol) bits.push(vol);
  if (typeof durationMin === 'number' && isFinite(durationMin) && durationMin > 0) bits.push('用时 ' + durationMin + ' 分钟');
  return bits.join(' · ');
}
module.exports = { dateLabel, md, mdSlash, kg, fixed1, thousands, signed, hm, lastTwo, capFirst, dur, bestLabel, showVolume, strengthStats, strengthMeta, strengthSummary, sessionMinutes, sessionLine, strengthCardSub };
