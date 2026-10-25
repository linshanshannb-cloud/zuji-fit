// P5 动作库: 左侧部位固定高度，右侧列表单独滚动；支持自定义动作入口与「我的」分区。
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const M = require('../../utils/muscle');
const CARD = require('../../utils/card');
const SORT = require('../../utils/exercise-sort');
const BATCH = 30;
const state = { q: '', bodyPart: '', equipment: '', group: '' };
const CUSTOM_KEY = '_custom';

function withCustomTab(base) {
  const tabs = M.tabs(base);
  const n = base.filter(e => e.custom).length;
  if (n) tabs.splice(1, 0, { key: CUSTOM_KEY, zh: '我的', count: n });
  return tabs;
}

Page({
  data: {
    q: '', bodyPart: '', equipment: '', groups: [], total: 0, all: 0, shown: BATCH,
    panel: false, panelBP: '', panelEq: '', panelCount: 0, bpLabel: '全部', eqLabel: '全部',
    bodyParts: [], equipments: [], group: '', tabs: [], listH: 400, mainScrollTop: 0, readOnly: false,
  },
  onLoad() {
    this.setData(Object.assign({
      bodyParts: repo.exercises.bodyParts,
      equipments: repo.exercises.equipments,
      all: repo.exercises.all().length,
      readOnly: repo.isReadOnly(),
    }, state));
    this.search();
  },
  onReady() { this.measureListH(); },
  onShow() {
    this.setData(Object.assign({
      readOnly: repo.isReadOnly(),
      all: repo.exercises.all().length,
    }, state));
    this.search();
    this.measureListH();
  },
  onUnload() { clearTimeout(this._t); },
  measureListH() {
    try {
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const q = wx.createSelectorQuery();
      q.select('.lib-top').boundingClientRect();
      q.exec(res => {
        const top = (res && res[0] && res[0].bottom) || 0;
        const h = Math.max(240, Math.floor((win.windowHeight || 600) - top));
        if (h !== this.data.listH) this.setData({ listH: h });
      });
    } catch (e) { /* keep default */ }
  },
  onQ(e) { state.q = e.detail.value; this.setData({ q: state.q }); clearTimeout(this._t); this._t = setTimeout(() => this.search(), 300); },
  clearQ() { state.q = ''; this.setData({ q: '' }); this.search(); },
  clearAll() { Object.assign(state, { q: '', bodyPart: '', equipment: '', group: '' }); this.setData(state); this.search(); },
  list(bp, eq) { return SORT.sortByMedia(repo.exercises.filter({ q: state.q, bodyPart: bp, equipment: eq })); },
  resetMainScroll() {
    this._flip = !this._flip;
    this.setData({ mainScrollTop: this._flip ? 0.01 : 0 });
  },
  setGroup(e) {
    state.group = e.currentTarget.dataset.k || '';
    this.setData({ group: state.group });
    this.search();
    this.resetMainScroll();
  },
  search() {
    const base = this.list(state.bodyPart, state.equipment);
    const tabs = withCustomTab(base);
    if (state.group && !tabs.some(t => t.key === state.group)) state.group = '';
    if (state.group === CUSTOM_KEY) this._all = base.filter(e => e.custom);
    else this._all = state.group ? base.filter(e => M.groupOf(e) === state.group) : base;
    this.setData({
      tabs, group: state.group, total: this._all.length, shown: BATCH,
      bpLabel: state.bodyPart ? repo.exercises.zhOf('bodyPart', state.bodyPart) : '全部',
      eqLabel: state.equipment ? repo.exercises.zhOf('equipment', state.equipment) : '全部',
    });
    this.render();
  },
  render() {
    const order = M.GROUPS.map(o => o.key);
    const counts = {}; this._all.forEach(e => { const g = M.groupOf(e); counts[g] = (counts[g] || 0) + 1; });
    let sorted;
    if (state.group === CUSTOM_KEY) {
      sorted = this._all.slice().sort(SORT.compareCustomTab);
    } else {
      sorted = this._all.slice().sort((a, b) => order.indexOf(M.groupOf(a)) - order.indexOf(M.groupOf(b)) || SORT.compareByMedia(a, b));
    }
    const groups = [];
    sorted.slice(0, this.data.shown).forEach(e => {
      let g = groups[groups.length - 1];
      const gk = state.group === CUSTOM_KEY ? CUSTOM_KEY : M.groupOf(e);
      const title = state.group === CUSTOM_KEY
        ? ('我的 · ' + this._all.length)
        : (M.zhOf(gk) + ' · ' + counts[gk]);
      if (!g || g.key !== gk) { g = { key: gk, title, items: [] }; groups.push(g); }
      g.items.push(CARD.cardOf(e, repo.exercises.zhOf, state.group === CUSTOM_KEY ? '我的' : M.zhOf(gk)));
    });
    this.setData({ groups });
  },
  more() { if (this.data.shown < this.data.total) { this.setData({ shown: this.data.shown + BATCH }); this.render(); } },
  open(e) { wx.navigateTo({ url: '/pages/exercise-detail/exercise-detail?id=' + encodeURIComponent(e.currentTarget.dataset.id) }); },
  goCustom() {
    if (!ui.canWrite()) return;
    wx.navigateTo({ url: '/pages/custom-exercise-edit/custom-exercise-edit' });
  },
  quickAdd(e) {
    if (!ui.canWrite()) return;
    const r = repo.workouts.addToCurrentDraft(e.currentTarget.dataset.id);
    if (!ui.handle(r)) return;
    if (r.data.created) return wx.navigateTo({ url: '/pages/workout-edit/workout-edit?id=' + r.data.workoutId });
    wx.showToast({ title: '已加入当前训练', icon: 'none' });
  },
  openPanel() { this.setData({ panel: true, panelBP: state.bodyPart, panelEq: state.equipment }); this.panelCount(); },
  closePanel() { this.setData({ panel: false }); },
  pBP(e) { const v = e.currentTarget.dataset.v || ''; this.setData({ panelBP: this.data.panelBP === v ? '' : v }); this.panelCount(); },
  pEq(e) { const v = e.currentTarget.dataset.v || ''; this.setData({ panelEq: this.data.panelEq === v ? '' : v }); this.panelCount(); },
  openSettings() { wx.navigateTo({ url: '/pages/settings/settings' }); },
  openAbout() { wx.navigateTo({ url: '/pages/about/about' }); },
  panelCount() { this.setData({ panelCount: this.list(this.data.panelBP, this.data.panelEq).length }); },
  panelReset() { this.setData({ panelBP: '', panelEq: '' }); this.panelCount(); },
  applyPanel() {
    state.bodyPart = this.data.panelBP; state.equipment = this.data.panelEq;
    this.setData({ panel: false, bodyPart: state.bodyPart, equipment: state.equipment });
    this.search(); this.resetMainScroll();
  },
});
