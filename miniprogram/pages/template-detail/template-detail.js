// 模板详情：看 4 个动作，复制到我的模板，或套用到训练。
const D = require('../../utils/date');
const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
function unknownFlag(v) { return v === true || v === 'true' || v === 1 || v === '1'; }
Page({
  data: { id: '', date: '', wid: '', t: null, future: false, applyLabel: '套用', readOnly: false },
  onLoad(q) {
    this.id = q.id || '';
    this.date = q.date || D.today();
    this.wid = q.wid || '';
    this.future = !this.wid && this.date > D.today();
    this.setData({ id: this.id, date: this.date, wid: this.wid, future: this.future });
    this.reload();
  },
  onShow() { if (this._loaded) this.reload(); this._loaded = true; },
  reload() {
    const t = repo.templates.get(this.id);
    if (!t) {
      wx.showToast({ title: '模板不存在', icon: 'none' });
      return setTimeout(() => wx.navigateBack(), 400);
    }
    const applyLabel = this.wid ? '追加到当前训练' : (this.future ? '还不能套用' : ('套用到' + F.md(this.date)));
    this.setData({ t, applyLabel, readOnly: repo.isReadOnly() });
  },
  openEx(e) {
    if (unknownFlag(e.currentTarget.dataset.unknown)) return wx.showToast({ title: '动作不存在', icon: 'none' });
    wx.navigateTo({ url: '/pages/exercise-detail/exercise-detail?id=' + encodeURIComponent(e.currentTarget.dataset.id) });
  },
  copy() {
    if (!ui.canWrite()) return;
    if (ui.handle(repo.templates.copyPreset(this.id))) wx.showToast({ title: '已复制到我的模板', icon: 'none' });
  },
  rename() {
    if (!ui.canWrite()) return;
    const t = this.data.t;
    wx.showModal({
      title: '模板名称', editable: true, placeholderText: '最多 30 字', content: t ? t.title : '',
      success: m => { if (m.confirm && ui.handle(repo.templates.renameMine(this.id, m.content || ''))) this.reload(); },
    });
  },
  remove() {
    if (!ui.canWrite()) return;
    ui.confirmDelete({ title: '删除这个模板？', content: '只删除本机副本，精选还在', confirmText: '删除' }, () => {
      if (ui.handle(repo.templates.removeMine(this.id))) wx.navigateBack();
    });
  },
  apply() {
    if (!ui.canWrite()) return;
    if (!this.wid && this.future) return wx.showToast({ title: '不能为未来日期套用模板', icon: 'none' });
    const r = repo.templates.apply({ id: this.id, date: this.date, workoutId: this.wid });
    if (r && r.code === 'DRAFT_EXISTS') return this.askDraft(r.data);
    if (!ui.handle(r)) return;
    wx.showToast({ title: this.wid ? '已追加到当前训练' : '已套用到训练', icon: 'none' });
    if (this.wid) wx.navigateBack({ delta: 2 });
    else wx.navigateTo({ url: '/pages/workout-edit/workout-edit?id=' + r.data.workoutId });
  },
  // 与日历「新建力量训练」同一条草稿规则：继续已有草稿，或放弃后再套用。
  askDraft(existing) {
    wx.showModal({
      title: '有未完成的训练',
      content: `你有一个未完成的训练（${F.md(existing.date)} · ${existing.exerciseCount} 个动作）。继续它，或放弃后套用模板。`,
      confirmText: '继续', cancelText: '放弃',
      success: m => {
        if (m.confirm) return wx.navigateTo({ url: '/pages/workout-edit/workout-edit?id=' + existing.id });
        if (!m.cancel) return;
        const sets = (repo.workouts.getWorkout(existing.id) || { exercises: [] }).exercises.reduce((n, e) => n + e.sets.length, 0);
        ui.confirmDelete({ title: '放弃这次训练？', content: `已录入的 ${sets} 组将被删除`, confirmText: '放弃' }, () => {
          if (ui.handle(repo.workouts.discardDraft())) this.apply();
        });
      },
    });
  },
});
