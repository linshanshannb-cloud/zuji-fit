// 饮食目标页 / 饮食回顾页共用的表单转换。不写存储。
const D = require('./date');
const repo = require('./repo/index');
const formula = require('./diet-formula');

const WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const REASON = { create: '创建', adjust: '确认调整', switch: '切换模式', refweight: '更新参考体重', calendar: '调整日历' };
const g = n => (n == null || n === '' || !isFinite(Number(n)) ? '—' : String(Math.round(Number(n) * 10) / 10));

function emptyForm(weight) {
  return {
    mode: 'taper', refWeightKg: weight || '', sex: '', age: '', heightCm: '', activity: '',
    energyMode: 'tdee_pct', deficitPct: '20', deficitKcal: '', absoluteTarget: '',
    macroMode: 's4b', proteinPerKg: '1.5', cycleProtein: '1.2', fatPct: '22.5',
    bodyType: '', fatPerKg: '1.1', weekPattern: formula.DEFAULTS.weekPattern.slice(),
    showBlogMap: false, overrideOn: false, carbsG: '', proteinG: '', fatG: '',
  };
}
function latestWeightStr() {
  const rows = repo.body.listBody().filter(r => r.weightKg != null && r.date <= D.today());
  return rows.length ? String(rows[rows.length - 1].weightKg) : '';
}
function settingsToForm(plan) {
  const s = plan.settings || {};
  const stage = repo.diet.activeStage() || {};
  const taper = stage.mode !== 'cycle';
  const pattern = (stage.weekPattern && stage.weekPattern.slice()) || (s.weekPattern && s.weekPattern.slice()) || formula.DEFAULTS.weekPattern.slice();
  return {
    mode: stage.mode || 'taper',
    refWeightKg: String(plan.refWeightKg),
    sex: s.sex || '',
    age: s.age == null || s.age === '' ? '' : String(s.age),
    heightCm: s.heightCm == null || s.heightCm === '' ? '' : String(s.heightCm),
    activity: s.activity || '',
    energyMode: s.energyMode || 'tdee_pct',
    deficitPct: s.deficitPct == null ? '20' : String(s.deficitPct),
    deficitKcal: s.deficitKcal == null ? '' : String(s.deficitKcal),
    absoluteTarget: s.absoluteTarget == null ? '' : String(s.absoluteTarget),
    macroMode: s.macroMode || 's4b',
    proteinPerKg: taper && s.proteinPerKg != null ? String(s.proteinPerKg) : '1.5',
    cycleProtein: !taper && s.proteinPerKg != null ? String(s.proteinPerKg) : '1.2',
    fatPct: s.fatPct == null ? '22.5' : String(Math.round(s.fatPct * 1000) / 10),
    bodyType: s.bodyType || '',
    fatPerKg: s.fatPerKg == null ? '1.1' : String(s.fatPerKg),
    weekPattern: pattern,
    showBlogMap: !!plan.showBlogMap,
    overrideOn: false, carbsG: '', proteinG: '', fatG: '',
  };
}
function formToInput(form, extra) {
  const input = {
    mode: form.mode, refWeightKg: form.refWeightKg, sex: form.sex, age: form.age, heightCm: form.heightCm,
    activity: form.activity, energyMode: form.energyMode, deficitPct: form.deficitPct, deficitKcal: form.deficitKcal,
    absoluteTarget: form.absoluteTarget, macroMode: form.macroMode,
    proteinPerKg: form.mode === 'cycle' ? form.cycleProtein : form.proteinPerKg,
    bodyType: form.bodyType, fatPerKg: form.fatPerKg, weekPattern: form.weekPattern, showBlogMap: form.showBlogMap,
  };
  if (form.mode === 'taper' && String(form.fatPct).trim() !== '') input.fatPct = Number(form.fatPct) / 100;
  if (form.mode === 'taper' && form.overrideOn) { input.carbsG = form.carbsG; input.proteinG = form.proteinG; input.fatG = form.fatG; }
  return Object.assign(input, extra || {});
}
function decoratePreview(p) {
  if (!p) return null;
  if (p.mode === 'taper') {
    return {
      mode: 'taper', c: g(p.carbsG), p: g(p.proteinG), f: g(p.fatG), k: String(p.kcal),
      tdee: p.params.tdee == null ? '' : String(Math.round(p.params.tdee)),
      target: p.params.targetKcal == null ? '' : String(Math.round(p.params.targetKcal)),
      bmr: p.params.bmr == null ? '' : String(Math.round(p.params.bmr)),
    };
  }
  return {
    mode: 'cycle',
    days: ['high', 'mid', 'low'].map(t => ({ type: t, label: formula.SPLIT[t].label, c: g(p.days[t].carbsG), p: g(p.days[t].proteinG), f: g(p.days[t].fatG), k: String(p.days[t].kcal) })),
  };
}
function savedInput(extra) {
  const plan = repo.diet.getPlan();
  const s = (plan && plan.settings) || {};
  const stage = repo.diet.activeStage() || {};
  return Object.assign({
    mode: stage.mode, refWeightKg: plan.refWeightKg, sex: s.sex, age: s.age, heightCm: s.heightCm, activity: s.activity,
    energyMode: s.energyMode, deficitPct: s.deficitPct, deficitKcal: s.deficitKcal, absoluteTarget: s.absoluteTarget,
    macroMode: s.macroMode, proteinPerKg: s.proteinPerKg, fatPct: s.fatPct, bodyType: s.bodyType, fatPerKg: s.fatPerKg,
    weekPattern: stage.weekPattern || s.weekPattern, confirmExisting: true,
  }, extra || {});
}

module.exports = { WEEK, REASON, g, emptyForm, latestWeightStr, settingsToForm, formToInput, decoratePreview, savedInput };
