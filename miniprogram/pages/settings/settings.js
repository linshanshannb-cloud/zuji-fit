// 设置：组间歇全局默认 + 各动作单独设置 + 计时结束提示音（存本地 fit_ui_prefs）。
const repo = require('../../utils/repo/index');
const R = require('../../utils/rest');
const beep = require('../../utils/beep');
Page({
  data: { dflt: R.DEFAULT, list: [], readOnly: false, timerSound: true },
  onShow() { this.refresh(); },
  refresh() {
    const o = repo.rest.overrides();
    const list = Object.keys(o).map(id => ({ id, name: repo.exercises.get(id).nameZh || id, secs: R.clamp(o[id]) }));
    this.setData({ dflt: repo.rest.getDefault(), list, readOnly: repo.isReadOnly(), timerSound: beep.enabled() });
  },
  onTimerSound(e) {
    if (this.data.readOnly) return;
    const on = !!(e.detail && e.detail.value);
    beep.setEnabled(on);
    this.setData({ timerSound: beep.enabled() });
  },
  previewSound() { beep.play(); try { wx.vibrateShort({ type: 'medium' }); } catch (err) { /* noop */ } },
  step(e) { if (this.data.readOnly) return; repo.rest.setDefault(this.data.dflt + Number(e.currentTarget.dataset.d)); this.refresh(); },
  reset(e) { repo.rest.setFor(e.currentTarget.dataset.id, 0); this.refresh(); },
  swipeReset(e) { this.reset(e); wx.showToast({ title: '已恢复默认', icon: 'none' }); },
});
