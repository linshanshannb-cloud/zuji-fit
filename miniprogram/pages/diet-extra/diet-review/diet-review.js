// 饮食回顾。建议只是草稿，确认后才从今天起记入新阶段。
const D = require('../../../utils/date');
const F = require('../../../utils/format');
const repo = require('../../../utils/repo/index');
const ui = require('../../../utils/ui');
const formula = require('../../../utils/diet-formula');
const Form = require('../../../utils/diet-form');

const g = Form.g;

Page({
  data: {
    readOnly: false, review: null, sheet: '', adjust: null, weightForm: null,
    stuckChoices: formula.DEFAULTS.stuckChoices,
  },
  onShow() {
    this.setData({ readOnly: repo.isReadOnly() });
    this.refresh();
  },
  refresh() {
    this.setData({ readOnly: repo.isReadOnly(), review: this.buildReview(repo.diet.getPlan()) });
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
        title: F.md(s.startDate) + ' · ' + (s.mode === 'cycle' ? '碳循环' : '碳水渐降') + ' · ' + (Form.REASON[s.reason] || '阶段'),
        sub: s.mode === 'cycle'
          ? '高 ' + s.days.high.kcal + ' · 中 ' + s.days.mid.kcal + ' · 低 ' + s.days.low.kcal + ' kcal'
          : '碳 ' + g(s.carbsG) + ' · 蛋白 ' + g(s.proteinG) + ' · 脂 ' + g(s.fatG) + ' · ' + s.kcal + ' kcal',
        weight: '参考体重 ' + g(s.refWeightKg) + ' kg',
      })),
    };
  },
  openGoal() { wx.navigateTo({ url: '/pages/diet-extra/diet-goal/diet-goal' }); },
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
    const r = repo.diet.commit(Form.savedInput(extra));
    if (!ui.handle(r)) return;
    wx.showToast({ title: '已记入新阶段' });
    this.setData({ sheet: '' });
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
    const r = repo.diet.preview(Form.savedInput(extra));
    this.setData({ 'weightForm.preview': r.ok ? Form.decoratePreview(r.data) : null, 'weightForm.error': r.ok ? '' : r.message });
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
    const r = repo.diet.commit(Form.savedInput(extra));
    if (!ui.handle(r)) return;
    wx.showToast({ title: '参考体重已更新' });
    this.setData({ sheet: '' });
    this.refresh();
  },
  closeSheet() { this.setData({ sheet: '' }); },
  noop() {},
});
