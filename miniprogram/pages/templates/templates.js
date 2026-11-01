// 训练模板列表：精选（内置 6 套）/ 我的（本机复制）。
const D = require('../../utils/date');
const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
Page({
  data: { tab: 'preset', presets: [], mine: [], date: '', dateLabel: '', wid: '', future: false, readOnly: false },
  onLoad(q) {
    this.date = q.date || D.today();
    this.wid = q.wid || '';
    this.setData({ date: this.date, dateLabel: F.md(this.date), wid: this.wid, future: this.date > D.today(), readOnly: repo.isReadOnly() });
  },
  onShow() { this.reload(); },
  reload() {
    this.setData({
      readOnly: repo.isReadOnly(),
      presets: repo.templates.listPresets(),
      mine: repo.templates.listMine(),
    });
  },
  setTab(e) { this.setData({ tab: e.currentTarget.dataset.t }); },
  showPreset() { this.setData({ tab: 'preset' }); },
  open(e) {
    const id = e.currentTarget.dataset.id;
    const parts = ['id=' + encodeURIComponent(id), 'date=' + this.date];
    if (this.wid) parts.push('wid=' + encodeURIComponent(this.wid));
    wx.navigateTo({ url: '/pages/template-detail/template-detail?' + parts.join('&') });
  },
});
