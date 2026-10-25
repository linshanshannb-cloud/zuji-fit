const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const T = require('../../utils/aerobic-types');

Page({
  data: { id: '', a: null, missing: false },
  onLoad(o) { this.setData({ id: o.id || '' }); },
  onShow() { this.load(); },
  load() {
    const a = repo.aerobic.get(this.data.id);
    if (!a) return this.setData({ a: null, missing: true });
    const kcalLabel = a.kcalSource === 'user_override' ? '已手动调整' : '估算';
    this.setData({
      missing: false,
      a: {
        name: a.activityName,
        typeName: a.activityType === 'custom' ? '自定义' : (T.BY_KEY[a.activityType] && T.BY_KEY[a.activityType].name) || a.activityName,
        date: F.dateLabel(a.date),
        md: F.md(a.date),
        note: a.note || '',
        stats: [
          { v: a.durationMin, k: '分钟' },
          { v: a.estimatedKcal, k: 'kcal（' + kcalLabel + '）' },
        ],
        refNote: T.REF_NOTE,
        created: a.createdAt ? F.hm(a.createdAt) : '',
      },
    });
  },
  edit() { if (ui.canWrite()) wx.navigateTo({ url: '/pages/aerobic-edit/aerobic-edit?id=' + this.data.id }); },
  remove() {
    if (!ui.canWrite()) return;
    const a = this.data.a;
    ui.confirmDelete({
      title: '删除这条有氧？',
      content: a ? `${a.md} · ${a.name} · ${a.stats[0].v} 分钟，删除后无法恢复` : '删除后无法恢复',
    }, () => {
      if (ui.handle(repo.aerobic.remove(this.data.id))) {
        wx.showToast({ title: '已删除' });
        setTimeout(() => wx.navigateBack(), 300);
      }
    });
  },
});
