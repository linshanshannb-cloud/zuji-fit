// 记录饮食。按食物 / 按营养素都写入同一天的条目，并带上餐次和营养快照。
const D = require('../../../utils/date');
const repo = require('../../../utils/repo/index');
const ui = require('../../../utils/ui');
const formula = require('../../../utils/diet-formula');
const P = require('../../../utils/diet-present');

const g = n => (n == null || !isFinite(Number(n)) ? '—' : String(Math.round(Number(n) * 10) / 10));

Page({
  data: {
    readOnly: false, saving: false, date: '', dateTitle: '', mode: 'food', meal: 'breakfast', meals: P.MEALS,
    q: '', examples: [], custom: [], foodId: 'ex-rice', basis: '', qty: '', lockedBasis: false, preview: '',
    nutrient: { name: '', carbsG: '', proteinG: '', fatG: '' }, nutrientPreview: '',
    basisList: formula.BASIS, sheet: '',
    customForm: { name: '', basis: '', carbsG: '', proteinG: '', fatG: '' },
  },
  onLoad(q) {
    const today = D.today();
    const date = q.date && q.date <= today ? q.date : today;
    const meal = P.MEALS.some(m => m.id === q.meal) ? q.meal : P.inferMeal(new Date());
    this.setData({ date, dateTitle: P.dayTitle(date, today), meal });
    this.reloadFoods();
  },
  onShow() { this.setData({ readOnly: repo.isReadOnly() }); this.reloadFoods(); },
  reloadFoods() {
    const all = repo.diet.listFoods();
    const q = String(this.data.q || '').trim();
    const match = f => !q || String(f.name || '').indexOf(q) >= 0;
    this.setData({
      examples: all.examples.filter(match).map(f => Object.assign({}, f, { phrase: this.data.basis ? P.basisPhrase(f.name, this.data.basis) : f.name })),
      custom: all.custom.filter(match).map(f => Object.assign({}, f, { basisLabel: formula.basisLabel(f.basis), phrase: P.basisPhrase(f.name, f.basis) })),
    });
  },
  setMode(e) { this.setData({ mode: e.currentTarget.dataset.m === 'nutrient' ? 'nutrient' : 'food' }); },
  setMeal(e) { this.setData({ meal: P.normalizeMeal(e.currentTarget.dataset.m) }); },
  onSearch(e) { this.setData({ q: e.detail.value }); this.reloadFoods(); },
  pickFood(e) {
    const id = e.currentTarget.dataset.id;
    const custom = (this.data.custom || []).find(f => f.id === id) || repo.diet.listFoods().custom.find(f => f.id === id);
    if (custom) this.setData({ foodId: id, basis: custom.basis, lockedBasis: true });
    else this.setData({ foodId: id, basis: '', lockedBasis: false });
    this.preview();
  },
  setBasis(e) {
    if (this.data.lockedBasis) { wx.showToast({ title: '这条食物的口径已固定', icon: 'none' }); return; }
    this.setData({ basis: e.currentTarget.dataset.m });
    this.preview();
  },
  onQty(e) { this.setData({ qty: e.detail.value }); this.preview(); },
  preview() {
    const f = this.data;
    const spec = formula.EXAMPLES.find(x => x.id === f.foodId) || repo.diet.listFoods().custom.find(x => x.id === f.foodId);
    const chosen = spec && f.basis ? P.basisPhrase(spec.name, f.basis) : '';
    if (!spec || !f.basis || !f.qty) { this.setData({ preview: '', chosen }); return; }
    if (spec.example && f.basis === 'perServing') { this.setData({ preview: '口播例没有每份含量', chosen }); return; }
    const qty = Number(f.qty);
    if (!(qty > 0)) { this.setData({ preview: '', chosen }); return; }
    const scaled = formula.scaleFood(spec, f.basis, qty);
    const kcal = Math.round(formula.kcalOf(scaled.carbsG, scaled.proteinG, scaled.fatG));
    const unit = f.basis === 'perServing' ? ' 份' : ' g';
    this.setData({
      chosen,
      preview: chosen + ' · ' + f.qty + unit + ' → 碳 ' + g(scaled.carbsG) + ' / 蛋白 ' + g(scaled.proteinG) + ' / 脂 ' + g(scaled.fatG) + ' g · ' + kcal + ' kcal',
    });
  },
  onNutrient(e) {
    this.setData({ ['nutrient.' + e.currentTarget.dataset.k]: e.detail.value });
    this.previewNutrient();
  },
  previewNutrient() {
    const n = this.data.nutrient;
    if ([n.carbsG, n.proteinG, n.fatG].some(v => String(v).trim() === '')) { this.setData({ nutrientPreview: '' }); return; }
    const c = Number(n.carbsG), p = Number(n.proteinG), f = Number(n.fatG);
    if (![c, p, f].every(x => isFinite(x) && x >= 0)) { this.setData({ nutrientPreview: '请填写非负数字' }); return; }
    this.setData({ nutrientPreview: Math.round(formula.kcalOf(c, p, f)) + ' kcal' });
  },
  save() {
    if (this._saving || this.data.saving) return;
    if (!ui.canWrite()) return;
    this._saving = true;
    this.setData({ saving: true });
    const r = this.data.mode === 'nutrient'
      ? repo.diet.addNutrient(this.data.date, { meal: this.data.meal, name: this.data.nutrient.name, carbsG: this.data.nutrient.carbsG, proteinG: this.data.nutrient.proteinG, fatG: this.data.nutrient.fatG })
      : repo.diet.addFood(this.data.date, { foodId: this.data.foodId, basis: this.data.basis, qty: this.data.qty, meal: this.data.meal });
    this._saving = false;
    this.setData({ saving: false });
    if (!ui.handle(r)) return;
    wx.showToast({ title: '已保存' });
    wx.navigateBack();
  },
  openCustom() { this.setData({ sheet: 'custom' }); },
  closeSheet() { this.setData({ sheet: '' }); },
  noop() {},
  onCustom(e) { this.setData({ ['customForm.' + e.currentTarget.dataset.k]: e.detail.value }); },
  setCustomBasis(e) { this.setData({ 'customForm.basis': e.currentTarget.dataset.m }); },
  saveCustom() {
    if (this._saving || !ui.canWrite()) return;
    this._saving = true;
    const r = repo.diet.saveCustomFood(this.data.customForm);
    this._saving = false;
    if (!ui.handle(r)) return;
    wx.showToast({ title: '已保存食物' });
    this.setData({ sheet: '', customForm: { name: '', basis: '', carbsG: '', proteinG: '', fatG: '' }, foodId: r.data.id, basis: r.data.basis, lockedBasis: true });
    this.reloadFoods();
    this.preview();
  },
  deleteCustom(e) {
    if (!ui.canWrite()) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这个食物？', content: '已经记进某一天的分量还会留着。', confirmText: '删除',
      success: m => {
        if (!m.confirm) return;
        if (!ui.handle(repo.diet.deleteCustomFood(id))) return;
        this.reloadFoods();
      },
    });
  },
});
