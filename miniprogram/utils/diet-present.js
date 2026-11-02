// 饮食今日页的纯展示与快照换算。不读存储、不改计划。
const D = require('./date');
const Fml = require('./diet-formula');

const MEALS = [
  { id: 'breakfast', label: '早餐' },
  { id: 'lunch', label: '午餐' },
  { id: 'dinner', label: '晚餐' },
  { id: 'snack', label: '加餐' },
  { id: 'other', label: '其他记录' },
];
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function round1(n) { return Math.round(Number(n) * 10) / 10; }
function fmtG(n) {
  const r = round1(n);
  return isFinite(r) ? String(r) : '0';
}
function mealLabel(id) {
  const row = MEALS.find(m => m.id === id);
  return row ? row.label : '其他记录';
}
function normalizeMeal(id) {
  return MEALS.some(m => m.id === id) ? id : 'other';
}
// 当前时刻推断餐次。凌晨和夜宵、下午茶归加餐。看历史日期时仍用现在的钟点。
function inferMeal(date) {
  const d = date instanceof Date ? date : new Date(date);
  const mins = d.getHours() * 60 + d.getMinutes();
  if (mins >= 5 * 60 && mins < 10 * 60) return 'breakfast';
  if (mins >= 10 * 60 && mins < 15 * 60) return 'lunch';
  if (mins >= 17 * 60 && mins < 21 * 60) return 'dinner';
  return 'snack';
}
function dayTitle(dateStr, todayStr) {
  const d = D.parse(dateStr);
  const prefix = todayStr && dateStr.slice(0, 4) !== todayStr.slice(0, 4) ? d.getFullYear() + '年' : '';
  return prefix + (d.getMonth() + 1) + '月' + d.getDate() + '日·' + WEEK[d.getDay()];
}
function isFoodEntry(e) {
  if (!e) return false;
  if (e.kind === 'food') return true;
  if (e.kind === 'nutrient' || e.kind === 'quick') return false;
  return !!(e.foodId || e.basis);
}
function basisPhrase(name, basis) {
  const n = name || '食物';
  if (basis === 'cooked') return n + '（熟），每 100g';
  if (basis === 'raw') return n + '（生），每 100g';
  if (basis === 'per100g') return n + '（每百克），每 100g';
  if (basis === 'perServing') return n + '（每份），每 1 份';
  return n;
}
function summaryBit(e) {
  if (!isFoodEntry(e)) {
    const n = e && e.name && e.name !== '快速记录' ? String(e.name).trim() : '';
    return n || '营养素记录';
  }
  const unit = e.basis === 'perServing' ? '份' : 'g';
  const qty = e.qty == null || e.qty === '' ? '' : String(e.qty);
  return (e.name || '食物') + (qty ? ' ' + qty + unit : '');
}
function mealSummary(entries) {
  const bits = (entries || []).map(summaryBit).filter(Boolean);
  if (!bits.length) return '';
  if (bits.length <= 3) return bits.join(' · ');
  return bits.slice(0, 3).join(' · ') + ' 等';
}
function deriveSnap(entry) {
  if (!entry) return null;
  if (entry.snap && isFinite(Number(entry.snap.carbsG)) && isFinite(Number(entry.snap.proteinG)) && isFinite(Number(entry.snap.fatG))) {
    return { carbsG: Number(entry.snap.carbsG), proteinG: Number(entry.snap.proteinG), fatG: Number(entry.snap.fatG) };
  }
  const qty = Number(entry.qty);
  if (!(qty > 0)) return null;
  const k = entry.basis === 'perServing' ? qty : qty / 100;
  if (!(k > 0)) return null;
  return {
    carbsG: (Number(entry.carbsG) || 0) / k,
    proteinG: (Number(entry.proteinG) || 0) / k,
    fatG: (Number(entry.fatG) || 0) / k,
  };
}
function scaleSnap(snap, basis, qty) {
  const q = Number(qty);
  if (!snap || !isFinite(q) || q < 0) return null;
  const k = basis === 'perServing' ? q : q / 100;
  const carbsG = round1((Number(snap.carbsG) || 0) * k);
  const proteinG = round1((Number(snap.proteinG) || 0) * k);
  const fatG = round1((Number(snap.fatG) || 0) * k);
  return { carbsG, proteinG, fatG, kcal: Math.round(Fml.kcalOf(carbsG, proteinG, fatG)) };
}
// 目标缺失或 ≤0：不除零，进度为 0，文案固定「未设置目标」。差额只用「还差 / 超出」，不出现负号。
function macroRemain(eaten, target) {
  const e = Number(eaten);
  const eatenN = isFinite(e) ? Math.max(0, e) : 0;
  const t = Number(target);
  if (target == null || target === '' || !isFinite(t) || t <= 0) {
    return { right: '未设置目标', gap: '', bar: 0, unset: true };
  }
  const diff = eatenN - t;
  let gap = '已达到';
  if (diff > 0.049) gap = '超出 ' + fmtG(diff) + 'g';
  else if (diff < -0.049) gap = '还差 ' + fmtG(-diff) + 'g';
  const bar = Math.max(0, Math.min(100, Math.round((eatenN / t) * 100)));
  return { right: fmtG(eatenN) + ' / ' + fmtG(t) + 'g', gap, bar, unset: false };
}
function kcalRemain(eatenKcal, targetKcal) {
  const e = Math.round(Number(eatenKcal) || 0);
  const tNum = Number(targetKcal);
  if (targetKcal == null || targetKcal === '' || !isFinite(tNum) || tNum <= 0) {
    return { line: e + ' kcal', remain: '未设置目标', unset: true };
  }
  const t = Math.round(tNum);
  const left = t - e;
  if (left >= 0) return { line: e + ' / ' + t + ' kcal', remain: '剩余 ' + left + ' kcal', unset: false };
  return { line: e + ' / ' + t + ' kcal', remain: '超出 ' + (-left) + ' kcal', unset: false };
}
function dayBadge(target) {
  if (!target) return '';
  if (target.dayType === 'high') return '高碳日';
  if (target.dayType === 'mid') return '中碳日';
  if (target.dayType === 'low') return '低碳日';
  if (target.mode === 'taper') return '渐降日';
  return '';
}
function intakeView(totals, target) {
  const eaten = totals || { carbsG: 0, proteinG: 0, fatG: 0, kcal: 0 };
  const kcal = kcalRemain(eaten.kcal, target ? target.kcal : null);
  const rows = [
    Object.assign({ key: 'carbs', name: '碳水' }, macroRemain(eaten.carbsG, target ? target.carbsG : null)),
    Object.assign({ key: 'protein', name: '蛋白质' }, macroRemain(eaten.proteinG, target ? target.proteinG : null)),
    Object.assign({ key: 'fat', name: '脂肪' }, macroRemain(eaten.fatG, target ? target.fatG : null)),
  ];
  return { kcalLine: kcal.line, remain: kcal.remain, badge: dayBadge(target), rows, unset: kcal.unset };
}
function presentEntry(e) {
  const food = isFoodEntry(e);
  const meal = normalizeMeal(e && e.meal);
  const named = e && e.name && e.name !== '快速记录' ? e.name : '';
  return {
    id: e.id,
    kind: food ? 'food' : 'nutrient',
    meal,
    mealLabel: mealLabel(meal),
    name: food ? (e.name || '') : named,
    displayName: food ? (e.name || '食物') : (named || '营养素记录'),
    basis: e.basis || '',
    basisText: food ? basisPhrase(e.name || '食物', e.basis) : '',
    qty: e.qty == null ? '' : String(e.qty),
    qtyText: e.qty == null ? '' : (e.basis === 'perServing' ? e.qty + ' 份' : e.qty + ' g'),
    carbsG: e.carbsG,
    proteinG: e.proteinG,
    fatG: e.fatG,
    line: fmtG(e.carbsG) + ' / ' + fmtG(e.proteinG) + ' / ' + fmtG(e.fatG) + ' g',
    example: !!e.example,
  };
}
function groupMeals(entries) {
  const buckets = {};
  MEALS.forEach(m => { buckets[m.id] = []; });
  (entries || []).forEach(e => { if (e) buckets[normalizeMeal(e.meal)].push(e); });
  return MEALS.filter(m => buckets[m.id].length).map(m => {
    const list = buckets[m.id];
    let c = 0, p = 0, f = 0;
    list.forEach(e => { c += Number(e.carbsG) || 0; p += Number(e.proteinG) || 0; f += Number(e.fatG) || 0; });
    return {
      id: m.id,
      label: m.label,
      count: list.length,
      summary: mealSummary(list),
      kcal: Math.round(Fml.kcalOf(c, p, f)),
      entries: list.map(presentEntry),
    };
  });
}
// 旧三大营养素记录 → 营养素记录。不猜食物名。食物只补快照，不回读食物表。
function migrateEntry(entry) {
  const e = Object.assign({}, entry);
  e.meal = normalizeMeal(entry && entry.meal);
  if (isFoodEntry(entry)) {
    e.kind = 'food';
    if (!e.snap) {
      const snap = deriveSnap(e);
      if (snap) e.snap = { carbsG: round1(snap.carbsG), proteinG: round1(snap.proteinG), fatG: round1(snap.fatG) };
    }
  } else {
    e.kind = 'nutrient';
    if (e.name == null || e.name === '快速记录') e.name = '';
  }
  e.v = 2;
  return e;
}

module.exports = {
  MEALS, WEEK, round1, fmtG, mealLabel, normalizeMeal, inferMeal, dayTitle, isFoodEntry, basisPhrase,
  summaryBit, mealSummary, deriveSnap, scaleSnap, macroRemain, kcalRemain, dayBadge, intakeView,
  presentEntry, groupMeals, migrateEntry,
};
