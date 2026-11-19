// 某一餐的明细。改重量走营养快照，不回读食物表。删除需确认。
const D = require('../../../utils/date');
const repo = require('../../../utils/repo/index');
const ui = require('../../../utils/ui');
const P = require('../../../utils/diet-present');
const Portion = require('../../../utils/diet-portion');
const JS = require('../../../utils/journal-stickers');
const T = require('../../../utils/tokens');

Page({
  data: {
    readOnly: false, saving: false, date: '', todayStr: '', meal: 'other', title: '', dateTitle: '',
    entries: [], editing: '', meals: P.MEALS, totalKcal: 0,
    edit: { qty: '', name: '', carbsG: '', proteinG: '', fatG: '', meal: 'other', date: '', kind: 'food', basis: '' },
    label: { mode: 'pack', kcal: '', carbsG: '', proteinG: '', fatG: '' }, labelError: '',
  },
  onLoad(q) {
    const today = D.today();
    this.date = q.date && q.date <= today ? q.date : today;
    this.meal = P.normalizeMeal(q.meal);
    this.setData({ todayStr: today });
    this.reload();
  },
  onShow() {
    this.setData({ readOnly: repo.isReadOnly(), todayStr: D.today() });
    if (this.date) this.reload();
  },
  reload() {
    const board = repo.diet.dayBoard(this.date);
    const group = (board.meals || []).find(m => m.id === this.meal);
    const entries = (group ? group.entries : []).map(e => {
      const name = e.displayName || e.name || '';
      return Object.assign({}, e, {
        sticker: JS.foodSticker(name),
        lg: JS.foodLarge(name),
        portionText: e.portionText || e.portion || e.qtyText || '',
        portionNote: e.portionNote || '',
        kcalText: (e.kcal == null ? '' : e.kcal + ' kcal'),
        macroText: '碳水 ' + P.fmtG(e.carbsG) + 'g · 蛋白 ' + P.fmtG(e.proteinG) + 'g · 脂肪 ' + P.fmtG(e.fatG) + 'g',
      });
    });
    const editing = entries.some(e => e.id === this.data.editing) ? this.data.editing : '';
    this.setData({
      date: this.date,
      meal: this.meal,
      title: P.mealLabel(this.meal),
      dateTitle: P.dayTitle(this.date, D.today()),
      entries,
      totalKcal: group ? group.kcal : 0,
      editing,
    });
  },
  fillAi(seed) {
    const prev = this.data.edit || {};
    const view = Portion.view(this.port);
    this.setData({
      editing: (seed && seed.id) || this.data.editing,
      edit: Object.assign({
        kind: 'ai',
        name: (seed && seed.name) || this.port.name,
        meal: (seed && seed.meal) || prev.meal,
        date: (seed && seed.date) || prev.date || this.data.date,
      }, view),
    });
  },
  startEdit(e) {
    const entry = this.data.entries.find(x => x.id === e.currentTarget.dataset.id);
    if (!entry) return;
    this._portionDirty = false;
    this._nutrientDirty = false;
    this._sendNutri = false;
    if (entry.nutri) {
      this.port = Portion.fromSaved(entry) || Portion.fromAssessed(entry);
      this.setData({ label: { mode: 'pack', kcal: '', carbsG: '', proteinG: '', fatG: '' }, labelError: '' });
      this.fillAi({ id: entry.id, name: entry.name, meal: entry.meal, date: this.data.date });
      return;
    }
    this.port = null;
    this.setData({
      editing: entry.id,
      edit: {
        qty: entry.qty, name: entry.name, basis: entry.basis, kind: entry.kind,
        carbsG: entry.carbsG == null ? '' : String(entry.carbsG),
        proteinG: entry.proteinG == null ? '' : String(entry.proteinG),
        fatG: entry.fatG == null ? '' : String(entry.fatG),
        meal: entry.meal, date: this.data.date,
      },
    });
  },
  onEdit(e) { this.setData({ ['edit.' + e.currentTarget.dataset.k]: e.detail.value }); },
  onAiNum(e) {
    if (!this.port) return;
    const k = e.currentTarget.dataset.k;
    const raw = String(e.detail.value || '').replace(/,/g, '');
    const next = Portion.editNutrient(this.port, k, raw);
    if (!next.state) {
      this.setData({ ['edit.' + k]: raw });
      if (next.error && next.error.indexOf('请填写') !== 0) wx.showToast({ title: next.error, icon: 'none' });
      return;
    }
      this.port = next.state;
    this._nutrientDirty = true;
    this._sendNutri = false;
    this.fillAi();
  },
  onAiChip(e) {
    if (!this.port) return;
    const chip = e.currentTarget.dataset.chip;
    if (chip === 'label') this.setData({ label: { mode: 'pack', kcal: '', carbsG: '', proteinG: '', fatG: '' }, labelError: '' });
    const next = Portion.applyChip(this.port, chip);
    if (!next.state) { wx.showToast({ title: next.error || '这个份量不行', icon: 'none' }); return; }
    this.port = next.state;
    if (chip !== 'label' && chip.indexOf('open:') !== 0) this._portionDirty = true;
    this.fillAi();
  },
  onAiQty(e) {
    if (!this.port) return;
    const next = Portion.setQtyRaw(this.port, e.detail.value);
    if (!next.state) {
      this.setData({ 'edit.qtyValue': e.detail.value });
      return;
    }
    this.port = next.state;
    this._portionDirty = true;
    this.fillAi();
  },
  onAiAmount(e) {
    if (!this.port) return;
    const next = Portion.setAmountRaw(this.port, e.detail.value);
    if (!next.state) {
      this.setData({ 'edit.amountValue': e.detail.value });
      if (next.error) wx.showToast({ title: next.error, icon: 'none' });
      return;
    }
    this.port = next.state;
    this._portionDirty = true;
    this.fillAi();
  },
  onLabelMode(e) { this.setData({ 'label.mode': e.currentTarget.dataset.m === '100g' ? '100g' : 'pack', labelError: '' }); },
  onLabelNum(e) { this.setData({ ['label.' + e.currentTarget.dataset.k]: e.detail.value, labelError: '' }); },
  applyAiLabel() {
    if (!this.port) return;
    const next = Portion.applyLabel(this.port, this.data.label);
    if (!next.state) { this.setData({ labelError: next.error || '包装营养还不行' }); return; }
    this.port = next.state;
    this._sendNutri = true;
    this._portionDirty = true;
    this._nutrientDirty = false;
    this.setData({ labelError: '' });
    this.fillAi();
  },
  setEditMeal(e) { this.setData({ 'edit.meal': e.currentTarget.dataset.m }); },
  onEditDate(e) { this.setData({ 'edit.date': e.detail.value }); },
  cancelEdit() { this.setData({ editing: '' }); },
  saveEdit() {
    if (this._saving || this.data.saving) return;
    if (!ui.canWrite()) return;
    const ed = this.data.edit;
    const patch = { meal: ed.meal, date: ed.date };
    if (ed.kind === 'ai' && this.port) {
      if (this._sendNutri) {
        patch.nutri = this.port.baseline;
        patch.portionMeta = this.port.detail;
      } else {
        if (this._portionDirty) patch.portionMeta = this.port.detail;
        if (this._nutrientDirty) {
          const shown = this.port.shown || {};
          patch.kcal = shown.kcal;
          patch.carbsG = shown.carbsG;
          patch.proteinG = shown.proteinG;
          patch.fatG = shown.fatG;
          if (shown.fiberG != null) patch.fiberG = shown.fiberG;
          if (shown.sugarG != null) patch.sugarG = shown.sugarG;
          if (shown.saltMg != null) patch.saltMg = shown.saltMg;
        }
      }
    } else if (ed.kind === 'food') patch.qty = ed.qty;
    else { patch.name = ed.name; patch.carbsG = ed.carbsG; patch.proteinG = ed.proteinG; patch.fatG = ed.fatG; }
    this._saving = true;
    this.setData({ saving: true });
    const r = repo.diet.updateEntry(this.data.date, this.data.editing, patch);
    this._saving = false;
    this.setData({ saving: false });
    if (!ui.handle(r)) return;
    wx.showToast({ title: '已保存' });
    this.setData({ editing: '' });
    if (r.data.date !== this.date) { wx.navigateBack(); return; }
    this.meal = r.data.entry.meal || this.meal;
    this.reload();
  },
  removeEntry(e) {
    if (!ui.canWrite()) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后这一餐的汇总会马上更新。',
      confirmText: '删除',
      confirmColor: T.DANGER,
      success: m => {
        if (!m.confirm) return;
        const r = repo.diet.removeEntry(this.data.date, id);
        if (!ui.handle(r)) return;
        wx.showToast({ title: '已删除' });
        if (this.data.editing === id) this.setData({ editing: '' });
        this.reload();
      },
    });
  },
});
