// 公式说明：数字全部来自 diet-formula，避免和 §J 各写一套。
const formula = require('../../utils/diet-formula');
const g = n => String(Math.round(n * 10) / 10);
const k1 = n => (Math.round(n * 10) / 10).toFixed(1);
function dayRows(plan) {
  return ['high', 'mid', 'low'].map(t => {
    const d = plan.days[t];
    return { type: t, label: formula.SPLIT[t].label, c: g(d.carbsG), p: g(d.proteinG), f: g(d.fatG), kcal: k1(d.kcal), shareC: Math.round(formula.SPLIT[t].carbShare * 100), shareF: Math.round(formula.SPLIT[t].fatShare * 100), days: formula.SPLIT[t].days };
  });
}
Page({
  data: { activities: formula.ACTIVITY, exclusions: formula.EXCLUSIONS, oral: [], proposal: [], kcalNote: formula.COPY.kcalNote },
  onLoad() {
    const tables = formula.anchorTables();
    this.setData({ oral: dayRows(tables.oral), proposal: dayRows(tables.proposal) });
  },
});
