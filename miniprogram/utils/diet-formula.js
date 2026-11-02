// Diet formulas locked by §J / D-001 / D-003.
// Do not retune high/mid/low shares to force the three days' kcal to match.
// Carb 4 kcal/g, protein 4, fat 9.
const ACTIVITY = [
  { id: 'sedentary', label: '久坐', factor: 1.2, hint: '很少运动' },
  { id: 'light', label: '轻度', factor: 1.375, hint: '每周 1–3 次' },
  { id: 'moderate', label: '中度', factor: 1.55, hint: '每周 3–5 次' },
  { id: 'heavy', label: '重度', factor: 1.725, hint: '几乎每日高强度' },
  { id: 'extreme', label: '极重', factor: 1.9, hint: '体力劳动或一天两练' },
];
const SPLIT = {
  high: { days: 2, carbShare: 0.5, fatShare: 0.15, label: '高' },
  mid: { days: 3, carbShare: 0.35, fatShare: 0.35, label: '中' },
  low: { days: 2, carbShare: 0.15, fatShare: 0.5, label: '低' },
};
const DEFAULTS = {
  deficitPct: 20,
  proteinPerKgTaper: 1.5,
  fatPct: 0.225,
  observeDays: 7,
  stuckDeltaG: -15,
  stuckChoices: [-15, -20, -30],
  strengthDeltaG: 15,
  carbFloorPct: 0.4,
  noLogTipDays: 3,
  declineWeeksTip: 8,
  cycleProteinPerKg: 1.2,
  endoCarbPerKg: 2,
  endoFatPerKg: 0.8,
  ectoCarbPerKg: 3,
  ectoFatPerKg: 1.1,
  ectoFatChoices: [1, 1.1, 1.2],
  weekPattern: ['high', 'mid', 'low', 'mid', 'high', 'mid', 'low'],
  riceCarbPer100g: 25,
};
const BASIS = [
  { id: 'raw', label: '生重' },
  { id: 'cooked', label: '熟重' },
  { id: 'per100g', label: '每百克' },
  { id: 'perServing', label: '每份' },
];
// 上集口播例。生熟未说明，蛋白和脂肪口播没给，按 0 计，界面必须再选口径。
const EXAMPLES = [
  { id: 'ex-rice', name: '米饭', example: true, carbsPer100g: 25, proteinPer100g: 0, fatPer100g: 0, note: '上集口播例，生熟未明' },
  { id: 'ex-mantou', name: '馒头', example: true, carbsPer100g: 50, proteinPer100g: 0, fatPer100g: 0, note: '上集口播例，生熟未明' },
  { id: 'ex-pumpkin', name: '南瓜', example: true, carbsPer100g: 4.4, proteinPer100g: 0, fatPer100g: 0, note: '上集口播例，生熟未明' },
];
const BLOG_MAP = [
  { type: 'high', label: '高碳', text: '臀、腿、背' },
  { type: 'mid', label: '中碳', text: '胸、背、肩' },
  { type: 'low', label: '低碳', text: '有氧、手臂、肩、纯休息' },
];
const COPY = {
  kcalNote: '口播称高、中、低碳日热量接近，差值可用蔬菜补上。按公式算出的中碳日热量常常更低，这是预期结果，不会为了凑平去改你的克数。',
  restHint: '低碳日优先放在休息日。训练部位和高、中、低怎么对应，下集还没有收齐，这里不会自动改你的安排。',
  blogDisclaimer: '非核实原片，仅参考',
  unlogged: '未记录',
  floorTip: '已到碳水底线，建议停止继续降碳，或进入维持。不会自动改目标。',
  noLogTip: '已连续多日没有摄入记录，建议补记。没记的日子不会按 0 算进饮食回顾。',
  strengthTip: '如果力量明显下滑，建议把碳水上调，默认 +15 g，可以改。确认前不会改目标。',
  declineTip: '碳水已经连续多周往下走，可以考虑先维持一段时间。',
};
// Listed so the formula page can say these are not defaults. They are not modes.
const EXCLUSIONS = [
  '抖音「三低一高 / 四低一高」没有核实过的 g/kg，不进默认',
  '百度经验的高 2 中 2 低 3、营养师纯倍数、112113 六天制、未展开的 metabolab 页，不进默认',
  '他人自述的「低碳不低于 110 g / 不要连续三天低碳 / 每次调 10–15 g」，不进默认',
  '0 碳日不是基础版（上集说基础版没有，只是以后的调整手段）',
  '博客园的部位对照默认关闭；打开也只是参考，不会自动排日历',
];

