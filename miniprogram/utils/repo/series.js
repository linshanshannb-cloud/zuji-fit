// Chart helpers built on body.bodySeries: date-proportional x positions; gaps stay gaps (no fabricated points).
const D = require('../date');
const dayIndex = s => Math.round(D.parse(s).getTime() / 86400000);
// Y axis on "nice" steps (DESIGN §4.7, REVIEW M6): 10% margin, bounds snapped to the step, 2–4 intervals,
// labels with 1 decimal only when step < 1 -> tick labels are always distinct.
const STEPS = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
function niceScale(min, max) {
  const nonNeg = min >= 0;
  if (min === max) { min -= 0.5; max += 0.5; }
  const span = max - min; min -= span * 0.1; max += span * 0.1;
  let step = STEPS[STEPS.length - 1];
  for (const s of STEPS) { if (Math.ceil(max / s - 1e-9) - Math.floor(min / s + 1e-9) <= 4) { step = s; break; } }
  let lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step;
  if (nonNeg && lo < 0) lo = 0;
  if (Math.round((hi - lo) / step) < 2) hi = lo + 2 * step;
  lo = Math.round(lo * 10) / 10; hi = Math.round(hi * 10) / 10;
  return { lo, hi, step, decimals: step < 1 ? 1 : 0 };
}
function chartLayout(series, w, h, pad = { l: 40, r: 12, t: 12, b: 24 }) {
  const pts = series.points;
  if (!pts.length) return { points: [], ticks: [], pad, w, h };
  const vals = pts.map(p => p.value);
  const raw = niceScale(Math.min.apply(null, vals), Math.max.apply(null, vals));
  const min = raw.lo, max = raw.hi;
  const x0 = dayIndex(series.from), x1 = dayIndex(series.to), iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const points = pts.map(p => ({ date: p.date, value: p.value,
    x: pad.l + (x1 === x0 ? iw / 2 : (iw * (dayIndex(p.date) - x0)) / (x1 - x0)), y: pad.t + ih * (1 - (p.value - min) / (max - min)) }));
  const n = Math.round((max - min) / raw.step);
  const ticks = [];
  for (let k = 0; k <= n; k++) {
    const v = Math.round((min + raw.step * k) * 10) / 10;
    ticks.push({ v, label: v.toFixed(raw.decimals), y: pad.t + ih * (1 - k / n) });
  }
  return { points, ticks, pad, w, h };
}
// Keep the bubble fully inside the canvas: clamp x to [0, w - bw]; flip below the point when too close to the top (REVIEW M5).
function bubblePos(p, w, h, bw, text) {
  const bh = 28;
  const left = Math.max(0, Math.min(w - bw, p.x - bw / 2));
  const top = p.y - bh - 10 >= 0 ? p.y - bh - 10 : Math.min(h - bh, p.y + 10);
  return { left: Math.round(left), top: Math.round(top), text };
}
module.exports = { chartLayout, niceScale, bubblePos };
