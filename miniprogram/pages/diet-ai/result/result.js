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

Page({
  data: {
    name: '', portion: '1份', note: '', tips: '',
    kcal: '', carbsG: '', proteinG: '', fatG: '', fiberG: '', sugarG: '', saltMg: '', saltShown: '',
    mealLabel: '', whenText: '', time: '',
    editName: false, editing: false, saving: false, keyboardHeight: 0, dockStyle: '',
  },
  onLoad() {
    const s = session.get();
    if (!s || !s.draft) {
      wx.showToast({ title: '请先描述吃了什么', icon: 'none' });
      wx.navigateBack();
      return;
    }
    const d = s.draft;
    this.date = s.date;
    this.meal = s.meal || 'snack';
    this.servings = 1;
    this.base = {
      kcal: num(d.kcal),
      carbsG: num(d.carbsG),
      proteinG: num(d.proteinG),
      fatG: num(d.fatG),
      fiberG: d.fiberG == null ? null : num(d.fiberG),
      sugarG: d.sugarG == null ? null : num(d.sugarG),
      saltMg: d.saltMg == null ? null : num(d.saltMg),
    };
    const salt = d.saltMg == null ? '' : String(d.saltMg);
    this.setData({
      name: d.name,
      portion: d.portion || '1份',
      tips: d.tips || '',
      kcal: String(d.kcal),
      carbsG: String(d.carbsG),
      proteinG: String(d.proteinG),
      fatG: String(d.fatG),
      fiberG: d.fiberG == null ? '' : String(d.fiberG),
      sugarG: d.sugarG == null ? '' : String(d.sugarG),
      saltMg: salt,
      saltShown: comma(salt),
      time: s.time || '',
      mealLabel: P.mealLabel(this.meal),
      whenText: whenText(s.date, s.time),
    });
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
  cancel() {
    session.clear();
    wx.navigateBack();
  },
  confirm() {
    if (this._busy || this.data.saving) return;
    if (!ui.canWrite()) return;
    const d = this.data;
    const checked = Ai.acceptEntry({
      name: d.name, portion: d.portion, note: d.note, tips: d.tips, eatenAt: d.time,
      kcal: d.kcal, carbsG: d.carbsG, proteinG: d.proteinG, fatG: d.fatG,
      fiberG: d.fiberG, sugarG: d.sugarG, saltMg: d.saltMg,
    });
    if (!checked.ok) { wx.showToast({ title: checked.message, icon: 'none' }); return; }
    this._busy = true;
    this.setData({ saving: true });
    const r = repo.diet.addAiEntry(this.date, Object.assign({ meal: this.meal }, checked.data));
    this._busy = false;
    this.setData({ saving: false });
    if (!ui.handle(r)) return;
    session.clear();
    wx.showToast({ title: '已记入' });
    const n = getCurrentPages().length;
    wx.navigateBack({ delta: n > 2 ? 2 : 1 });
  },
});
