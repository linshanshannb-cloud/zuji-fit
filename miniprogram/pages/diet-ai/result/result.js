// 识别结果确认。改数字不会写存储，点 ✓ 才记入当天。
const repo = require('../../../utils/repo/index');
const ui = require('../../../utils/ui');
const Ai = require('../../../utils/diet-ai');
const session = require('../session');

Page({
  data: {
    name: '', portion: '', note: '', tips: '',
    kcal: '', carbsG: '', proteinG: '', fatG: '', fiberG: '', sugarG: '', saltMg: '',
    editing: false, saving: false, keyboardHeight: 0,
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
    this.meal = s.meal;
    this.setData({
      name: d.name,
      portion: d.portion || '',
      tips: d.tips || '',
      kcal: String(d.kcal),
      carbsG: String(d.carbsG),
      proteinG: String(d.proteinG),
      fatG: String(d.fatG),
      fiberG: d.fiberG == null ? '' : String(d.fiberG),
      sugarG: d.sugarG == null ? '' : String(d.sugarG),
      saltMg: d.saltMg == null ? '' : String(d.saltMg),
      time: s.time || '',
    });
  },
  toggleEdit() { this.setData({ editing: !this.data.editing }); },
  editNote() { this.setData({ editing: true }); },
  onName(e) { this.setData({ name: e.detail.value }); },
  onPortion(e) { this.setData({ portion: e.detail.value }); },
  onNote(e) { this.setData({ note: e.detail.value }); },
  onTips(e) { this.setData({ tips: e.detail.value }); },
  onNum(e) { this.setData({ [e.currentTarget.dataset.k]: e.detail.value }); },
  onKeyboard(e) { this.setData({ keyboardHeight: (e.detail && e.detail.height) || 0 }); },
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
