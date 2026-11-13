// Local diet plan, stage snapshots, intake logs, custom foods.
// Keys are optional: a missing key is an empty state, same idea as fit_rest_days.
// New body-weight rows never rewrite a stage. Intake is a different key from the plan.
const S = require('../storage');
const K = require('./keys');
const C = require('./core');
const V = require('./validate');
const D = require('../date');
const { newId } = require('./ids');
const Fml = require('../diet-formula');
const P = require('../diet-present');
const Ai = require('../diet-ai');

const num = v => {
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  return /^-?(\d+(\.\d*)?|\.\d+)$/.test(s) ? Number(s) : NaN;
};
function needNum(v, label, min, max) {
  if (V.isBlank(v)) C.raise('VALIDATION', '请填写' + label);
  const n = num(typeof v === 'number' ? String(v) : v);
  if (!isFinite(n)) C.raise('VALIDATION', label + '必须是数字');
  if (n < min || n > max) C.raise('VALIDATION', label + '需在 ' + min + '–' + max);
  return n;
}
function blankish(v) { return v == null || v === ''; }

function problem() {
  S.getTyped(K.DIET_PLAN, 'object', null);
  S.getTyped(K.DIET_LOGS, 'array', []);
  S.getTyped(K.DIET_FOODS, 'array', []);
  const h = S.getHealth();
  const keys = [K.DIET_PLAN, K.DIET_LOGS, K.DIET_FOODS].filter(k => h.corruptKeys.includes(k) || h.unreadableKeys.includes(k));
  return keys.length ? { code: 'DATA_CORRUPT', message: '饮食数据读取异常，已暂停保存以保护原数据', keys } : null;
}
function readPlan() { return S.getTyped(K.DIET_PLAN, 'object', null); }
function writePlan(plan) { S.set(K.DIET_PLAN, plan); }
function readLogs() { return S.getTyped(K.DIET_LOGS, 'array', []); }
function writeLogs(list) { S.set(K.DIET_LOGS, list); }
function readFoods() { return S.getTyped(K.DIET_FOODS, 'array', []); }
function writeFoods(list) { S.set(K.DIET_FOODS, list); }
const stagesOf = plan => (plan && Array.isArray(plan.stages) ? plan.stages : []);

function stageForDate(plan, date) {
  const list = stagesOf(plan).filter(s => s && s.startDate <= date);
  list.sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : (a.confirmedAt || 0) - (b.confirmedAt || 0)));
  return list.length ? list[list.length - 1] : null;
}
function activeStage(plan) {
  if (!plan) return null;
  const hit = stagesOf(plan).find(s => s.id === plan.activeStageId);
  return hit || stageForDate(plan, C.today());
}
function planStart(plan) {
  const dates = stagesOf(plan).map(s => s.startDate).filter(Boolean).sort();
  return dates.length ? dates[0] : null;
}
function totals(log) {
  return P.sumIntake(log && log.entries);
}
function dayTarget(date, plan) {
  const p = plan || readPlan();
  if (!p) return null;
  const stage = stageForDate(p, date);
  if (!stage) return null;
  if (stage.mode === 'cycle') {
    const idx = (D.parse(date).getDay() + 6) % 7;
    const dayType = stage.weekPattern[idx];
    const m = stage.days[dayType];
    if (!m) return null;
    return {
      date, mode: 'cycle', stageId: stage.id, startDate: stage.startDate, refWeightKg: stage.refWeightKg, dayType,
      carbsG: m.carbsG, proteinG: m.proteinG, fatG: m.fatG, kcal: m.kcal,
    };
  }
  return {
    date, mode: 'taper', stageId: stage.id, startDate: stage.startDate, refWeightKg: stage.refWeightKg, dayType: null,
    carbsG: stage.carbsG, proteinG: stage.proteinG, fatG: stage.fatG, kcal: stage.kcal,
  };
}
function floorInfo(plan, stage) {
  if (!plan || !stage || stage.mode !== 'taper' || plan.anchorCarbsG == null) return null;
  const pct = plan.carbFloorPct == null ? Fml.DEFAULTS.carbFloorPct : plan.carbFloorPct;
  const floorG = plan.carbFloorG != null ? plan.carbFloorG : Fml.round1(plan.anchorCarbsG * pct);
  return { floorG, anchorG: plan.anchorCarbsG, pct, atFloor: stage.carbsG <= floorG + 0.05, usesAbsolute: plan.carbFloorG != null };
}
function observeWindow(stage, today) {
  if (!stage || stage.mode !== 'taper') return null;
  const days = (stage.params && stage.params.observeDays) || Fml.DEFAULTS.observeDays;
  const start = stage.startDate;
  const end = D.addDays(start, days - 1);
  let elapsed = 0;
  if (today >= start) {
    const cap = today < end ? today : end;
    elapsed = 1;
    let d = start;
    while (d < cap && elapsed < days) { d = D.addDays(d, 1); elapsed++; }
  }
  return { start, end, days, elapsed, complete: today >= end };
}
function declineTip(plan, today) {
  if (!plan) return null;
  const stages = stagesOf(plan).filter(s => s.mode === 'taper').slice().sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : (a.confirmedAt || 0) - (b.confirmedAt || 0)));
  if (stages.length < 2) return null;
  let i = stages.length - 1;
  while (i > 0 && stages[i].carbsG < stages[i - 1].carbsG - 0.05) i--;
  const start = stages[i], cur = stages[stages.length - 1];
  if (!(cur.carbsG < start.carbsG - 0.05)) return null;
  let days = 0, d = start.startDate;
  while (d < today && days < 4000) { d = D.addDays(d, 1); days++; }
  const weeks = Math.floor(days / 7);
  const n = plan.declineWeeksTip || Fml.DEFAULTS.declineWeeksTip;
  if (weeks < n) return null;
  return { weeks, n, from: start.carbsG, to: cur.carbsG };
}

