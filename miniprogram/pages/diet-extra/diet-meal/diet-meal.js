// 某一餐的明细。改重量走营养快照，不回读食物表。删除需确认。
const D = require('../../../utils/date');
const repo = require('../../../utils/repo/index');
const ui = require('../../../utils/ui');
const P = require('../../../utils/diet-present');
const T = require('../../../utils/tokens');

Page({
  data: {
    readOnly: false, saving: false, date: '', todayStr: '', meal: 'other', title: '', dateTitle: '',
    entries: [], editing: '', meals: P.MEALS,
    edit: { qty: '', name: '', carbsG: '', proteinG: '', fatG: '', meal: 'other', date: '', kind: 'food', basis: '' },
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
    const entries = group ? group.entries : [];
    const editing = entries.some(e => e.id === this.data.editing) ? this.data.editing : '';
    this.setData({
      date: this.date,
      meal: this.meal,
      title: P.mealLabel(this.meal),
      dateTitle: P.dayTitle(this.date, D.today()),
      entries,
      editing,
    });
  },
  startEdit(e) {
    const entry = this.data.entries.find(x => x.id === e.currentTarget.dataset.id);
    if (!entry) return;
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
  setEditMeal(e) { this.setData({ 'edit.meal': e.currentTarget.dataset.m }); },
  onEditDate(e) { this.setData({ 'edit.date': e.detail.value }); },
  cancelEdit() { this.setData({ editing: '' }); },
  saveEdit() {
    if (this._saving || this.data.saving) return;
    if (!ui.canWrite()) return;
    const ed = this.data.edit;
    const patch = { meal: ed.meal, date: ed.date };
    if (ed.kind === 'food') patch.qty = ed.qty;
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
