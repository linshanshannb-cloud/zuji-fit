// Custom nav (DESIGN §3.1). mode: tab (large left title) | back | close. Set custom-back to handle back yourself (bind:back).
// Also shows the data-state banner: read-only (newer schema / init failure) or damaged data with 「重新加载」(PRODUCT_SPEC 7.2).
const repo = require('../../utils/repo/index');
function bannerState() {
  const st = repo.status() || {}, h = repo.health();
  if (st.mode === 'readonly') return { banner: st.message || '当前为只读模式，请更新小程序', bannerAct: false };
  if (st.mode === 'error' && st.readOnly !== false) return { banner: '数据加载失败，本次只读 · 点此重新加载', bannerAct: true };
  if (!h.ok) return { banner: '部分数据读取异常，已暂停保存（原数据已保留）· 重新加载', bannerAct: true };
  return { banner: '', bannerAct: false };
}
Component({
  options: { styleIsolation: 'apply-shared', multipleSlots: true },
  properties: { title: String, mode: { type: String, value: 'back' }, customBack: Boolean },
  data: { statusH: 20, navH: 44, rightGap: 100, banner: '', bannerAct: false },
  lifetimes: {
    attached() {
      let statusH = 20, navH = 44, rightGap = 100;
      try {
        const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const cap = wx.getMenuButtonBoundingClientRect();
        statusH = win.statusBarHeight; navH = cap.height + (cap.top - statusH) * 2; rightGap = win.windowWidth - cap.left + 8;
      } catch (e) { /* defaults */ }
      this.setData(Object.assign({ statusH, navH, rightGap }, bannerState()));
    },
  },
  pageLifetimes: { show() { this.setData(bannerState()); } },
  methods: {
    onBack() {
      if (this.data.customBack) return this.triggerEvent('back');
      if (getCurrentPages().length > 1) wx.navigateBack(); else wx.switchTab({ url: '/pages/calendar/calendar' });
    },
    onBanner() {
      if (!this.data.bannerAct) return;
      repo.reload();
      this.setData(bannerState());
      const pages = getCurrentPages(), page = pages[pages.length - 1];
      if (page && typeof page.onShow === 'function') page.onShow();
      wx.showToast({ title: repo.health().ok && repo.status().mode === 'normal' ? '已重新加载' : '数据仍有异常', icon: 'none' });
    },
  },
});
