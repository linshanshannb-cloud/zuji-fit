// 识别结果确认。改数字不会写存储，点「记入今天」才写入。
const D = require('../../../utils/date');
const repo = require('../../../utils/repo/index');
const ui = require('../../../utils/ui');
const P = require('../../../utils/diet-present');
const Ai = require('../../../utils/diet-ai');
const session = require('../session');

const NUM_KEYS = ['kcal', 'carbsG', 'proteinG', 'fatG', 'fiberG', 'sugarG', 'saltMg'];
const INT_KEYS = { kcal: true, saltMg: true };

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : null;
}
function comma(v) {
  const s = String(v == null ? '' : v).replace(/,/g, '');
  if (!/^\d+$/.test(s)) return s;
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function scaled(base, key, servings) {
  if (base[key] == null) return '';
  const v = base[key] * servings;
  return INT_KEYS[key] ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}
function whenText(date, time) {
  const today = D.today();
  const day = date === today ? '今天' : ((D.parse(date).getMonth() + 1) + '月' + D.parse(date).getDate() + '日');
  return day + ' ' + (time || '');
}

function rowFrom(d, i) {
  const salt = d.saltMg == null || d.saltMg === '' ? '' : String(d.saltMg);
  const field = (key, empty) => (d[key] == null || d[key] === '' ? (empty ? '' : '') : String(d[key]));
  return {
    id: 'f' + i,
    name: d.name || '',
    portion: d.portion || '1份',
    note: d.note || '',
    tips: d.tips || '',
    servings: 1,
    open: false,
    kcal: field('kcal'),
    carbsG: field('carbsG'),
    proteinG: field('proteinG'),
    fatG: field('fatG'),
    fiberG: d.fiberG == null || d.fiberG === '' ? '' : String(d.fiberG),
    sugarG: d.sugarG == null || d.sugarG === '' ? '' : String(d.sugarG),
    saltMg: salt,
    saltShown: comma(salt),
    base: {
      kcal: num(d.kcal),
      carbsG: num(d.carbsG),
      proteinG: num(d.proteinG),
      fatG: num(d.fatG),
      fiberG: d.fiberG == null || d.fiberG === '' ? null : num(d.fiberG),
      sugarG: d.sugarG == null || d.sugarG === '' ? null : num(d.sugarG),
      saltMg: d.saltMg == null || d.saltMg === '' ? null : num(d.saltMg),
    },
  };
}
function viewRow(row) {
  return {
    id: row.id, name: row.name, portion: row.portion, note: row.note, open: !!row.open,
    kcal: row.kcal, carbsG: row.carbsG, proteinG: row.proteinG, fatG: row.fatG,
    fiberG: row.fiberG, sugarG: row.sugarG, saltMg: row.saltMg, saltShown: row.saltShown,
  };
}

Page({
  data: {
    name: '', portion: '1份', note: '', tips: '',
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
    this.rows = list.map(rowFrom);
    const shared = {
      time: s.time || '',
      mealLabel: P.mealLabel(this.meal),
      whenText: whenText(s.date, s.time),
    };
    if (this.rows.length > 1) {
      this.servings = 1;
      this.base = {};
      this.setData(Object.assign({ multi: true }, shared, this.itemPatch()));
      return;
    }
    this.adopt(this.rows[0], shared);
  },
  itemPatch() {
    const items = (this.rows || []).map(viewRow);
    const total = items.reduce((t, row) => t + (num(row.kcal) || 0), 0);
    return { items, totalKcal: Math.round(total) };
  },
  adopt(row, shared) {
    this.servings = row.servings || 1;
    this.base = Object.assign({}, row.base);
    const salt = row.saltMg || '';
    this.setData(Object.assign({
      multi: false, items: [], totalKcal: Math.round(num(row.kcal) || 0),
      name: row.name, portion: row.portion, note: row.note, tips: row.tips,
      kcal: row.kcal, carbsG: row.carbsG, proteinG: row.proteinG, fatG: row.fatG,
      fiberG: row.fiberG, sugarG: row.sugarG, saltMg: salt, saltShown: comma(salt),
    }, shared || {}));
  },
  toggleEdit() { this.setData({ editing: !this.data.editing, editName: !this.data.editing }); },
  editName() { this.setData({ editName: true }); },
  editNote() { this.setData({ editing: true }); },
  onName(e) { this.setData({ name: e.detail.value }); },
  onPortion(e) { this.setData({ portion: e.detail.value }); },
  onNote(e) { this.setData({ note: e.detail.value }); },
  onTips(e) { this.setData({ tips: e.detail.value }); },
  onNum(e) {
    const k = e.currentTarget.dataset.k;
    const raw = String(e.detail.value || '').replace(/,/g, '');
    const patch = k === 'saltMg' ? { saltMg: raw, saltShown: comma(raw) } : { [k]: raw };
    this.setData(patch);
    const n = num(raw);
    if (n != null && this.servings) this.base[k] = n / this.servings;
    else if (raw === '') this.base[k] = null;
  },
  stepPortion(e) {
    const d = Number(e.currentTarget.dataset.d);
    const next = Math.max(1, (this.servings || 1) + d);
    if (next === this.servings) return;
    this.servings = next;
    const patch = { portion: next + '份' };
    NUM_KEYS.forEach(k => {
      patch[k] = scaled(this.base, k, next);
      if (k === 'saltMg') patch.saltShown = comma(patch.saltMg);
    });
    this.setData(patch);
  },
  cycleMeal() {
    const order = ['breakfast', 'lunch', 'dinner', 'snack'];
    const i = order.indexOf(this.meal);
    this.meal = order[(i + 1) % order.length];
    this._mealLocked = true;
    this.setData({ mealLabel: P.mealLabel(this.meal) });
  },
  onTime(e) {
    const time = e.detail.value;
    if (!this._mealLocked) this.meal = P.inferMeal(new Date(2000, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3)), 0));
    this.setData({ time, mealLabel: P.mealLabel(this.meal), whenText: whenText(this.date, time) });
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
    if (k === 'name' || k === 'portion' || k === 'note') row[k] = value;
    else {
      const raw = String(value || '').replace(/,/g, '');
      row[k] = raw;
      if (k === 'saltMg') row.saltShown = comma(raw);
      const n = num(raw);
      if (n != null && row.servings) row.base[k] = n / row.servings;
      else if (raw === '') row.base[k] = null;
    }
    this.setData(this.itemPatch());
  },
  stepItem(e) {
    const row = (this.rows || []).find(r => r.id === e.currentTarget.dataset.id);
    if (!row) return;
    const next = Math.max(1, (row.servings || 1) + Number(e.currentTarget.dataset.d));
    if (next === row.servings) return;
    row.servings = next;
    row.portion = next + '份';
    NUM_KEYS.forEach(k => {
      row[k] = scaled(row.base, k, next);
      if (k === 'saltMg') row.saltShown = comma(row.saltMg);
    });
    this.setData(this.itemPatch());
  },
  toggleItem(e) {
    const row = (this.rows || []).find(r => r.id === e.currentTarget.dataset.id);
    if (!row) return;
    row.open = !row.open;
    this.setData(this.itemPatch());
  },
  removeItem(e) {
    const id = e.currentTarget.dataset.id;
    this.rows = (this.rows || []).filter(r => r.id !== id);
    if (!this.rows.length) {
      this.setData({ multi: true, items: [], totalKcal: 0 });
      return;
    }
    if (this.rows.length === 1) {
      this.adopt(this.rows[0]);
      return;
    }
    this.setData(this.itemPatch());
  },
  cancel() {
    session.clear();
    wx.navigateBack();
  },
  confirm() {
    if (this._busy || this.data.saving) return;
    if (!ui.canWrite()) return;
    const inputs = this.data.multi
      ? (this.rows || []).map(row => ({
        name: row.name, portion: row.portion, note: row.note, tips: row.tips, eatenAt: this.data.time,
        kcal: row.kcal, carbsG: row.carbsG, proteinG: row.proteinG, fatG: row.fatG,
        fiberG: row.fiberG, sugarG: row.sugarG, saltMg: row.saltMg,
      }))
      : [{
        name: this.data.name, portion: this.data.portion, note: this.data.note, tips: this.data.tips, eatenAt: this.data.time,
        kcal: this.data.kcal, carbsG: this.data.carbsG, proteinG: this.data.proteinG, fatG: this.data.fatG,
        fiberG: this.data.fiberG, sugarG: this.data.sugarG, saltMg: this.data.saltMg,
      }];
    if (!inputs.length) { wx.showToast({ title: '至少留一条食物', icon: 'none' }); return; }
    const ready = [];
    for (let i = 0; i < inputs.length; i++) {
      const checked = Ai.acceptEntry(inputs[i]);
      if (!checked.ok) {
        const who = inputs.length > 1 ? ((inputs[i].name || '这一条') + '：') : '';
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
