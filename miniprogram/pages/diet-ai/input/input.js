// 文字识别输入。相机只留入口，不调用相机或相册。语音不做。
const D = require('../../../utils/date');
const P = require('../../../utils/diet-present');
const Ai = require('../../../utils/diet-ai');
const call = require('./call');
const session = require('../session');

function clock(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return new Date();
  return new Date(2000, 0, 1, Number(m[1]), Number(m[2]), 0);
}
function timeLabel(date, today, time) {
  if (date === today) return '今天 ' + time;
  const d = D.parse(date);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + time;
}

Page({
  data: {
    tab: 'text',
    date: '',
    time: '',
    timeLabel: '',
    text: '',
    loading: false,
    canSend: false,
    failTitle: '',
    failText: '',
    finderNote: '这一期还不能拍照。用上面的「输入」写一句就行，不会打开相机。',
    keyboardHeight: 0,
  },
  onLoad(q) {
    const today = D.today();
    const date = q.date && D.isValid(q.date) && q.date <= today ? q.date : today;
    const now = new Date();
    const time = D.pad(now.getHours()) + ':' + D.pad(now.getMinutes());
    this.date = date;
    this.today = today;
    this._meal = P.inferMeal(now);
    this.setData({ date, time, timeLabel: timeLabel(date, today, time) });
  },
  onUnload() { this._dead = true; },
  sync(extra) {
    extra = extra || {};
    const text = extra.text != null ? extra.text : this.data.text;
    const loading = extra.loading != null ? extra.loading : this.data.loading;
    const tab = extra.tab != null ? extra.tab : this.data.tab;
    this.setData(Object.assign({}, extra, {
      canSend: tab === 'text' && String(text || '').trim().length > 0 && !loading,
    }));
  },
  useCamera() { this.sync({ tab: 'camera', keyboardHeight: 0 }); },
  useText() { this.sync({ tab: 'text' }); },
  cameraLater() {
    this.setData({ finderNote: '拍照还没接上。先切到「输入」，用一句话描述。' });
  },
  onTime(e) {
    const time = e.detail.value;
    this._meal = P.inferMeal(clock(time));
    this.setData({ time, timeLabel: timeLabel(this.date, this.today, time) });
  },
  onText(e) { this.sync({ text: e.detail.value, failTitle: '', failText: '' }); },
  onKeyboard(e) { this.setData({ keyboardHeight: (e.detail && e.detail.height) || 0 }); },
  clearFail() { this.setData({ failTitle: '', failText: '' }); },
  cancel() {
    this._dead = true;
    session.clear();
    wx.navigateBack();
  },
  manual() {
    wx.navigateTo({ url: '/pages/diet-extra/diet-log/diet-log?date=' + this.date });
  },
  confirm() {
    if (this.data.tab !== 'text' || this._busy) return Promise.resolve();
    const text = String(this.data.text || '').trim();
    if (!text) {
      this.setData({ failTitle: '先写一句话', failText: '比如：下午吃了一块巧克力。' });
      return Promise.resolve();
    }
    this._busy = true;
    this.sync({ loading: true, failTitle: '', failText: '' });
    return call.recognize(text).then(content => {
      if (this._dead) return;
      const assessed = Ai.assess(Ai.parseModelText(content));
      if (!assessed.ok) {
        this.sync({ loading: false, failTitle: assessed.title, failText: assessed.message });
        return;
      }
      session.set({ date: this.date, time: this.data.time, meal: this._meal, draft: assessed.data });
      wx.navigateTo({ url: '/pages/diet-ai/result/result' });
    }).catch(err => {
      if (this._dead) return;
      const info = call.failInfo(err);
      this.sync({ loading: false, failTitle: info.title, failText: info.message });
    }).then(() => {
      this._busy = false;
      if (!this._dead) this.sync({ loading: false });
    });
  },
});
