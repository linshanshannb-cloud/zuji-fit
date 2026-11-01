// 饮食：今日 / 计划 / 复盘。目标来自阶段快照；摄入是另一份记录。未记录不是 0。
const D = require('../../utils/date');
const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const formula = require('../../utils/diet-formula');
const WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const REASON = { create: '创建', adjust: '确认调整', switch: '切换模式', refweight: '更新参考体重', calendar: '调整日历' };
const g = n => (n == null || n === '' || !isFinite(Number(n)) ? '—' : String(Math.round(Number(n) * 10) / 10));
const kcal = n => (n == null || n === '' || !isFinite(Number(n)) ? '—' : String(Math.round(Number(n))));

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

Page({
  data: {
    tab: 'today', readOnly: false, loadError: '', hasPlan: false, date: '', dateLabel: '', canNext: false,
    today: null, review: null, form: emptyForm(''), preview: null, previewError: '', compare: '', weekCells: [], patternText: '',
    hint: { floor: '', noLog: '3' }, sheet: '', quick: { carbsG: '', proteinG: '', fatG: '' },
    foodForm: { foodId: 'ex-rice', basis: '', qty: '', lockedBasis: false }, foodPreview: '',
    foods: { examples: formula.EXAMPLES, custom: [] },
    customForm: { name: '', basis: '', carbsG: '', proteinG: '', fatG: '' },
    adjust: null, weightForm: null,
    activities: formula.ACTIVITY, basisList: formula.BASIS, blogMap: formula.BLOG_MAP,
    kcalNote: formula.COPY.kcalNote, restHint: formula.COPY.restHint, blogDisclaimer: formula.COPY.blogDisclaimer,
    stuckChoices: formula.DEFAULTS.stuckChoices,
  },
  onShow() {
    if (!this._booted) {
      this._booted = true;
      const plan = repo.diet.getPlan();
      this.setData({ tab: plan ? 'today' : 'plan', date: D.today() });
      this.loadForm();
    }
    this.refresh();
  },
  loadForm() {
    const plan = repo.diet.getPlan();
    const patch = { form: plan ? settingsToForm(plan) : emptyForm(latestWeightStr()), hasPlan: !!plan };
    if (!this._hintDirty) patch.hint = { floor: plan && plan.carbFloorG != null ? String(plan.carbFloorG) : '', noLog: String(plan ? plan.noLogTipDays : 3) };
    this.setData(patch);
  },
  refresh() {
    const err = repo.diet.problem();
    const readOnly = repo.isReadOnly();
    if (err) { this.setData({ loadError: err.message, readOnly, hasPlan: false, today: null, review: null }); return; }
    const plan = repo.diet.getPlan();
    const date = this.data.date || D.today();
    const foods = repo.diet.listFoods();
    this.setData(Object.assign({
      loadError: '', readOnly, hasPlan: !!plan, date, dateLabel: F.dateLabel(date, D.today()), canNext: date < D.today(),
      today: plan ? this.buildToday(plan, date) : null,
      review: this.buildReview(plan),
      foods: { examples: foods.examples, custom: foods.custom.map(f => Object.assign({}, f, { basisLabel: formula.basisLabel(f.basis) })) },
    }, this.previewPack()));
  },
  previewPack() {
    const form = this.data.form;
    if (!form) return {};
    const counts = formula.patternCounts(form.weekPattern);
    const r = repo.diet.preview(formToInput(form));
    let compare = '';
    if (form.mode === 'cycle' && form.sex && form.age && form.heightCm && form.activity && form.refWeightKg) {
      const b = formula.bmr({ sex: form.sex, weightKg: Number(form.refWeightKg), heightCm: Number(form.heightCm), age: Number(form.age) });
      const t = formula.tdee(b, form.activity);
      if (t) compare = '对照 TDEE 约 ' + Math.round(t) + ' kcal。碳循环的克数不看这个数，也不会为了接近它去改。';
    }
    const preview = r.ok ? decoratePreview(r.data) : null;
    return {
      preview, previewError: r.ok || !String(form.refWeightKg || '').trim() ? '' : r.message, compare,
      patternText: '高 ' + counts.high + ' · 中 ' + counts.mid + ' · 低 ' + counts.low,
      weekCells: D.weekGrid(D.today()).map((cell, i) => {
        const type = form.weekPattern[i];
        const day = r.ok && r.data.mode === 'cycle' ? r.data.days[type] : null;
        return { date: cell.date, label: WEEK[i], type, typeLabel: formula.SPLIT[type] ? formula.SPLIT[type].label : '', rest: repo.restDays.isRest(cell.date), kcal: day ? String(day.kcal) : '' };
      }),
    };
  },
  buildToday(plan, date) {
    const target = repo.diet.dayTarget(date);
    const intake = repo.diet.presentIntake(date);
    const active = repo.diet.activeStage();
    const shown = repo.diet.stageForDate(date);
    const viewingCurrent = !!(target && active && target.stageId === active.id);
    const win = viewingCurrent ? repo.diet.observeWindow(D.today()) : null;
    let windowLine = '';
    if (win) {
      const a = repo.body.getBodyByDate(win.start), b = repo.body.getBodyByDate(win.end);
      windowLine = '观察窗第 ' + win.elapsed + ' / ' + win.days + ' 天（' + F.md(win.start) + '–' + F.md(win.end) + '）';
      if (!win.complete) windowLine += '。还没到窗末。';
      else if (!a || a.weightKg == null || !b || b.weightKg == null) windowLine += '。窗首或窗末没有体重，样本不足。';
      else windowLine += '。体重 ' + g(a.weightKg) + ' → ' + g(b.weightKg) + ' kg' + (a.waistCm != null && b.waistCm != null ? '，腰围 ' + g(a.waistCm) + ' → ' + g(b.waistCm) + ' cm' : '') + '。';
    }
    const rows = repo.body.listBody().filter(r => r.weightKg != null && r.date <= D.today());
    const latest = rows.length ? rows[rows.length - 1] : null;
    const drift = latest && Math.abs(latest.weightKg - plan.refWeightKg) > 0.05 ? { latest: g(latest.weightKg), locked: g(plan.refWeightKg), date: F.md(latest.date) } : null;
    const streak = repo.diet.noLogStreak(D.today(), repo.diet.planStart());
    const tipN = plan.noLogTipDays || 3;
    let delta = null;
    if (intake.recorded && target) {
      delta = {
        c: F.signed(intake.totals.carbsG - target.carbsG), p: F.signed(intake.totals.proteinG - target.proteinG),
        f: F.signed(intake.totals.fatG - target.fatG), k: F.signed(intake.totals.kcal - target.kcal),
      };
    }
    return {
      missing: !target,
      mode: shown ? shown.mode : '',
      dayType: target ? target.dayType : '',
      dayLabel: target && target.dayType ? formula.SPLIT[target.dayType].label + '碳' : '',
      c: target ? g(target.carbsG) : '', p: target ? g(target.proteinG) : '', f: target ? g(target.fatG) : '', k: target ? String(target.kcal) : '',
      ref: g(plan.refWeightKg), windowLine, drift,
      recorded: intake.recorded,
      ic: intake.recorded ? g(intake.totals.carbsG) : '', ip: intake.recorded ? g(intake.totals.proteinG) : '',
      iff: intake.recorded ? g(intake.totals.fatG) : '', ik: intake.recorded ? String(intake.totals.kcal) : '',
      delta,
      entries: (intake.entries || []).map(e => ({
        id: e.id, name: e.name, example: !!e.example,
        basis: e.basis ? formula.basisLabel(e.basis) : '',
        qty: e.qty == null ? '' : (e.basis === 'perServing' ? e.qty + ' 份' : e.qty + ' g'),
        line: g(e.carbsG) + ' / ' + g(e.proteinG) + ' / ' + g(e.fatG) + ' g',
      })),
      noLog: streak >= tipN, noLogText: '已连续 ' + streak + ' 天没有摄入记录。' + formula.COPY.noLogTip,
    };
  },
  buildReview(plan) {
    if (!plan) return { empty: true };
    const today = D.today();
    const series = repo.body.bodySeries('weightKg', 30);
    const start = repo.diet.planStart();
    const from = start && start > D.addDays(today, -6) ? start : D.addDays(today, -6);
    const sum = repo.diet.intakeSummary(from, today);
    const floor = repo.diet.floorInfo();
    const decline = repo.diet.declineTip(today);
    const active = repo.diet.activeStage();
    const win = repo.diet.observeWindow(today);
    let observe = '';
    if (win) {
      const a = repo.body.getBodyByDate(win.start), b = repo.body.getBodyByDate(win.end);
      observe = F.md(win.start) + ' → ' + F.md(win.end) + '。体重 ' + (a && a.weightKg != null ? g(a.weightKg) : '未记录') + ' → ' + (b && b.weightKg != null ? g(b.weightKg) : '未记录') + ' kg';
      if (a && a.waistCm != null) observe += '。腰围窗首 ' + g(a.waistCm) + ' cm';
      if (b && b.waistCm != null) observe += '，窗末 ' + g(b.waistCm) + ' cm';
      if (!win.complete) observe += '。观察窗未结束。';
      else if (!a || a.weightKg == null || !b || b.weightKg == null) observe += '。样本不足，不能据此判断卡住。';
    }
    const rows = repo.body.listBody().filter(r => r.weightKg != null && r.date <= today);
    const latest = rows.length ? rows[rows.length - 1] : null;
    return {
      empty: false,
      chart: series.points.length >= 2 ? series : null,
      points: series.points.length,
      sample: series.points.length < 2 ? '样本不足，再记一次体重才能看趋势' : '',
      locked: g(plan.refWeightKg),
      latest: latest ? g(latest.weightKg) + ' kg（' + F.md(latest.date) + '）' : '还没有体重记录',
      drift: !!(latest && Math.abs(latest.weightKg - plan.refWeightKg) > 0.05),
      sumText: '这 ' + sum.span + ' 天里有记录 ' + sum.logged + ' 天' + (sum.avg ? '，平均 ' + Math.round(sum.avg.kcal) + ' kcal（碳 ' + g(sum.avg.carbsG) + ' / 蛋白 ' + g(sum.avg.proteinG) + ' / 脂 ' + g(sum.avg.fatG) + '）' : '') + '。未记录 ' + sum.unlogged + ' 天不计入。',
      floorText: floor ? '碳水底线 ' + g(floor.floorG) + ' g（' + (floor.usesAbsolute ? '自定克数' : '计划起始 ' + g(floor.anchorG) + ' g 的 40%') + '）。' + (floor.atFloor ? formula.COPY.floorTip : '还没碰到底线。') : '',
      declineText: decline ? '已连续 ' + decline.weeks + ' 周把碳水从 ' + g(decline.from) + ' g 调到 ' + g(decline.to) + ' g。' + formula.COPY.declineTip : '',
      noLog: repo.diet.noLogStreak(today, start) >= (plan.noLogTipDays || 3),
      noLogText: formula.COPY.noLogTip,
      observe, mode: active ? active.mode : '',
      stages: repo.diet.stages().slice().reverse().map(s => ({
        id: s.id, current: active && s.id === active.id,
        title: F.md(s.startDate) + ' · ' + (s.mode === 'cycle' ? '碳循环' : '碳水渐降') + ' · ' + (REASON[s.reason] || '阶段'),
        sub: s.mode === 'cycle'
          ? '高 ' + s.days.high.kcal + ' · 中 ' + s.days.mid.kcal + ' · 低 ' + s.days.low.kcal + ' kcal'
          : '碳 ' + g(s.carbsG) + ' · 蛋白 ' + g(s.proteinG) + ' · 脂 ' + g(s.fatG) + ' · ' + s.kcal + ' kcal',
        weight: '参考体重 ' + g(s.refWeightKg) + ' kg',
      })),
    };
  },
  setTab(e) { this.setData({ tab: e.currentTarget.dataset.t }); },
  goCreate() { this.setData({ tab: 'plan' }); },
  shiftDate(e) {
    const next = D.addDays(this.data.date, Number(e.currentTarget.dataset.d));
    if (next > D.today()) return;
    this.setData({ date: next, quick: { carbsG: '', proteinG: '', fatG: '' } });
    this.refresh();
  },
  openFormula() { wx.navigateTo({ url: '/pages/diet-formula/diet-formula' }); },
  onForm(e) { this.setData({ ['form.' + e.currentTarget.dataset.k]: e.detail.value }); this.refresh(); },
  setMode(e) { this.setData({ 'form.mode': e.currentTarget.dataset.m }); this.refresh(); },
  setEnergy(e) { this.setData({ 'form.energyMode': e.currentTarget.dataset.m }); this.refresh(); },
  setMacro(e) { this.setData({ 'form.macroMode': e.currentTarget.dataset.m }); this.refresh(); },
  setSex(e) { this.setData({ 'form.sex': e.currentTarget.dataset.m }); this.refresh(); },
  setActivity(e) { this.setData({ 'form.activity': e.currentTarget.dataset.m }); this.refresh(); },
  setBody(e) { this.setData({ 'form.bodyType': e.currentTarget.dataset.m }); this.refresh(); },
  setFatKg(e) { this.setData({ 'form.fatPerKg': e.currentTarget.dataset.m }); this.refresh(); },
  toggleOverride() { this.setData({ 'form.overrideOn': !this.data.form.overrideOn }); this.refresh(); },
  cyclePattern(e) {
    const i = Number(e.currentTarget.dataset.i);
    const order = ['high', 'mid', 'low'];
    const pattern = this.data.form.weekPattern.slice();
    pattern[i] = order[(order.indexOf(pattern[i]) + 1) % 3];
    this.setData({ 'form.weekPattern': pattern });
    this.refresh();
  },
  applyRest() {
    const pattern = this.data.form.weekPattern.slice();
    D.weekGrid(D.today()).forEach((cell, i) => { if (repo.restDays.isRest(cell.date)) pattern[i] = 'low'; });
    this.setData({ 'form.weekPattern': pattern });
    this.refresh();
    wx.showToast({ title: '已写入草稿，确认后才生效', icon: 'none' });
  },
  commitPlan() {
    if (!ui.canWrite()) return;
    const input = formToInput(this.data.form, { confirmExisting: this.data.hasPlan });
    const preview = repo.diet.preview(input);
    if (!preview.ok) { wx.showToast({ title: preview.message, icon: 'none' }); return; }
    const w = preview.data.refWeightKg;
    if (!this.data.hasPlan) {
      wx.showModal({ title: '锁定参考体重', content: '参考体重将锁定为 ' + w + ' kg。之后新的体重记录不会自动改每日目标。', confirmText: '锁定', success: m => { if (m.confirm) this.writePlan(input); } });
      return;
    }
    const switching = this.data.form.mode !== repo.diet.getPlan().mode;
    wx.showModal({
      title: switching ? '切换计划模式' : '确认新阶段',
      content: switching ? '从今天起用新模式。今天以前仍显示旧目标。' : '从今天起使用新目标。更早的日期仍按当时的阶段显示。',
      confirmText: switching ? '切换' : '确认',
      success: m => { if (m.confirm) this.writePlan(Object.assign({}, input, { reason: switching ? 'switch' : 'adjust' })); },
    });
  },
  writePlan(input) {
    const r = repo.diet.commit(input);
    if (!ui.handle(r)) return;
    wx.showToast({ title: '已保存' });
    this.loadForm();
    this.setData({ tab: 'today', date: D.today(), sheet: '' });
    this.refresh();
  },
  toggleBlog() {
    if (!this.data.hasPlan) { this.setData({ 'form.showBlogMap': !this.data.form.showBlogMap }); return; }
    if (!ui.canWrite()) return;
    const next = !repo.diet.getPlan().showBlogMap;
    if (ui.handle(repo.diet.updatePrefs({ showBlogMap: next }))) this.setData({ 'form.showBlogMap': next });
  },
  onHint(e) { this._hintDirty = true; this.setData({ ['hint.' + e.currentTarget.dataset.k]: e.detail.value }); },
  saveHints() {
    if (!ui.canWrite() || !this.data.hasPlan) return;
    const patch = { noLogTipDays: this.data.hint.noLog, carbFloorG: this.data.hint.floor };
    const r = repo.diet.updatePrefs(patch);
    if (!ui.handle(r)) return;
    this._hintDirty = false;
    wx.showToast({ title: '提示已保存' });
    this.refresh();
  },
  onQuick(e) { this.setData({ ['quick.' + e.currentTarget.dataset.k]: e.detail.value }); },
  saveQuick() {
    if (!ui.canWrite()) return;
    const q = this.data.quick;
    const date = this.data.date;
    const go = () => {
      const r = repo.diet.saveQuick(date, q);
      if (!ui.handle(r)) return;
      this.setData({ quick: { carbsG: '', proteinG: '', fatG: '' } });
      wx.showToast({ title: '已记下' });
      this.refresh();
    };
    if (this.data.today && this.data.today.recorded) {
      wx.showModal({ title: '覆盖这天的摄入？', content: '会用这次填写替换已经记下的食物和克数。', confirmText: '覆盖', success: m => { if (m.confirm) go(); } });
      return;
    }
    go();
  },
  clearLog() {
    if (!ui.canWrite()) return;
    wx.showModal({ title: '清空这天的记录？', content: '清空后恢复为未记录，不会记成 0。', confirmText: '清空', success: m => {
      if (!m.confirm) return;
      if (!ui.handle(repo.diet.clearLog(this.data.date))) return;
      wx.showToast({ title: '已恢复未记录' });
      this.refresh();
    } });
  },
  openFood() { this.setData({ sheet: 'food', foodPreview: '' }); this.previewFood(); },
  pickFood(e) {
    const id = e.currentTarget.dataset.id;
    const custom = this.data.foods.custom.find(f => f.id === id);
    if (custom) this.setData({ foodForm: { foodId: id, basis: custom.basis, qty: this.data.foodForm.qty, lockedBasis: true } });
    else this.setData({ foodForm: { foodId: id, basis: '', qty: this.data.foodForm.qty, lockedBasis: false } });
    this.previewFood();
  },
  setBasis(e) {
    if (this.data.foodForm.lockedBasis) { wx.showToast({ title: '这条食物的口径已固定', icon: 'none' }); return; }
    this.setData({ 'foodForm.basis': e.currentTarget.dataset.m });
    this.previewFood();
  },
  onFoodQty(e) { this.setData({ 'foodForm.qty': e.detail.value }); this.previewFood(); },
  previewFood() {
    const f = this.data.foodForm;
    if (!f.basis || !f.qty) { this.setData({ foodPreview: '' }); return; }
    const spec = formula.EXAMPLES.find(x => x.id === f.foodId) || this.data.foods.custom.find(x => x.id === f.foodId);
    if (!spec) { this.setData({ foodPreview: '' }); return; }
    if (spec.example && f.basis === 'perServing') { this.setData({ foodPreview: '口播例没有每份含量' }); return; }
    const qty = Number(f.qty);
    if (!(qty > 0)) { this.setData({ foodPreview: '' }); return; }
    const scaled = formula.scaleFood(spec, f.basis, qty);
    this.setData({ foodPreview: formula.basisLabel(f.basis) + ' · 碳 ' + g(scaled.carbsG) + ' / 蛋白 ' + g(scaled.proteinG) + ' / 脂 ' + g(scaled.fatG) + ' g' });
  },
  addFoodToDay() {
    if (!ui.canWrite()) return;
    const f = this.data.foodForm;
    const r = repo.diet.addFood(this.data.date, { foodId: f.foodId, basis: f.basis, qty: f.qty });
    if (!ui.handle(r)) return;
    wx.showToast({ title: '已加入这天' });
    this.setData({ sheet: '', foodForm: { foodId: f.foodId, basis: f.lockedBasis ? f.basis : '', qty: '', lockedBasis: f.lockedBasis } });
    this.refresh();
  },
  removeEntry(e) {
    if (!ui.canWrite()) return;
    const r = repo.diet.removeEntry(this.data.date, e.currentTarget.dataset.id);
    if (!ui.handle(r)) return;
    this.refresh();
  },
  openCustom() { this.setData({ sheet: 'custom' }); },
  onCustom(e) { this.setData({ ['customForm.' + e.currentTarget.dataset.k]: e.detail.value }); },
  setCustomBasis(e) { this.setData({ 'customForm.basis': e.currentTarget.dataset.m }); },
  saveCustom() {
    if (!ui.canWrite()) return;
    const c = this.data.customForm;
    const r = repo.diet.saveCustomFood(c);
    if (!ui.handle(r)) return;
    wx.showToast({ title: '已保存食物' });
    this.setData({ sheet: 'food', customForm: { name: '', basis: '', carbsG: '', proteinG: '', fatG: '' }, foodForm: { foodId: r.data.id, basis: r.data.basis, qty: '', lockedBasis: true } });
    this.refresh();
  },
  deleteCustom(e) {
    if (!ui.canWrite()) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({ title: '删除这个食物？', content: '已经记进某一天的分量还会留着。', confirmText: '删除', success: m => {
      if (!m.confirm) return;
      if (!ui.handle(repo.diet.deleteCustomFood(id))) return;
      this.refresh();
    } });
  },
  openAdjust(e) {
    const plan = repo.diet.getPlan();
    if (!plan) return;
    const kind = e.currentTarget.dataset.kind;
    const draft = repo.diet.suggestion(kind);
    if (!draft.ok) { ui.handle(draft); return; }
    const win = repo.diet.observeWindow(D.today());
    let trend = '';
    if (win) {
      const a = repo.body.getBodyByDate(win.start), b = repo.body.getBodyByDate(win.end);
      trend = '观察窗 ' + F.md(win.start) + '–' + F.md(win.end) + '。窗首体重 ' + (a && a.weightKg != null ? g(a.weightKg) : '未记录') + ' kg，窗末 ' + (b && b.weightKg != null ? g(b.weightKg) : '未记录') + ' kg。';
      if (a && a.waistCm != null) trend += '窗首腰围 ' + g(a.waistCm) + ' cm。';
      if (b && b.waistCm != null) trend += '窗末腰围 ' + g(b.waistCm) + ' cm。';
    }
    let windowNote = '';
    if (draft.data.mode === 'taper' && kind === 'stuck' && win && !win.complete) windowNote = '还没到 7 天观察窗。这只是预览，不会自动改目标。';
    const d = draft.data;
    this._adjustBase = repo.diet.activeStage();
    this.setData({
      sheet: 'adjust',
      adjust: {
        kind, mode: d.mode, note: d.note, floorNote: d.floorNote || '', windowNote, trend,
        carbsG: d.mode === 'taper' ? String(d.carbsG) : '', proteinG: d.mode === 'taper' ? String(d.proteinG) : '', fatG: d.mode === 'taper' ? String(d.fatG) : '',
        basis: '', rice: '', riceNote: '',
        days: d.mode === 'cycle' ? ['high', 'mid', 'low'].map(t => ({ type: t, label: formula.SPLIT[t].label, carbsG: String(d.days[t].carbsG), proteinG: String(d.days[t].proteinG), fatG: String(d.days[t].fatG) })) : [],
      },
    });
  },
  setChip(e) {
    const stage = this._adjustBase;
    if (!stage || stage.mode !== 'taper') return;
    const delta = Number(e.currentTarget.dataset.d);
    let carbs = formula.round1(stage.carbsG + delta);
    const floor = repo.diet.floorInfo();
    let floorNote = '';
    if (floor && delta < 0 && carbs < floor.floorG) {
      floorNote = '这条建议会低于底线 ' + floor.floorG + ' g，已先填在底线上。你可以再改。确认前不会写入。';
      carbs = floor.floorG;
    }
    this.setData({ 'adjust.carbsG': String(carbs), 'adjust.floorNote': floorNote });
  },
  onAdjust(e) { this.setData({ ['adjust.' + e.currentTarget.dataset.k]: e.detail.value }); },
  onAdjustDay(e) {
    const i = Number(e.currentTarget.dataset.i), k = e.currentTarget.dataset.k;
    this.setData({ ['adjust.days[' + i + '].' + k]: e.detail.value });
  },
  setAdjustBasis(e) { this.setData({ 'adjust.basis': e.currentTarget.dataset.m }); },
  applyRice() {
    const a = this.data.adjust;
    if (a.basis !== 'raw' && a.basis !== 'cooked') { wx.showToast({ title: '请先选择生重或熟重', icon: 'none' }); return; }
    const grams = Number(a.rice);
    if (!(grams > 0)) { wx.showToast({ title: '请填写主食克数', icon: 'none' }); return; }
    const cut = formula.riceCarbs(grams);
    const next = Math.max(0, formula.round1(this._adjustBase.carbsG - cut));
    this.setData({ 'adjust.carbsG': String(next), 'adjust.riceNote': '按' + formula.basisLabel(a.basis) + ' ' + grams + ' g 米饭（口播例，生熟系数相同）约减碳 ' + g(cut) + ' g。确认前不会写入。' });
  },
  confirmAdjust() {
    if (!ui.canWrite()) return;
    const a = this.data.adjust;
    const stage = repo.diet.activeStage();
    const extra = { reason: 'adjust' };
    if (stage.mode === 'taper') { extra.carbsG = a.carbsG; extra.proteinG = a.proteinG; extra.fatG = a.fatG; }
    else {
      const days = {};
      a.days.forEach(d => { days[d.type] = { carbsG: d.carbsG, proteinG: d.proteinG, fatG: d.fatG }; });
      extra.days = days;
    }
    const r = repo.diet.commit(savedInput(extra));
    if (!ui.handle(r)) return;
    wx.showToast({ title: '已记入新阶段' });
    this.setData({ sheet: '' });
    this.loadForm();
    this.refresh();
  },
  openWeight() {
    const plan = repo.diet.getPlan();
    if (!plan) return;
    const rows = repo.body.listBody().filter(r => r.weightKg != null && r.date <= D.today());
    const latest = rows.length ? rows[rows.length - 1].weightKg : plan.refWeightKg;
    this.setData({ sheet: 'weight', weightForm: { refWeightKg: String(latest), keepGrams: false, preview: null, error: '', locked: g(plan.refWeightKg) } });
    this.previewWeight();
  },
  onWeight(e) { this.setData({ 'weightForm.refWeightKg': e.detail.value }); this.previewWeight(); },
  toggleKeep() { this.setData({ 'weightForm.keepGrams': !this.data.weightForm.keepGrams }); this.previewWeight(); },
  previewWeight() {
    const stage = repo.diet.activeStage();
    const w = this.data.weightForm;
    const extra = { refWeightKg: w.refWeightKg, reason: 'refweight' };
    if (w.keepGrams && stage) {
      if (stage.mode === 'taper') { extra.carbsG = stage.carbsG; extra.proteinG = stage.proteinG; extra.fatG = stage.fatG; }
      else extra.days = stage.days;
    }
    const r = repo.diet.preview(savedInput(extra));
    this.setData({ 'weightForm.preview': r.ok ? decoratePreview(r.data) : null, 'weightForm.error': r.ok ? '' : r.message });
  },
  confirmWeight() {
    if (!ui.canWrite()) return;
    const w = this.data.weightForm;
    if (w.error) { wx.showToast({ title: w.error, icon: 'none' }); return; }
    const stage = repo.diet.activeStage();
    const extra = { refWeightKg: w.refWeightKg, reason: 'refweight' };
    if (w.keepGrams && stage) {
      if (stage.mode === 'taper') { extra.carbsG = stage.carbsG; extra.proteinG = stage.proteinG; extra.fatG = stage.fatG; }
      else extra.days = stage.days;
    }
    const r = repo.diet.commit(savedInput(extra));
    if (!ui.handle(r)) return;
    wx.showToast({ title: '参考体重已更新' });
    this.setData({ sheet: '' });
    this.loadForm();
    this.refresh();
  },
  closeSheet() { this.setData({ sheet: '' }); },
  noop() {},
});
