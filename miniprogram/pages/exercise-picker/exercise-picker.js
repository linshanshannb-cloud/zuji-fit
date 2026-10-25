// P4 动作选择器. mode=add (multi) | replace (single). 左侧部位固定高度。
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const M = require('../../utils/muscle');
const CARD = require('../../utils/card');
const SORT = require('../../utils/exercise-sort');
const BATCH = 30;
const CUSTOM_KEY = '_custom';

function withCustomTab(base) {
  const tabs = M.tabs(base);
  const n = base.filter(e => e.custom).length;
  if (n) tabs.splice(1, 0, { key: CUSTOM_KEY, zh: '我的', count: n });
  return tabs;
}

Page({
  data: {
    mode: 'add', q: '', bodyPart: '', equipment: '', items: [], total: 0, shown: BATCH,
    selected: [], selMap: {}, added: {}, bodyParts: [], equipments: [], group: '', tabs: [],
    listH: 400, mainScrollTop: 0, readOnly: false,
  },
  onLoad(o) {
    const added = {};
    const w = o.wid ? repo.workouts.getWorkout(o.wid) : null;
    if (w) w.exercises.forEach(e => { added[e.exerciseId] = true; });
    this.setData({
      mode: o.mode || 'add', added,
      bodyParts: repo.exercises.bodyParts,
      equipments: repo.exercises.equipments,
      readOnly: repo.isReadOnly(),
    });
    this.search();
  },
  onReady() { this.measureListH(); },
  onShow() {
    this.setData({ readOnly: repo.isReadOnly() });
    this.search();
    this.measureListH();
  },
  onUnload() { clearTimeout(this._t); },
  measureListH() {
    try {
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      // 底部确认栏约 bar-h；用 query 量 top，再扣底栏
      const q = wx.createSelectorQuery();
      q.select('.pk-top').boundingClientRect();
      q.exec(res => {
        const top = (res && res[0] && res[0].bottom) || 0;
        const rpx = (win.windowWidth || 375) / 750;
        const barPx = Math.ceil(160 * rpx) + (win.safeArea ? Math.max(0, (win.screenHeight || 0) - win.safeArea.bottom) : 0);
        const h = Math.max(200, Math.floor((win.windowHeight || 600) - top - barPx));
        if (h !== this.data.listH) this.setData({ listH: h });
      });
    } catch (e) { /* keep default */ }
  },
  onQ(e) { this.setData({ q: e.detail.value }); clearTimeout(this._t); this._t = setTimeout(() => this.search(), 300); },
  clearQ() { this.setData({ q: '' }); this.search(); },
  setBP(e) { this.setData({ bodyPart: e.currentTarget.dataset.v }); this.search(); this.resetMainScroll(); },
  setEq(e) { this.setData({ equipment: e.currentTarget.dataset.v }); this.search(); this.resetMainScroll(); },
  resetMainScroll() {
    this._flip = !this._flip;
    this.setData({ mainScrollTop: this._flip ? 0.01 : 0 });
  },
  setGroup(e) {
    this.setData({ group: e.currentTarget.dataset.k || '' });
    this.search();
    this.resetMainScroll();
  },
  clearAll() { this.setData({ q: '', bodyPart: '', equipment: '', group: '' }); this.search(); this.resetMainScroll(); },
  search() {
    const { q, bodyPart, equipment } = this.data;
    const base = repo.exercises.filter({ q, bodyPart, equipment });
    const tabs = withCustomTab(base);
    let group = this.data.group;
    if (group && !tabs.some(t => t.key === group)) group = '';
    if (group === CUSTOM_KEY) this._all = base.filter(e => e.custom).slice().sort(SORT.compareCustomTab);
    else {
      const filtered = group ? base.filter(e => M.groupOf(e) === group) : base;
      const order = M.GROUPS.map(o => o.key);
      this._all = filtered.slice().sort((a, b) =>
        (group ? 0 : order.indexOf(M.groupOf(a)) - order.indexOf(M.groupOf(b))) || SORT.compareByMedia(a, b));
    }
    this.setData({ tabs, group, total: this._all.length, shown: BATCH });
    this.render();
  },
  render() {
    const items = this._all.slice(0, this.data.shown).map(e => CARD.cardOf(e, repo.exercises.zhOf, M.zhOf(M.groupOf(e))));
    this.setData({ items });
  },
  more() { if (this.data.shown < this.data.total) { this.setData({ shown: this.data.shown + BATCH }); this.render(); } },
  toggle(e) { this.toggleId(e.currentTarget.dataset.id); },
  toggleId(id, forceOn) {
    let sel = this.data.selected.slice();
    if (this.data.mode === 'replace') sel = sel[0] === id && !forceOn ? [] : [id];
    else if (sel.includes(id)) { if (!forceOn) sel = sel.filter(x => x !== id); } else sel.push(id);
    const selMap = {}; sel.forEach((x, i) => { selMap[x] = i + 1; });
    this.setData({ selected: sel, selMap });
  },
  detail(e) {
    const id = e.currentTarget.dataset.id, self = this;
    wx.navigateTo({ url: '/pages/exercise-detail/exercise-detail?mode=select&id=' + encodeURIComponent(id), events: { select() { self.toggleId(id, true); } } });
  },
  goCustom() {
    if (!ui.canWrite()) return;
    wx.navigateTo({ url: '/pages/custom-exercise-edit/custom-exercise-edit' });
  },
  confirm() {
    if (!this.data.selected.length) return;
    const ch = this.getOpenerEventChannel && this.getOpenerEventChannel();
    if (ch && ch.emit) ch.emit('picked', this.data.selected.slice());
    wx.navigateBack();
  },
});
