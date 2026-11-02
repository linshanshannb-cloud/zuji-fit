// 饮食目标。从今天起写入新阶段；更早的日期仍用当时的快照。
const D = require('../../../utils/date');
const repo = require('../../../utils/repo/index');
const ui = require('../../../utils/ui');
const formula = require('../../../utils/diet-formula');
const Form = require('../../../utils/diet-form');

Page({
  data: {
    readOnly: false, hasPlan: false, form: Form.emptyForm(''), preview: null, previewError: '', compare: '',
    weekCells: [], patternText: '', hint: { floor: '', noLog: '3' },
    activities: formula.ACTIVITY, blogMap: formula.BLOG_MAP,
    kcalNote: formula.COPY.kcalNote, restHint: formula.COPY.restHint, blogDisclaimer: formula.COPY.blogDisclaimer,
  },
  onShow() {
    if (!this._booted) { this._booted = true; this.loadForm(); }
    this.setData({ readOnly: repo.isReadOnly() });
    this.refresh();
  },
  loadForm() {
    const plan = repo.diet.getPlan();
    const patch = { form: plan ? Form.settingsToForm(plan) : Form.emptyForm(Form.latestWeightStr()), hasPlan: !!plan };
    if (!this._hintDirty) patch.hint = { floor: plan && plan.carbFloorG != null ? String(plan.carbFloorG) : '', noLog: String(plan ? plan.noLogTipDays : 3) };
    this.setData(patch);
  },
  refresh() {
    this.setData(Object.assign({ hasPlan: !!repo.diet.getPlan(), readOnly: repo.isReadOnly() }, this.previewPack()));
  },
  previewPack() {
    const form = this.data.form;
    if (!form) return {};
    const counts = formula.patternCounts(form.weekPattern);
    const r = repo.diet.preview(Form.formToInput(form));
    let compare = '';
    if (form.mode === 'cycle' && form.sex && form.age && form.heightCm && form.activity && form.refWeightKg) {
      const b = formula.bmr({ sex: form.sex, weightKg: Number(form.refWeightKg), heightCm: Number(form.heightCm), age: Number(form.age) });
      const t = formula.tdee(b, form.activity);
      if (t) compare = '对照 TDEE 约 ' + Math.round(t) + ' kcal。碳循环的克数不看这个数，也不会为了接近它去改。';
    }
    return {
      preview: r.ok ? Form.decoratePreview(r.data) : null,
      previewError: r.ok || !String(form.refWeightKg || '').trim() ? '' : r.message,
      compare,
      patternText: '高 ' + counts.high + ' · 中 ' + counts.mid + ' · 低 ' + counts.low,
      weekCells: D.weekGrid(D.today()).map((cell, i) => {
        const type = form.weekPattern[i];
        const day = r.ok && r.data.mode === 'cycle' ? r.data.days[type] : null;
        return { date: cell.date, label: Form.WEEK[i], type, typeLabel: formula.SPLIT[type] ? formula.SPLIT[type].label : '', rest: repo.restDays.isRest(cell.date), kcal: day ? String(day.kcal) : '' };
      }),
    };
  },
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
    const input = Form.formToInput(this.data.form, { confirmExisting: this.data.hasPlan });
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
    wx.navigateBack();
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
    const r = repo.diet.updatePrefs({ noLogTipDays: this.data.hint.noLog, carbFloorG: this.data.hint.floor });
    if (!ui.handle(r)) return;
    this._hintDirty = false;
    wx.showToast({ title: '提示已保存' });
    this.refresh();
  },
  openFormula() { wx.navigateTo({ url: '/pages/diet-formula/diet-formula' }); },
});
