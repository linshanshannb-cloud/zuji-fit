// P8 新增/编辑身体数据. New -> repo.body.saveBody; edit -> repo.body.updateBody (PRODUCT_SPEC §9 #2).
const D = require('../../utils/date');
const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const V = repo.validate;
const CHECK = { weightKg: V.validateBodyWeight, bodyFatPct: V.validateBodyFat, waistCm: V.validateWaist };
const withLabel = page => page.setData({ dateLabel: F.dateLabel(page.data.form.date) });
Page({
  data: { dateLabel: '', autoLoaded: false, id: '', today: '', form: { date: '', weightKg: '', bodyFatPct: '', waistCm: '', note: '' }, errors: {}, dirty: false, focus: true, saving: false },
  onLoad(o) {
    const today = D.today(); this.setData({ today });
    if (o.id) { const r = repo.body.getBody(o.id); if (r) return this.loadRecord(r); } // explicit edit
    const date = o.date && o.date <= today ? o.date : today;
    this.openDate(date);
  },
  // New-mode entry for a date: load that day's record if any (auto edit), else a blank form.
  openDate(date) {
    const existing = repo.body.getBodyByDate(date);
    if (existing) { this.loadRecord(existing); this.setData({ autoLoaded: true }); return wx.showToast({ title: `已载入 ${F.md(date)} 的记录`, icon: 'none' }); }
    this.setData({ id: '', autoLoaded: false, dirty: false, errors: {}, form: { date, weightKg: '', bodyFatPct: '', waistCm: '', note: '' } });
    this._noWeight = false; withLabel(this);
  },
  loadRecord(r) {
    const s = v => (v == null ? '' : String(v));
    this._noWeight = r.weightKg == null; // v0-migrated record without weight: may be edited without adding one (DATA_MODEL §9.2)
    this.setData({ id: r.id, form: { date: r.date, weightKg: s(r.weightKg), bodyFatPct: s(r.bodyFatPct), waistCm: s(r.waistCm), note: r.note || '' }, errors: {}, dirty: false });
    withLabel(this);
  },
  onDate(e) {
    const date = e.detail.value;
    // new mode (incl. a record auto-loaded from new mode): switching date re-targets that day; explicit edit moves the record
    if (!this.data.id || this.data.autoLoaded) return this.openDate(date);
    this.setData({ 'form.date': date, dirty: true }); withLabel(this);
  },
  onInput(e) { this.setData({ ['form.' + e.currentTarget.dataset.k]: e.detail.value, dirty: true }); },
  onBlur(e) { this.validateField(e.currentTarget.dataset.k); },
  validateField(k) {
    if (!CHECK[k]) return true;
    const r = CHECK[k](String(this.data.form[k]).trim());
    this.setData({ ['errors.' + k]: r.ok ? '' : r.message });
    return r.ok;
  },
  save() {
    if (this.data.saving || !ui.canWrite()) return;
    const keepNoWeight = this.skipWeight();
    const okAll = (keepNoWeight ? ['bodyFatPct', 'waistCm'] : ['weightKg', 'bodyFatPct', 'waistCm']).map(k => this.validateField(k)).every(Boolean);
    if (!okAll) return;
    const w = Number(this.data.form.weightKg);
    if (!keepNoWeight && (w < 20 || w > 300)) {
      return wx.showModal({ title: '确认体重', content: `体重 ${F.kg(w)} kg 看起来不太常见，确定保存吗？`, success: m => { if (m.confirm) this.doSave(); } });
    }
    this.doSave();
  },
  skipWeight() { return !!(this.data.id && this._noWeight && String(this.data.form.weightKg).trim() === ''); },
  doSave() {
    this.setData({ saving: true });
    const f = Object.assign({}, this.data.form);
    if (this.skipWeight()) delete f.weightKg; // leave the (null) weight untouched
    const r = this.data.id ? repo.body.updateBody(this.data.id, f) : repo.body.saveBody(f);
    this.setData({ saving: false });
    if (!ui.handle(r, { silent: ['INVALID_BODY_WEIGHT', 'INVALID_BODY_FAT', 'INVALID_WAIST', 'WEIGHT_REQUIRED'].includes(r.code) })) {
      const map = { INVALID_BODY_WEIGHT: 'weightKg', WEIGHT_REQUIRED: 'weightKg', INVALID_BODY_FAT: 'bodyFatPct', INVALID_WAIST: 'waistCm' };
      if (map[r.code]) this.setData({ ['errors.' + map[r.code]]: r.message });
      return;
    }
    this.setData({ dirty: false });
    wx.showToast({ title: '已保存' }); setTimeout(() => wx.navigateBack(), 300);
  },
  remove() {
    if (!ui.canWrite()) return;
    ui.confirmDelete({ title: `删除 ${F.md(this.data.form.date)} 的记录？`, content: '体重、体脂率、腰围将一起删除' }, () => {
      if (ui.handle(repo.body.deleteBody(this.data.id))) { this.setData({ dirty: false }); wx.showToast({ title: '已删除' }); setTimeout(() => wx.navigateBack(), 300); }
    });
  },
  onBack() {
    if (this.data.id && this.data.dirty) return wx.showModal({ title: '放弃修改？', confirmText: '放弃', success: m => { if (m.confirm) wx.navigateBack(); } });
    wx.navigateBack();
  },
});
