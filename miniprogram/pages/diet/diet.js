// 饮食首页：今日。计划和回顾在右上角进入二级页。目标来自阶段快照，摄入是另一份记录。
const D = require('../../utils/date');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const P = require('../../utils/diet-present');
const T = require('../../utils/tokens');

Page({
  data: {
    readOnly: false, loadError: '', hasPlan: false,
    date: '', todayStr: '', dateTitle: '', canNext: false,
    board: { recorded: false, emptyText: '这一天还没有饮食记录。', mealCount: 0, badge: '', kcalLine: '0 kcal', remain: '未设置目标', rows: [], meals: [], targetC: '', targetK: '' },
  },
  onShow() {
    const today = D.today();
    if (!this.data.date) this.setData({ date: today });
    this.setData({ todayStr: today });
    if (!repo.isReadOnly() && !repo.diet.problem()) {
      const migrated = repo.diet.migrateLogs();
      if (migrated && !migrated.ok) wx.showToast({ title: '记录升级失败，已保留原数据', icon: 'none' });
    }
    this.refresh();
  },
  refresh() {
    const err = repo.diet.problem();
    const readOnly = repo.isReadOnly();
    if (err) { this.setData({ loadError: err.message, readOnly, hasPlan: false, board: null }); return; }
    const date = this.data.date || D.today();
    const plan = repo.diet.getPlan();
    const board = repo.diet.dayBoard(date);
    const intake = board.intake;
    this.setData({
      loadError: '', readOnly, hasPlan: !!plan, date,
      dateTitle: P.dayTitle(date, D.today()),
      canNext: date < D.today(),
      board: {
        recorded: board.recorded,
        emptyText: board.emptyText,
        mealCount: board.mealCount,
        badge: intake.badge,
        kcalLine: intake.kcalLine,
        remain: intake.remain,
        rows: intake.rows,
        meals: board.meals,
        targetC: board.target ? String(board.target.carbsG) : '',
        targetK: board.target ? String(board.target.kcal) : '',
      },
    });
  },
  shiftDate(e) {
    const next = D.addDays(this.data.date, Number(e.currentTarget.dataset.d));
    if (next > D.today()) return;
    this.setData({ date: next });
    this.refresh();
  },
  onPickDate(e) {
    const next = e.detail.value;
    if (!next || next > D.today()) return;
    this.setData({ date: next });
    this.refresh();
  },
  openGoal() { wx.navigateTo({ url: '/pages/diet-extra/diet-goal/diet-goal' }); },
  openReview() { wx.navigateTo({ url: '/pages/diet-extra/diet-review/diet-review' }); },
  openLog() { wx.navigateTo({ url: '/pages/diet-extra/diet-log/diet-log?date=' + this.data.date }); },
  openMeal(e) {
    wx.navigateTo({ url: '/pages/diet-extra/diet-meal/diet-meal?date=' + this.data.date + '&meal=' + e.currentTarget.dataset.meal });
  },
  openMore() {
    if (!this.data.board || !this.data.board.recorded) return;
    wx.showActionSheet({
      itemList: ['清空当天记录'],
      success: r => { if (r.tapIndex === 0) this.confirmClear(); },
    });
  },
  confirmClear() {
    if (!ui.canWrite()) return;
    wx.showModal({
      title: '清空当天记录？',
      content: '这一天的记录会全部删除。饮食目标不会变，也不会记成吃了 0。',
      confirmText: '清空',
      confirmColor: T.DANGER,
      success: m => {
        if (!m.confirm) return;
        if (!ui.handle(repo.diet.clearLog(this.data.date))) return;
        wx.showToast({ title: '已清空' });
        this.refresh();
      },
    });
  },
});
