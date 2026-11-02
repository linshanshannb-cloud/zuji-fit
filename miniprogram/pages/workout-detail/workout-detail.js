const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
Page({
  data: { id: '', w: null, missing: false, detailMissing: false, detailCorrupt: false, corruptCount: 0 },
  onLoad(o) { this.setData({ id: o.id }); if (o.done) wx.showToast({ title: '训练已完成' }); },
  onShow() { this._repeating = false; this.load(); },
  load() {
    const w = repo.workouts.getWorkout(this.data.id);
    if (!w) return this.setData({ w: null, missing: true, detailMissing: false, detailCorrupt: false });
    let n = 0;
    const exercises = w.exercises.map(e => {
      let k = 0;
      const time = e.mode === 'time';
      return { id: e.id, exerciseId: e.exerciseId, name: e.displayName, unknown: !!(e.exercise && e.exercise.unknown), note: e.note, time,
        part: e.exercise && !e.exercise.unknown ? repo.exercises.zhOf('bodyPart', e.exercise.bodyPart) : '',
        sets: e.sets.map(s => {
          const base = { id: s.id, warm: s.type === 'warmup', no: s.type === 'warmup' ? '热' : ++k, done: s.done };
          if (time) {
            return Object.assign(base, {
              w: s.weightKg == null ? '自重' : F.kg(s.weightKg),
              r: s.durationSec == null ? '—' : F.dur(s.durationSec),
              vol: s.done ? '已完成' : '未完成',
            });
          }
          return Object.assign(base, { w: s.weightKg == null ? '—' : F.kg(s.weightKg), r: s.reps == null ? '—' : s.reps,
            vol: s.type === 'warmup' ? '—' : !s.done ? '未完成' : F.thousands((s.weightKg || 0) * (s.reps || 0)) });
        }) };
    });
    n = exercises.length;
    this.setData({ missing: false, detailMissing: !!w.detailMissing, detailCorrupt: !!w.detailCorrupt,
      corruptCount: w.integrity && w.integrity.issues ? w.integrity.issues.length : 0, w: {
      name: w.name, date: F.dateLabel(w.date), note: w.note, status: w.status,
      time: w.startedAt ? F.hm(w.startedAt) + ' 开始' + (w.completedAt ? ' · ' + Math.max(1, Math.round((w.completedAt - w.startedAt) / 60000)) + ' 分钟' : '') : '补录',
      stats: F.strengthStats(w.exerciseCount, w.setCount, w.volumeKg, w.timeSec),
      exercises, md: F.md(w.date), setTotal: exercises.reduce((t, e) => t + e.sets.length, 0) } });
  },
  openEx(e) { if (!e.currentTarget.dataset.unknown) wx.navigateTo({ url: '/pages/exercise-detail/exercise-detail?id=' + encodeURIComponent(e.currentTarget.dataset.eid) }); },
  edit() {
    if (this.data.detailMissing) { wx.showToast({ title: '训练详情丢失，只能查看', icon: 'none' }); return; }
    if (this.data.detailCorrupt) { wx.showToast({ title: '记录已损坏，已暂停编辑', icon: 'none' }); return; }
    if (ui.canWrite()) wx.navigateTo({ url: '/pages/workout-edit/workout-edit?id=' + this.data.id });
  },
  // 再练一次：复制动作和组结构到今天（带重量，完成勾选清空），然后打开今天的编辑页。
  repeat() {
    if (this._repeating) return;
    if (!ui.canWrite()) return;
    if (this.data.detailMissing) { wx.showToast({ title: '训练详情丢失，不能复制', icon: 'none' }); return; }
    if (this.data.detailCorrupt) { wx.showToast({ title: '记录已损坏，不能复制', icon: 'none' }); return; }
    this._repeating = true;
    const r = repo.workouts.repeatFrom(this.data.id);
    if (r && r.code === 'DRAFT_EXISTS') return this.askDraft(r.data);
    if (r && (r.code === 'DETAIL_MISSING' || r.code === 'DATA_CORRUPT')) {
      this._repeating = false;
      wx.showToast({ title: r.message || '不能复制这次训练', icon: 'none' });
      return;
    }
    if (!ui.handle(r)) { this._repeating = false; return; }
    wx.showToast({ title: r.data.mode === 'append' ? '已追加到今天' : '已复制到今天', icon: 'none' });
    wx.navigateTo({
      url: '/pages/workout-edit/workout-edit?id=' + r.data.workoutId,
      fail: () => { this._repeating = false; },
    });
  },
  onRepeatBlocked() {
    if (this.data.detailMissing) wx.showToast({ title: '训练详情丢失，不能复制', icon: 'none' });
    else wx.showToast({ title: '记录已损坏，不能复制', icon: 'none' });
  },
  // 另一天还有未完成草稿时不能静默丢掉。继续它，或放弃后再复制到今天。
  askDraft(existing) {
    const date = existing && existing.date ? F.md(existing.date) : '';
    const n = existing && existing.exerciseCount ? existing.exerciseCount : 0;
    wx.showModal({
      title: '有未完成的训练',
      content: `你有一个未完成的训练（${date} · ${n} 个动作）。继续它，或放弃后复制到今天。`,
      confirmText: '继续', cancelText: '放弃',
      fail: () => { this._repeating = false; },
      success: m => {
        this._repeating = false;
        if (m.confirm) return wx.navigateTo({ url: '/pages/workout-edit/workout-edit?id=' + existing.id });
        if (!m.cancel) return;
        const sets = (repo.workouts.getWorkout(existing.id) || { exercises: [] }).exercises.reduce((t, e) => t + e.sets.length, 0);
        ui.confirmDelete({ title: '放弃这次训练？', content: `已录入的 ${sets} 组将被删除`, confirmText: '放弃' }, () => {
          if (ui.handle(repo.workouts.discardDraft())) this.repeat();
        });
      },
    });
  },
  remove() {
    if (!ui.canWrite()) return;
    const w = this.data.w;
    ui.confirmDelete({ title: '删除这次训练？', content: w ? `${w.md} · ${w.exercises.length} 个动作 ${w.setTotal} 组，删除后无法恢复` : '删除后无法恢复' }, () => {
      if (ui.handle(repo.workouts.deleteWorkout(this.data.id))) { wx.showToast({ title: '已删除' }); setTimeout(() => wx.navigateBack(), 300); }
    });
  },
});
