const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
Page({
  data: { id: '', w: null, missing: false },
  onLoad(o) { this.setData({ id: o.id }); if (o.done) wx.showToast({ title: '训练已完成' }); },
  onShow() { this.load(); },
  load() {
    const w = repo.workouts.getWorkout(this.data.id);
    if (!w) return this.setData({ w: null, missing: true });
    let n = 0;
    const exercises = w.exercises.map(e => {
      let k = 0;
      return { id: e.id, exerciseId: e.exerciseId, name: e.displayName, unknown: !!(e.exercise && e.exercise.unknown), note: e.note,
        part: e.exercise && !e.exercise.unknown ? repo.exercises.zhOf('bodyPart', e.exercise.bodyPart) : '',
        sets: e.sets.map(s => ({ id: s.id, warm: s.type === 'warmup', no: s.type === 'warmup' ? '热' : ++k, w: s.weightKg == null ? '—' : F.kg(s.weightKg), r: s.reps == null ? '—' : s.reps,
          done: s.done, vol: s.type === 'warmup' ? '—' : !s.done ? '未完成' : F.thousands((s.weightKg || 0) * s.reps) })) };
    });
    n = exercises.length;
    this.setData({ missing: false, detailMissing: !n && (repo.workouts.getHeader(this.data.id) || {}).exerciseCount > 0, w: {
      name: w.name, date: F.dateLabel(w.date), note: w.note, status: w.status,
      time: w.startedAt ? F.hm(w.startedAt) + ' 开始' + (w.completedAt ? ' · ' + Math.max(1, Math.round((w.completedAt - w.startedAt) / 60000)) + ' 分钟' : '') : '补录',
      stats: [{ v: w.exerciseCount, k: '动作' }, { v: w.setCount, k: '组' }, { v: F.thousands(w.volumeKg), k: '容量 kg' }],
      exercises, md: F.md(w.date), setTotal: exercises.reduce((t, e) => t + e.sets.length, 0) } });
  },
  openEx(e) { if (!e.currentTarget.dataset.unknown) wx.navigateTo({ url: '/pages/exercise-detail/exercise-detail?id=' + encodeURIComponent(e.currentTarget.dataset.eid) }); },
  edit() { if (ui.canWrite()) wx.navigateTo({ url: '/pages/workout-edit/workout-edit?id=' + this.data.id }); },
  remove() {
    if (!ui.canWrite()) return;
    const w = this.data.w;
    ui.confirmDelete({ title: '删除这次训练？', content: w ? `${w.md} · ${w.exercises.length} 个动作 ${w.setTotal} 组，删除后无法恢复` : '删除后无法恢复' }, () => {
      if (ui.handle(repo.workouts.deleteWorkout(this.data.id))) { wx.showToast({ title: '已删除' }); setTimeout(() => wx.navigateBack(), 300); }
    });
  },
});