function buildTaper(input, weight) {
  const macroMode = input.macroMode === '532' ? '532' : 's4b';
  const proteinPerKg = blankish(input.proteinPerKg) ? Fml.DEFAULTS.proteinPerKgTaper : needNum(input.proteinPerKg, '蛋白系数', 0.5, 3);
  const fatPct = blankish(input.fatPct) ? Fml.DEFAULTS.fatPct : needNum(input.fatPct, '脂肪占比', 0.05, 0.6);
  const energyMode = input.energyMode || 'tdee_pct';
  const params = { energyMode, macroMode, proteinPerKg, fatPct, bmr: null, tdee: null, targetKcal: null, override: false, observeDays: Fml.DEFAULTS.observeDays, deficitPct: Fml.DEFAULTS.deficitPct, deficitKcal: null, absoluteTarget: null, sex: null, age: null, heightCm: null, activity: null };
  let target;
  if (energyMode === 'absolute_target') {
    target = needNum(input.absoluteTarget, '目标热量', 800, 8000);
    params.absoluteTarget = target;
  } else if (energyMode === 'absolute_deficit' || energyMode === 'tdee_pct') {
    if (input.sex !== 'male' && input.sex !== 'female') C.raise('VALIDATION', '请选择性别');
    const age = needNum(input.age, '年龄', 10, 100);
    if (Math.round(age) !== age) C.raise('VALIDATION', '年龄需为整数');
    const heightCm = needNum(input.heightCm, '身高', 100, 250);
    if (!Fml.activityFactor(input.activity)) C.raise('VALIDATION', '请选择活动水平');
    const bmr = Fml.bmr({ sex: input.sex, weightKg: weight, heightCm, age });
    const tdee = Fml.tdee(bmr, input.activity);
    params.sex = input.sex; params.age = age; params.heightCm = heightCm; params.activity = input.activity;
    params.bmr = bmr; params.tdee = tdee;
    if (energyMode === 'absolute_deficit') {
      const deficitKcal = needNum(input.deficitKcal, '热量缺口', 0, 3000);
      if (deficitKcal >= tdee) C.raise('VALIDATION', '缺口需要小于 TDEE');
      target = tdee - deficitKcal;
      params.deficitKcal = deficitKcal;
    } else {
      const deficitPct = blankish(input.deficitPct) ? Fml.DEFAULTS.deficitPct : needNum(input.deficitPct, '缺口比例', 0, 50);
      target = Fml.targetFromTdee(tdee, deficitPct);
      params.deficitPct = deficitPct;
    }
  } else C.raise('VALIDATION', '请选择热量算法');
  if (!(target > 0)) C.raise('VALIDATION', '目标热量需大于 0');
  params.targetKcal = target;
  let macros = Fml.macrosFromTarget(target, { mode: macroMode, weightKg: weight, proteinPerKg, fatPct });
  if (macros.carbsG < -0.05) C.raise('VALIDATION', '目标热量不够分给蛋白和脂肪，请提高热量或改用 532');
  const touched = ['carbsG', 'proteinG', 'fatG'].some(k => !blankish(input[k]));
  if (touched) {
    if (['carbsG', 'proteinG', 'fatG'].some(k => blankish(input[k]))) C.raise('VALIDATION', '微调时请同时填写碳水、蛋白和脂肪');
    params.override = true;
    macros = { carbsG: needNum(input.carbsG, '碳水', 0, 2000), proteinG: needNum(input.proteinG, '蛋白', 0, 2000), fatG: needNum(input.fatG, '脂肪', 0, 1000) };
  }
  const rounded = Fml.roundMacros(macros);
  return { mode: 'taper', refWeightKg: weight, carbsG: rounded.carbsG, proteinG: rounded.proteinG, fatG: rounded.fatG, kcal: rounded.kcal, params };
}
function buildCycle(input, weight) {
  if (input.bodyType !== 'endo' && input.bodyType !== 'ecto') C.raise('VALIDATION', '请选择体型（内胚或外胚）');
  const proteinPerKg = blankish(input.proteinPerKg) ? Fml.DEFAULTS.cycleProteinPerKg : needNum(input.proteinPerKg, '蛋白系数', 0.8, 1.5);
  let fatPerKg = Fml.DEFAULTS.endoFatPerKg;
  if (input.bodyType === 'ecto') {
    fatPerKg = blankish(input.fatPerKg) ? Fml.DEFAULTS.ectoFatPerKg : needNum(input.fatPerKg, '脂肪系数', 1, 1.2);
    if (!Fml.DEFAULTS.ectoFatChoices.some(x => Math.abs(x - fatPerKg) < 1e-6)) C.raise('VALIDATION', '外胚脂肪请选 1.0、1.1 或 1.2');
  }
  const pattern = input.weekPattern && input.weekPattern.length ? input.weekPattern : Fml.DEFAULTS.weekPattern.slice();
  if (!Fml.patternValid(pattern)) C.raise('VALIDATION', '一周需正好是高碳 2 天、中碳 3 天、低碳 2 天');
  const calc = Fml.cyclePlan({ weightKg: weight, bodyType: input.bodyType, proteinPerKg, fatPerKg });
  const days = {};
  let override = false;
  if (input.days) {
    override = true;
    ['high', 'mid', 'low'].forEach(t => {
      const src = input.days[t] || {};
      days[t] = Fml.roundMacros({
        carbsG: needNum(src.carbsG, '碳水', 0, 2000),
        proteinG: needNum(src.proteinG, '蛋白', 0, 2000),
        fatG: needNum(src.fatG, '脂肪', 0, 1000),
      });
    });
  } else {
    ['high', 'mid', 'low'].forEach(t => { days[t] = Fml.roundMacros(calc.days[t]); });
  }
  return {
    mode: 'cycle', refWeightKg: weight, weekPattern: pattern.slice(), days,
    params: { bodyType: input.bodyType, proteinPerKg, fatPerKg, carbPerKg: calc.std.carbPerKg, carbWeek: calc.carbWeek, fatWeek: calc.fatWeek, override },
  };
}
function settingsFrom(built) {
  const p = built.params;
  return {
    mode: built.mode,
    refWeightKg: built.refWeightKg,
    sex: p.sex || '',
    age: p.age == null ? '' : p.age,
    heightCm: p.heightCm == null ? '' : p.heightCm,
    activity: p.activity || '',
    energyMode: p.energyMode || 'tdee_pct',
    deficitPct: p.deficitPct == null ? Fml.DEFAULTS.deficitPct : p.deficitPct,
    deficitKcal: p.deficitKcal,
    absoluteTarget: p.absoluteTarget,
    macroMode: p.macroMode || 's4b',
    proteinPerKg: p.proteinPerKg,
    fatPct: p.fatPct == null ? null : p.fatPct,
    bodyType: p.bodyType || '',
    fatPerKg: p.fatPerKg == null ? null : p.fatPerKg,
    weekPattern: built.weekPattern ? built.weekPattern.slice() : Fml.DEFAULTS.weekPattern.slice(),
  };
}
function preview(input) {
  try {
    const weightR = V.validateBodyWeight(input && input.refWeightKg);
    if (!weightR.ok) return C.fail(weightR.code, weightR.message);
    if (!input || (input.mode !== 'taper' && input.mode !== 'cycle')) return C.fail('VALIDATION', '请选择计划模式');
    const built = input.mode === 'cycle' ? buildCycle(input, weightR.value) : buildTaper(input, weightR.value);
    const data = built.mode === 'taper'
      ? { mode: 'taper', refWeightKg: built.refWeightKg, carbsG: built.carbsG, proteinG: built.proteinG, fatG: built.fatG, kcal: built.kcal, params: built.params }
      : { mode: 'cycle', refWeightKg: built.refWeightKg, weekPattern: built.weekPattern, days: built.days, params: built.params };
    return C.ok(data);
  } catch (e) {
    if (e && e.repoCode) return C.fail(e.repoCode, e.message);
    throw e;
  }
}
function commit(input) {
  return C.guard(() => {
    C.writable();
    input = input || {};
    const existing = readPlan();
    if (existing && !input.confirmExisting) C.raise('PLAN_EXISTS', '已有饮食计划。确认后才会从今天起记入新阶段');
    const viewed = preview(input);
    if (!viewed.ok) C.raise(viewed.code, viewed.message);
    const weight = viewed.data.refWeightKg;
    const built = input.mode === 'cycle' ? buildCycle(input, weight) : buildTaper(input, weight);
    const t = C.now(), today = C.today();
    const plan = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: newId('dp_', t), v: 1, createdAt: t, showBlogMap: false,
      noLogTipDays: Fml.DEFAULTS.noLogTipDays, declineWeeksTip: Fml.DEFAULTS.declineWeeksTip,
      carbFloorPct: Fml.DEFAULTS.carbFloorPct, carbFloorG: null, anchorCarbsG: null, stages: [],
    };
    if (!existing && input.showBlogMap) plan.showBlogMap = true;
    const stage = {
      id: newId('ds_', t), planId: plan.id, mode: built.mode, startDate: today, confirmedAt: t,
      reason: input.reason || (existing ? 'adjust' : 'create'), refWeightKg: weight, params: built.params,
    };
    if (built.mode === 'taper') {
      stage.carbsG = built.carbsG; stage.proteinG = built.proteinG; stage.fatG = built.fatG; stage.kcal = built.kcal;
      const prev = existing ? stageForDate(existing, today) : null;
      if (plan.anchorCarbsG == null || !prev || prev.mode !== 'taper') plan.anchorCarbsG = stage.carbsG;
    } else {
      stage.weekPattern = built.weekPattern;
      stage.days = built.days;
    }
    plan.mode = built.mode;
    plan.refWeightKg = weight;
    plan.settings = settingsFrom(built);
    plan.updatedAt = t;
    plan.activeStageId = stage.id;
    plan.stages = stagesOf(plan).concat([stage]);
    writePlan(plan);
    return C.ok({ plan, stage });
  });
}
function updatePrefs(patch) {
  return C.guard(() => {
    C.writable();
    const plan = readPlan();
    if (!plan) C.raise('NOT_FOUND', '还没有饮食计划');
    const next = JSON.parse(JSON.stringify(plan));
    patch = patch || {};
    if ('showBlogMap' in patch) next.showBlogMap = !!patch.showBlogMap;
    if ('noLogTipDays' in patch) {
      const n = needNum(patch.noLogTipDays, '未记录提示天数', 1, 14);
      if (Math.round(n) !== n) C.raise('VALIDATION', '天数需为整数');
      next.noLogTipDays = n;
    }
    if ('declineWeeksTip' in patch) {
      const n = needNum(patch.declineWeeksTip, '连续下降提示周数', 1, 52);
      if (Math.round(n) !== n) C.raise('VALIDATION', '周数需为整数');
      next.declineWeeksTip = n;
    }
    if ('carbFloorG' in patch) {
      if (blankish(patch.carbFloorG)) next.carbFloorG = null;
      else next.carbFloorG = Fml.round1(needNum(patch.carbFloorG, '碳水底线', 0, 2000));
    }
    if ('carbFloorPct' in patch) next.carbFloorPct = needNum(patch.carbFloorPct, '底线比例', 0.05, 0.95);
    next.updatedAt = C.now();
    writePlan(next);
    return C.ok(next);
  });
}
// Draft only. Never writes.
function suggestion(kind) {
  const plan = readPlan();
  const stage = activeStage(plan);
  if (!plan || !stage) return C.fail('NOT_FOUND', '还没有饮食计划');
  if (stage.mode === 'cycle') {
    const days = {};
    ['high', 'mid', 'low'].forEach(t => {
      const src = stage.days[t];
      const carbsG = Fml.round1(src.carbsG + (kind === 'strength' ? Fml.DEFAULTS.strengthDeltaG : 0));
      days[t] = Fml.roundMacros({ carbsG, proteinG: src.proteinG, fatG: src.fatG });
    });
    const note = kind === 'strength' ? '三个日型的碳水都先 +15 g，可以分别改。确认前不会改目标，也不会改周占比公式。' : '下面是当前三日克数，改完并确认才会记入新阶段。';
    return C.ok({ kind: kind || 'manual', mode: 'cycle', days, note, floorNote: '' });
  }
  const base = stage.carbsG;
  let delta = 0;
  let note = '手动调整。确认前不会改目标。';
  if (kind === 'stuck') { delta = Fml.DEFAULTS.stuckDeltaG; note = '建议碳水 −15 g，可以改。未确认不会改目标。'; }
  if (kind === 'strength') { delta = Fml.DEFAULTS.strengthDeltaG; note = '建议碳水 +15 g，可以改。未确认不会改目标。'; }
  const floor = floorInfo(plan, stage);
  let carbs = Fml.round1(base + delta);
  let floorNote = '';
  if (floor && delta < 0 && carbs < floor.floorG) {
    floorNote = '这条建议会低于底线 ' + floor.floorG + ' g，已先填在底线上。你可以再改。确认前不会写入。';
    carbs = floor.floorG;
  }
  return C.ok({ kind: kind || 'manual', mode: 'taper', carbsG: carbs, proteinG: stage.proteinG, fatG: stage.fatG, note, floorNote, delta });
}

