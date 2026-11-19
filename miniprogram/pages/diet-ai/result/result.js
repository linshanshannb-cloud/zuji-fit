// 识别结果确认。改数字不会写存储，点「记入今天」才写入。
const D = require('../../../utils/date');
const repo = require('../../../utils/repo/index');
const ui = require('../../../utils/ui');
const P = require('../../../utils/diet-present');
const Ai = require('../../../utils/diet-ai');
const Portion = require('../../../utils/diet-portion');
const session = require('../session');

function comma(v) {
  const s = String(v == null ? '' : v).replace(/,/g, '');
  if (!/^\d+$/.test(s)) return s;
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function whenText(date, time) {
  const today = D.today();
  const day = date === today ? '今天' : ((D.parse(date).getMonth() + 1) + '月' + D.parse(date).getDate() + '日');
  return day + ' ' + (time || '');
}
function decorate(state) {
  const view = Portion.view(state);
  view.id = state.id;
  view.name = state.name;
  view.note = state.note || '';
  view.tips = state.tips || '';
  view.open = !!state.open;
  view.saltShown = comma(view.saltMg);
  return view;
}
const EMPTY_LABEL = { mode: 'pack', kcal: '', carbsG: '', proteinG: '', fatG: '' };

Page({
  data: {
    name: '', note: '', tips: '', portionText: '一份', portionStatus: '', energyNote: '',
    chips: [], units: [], qtyOpen: '', qtyValue: '', amountValue: '', amountUnit: 'g',
    clarify: false, labelOpen: false, labelPack: '', labelError: '',
    label: EMPTY_LABEL,
    kcal: '', carbsG: '', proteinG: '', fatG: '', fiberG: '', sugarG: '', saltMg: '', saltShown: '',
    mealLabel: '', whenText: '', time: '',
    editName: false, editing: false, saving: false, keyboardHeight: 0, dockStyle: '',
    multi: false, items: [], totalKcal: 0,
  },
  onLoad() {
    const s = session.get();
    const list = s && Array.isArray(s.items) && s.items.length ? s.items : (s && s.draft ? [s.draft] : []);
    if (!s || !list.length) {
      wx.showToast({ title: '请先描述吃了什么', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.date = s.date;
    this.meal = s.meal || 'snack';
    this.rows = list.map((row, i) => {
      const state = Portion.fromAssessed(row);
      state.id = 'f' + i;
      state.open = false;
      return state;
    });
    this.shared = {
      time: s.time || '',
      mealLabel: P.mealLabel(this.meal),
      whenText: whenText(s.date, s.time),
    };
    if (this.rows.length > 1) {
      this.state = null;
      this.syncMulti();
      return;
    }
    this.state = this.rows[0];
    this.syncSingle();
  },
  syncSingle() {
    const view = decorate(this.state);
    this.setData(Object.assign({
      multi: false, items: [], totalKcal: Math.round(Number(view.kcal) || 0),
    }, this.shared, view));
  },
  syncMulti() {
    const items = (this.rows || []).map(decorate);
    const total = items.reduce((t, row) => t + (Number(row.kcal) || 0), 0);
    this.setData(Object.assign({ multi: true, items, totalKcal: Math.round(total) }, this.shared));
  },
  applyTo(id, next) {
    if (!next || next.error) {
      wx.showToast({ title: (next && next.error) || '这个份量不行', icon: 'none' });
      return;
    }
    if (id) {
      const i = (this.rows || []).findIndex(r => r.id === id);
      if (i < 0) return;
      next.state.id = id;
      next.state.open = this.rows[i].open;
      next.state.name = this.rows[i].name;
      next.state.note = this.rows[i].note;
      next.state.tips = this.rows[i].tips;
      this.rows[i] = next.state;
      if (next.state.labelOpen) this.rows.forEach(r => { if (r.id !== id) r.labelOpen = false; });
      this.syncMulti();
      return;
    }
    next.state.name = this.state.name;
    next.state.note = this.state.note;
    next.state.tips = this.state.tips;
    this.state = next.state;
    this.syncSingle();
  },
  stateOf(id) {
    if (!id) return this.state;
    return (this.rows || []).find(r => r.id === id) || null;
  },
  toggleEdit() { this.setData({ editing: !this.data.editing, editName: !this.data.editing }); },
  editName() { this.setData({ editName: true }); },
  editNote() { this.setData({ editing: true }); },
  onName(e) {
    this.state.name = e.detail.value;
    this.setData({ name: e.detail.value });
  },
  onNote(e) {
    this.state.note = e.detail.value;
    this.setData({ note: e.detail.value });
  },
  onTips(e) {
    this.state.tips = e.detail.value;
    this.setData({ tips: e.detail.value });
  },
  onNum(e) {
    const k = e.currentTarget.dataset.k;
    const raw = String(e.detail.value || '').replace(/,/g, '');
    const next = Portion.editNutrient(this.state, k, raw);
    if (!next.state) {
      const patch = k === 'saltMg' ? { saltMg: raw, saltShown: comma(raw) } : { [k]: raw };
      this.setData(patch);
      if (next.error && next.error.indexOf('请填写') !== 0) wx.showToast({ title: next.error, icon: 'none' });
      return;
    }
    this.applyTo(null, next);
  },
  onChip(e) {
    const id = e.currentTarget.dataset.id || '';
    const state = this.stateOf(id);
    if (!state) return;
    const chip = e.currentTarget.dataset.chip;
    if (chip === 'label') this.setData({ label: Object.assign({}, EMPTY_LABEL), labelError: '' });
    this.applyTo(id, Portion.applyChip(state, chip));
  },
  stepPortion(e) {
    const dir = Number(e.currentTarget.dataset.d) > 0 ? '1' : '-1';
    this.applyTo(null, Portion.applyChip(this.state, 'step:' + dir));
  },
  onQty(e) {
    const id = e.currentTarget.dataset.id || '';
    const state = this.stateOf(id);
    if (!state) return;
    const next = Portion.setQtyRaw(state, e.detail.value);
    if (!next.state) {
      if (id) {
        const items = this.data.items.map(item => item.id === id ? Object.assign({}, item, { qtyValue: e.detail.value }) : item);
        this.setData({ items });
      } else this.setData({ qtyValue: e.detail.value });
      if (next.error && String(e.detail.value || '').trim()) wx.showToast({ title: next.error, icon: 'none' });
      return;
    }
    this.applyTo(id, next);
  },
  onAmount(e) {
    const id = e.currentTarget.dataset.id || '';
    const state = this.stateOf(id);
    if (!state) return;
    const next = Portion.setAmountRaw(state, e.detail.value);
    if (!next.state) {
      this.setData(id ? {} : { amountValue: e.detail.value });
      if (next.error && String(e.detail.value || '').trim()) wx.showToast({ title: next.error, icon: 'none' });
      return;
    }
    this.applyTo(id, next);
  },
  onLabelMode(e) { this.setData({ 'label.mode': e.currentTarget.dataset.m === '100g' ? '100g' : 'pack', labelError: '' }); },
  onLabelNum(e) { this.setData({ ['label.' + e.currentTarget.dataset.k]: e.detail.value, labelError: '' }); },
  applyLabel(e) {
    const id = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || '';
    const state = this.stateOf(id);
    if (!state) return;
    const next = Portion.applyLabel(state, this.data.label);
    if (!next.state) { this.setData({ labelError: next.error || '包装营养还不行' }); return; }
    this.setData({ labelError: '', label: Object.assign({}, EMPTY_LABEL) });
    this.applyTo(id, next);
  },
  cycleMeal() {
    const order = ['breakfast', 'lunch', 'dinner', 'snack'];
    const i = order.indexOf(this.meal);
    this.meal = order[(i + 1) % order.length];
    this._mealLocked = true;
    this.shared.mealLabel = P.mealLabel(this.meal);
    this.setData({ mealLabel: this.shared.mealLabel });
  },
  onTime(e) {
    const time = e.detail.value;
    if (!this._mealLocked) this.meal = P.inferMeal(new Date(2000, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3)), 0));
    this.shared.time = time;
    this.shared.mealLabel = P.mealLabel(this.meal);
    this.shared.whenText = whenText(this.date, time);
    this.setData({ time, mealLabel: this.shared.mealLabel, whenText: this.shared.whenText });
  },
  onKeyboard(e) {
    const h = (e.detail && e.detail.height) || 0;
    this.setData({ keyboardHeight: h, dockStyle: h ? ('bottom:' + (h + 12) + 'px') : '' });
  },
  onItem(e) {
    const row = (this.rows || []).find(r => r.id === e.currentTarget.dataset.id);
    if (!row) return;
    const k = e.currentTarget.dataset.k;
    const value = e.detail.value;
    if (k === 'name' || k === 'note') {
      row[k] = value;
      this.syncMulti();
      return;
    }
    const raw = String(value || '').replace(/,/g, '');
    const next = Portion.editNutrient(row, k, raw);
    if (!next.state) {
      const items = this.data.items.map(item => {
        if (item.id !== row.id) return item;
        const copy = Object.assign({}, item);
        copy[k] = raw;
        if (k === 'saltMg') copy.saltShown = comma(raw);
        return copy;
      });
      this.setData({ items });
      if (next.error && next.error.indexOf('请填写') !== 0) wx.showToast({ title: next.error, icon: 'none' });
      return;
    }
    this.applyTo(row.id, next);
  },
  stepItem(e) {
    const id = e.currentTarget.dataset.id;
    const row = this.stateOf(id);
    if (!row) return;
    const dir = Number(e.currentTarget.dataset.d) > 0 ? '1' : '-1';
    this.applyTo(id, Portion.applyChip(row, 'step:' + dir));
  },
  toggleItem(e) {
    const row = (this.rows || []).find(r => r.id === e.currentTarget.dataset.id);
    if (!row) return;
    row.open = !row.open;
    this.syncMulti();
  },
  removeItem(e) {
    const id = e.currentTarget.dataset.id;
    this.rows = (this.rows || []).filter(r => r.id !== id);
    if (!this.rows.length) {
      this.state = null;
      this.setData({ multi: true, items: [], totalKcal: 0 });
      return;
    }
    if (this.rows.length === 1) {
      this.state = this.rows[0];
      this.syncSingle();
      return;
    }
    this.syncMulti();
  },
  cancel() {
    session.clear();
    wx.navigateBack();
  },
  confirm() {
    if (this._busy || this.data.saving) return;
    if (!ui.canWrite()) return;
    const states = this.data.multi ? (this.rows || []) : (this.state ? [this.state] : []);
    if (!states.length) { wx.showToast({ title: '至少留一条食物', icon: 'none' }); return; }
    const ready = [];
    for (let i = 0; i < states.length; i++) {
      const input = Portion.toInput(states[i], { eatenAt: this.data.time || this.shared.time });
      const checked = Ai.acceptEntry(input);
      if (!checked.ok) {
        const who = states.length > 1 ? ((input.name || '这一条') + '：') : '';
        wx.showToast({ title: who + checked.message, icon: 'none' });
        return;
      }
      ready.push(Object.assign({ meal: this.meal }, checked.data));
    }
    this._busy = true;
    this.setData({ saving: true });
    const r = repo.diet.addAiEntries(this.date, ready);
    this._busy = false;
    this.setData({ saving: false });
    if (!ui.handle(r)) return;
    session.clear();
    wx.showToast({ title: '已记入' });
    const n = getCurrentPages().length;
    wx.navigateBack({ delta: n > 2 ? 2 : 1 });
  },
});