function activityFactor(id) {
  const row = ACTIVITY.find(a => a.id === id);
  return row ? row.factor : null;
}
function bmr(p) {
  if (!p || (p.sex !== 'male' && p.sex !== 'female')) return null;
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'female' ? base - 161 : base + 5;
}
function tdee(bmrValue, activityId) {
  const f = activityFactor(activityId);
  if (f == null || bmrValue == null || !isFinite(bmrValue)) return null;
  return bmrValue * f;
}
function kcalOf(c, p, f) { return 4 * c + 4 * p + 9 * f; }
function round1(n) { return Math.round(n * 10) / 10; }
function roundMacros(m) {
  const carbsG = round1(m.carbsG), proteinG = round1(m.proteinG), fatG = round1(m.fatG);
  return { carbsG, proteinG, fatG, kcal: Math.round(kcalOf(carbsG, proteinG, fatG)) };
}
// S4b (default) or 532. Returns raw grams; callers round for storage.
function macrosFromTarget(target, opts) {
  const mode = opts.mode === '532' ? '532' : 's4b';
  if (mode === '532') {
    const carbsG = target * 0.5 / 4, proteinG = target * 0.3 / 4, fatG = target * 0.2 / 9;
    return { carbsG, proteinG, fatG, kcal: kcalOf(carbsG, proteinG, fatG) };
  }
  const proteinG = opts.weightKg * opts.proteinPerKg;
  const fatKcal = target * opts.fatPct;
  const fatG = fatKcal / 9;
  const carbKcal = target - proteinG * 4 - fatKcal;
  const carbsG = carbKcal / 4;
  return { carbsG, proteinG, fatG, kcal: kcalOf(carbsG, proteinG, fatG) };
}
function targetFromTdee(tdeeValue, deficitPct) { return tdeeValue * (1 - deficitPct / 100); }
function cycleStandards(bodyType, fatPerKg) {
  if (bodyType === 'ecto') return { carbPerKg: DEFAULTS.ectoCarbPerKg, fatPerKg: fatPerKg == null ? DEFAULTS.ectoFatPerKg : fatPerKg };
  return { carbPerKg: DEFAULTS.endoCarbPerKg, fatPerKg: DEFAULTS.endoFatPerKg };
}
function cyclePlan(input) {
  const std = cycleStandards(input.bodyType, input.fatPerKg);
  const proteinG = input.weightKg * input.proteinPerKg;
  const carbWeek = input.weightKg * std.carbPerKg * 7;
  const fatWeek = input.weightKg * std.fatPerKg * 7;
  const days = {};
  ['high', 'mid', 'low'].forEach(type => {
    const sp = SPLIT[type];
    const carbsG = carbWeek * sp.carbShare / sp.days;
    const fatG = fatWeek * sp.fatShare / sp.days;
    days[type] = { carbsG, proteinG, fatG, kcal: kcalOf(carbsG, proteinG, fatG) };
  });
  return { std, proteinG, carbWeek, fatWeek, days };
}
function patternCounts(pattern) {
  const c = { high: 0, mid: 0, low: 0 };
  (pattern || []).forEach(t => { if (Object.prototype.hasOwnProperty.call(c, t)) c[t]++; });
  return c;
}
function patternValid(pattern) {
  if (!Array.isArray(pattern) || pattern.length !== 7) return false;
  if (pattern.some(t => !Object.prototype.hasOwnProperty.call(SPLIT, t))) return false;
  const c = patternCounts(pattern);
  return c.high === 2 && c.mid === 3 && c.low === 2;
}
function riceCarbs(grams) { return grams * DEFAULTS.riceCarbPer100g / 100; }
function scaleFood(spec, basis, qty) {
  if (basis === 'perServing') {
    return { carbsG: spec.carbsG * qty, proteinG: spec.proteinG * qty, fatG: spec.fatG * qty };
  }
  const c = spec.carbsPer100g != null ? spec.carbsPer100g : spec.carbsG;
  const p = spec.proteinPer100g != null ? spec.proteinPer100g : spec.proteinG;
  const f = spec.fatPer100g != null ? spec.fatPer100g : spec.fatG;
  const k = qty / 100;
  return { carbsG: c * k, proteinG: p * k, fatG: f * k };
}
function anchorTables() {
  const oral = cyclePlan({ weightKg: 90, bodyType: 'endo', proteinPerKg: 1, fatPerKg: 0.8 });
  const proposal = cyclePlan({ weightKg: 90, bodyType: 'endo', proteinPerKg: DEFAULTS.cycleProteinPerKg, fatPerKg: 0.8 });
  return { oral, proposal };
}
function basisLabel(id) {
  const row = BASIS.find(b => b.id === id);
  return row ? row.label : '';
}
module.exports = {
  ACTIVITY, SPLIT, DEFAULTS, BASIS, EXAMPLES, BLOG_MAP, COPY, EXCLUSIONS,
  activityFactor, bmr, tdee, kcalOf, round1, roundMacros, macrosFromTarget, targetFromTdee,
  cycleStandards, cyclePlan, patternCounts, patternValid, riceCarbs, scaleFood, anchorTables, basisLabel,
};
