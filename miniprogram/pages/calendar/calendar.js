const D = require('../../utils/date');
const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const DM = require('../../utils/daymark');
const ymOf = s => { const p = D.parse(s); return { year: p.getFullYear(), month: p.getMonth() + 1 }; };
Page({
  // calView：'week'（默认，所选日所在周）| 'month'；仅存在页面内存，不写存储
  data: { year: 0, month: 0, selected: '', today: '', calView: 'week', marks: {}, info: {}, cards: [], day: {}, draft: null, sel: {}, monthEmpty: false, readOnly: false },
  onLoad() { const t = D.today(); this.setData(Object.assign({ selected: t, today: t }, ymOf(t))); },
  onShow() { this.refresh(); },
  refresh() {
    const { year, month, selected } = this.data, today = D.today();
    const from = `${year}-${D.pad(month)}-01`, to = `${year}-${D.pad(month)}-${D.pad(D.daysInMonth(year, month))}`;
    // 格子标签按 6×7 网格范围取：周视图跨月那几天也有标签（周视图时 year/month = 所选日月份，所在周必在网格内）
    const grid = D.monthGrid(year, month);
    const marks = {};
    Object.keys(repo.workouts.completedDates()).forEach(d => { marks[d] = true; });
    Object.keys(repo.aerobic.completedDates()).forEach(d => { marks[d] = true; });
    const ws = repo.workouts.daySummaries(selected), as = repo.aerobic.daySummaries(selected);
    const strength = ws.map(w => ({
      id: w.id, kind: 'strength', title: w.displayName, duration: w.durationMin, detailMissing: w.detailMissing, createdAt: w.createdAt || 0,
      stats: [{ v: w.exerciseCount, k: '动作' }, { v: w.setCount, k: '组' }, { v: F.thousands(w.volumeKg), k: '容量 kg' }],
      meta: `${w.exerciseCount} 动作 · ${w.setCount} 组 · ${F.thousands(w.volumeKg)} kg`,
      top: w.top.map(t => ({ name: t.name, text: t.sets + '组' + (t.best ? ' · 最佳 ' + F.kg(t.best.weightKg) + 'kg×' + t.best.reps : '') })), more: w.more }));
    const aerobic = as.map(a => ({
      id: a.id, kind: 'aerobic', title: a.title, duration: a.durationMin, createdAt: a.createdAt || 0,
      kcalHint: a.kcalSource === 'user_override' ? '已手动调整' : '估算',
      stats: [
        { v: a.durationMin, k: '分钟' },
        { v: a.estimatedKcal, k: a.kcalSource === 'user_override' ? 'kcal（已手改）' : 'kcal（估算）' },
      ],
      meta: `${a.estimatedKcal} kcal · ${a.kcalSource === 'user_override' ? '已手改' : '估算'}`,
      top: [], more: 0 }));
    const cards = strength.concat(aerobic).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const info = DM.buildInfo(repo, grid[0].date, grid[grid.length - 1].date);
    const isRest = cards.length === 0 && repo.restDays.isRest(selected);
    const draft = repo.workouts.getDraft();
    const kind = selected > today ? 'future' : selected === today ? 'today' : 'past';
    const hasStrength = strength.length > 0, hasAerobic = aerobic.length > 0;
    const totalMin = cards.reduce((t, c) => t + (c.duration || 0), 0);
    this.setData({ today, marks, info, cards, readOnly: repo.isReadOnly(),
      day: cards.length ? this.daySummary(ws, as, totalMin, cards.some(c => !c.duration)) : {},
      monthEmpty: !Object.keys(marks).some(d => d >= from && d <= to),
      draft: draft ? { id: draft.id, text: (draft.date === today ? '今天' : F.md(draft.date)) + '有一个未完成的训练' } : null,
      sel: { label: F.dateLabel(selected, today), kind, isTraining: cards.length > 0, isRest, hasStrength, hasAerobic, totalMin } });
  },
  // 所选日汇总卡：力量/有氧分别累加当天全部记录
  daySummary(ws, as, totalMin, partial) {
    const sum = (list, k) => list.reduce((t, x) => t + (Number(x[k]) || 0), 0);
    const dp = DM.dayParts(repo, this.data.selected);
    const manual = as.some(a => a.kcalSource === 'user_override');
    return {
      totalMin, totalNote: totalMin && partial ? '部分记录无时长' : '',
      strength: ws.length ? { parts: dp.parts.join(' · ') || '—', stats: [
        { v: sum(ws, 'exerciseCount'), k: '动作' }, { v: sum(ws, 'setCount'), k: '组' }, { v: F.thousands(sum(ws, 'volumeKg')), k: '容量 kg' }] } : null,
      aerobic: as.length ? { names: dp.aeros.join(' · ') || '有氧', stats: [
        { v: sum(as, 'durationMin'), k: '分钟' }, { v: sum(as, 'estimatedKcal'), k: manual ? 'kcal（含手改）' : 'kcal（估算）' }] } : null,
    };
  },
  onSelect(e) {
    const date = e.detail.date;
    // 周视图里跨月的那几天：年月跟随所选日
    this.setData(Object.assign({ selected: date }, this.data.calView === 'week' ? ymOf(date) : {})); this.refresh();
  },
  // 周视图：前后一周（所选日 ±7 天，自然跨月/跨年）；月视图：前后一月
  onShift(e) {
    const delta = e.detail.delta;
    if (this.data.calView === 'week') { const s = D.addDays(this.data.selected, 7 * delta); this.setData(Object.assign({ selected: s }, ymOf(s))); }
    else this.setData(D.addMonths(this.data.year, this.data.month, delta));
    this.refresh();
  },
  onToday() { const t = D.today(); this.setData(Object.assign({ selected: t }, ymOf(t))); this.refresh(); },
  // 展开/收起：收起时回到所选日所在周
  onToggle() {
    const v = this.data.calView === 'week' ? 'month' : 'week';
    this.setData(Object.assign({ calView: v }, v === 'week' ? ymOf(this.data.selected) : {})); this.refresh();
  },
  openCard(e) {
    const id = e.currentTarget.dataset.id, kind = e.currentTarget.dataset.kind;
    if (kind === 'aerobic') wx.navigateTo({ url: '/pages/aerobic-detail/aerobic-detail?id=' + id });
    else wx.navigateTo({ url: '/pages/workout-detail/workout-detail?id=' + id });
  },
  continueDraft() { wx.navigateTo({ url: '/pages/workout-edit/workout-edit?id=' + this.data.draft.id }); },
  // FAB / 空态：力量或有氧
  pickNew() {
    if (!ui.canWrite()) return;
    if (this.data.selected > D.today()) return wx.showToast({ title: '不能为未来日期新建训练', icon: 'none' });
    wx.showActionSheet({
      itemList: ['力量训练', '有氧训练'],
      success: r => { if (r.tapIndex === 0) this.newWorkout(); else if (r.tapIndex === 1) this.newAerobic(); },
    });
  },
  newAerobic() {
    if (!ui.canWrite()) return;
    if (this.data.selected > D.today()) return wx.showToast({ title: '不能为未来日期新建有氧', icon: 'none' });
    wx.navigateTo({ url: '/pages/aerobic-edit/aerobic-edit?date=' + this.data.selected });
  },
  // 过去空日：补录力量 / 补录有氧 / 标记休息
  pickPast() {
    if (!ui.canWrite()) return;
    wx.showActionSheet({
      itemList: ['补录力量训练', '补录有氧训练', '标记为休息日'],
      success: r => {
        if (r.tapIndex === 0) this.newWorkout();
        else if (r.tapIndex === 1) this.newAerobic();
        else if (r.tapIndex === 2) this.markRest();
      },
    });
  },
  markRest() { if (!ui.canWrite()) return; if (ui.handle(repo.restDays.mark(this.data.selected))) { wx.showToast({ title: '已标记为休息日', icon: 'none' }); this.refresh(); } },
  unmarkRest() { if (!ui.canWrite()) return; if (ui.handle(repo.restDays.unmark(this.data.selected))) { wx.showToast({ title: '已取消休息日', icon: 'none' }); this.refresh(); } },
  newWorkout() {
    if (!ui.canWrite()) return;
    if (this.data.selected > D.today()) return wx.showToast({ title: '不能为未来日期新建训练', icon: 'none' });
    const date = this.data.selected, existing = repo.workouts.getDraft();
    const go = () => { const r = repo.workouts.createDraft({ date }); if (ui.handle(r)) wx.navigateTo({ url: '/pages/workout-edit/workout-edit?id=' + r.data.id }); };
    if (!existing) return go();
    wx.showModal({ title: '有未完成的训练', content: `你有一个未完成的训练（${F.md(existing.date)} · ${existing.exerciseCount} 个动作）。继续它，或放弃后新建训练。`,
      confirmText: '继续', cancelText: '放弃',
      success: m => {
        if (m.confirm) return wx.navigateTo({ url: '/pages/workout-edit/workout-edit?id=' + existing.id });
        if (!m.cancel) return;
        const sets = (repo.workouts.getWorkout(existing.id) || { exercises: [] }).exercises.reduce((t, e) => t + e.sets.length, 0);
        ui.confirmDelete({ title: '放弃这次训练？', content: `已录入的 ${sets} 组将被删除`, confirmText: '放弃' }, () => { if (ui.handle(repo.workouts.discardDraft())) { this.refresh(); go(); } });
      } });
  },
});
