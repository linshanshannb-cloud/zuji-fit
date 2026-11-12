// 某一天的饮食记录。从日历的当日汇总进来。
const D = require('../../../utils/date');
const repo = require('../../../utils/repo/index');
const P = require('../../../utils/diet-present');

function extra(e) {
  const bits = [];
  if (e.fiberG !== '' && e.fiberG != null) bits.push('纤维 ' + P.fmtG(e.fiberG) + 'g');
  if (e.sugarG !== '' && e.sugarG != null) bits.push('糖 ' + P.fmtG(e.sugarG) + 'g');
  if (e.saltMg !== '' && e.saltMg != null) bits.push('盐 ' + Math.round(Number(e.saltMg)) + 'mg');
  return bits.join(' · ');
}

Page({
  data: {
    date: '', title: '', dateTitle: '', kcalLine: '未记录', sub: '', entries: [], canAdd: false, future: false,
  },
  onLoad(q) {
    const today = D.today();
    this.date = q.date && D.isValid(q.date) ? q.date : today;
    this.setData({ date: this.date });
  },
  onShow() { this.reload(); },
  reload() {
    const today = D.today();
    const date = this.date;
    const future = date > today;
    const err = repo.diet.problem();
    if (err) {
      this.setData({ title: '饮食', dateTitle: P.dayTitle(date, today), kcalLine: '读取异常', sub: err.message, entries: [], canAdd: false, future });
      return;
    }
    const board = repo.diet.dayBoard(date);
    this.setData({
      title: '饮食',
      dateTitle: P.dayTitle(date, today),
      future,
      canAdd: !future && !repo.isReadOnly(),
      kcalLine: board.recorded ? board.totals.kcal + ' kcal' : '未记录',
      sub: future ? '还没到这一天' : (board.recorded ? board.entries.length + ' 条' : '这一天还没有饮食记录。'),
      entries: (board.entries || []).map(e => Object.assign({}, e, { extra: extra(e) })),
    });
  },
  openAi() { wx.navigateTo({ url: '/pages/diet-ai/input/input?date=' + this.date }); },
  openLog() { wx.navigateTo({ url: '/pages/diet-extra/diet-log/diet-log?date=' + this.date }); },
  openMeal(e) {
    wx.navigateTo({ url: '/pages/diet-extra/diet-meal/diet-meal?date=' + this.date + '&meal=' + e.currentTarget.dataset.meal });
  },
});