function getLog(date) {
  const log = readLogs().find(l => l && l.date === date);
  if (!log || !log.entries || !log.entries.length) return null;
  return log;
}
function presentIntake(date) {
  const log = getLog(date);
  if (!log) return { recorded: false, text: Fml.COPY.unlogged, entries: [], totals: null };
  return { recorded: true, text: '', entries: log.entries, totals: totals(log) };
}
function sortLogs(list) { return list.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); }
function saveQuick(date, input) {
  return C.guard(() => {
    C.writable();
    const d = C.check(V.validateDate(date, { today: C.today() }));
    input = input || {};
    const carbsG = Fml.round1(needNum(input.carbsG, '碳水', 0, 2000));
    const proteinG = Fml.round1(needNum(input.proteinG, '蛋白', 0, 2000));
    const fatG = Fml.round1(needNum(input.fatG, '脂肪', 0, 1000));
    const t = C.now();
    const entry = { id: newId('de_', t), kind: 'quick', meal: 'other', name: '快速记录', basis: null, qty: null, carbsG, proteinG, fatG, example: false, foodId: null };
    const prev = readLogs().find(l => l.date === d);
    const log = { id: prev ? prev.id : newId('dl_', t), date: d, entries: [entry], createdAt: prev ? prev.createdAt : t, updatedAt: t };
    writeLogs(sortLogs(readLogs().filter(l => l.date !== d).concat([log])));
    return C.ok(log);
  });
}
function resolveFood(input) {
  if (input.foodId) {
    const ex = Fml.EXAMPLES.find(f => f.id === input.foodId);
    if (ex) return ex;
    const custom = readFoods().find(f => f.id === input.foodId);
    if (!custom) C.raise('NOT_FOUND', '找不到这条食物');
    return custom;
  }
  const name = C.check(V.validateText(input.name, 30, 'TEXT_TOO_LONG'));
  if (!name) C.raise('VALIDATION', '请填写食物名称');
  return {
    id: null, name, example: false, basis: input.basis,
    carbsPer100g: input.carbsPer100g, proteinPer100g: input.proteinPer100g, fatPer100g: input.fatPer100g,
    carbsG: input.perCarbsG, proteinG: input.perProteinG, fatG: input.perFatG,
  };
}
function addFood(date, input) {
  return C.guard(() => {
    C.writable();
    const d = C.check(V.validateDate(date, { today: C.today() }));
    input = input || {};
    if (!Fml.BASIS.some(b => b.id === input.basis)) C.raise('BASIS_REQUIRED', '请先选择口径：生重、熟重、每百克或每份');
    const spec = resolveFood(input);
    if (spec.example && input.basis === 'perServing') C.raise('BASIS_REQUIRED', '口播例没有每份含量，请按克数换算，或自定义一条按每份记的食物');
    if (!spec.example && spec.basis && spec.basis !== input.basis) C.raise('BASIS_REQUIRED', '这条食物保存时的口径是' + Fml.basisLabel(spec.basis) + '，不能换成另一种口径');
    const qty = needNum(input.qty, input.basis === 'perServing' ? '份数' : '重量', 0.1, input.basis === 'perServing' ? 50 : 5000);
    if (input.basis === 'perServing') {
      if (blankish(spec.carbsG) || blankish(spec.proteinG) || blankish(spec.fatG)) C.raise('VALIDATION', '每份食物需要填写每份的碳、蛋白、脂肪');
    }
    const scaled = Fml.scaleFood(spec, input.basis, qty);
    ['carbsG', 'proteinG', 'fatG'].forEach(k => { if (!isFinite(scaled[k]) || scaled[k] < 0) C.raise('VALIDATION', '换算结果无效'); });
    const per = input.basis === 'perServing'
      ? { carbsG: Number(spec.carbsG), proteinG: Number(spec.proteinG), fatG: Number(spec.fatG) }
      : {
        carbsG: Number(spec.carbsPer100g != null ? spec.carbsPer100g : spec.carbsG),
        proteinG: Number(spec.proteinPer100g != null ? spec.proteinPer100g : spec.proteinG),
        fatG: Number(spec.fatPer100g != null ? spec.fatPer100g : spec.fatG),
      };
    const t = C.now();
    const entry = {
      id: newId('de_', t), kind: 'food', meal: P.normalizeMeal(input.meal || 'other'), name: spec.name, basis: input.basis, qty: Fml.round1(qty),
      snap: { carbsG: Fml.round1(per.carbsG), proteinG: Fml.round1(per.proteinG), fatG: Fml.round1(per.fatG) },
      carbsG: Fml.round1(scaled.carbsG), proteinG: Fml.round1(scaled.proteinG), fatG: Fml.round1(scaled.fatG),
      example: !!spec.example, foodId: spec.id || null, v: 2,
    };
    const logs = readLogs();
    const prev = logs.find(l => l.date === d);
    const log = prev ? JSON.parse(JSON.stringify(prev)) : { id: newId('dl_', t), date: d, entries: [], createdAt: t };
    log.entries = (log.entries || []).concat([entry]);
    log.updatedAt = t;
    writeLogs(sortLogs(logs.filter(l => l.date !== d).concat([log])));
    return C.ok(log);
  });
}
function removeEntry(date, entryId) {
  return C.guard(() => {
    C.writable();
    const logs = readLogs();
    const prev = logs.find(l => l.date === date);
    if (!prev) C.raise('NOT_FOUND', '这天没有记录');
    const entries = (prev.entries || []).filter(e => e.id !== entryId);
    if (!entries.length) { writeLogs(logs.filter(l => l.date !== date)); return C.ok(null); }
    const log = Object.assign({}, prev, { entries, updatedAt: C.now() });
    writeLogs(sortLogs(logs.filter(l => l.date !== date).concat([log])));
    return C.ok(log);
  });
}
function applyPatch(entry, patch) {
  const next = JSON.parse(JSON.stringify(entry));
  if ('meal' in patch && patch.meal != null && patch.meal !== '') next.meal = P.normalizeMeal(patch.meal);
  else if (!next.meal) next.meal = 'other';
  const nutrient = !P.isFoodEntry(next);
  if (nutrient) {
    next.kind = 'nutrient';
    if ('name' in patch) {
      if (blankish(patch.name) || patch.name === '快速记录') next.name = '';
      else next.name = C.check(V.validateText(patch.name, 30));
    } else if (next.name === '快速记录') next.name = '';
    const touch = ['carbsG', 'proteinG', 'fatG'].some(k => k in patch && !blankish(patch[k]));
    if (touch) {
      next.carbsG = Fml.round1(needNum('carbsG' in patch ? patch.carbsG : next.carbsG, '碳水', 0, 2000));
      next.proteinG = Fml.round1(needNum('proteinG' in patch ? patch.proteinG : next.proteinG, '蛋白', 0, 2000));
      next.fatG = Fml.round1(needNum('fatG' in patch ? patch.fatG : next.fatG, '脂肪', 0, 1000));
      if (P.storedKcal(entry) != null || entry.source === 'ai-text') {
        next.kcal = Math.round(Fml.kcalOf(next.carbsG, next.proteinG, next.fatG));
      }
    }
    next.snap = { carbsG: next.carbsG, proteinG: next.proteinG, fatG: next.fatG };
    next.basis = null;
    next.qty = null;
    next.v = 2;
    return next;
  }
  next.kind = 'food';
  if ('qty' in patch && !blankish(patch.qty)) {
    const qty = needNum(patch.qty, next.basis === 'perServing' ? '份数' : '重量', 0.1, next.basis === 'perServing' ? 50 : 5000);
    const snap = P.deriveSnap(next);
    if (!snap) C.raise('VALIDATION', '这条食物缺少营养快照，不能改重量');
    const scaled = P.scaleSnap(snap, next.basis, qty);
    if (!scaled || ['carbsG', 'proteinG', 'fatG'].some(k => !isFinite(scaled[k]) || scaled[k] < 0)) C.raise('VALIDATION', '换算结果无效');
    next.qty = Fml.round1(qty);
    next.carbsG = scaled.carbsG;
    next.proteinG = scaled.proteinG;
    next.fatG = scaled.fatG;
    next.snap = { carbsG: Fml.round1(snap.carbsG), proteinG: Fml.round1(snap.proteinG), fatG: Fml.round1(snap.fatG) };
  }
  next.v = 2;
  return next;
}
function addNutrient(date, input) {
  return C.guard(() => {
    C.writable();
    const d = C.check(V.validateDate(date, { today: C.today() }));
    input = input || {};
    const carbsG = Fml.round1(needNum(input.carbsG, '碳水', 0, 2000));
    const proteinG = Fml.round1(needNum(input.proteinG, '蛋白', 0, 2000));
    const fatG = Fml.round1(needNum(input.fatG, '脂肪', 0, 1000));
    let name = '';
    if (!blankish(input.name)) name = C.check(V.validateText(input.name, 30));
    const t = C.now();
    const entry = {
      id: newId('de_', t), kind: 'nutrient', meal: P.normalizeMeal(input.meal || 'other'), name,
      basis: null, qty: null, snap: { carbsG, proteinG, fatG }, carbsG, proteinG, fatG,
      example: false, foodId: null, v: 2,
    };
    const logs = readLogs();
    const prev = logs.find(l => l.date === d);
    const log = prev ? JSON.parse(JSON.stringify(prev)) : { id: newId('dl_', t), date: d, entries: [], createdAt: t };
    log.entries = (log.entries || []).concat([entry]);
    log.updatedAt = t;
    writeLogs(sortLogs(logs.filter(l => l.date !== d).concat([log])));
    return C.ok(log);
  });
}
function aiEntryFrom(input, t) {
  input = input || {};
  const checked = Ai.acceptEntry(input);
  if (!checked.ok) C.raise(checked.code || 'VALIDATION', checked.message);
  const row = checked.data;
  return {
    id: newId('de_', t), kind: 'nutrient', meal: P.normalizeMeal(input.meal || 'other'), name: row.name,
    basis: null, qty: null, snap: { carbsG: row.carbsG, proteinG: row.proteinG, fatG: row.fatG },
    carbsG: row.carbsG, proteinG: row.proteinG, fatG: row.fatG,
    fiberG: row.fiberG, sugarG: row.sugarG, saltMg: row.saltMg, kcal: row.kcal,
    portion: row.portion || '', tips: row.tips || '', note: row.note || '', eatenAt: row.eatenAt,
    source: 'ai-text', example: false, foodId: null, v: 2,
  };
}
function addAiEntries(date, list) {
  return C.guard(() => {
    C.writable();
    const d = C.check(V.validateDate(date, { today: C.today() }));
    if (!Array.isArray(list) || !list.length) C.raise('VALIDATION', '没有可记入的食物');
    const t = C.now();
    const built = list.map(input => aiEntryFrom(input, t));
    const logs = readLogs();
    const prev = logs.find(l => l.date === d);
    const log = prev ? JSON.parse(JSON.stringify(prev)) : { id: newId('dl_', t), date: d, entries: [], createdAt: t };
    log.entries = (log.entries || []).concat(built);
    log.updatedAt = t;
    writeLogs(sortLogs(logs.filter(l => l.date !== d).concat([log])));
    return C.ok(log);
  });
}
function addAiEntry(date, input) {
  return addAiEntries(date, [input || {}]);
}
function intakeMarks(from, to) {
  const out = {};
  if (!from || !to || from > to) return out;
  let d = from, n = 0;
  while (d <= to && n < 42) {
    const log = getLog(d);
    if (log) out[d] = totals(log).kcal;
    d = D.addDays(d, 1);
    n++;
  }
  return out;
}
function updateEntry(date, entryId, patch) {
  return C.guard(() => {
    C.writable();
    const d = C.check(V.validateDate(date, { today: C.today() }));
    patch = patch || {};
    const logs = JSON.parse(JSON.stringify(readLogs()));
    const src = logs.find(l => l.date === d);
    if (!src) C.raise('NOT_FOUND', '这天没有记录');
    const idx = (src.entries || []).findIndex(e => e.id === entryId);
    if (idx < 0) C.raise('NOT_FOUND', '找不到这条记录');
    const next = applyPatch(src.entries[idx], patch);
    let targetDate = d;
    if (!blankish(patch.date) && patch.date !== d) targetDate = C.check(V.validateDate(patch.date, { today: C.today() }));
    src.entries.splice(idx, 1);
    src.updatedAt = C.now();
    let target = src;
    if (targetDate !== d) {
      target = logs.find(l => l.date === targetDate);
      if (!target) {
        const t = C.now();
        target = { id: newId('dl_', t), date: targetDate, entries: [], createdAt: t, updatedAt: t };
        logs.push(target);
      }
    }
    target.entries = (target.entries || []).concat([next]);
    target.updatedAt = C.now();
    writeLogs(sortLogs(logs.filter(l => l.entries && l.entries.length)));
    return C.ok({ date: targetDate, entry: next });
  });
}
function dayBoard(date) {
  const target = dayTarget(date);
  const log = getLog(date);
  const raw = log ? log.entries : [];
  const meals = P.groupMeals(raw);
  const sum = raw.length ? totals(log) : { carbsG: 0, proteinG: 0, fatG: 0, kcal: 0 };
  return {
    recorded: raw.length > 0,
    emptyText: raw.length ? '' : '这一天还没有饮食记录。',
    entries: raw.map(P.presentEntry),
    meals,
    mealCount: meals.length,
    totals: sum,
    target,
    intake: P.intakeView(sum, target),
  };
}
function migrateLogs() {
  return C.guard(() => {
    C.writable();
    if (problem()) C.raise('DATA_CORRUPT', '饮食数据读取异常，已暂停保存以保护原数据');
    const raw = readLogs();
    const next = raw.map(log => {
      if (!log || typeof log !== 'object') return log;
      const copy = Object.assign({}, log);
      copy.entries = (log.entries || []).map(P.migrateEntry);
      return copy;
    });
    if (JSON.stringify(raw) === JSON.stringify(next)) return C.ok({ changed: false });
    const backup = JSON.parse(JSON.stringify(raw));
    try {
      writeLogs(next);
      if (JSON.stringify(readLogs()) !== JSON.stringify(next)) {
        writeLogs(backup);
        C.raise('WRITE_FAILED', '饮食记录迁移校验失败，已恢复原数据');
      }
    } catch (e) {
      try { writeLogs(backup); } catch (ignore) { /* 写入没成功时原数据还在 */ }
      throw e;
    }
    return C.ok({ changed: true });
  });
}
function clearLog(date) {
  return C.guard(() => {
    C.writable();
    const d = C.check(V.validateDate(date, { today: C.today() }));
    writeLogs(readLogs().filter(l => l.date !== d));
    return C.ok(true);
  });
}
function intakeSummary(from, to) {
  let span = 0, logged = 0;
  const sum = { carbsG: 0, proteinG: 0, fatG: 0, kcal: 0 };
  let d = from;
  while (d && to && d <= to && span < 400) {
    span++;
    const log = getLog(d);
    if (log) {
      logged++;
      const t = totals(log);
      sum.carbsG += t.carbsG; sum.proteinG += t.proteinG; sum.fatG += t.fatG; sum.kcal += t.kcal;
    }
    d = D.addDays(d, 1);
  }
  return {
    from, to, span, logged, unlogged: span - logged,
    avg: logged ? { carbsG: sum.carbsG / logged, proteinG: sum.proteinG / logged, fatG: sum.fatG / logged, kcal: sum.kcal / logged } : null,
  };
}
function noLogStreak(today, planStartDate) {
  if (!planStartDate || !today) return 0;
  let n = 0, d = today;
  while (d >= planStartDate && n < 366) {
    if (getLog(d)) break;
    n++;
    d = D.addDays(d, -1);
  }
  return n;
}
function listFoods() {
  return { examples: Fml.EXAMPLES, custom: readFoods() };
}
function saveCustomFood(input) {
  return C.guard(() => {
    C.writable();
    input = input || {};
    const name = C.check(V.validateText(input.name, 30));
    if (!name) C.raise('VALIDATION', '请填写食物名称');
    if (!Fml.BASIS.some(b => b.id === input.basis)) C.raise('BASIS_REQUIRED', '请先选择口径：生重、熟重、每百克或每份');
    const carbsG = Fml.round1(needNum(input.carbsG, '碳水', 0, 500));
    const proteinG = Fml.round1(needNum(input.proteinG, '蛋白', 0, 500));
    const fatG = Fml.round1(needNum(input.fatG, '脂肪', 0, 500));
    const t = C.now();
    const row = { id: input.id || newId('df_', t), name, basis: input.basis, carbsG, proteinG, fatG, example: false, createdAt: t };
    const list = readFoods().filter(f => f.id !== row.id).concat([row]);
    writeFoods(list);
    return C.ok(row);
  });
}
function deleteCustomFood(id) {
  return C.guard(() => {
    C.writable();
    const list = readFoods();
    if (!list.some(f => f.id === id)) C.raise('NOT_FOUND', '找不到这条食物');
    writeFoods(list.filter(f => f.id !== id));
    return C.ok(true);
  });
}
module.exports = {
  problem, getPlan: readPlan, stages: () => stagesOf(readPlan()), activeStage: () => activeStage(readPlan()),
  stageForDate: date => stageForDate(readPlan(), date), planStart: () => planStart(readPlan()),
  dayTarget: date => dayTarget(date), floorInfo: () => floorInfo(readPlan(), activeStage(readPlan())),
  observeWindow: today => observeWindow(activeStage(readPlan()), today || C.today()),
  declineTip: today => declineTip(readPlan(), today || C.today()),
  preview, commit, updatePrefs, suggestion,
  getLog, presentIntake, totals, saveQuick, addFood, addNutrient, addAiEntry, addAiEntries, updateEntry, dayBoard, migrateLogs, removeEntry, clearLog, intakeSummary, intakeMarks, noLogStreak,
  listFoods, saveCustomFood, deleteCustomFood,
};
