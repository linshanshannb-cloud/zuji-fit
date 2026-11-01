const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
Page({
  data: { id: '', w: null, missing: false, detailMissing: false, detailCorrupt: false, corruptCount: 0 },
  onLoad(o) { this.setData({ id: o.id }); if (o.done) wx.showToast({ title: '训练已完成' }); },
  onShow() { this.load(); },
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
  remove() {
    if (!ui.canWrite()) return;
    const w = this.data.w;
    ui.confirmDelete({ title: '删除这次训练？', content: w ? `${w.md} · ${w.exercises.length} 个动作 ${w.setTotal} 组，删除后无法恢复` : '删除后无法恢复' }, () => {
      if (ui.handle(repo.workouts.deleteWorkout(this.data.id))) { wx.showToast({ title: '已删除' }); setTimeout(() => wx.navigateBack(), 300); }
    });
  },
});
