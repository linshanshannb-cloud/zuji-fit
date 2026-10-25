// 设置：组间歇全局默认 + 各动作单独设置（存本地 fit_ui_prefs）。
const repo = require('../../utils/repo/index');
const R = require('../../utils/rest');
Page({
  data: { dflt: R.DEFAULT, list: [], readOnly: false },
  onShow() { this.refresh(); },
  refresh() {
    const o = repo.rest.overrides();
    const list = Object.keys(o).map(id => ({ id, name: repo.exercises.get(id).nameZh || id, secs: R.clamp(o[id]) }));
    this.setData({ dflt: repo.rest.getDefault(), list, readOnly: repo.isReadOnly() });
  },
  step(e) { if (this.data.readOnly) return; repo.rest.setDefault(this.data.dflt + Number(e.currentTarget.dataset.d)); this.refresh(); },
  reset(e) { repo.rest.setFor(e.currentTarget.dataset.id, 0); this.refresh(); },
  swipeReset(e) { this.reset(e); wx.showToast({ title: '已恢复默认', icon: 'none' }); },
});
