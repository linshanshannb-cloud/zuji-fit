// P3 新建/编辑训练. Every edit is written immediately through the repo (sync storage), so "autosave" = per-edit write.
const D = require('../../utils/date');
const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const R = require('../../utils/rest');
// Centered nav title area = windowWidth - 2 * capsule gap. Below ~170px (e.g. 320pt iPhone SE) drop weekday + status tag (REVIEW M1).
function navNarrow() {
  try { const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(), cap = wx.getMenuButtonBoundingClientRect();
    return win.windowWidth - 2 * (win.windowWidth - cap.left + 8) < 170; } catch (e) { return false; }
}
const SAVE_FAIL = ['QUOTA_EXCEEDED', 'WRITE_FAILED', 'DATA_CORRUPT'];
Page({
  data: { id: '', w: null, cards: [], expanded: '', sorting: false, saveState: 'saved', canRetry: false, info: false, form: {}, today: '', shakeSet: '', narrow: false, readOnly: false },
  onLoad(o) { this.setData({ id: o.id || '', today: D.today(), narrow: navNarrow(), readOnly: repo.isReadOnly() }); this.reload(); },
  onShow() { if (this._loaded) { this.setData({ readOnly: repo.isReadOnly() }); this.reload(); } this._loaded = true; },
  onUnload() { // leaving before the first exercise: in-memory draft is discarded (DATA_MODEL §4.1)
    const p = repo.workouts.getPending(); if (p && p.id === this.data.id) repo.workouts.discardPending();
  },
  reload() {
    const w = repo.workouts.getWorkout(this.data.id);
    if (!w) { wx.showToast({ title: '训练不存在', icon: 'none' }); return setTimeout(() => wx.navigateBack(), 400); }
    const cards = w.exercises.map(e => {
      let k = 0;
      return { id: e.id, name: e.displayName, exerciseId: e.exerciseId, note: e.note, unknown: !!(e.exercise && e.exercise.unknown),
        part: e.exercise && !e.exercise.unknown ? repo.exercises.zhOf('bodyPart', e.exercise.bodyPart) : '',
        bodyweight: !!(e.exercise && e.exercise.equipment === 'body_weight'),
        doneCount: e.sets.filter(s => s.done).length,
        restLabel: repo.rest.getFor(e.exerciseId) + 's' + (repo.rest.getOverride(e.exerciseId) ? '' : '（默认）'),
        sets: e.sets.map(s => Object.assign({}, s, { label: s.type === 'warmup' ? '热' : String(++k) })) };
    });
    let expanded = this.data.expanded;
    if (!cards.some(c => c.id === expanded)) expanded = cards.length ? cards[cards.length - 1].id : '';
    this.setData({ cards, expanded, w: { id: w.id, status: w.status, persisted: w.persisted !== false, dateLabel: F.dateLabel(w.date), dateShort: F.md(w.date), date: w.date,
      name: w.name, note: w.note, placeholder: F.md(w.date) + '训练', summary: `${w.exerciseCount} 个动作 · ${w.setCount} 组 · ${F.thousands(w.volumeKg)} kg` } });
  },
  // Run a repo mutation. Success -> reload from storage. Storage failure -> keep what's on screen (PRODUCT_SPEC 7.1
  // "页面上的数据保留在内存里，不清空"), show 保存失败 · 重试. `opts.retry` re-runs the write; `opts.keep` patches the
  // page with the value the user entered so it is not wiped.
  run(r, opts = {}) {
    const okk = ui.handle(r, opts);
    if (okk) { this._retry = null; this.setData({ saveState: 'saved', canRetry: false }); this.reload(); return true; }
    if (r && SAVE_FAIL.includes(r.code)) {
      this._retry = opts.retry || null;
      if (opts.keep) opts.keep();
      this.setData({ saveState: 'failed', canRetry: !!opts.retry });
      return false;
    }
    this.reload(); // validation errors: re-sync the inputs with stored values
    return false;
  },
  retry() { if (this._retry && this.data.saveState === 'failed') { const f = this._retry; this.run(f(), { retry: f }); } },
  // ---------- header / info sheet
  onClose() {
    const w = this.data.w;
    if (!w || w.status === 'draft') return wx.navigateBack();
    this.finishEdit(true);
  },
  openInfo() { const w = this.data.w; this.setData({ info: true, form: { name: w.name, note: w.note, date: w.date, dateLabel: F.dateLabel(w.date) } }); },
  closeInfo() { this.setData({ info: false }); },
  onInfoInput(e) { this.setData({ ['form.' + e.currentTarget.dataset.k]: e.detail.value }); },
  onInfoDate(e) { this.setData({ 'form.date': e.detail.value, 'form.dateLabel': F.dateLabel(e.detail.value) }); },
  saveInfo() { const { name, note, date } = this.data.form; if (this.run(repo.workouts.updateWorkout(this.data.id, { name, note, date }))) this.setData({ info: false }); },
  // ---------- exercises
  toggleCard(e) { const id = e.currentTarget.dataset.id; this.setData({ expanded: this.data.expanded === id ? '' : id }); },
  openPicker(mode = 'add', weId = '') {
    if (!ui.canWrite()) return;
    const self = this;
    wx.navigateTo({
      url: `/pages/exercise-picker/exercise-picker?mode=${mode}&wid=${this.data.id}`,
      events: { picked(ids) { self.onPicked(ids, mode, weId); } },
    });
  },
  addTap() { this.openPicker('add'); },
  onPicked(ids, mode, weId) {
    if (!ids || !ids.length) return;
    if (mode === 'replace') return this.run(repo.workouts.replaceExercise(this.data.id, weId, ids[0]));
    const r = repo.workouts.addExercises(this.data.id, ids);
    if (r.ok) this.setData({ expanded: r.data[r.data.length - 1].id });
    this.run(r);
  },
  more(e) {
    const id = e.currentTarget.dataset.id, card = this.data.cards.find(c => c.id === id);
    if (!ui.canWrite()) return;
    const items = ['动作备注', '组间歇时长', '调整顺序', '替换动作', '删除动作'];
    wx.showActionSheet({ itemList: items, success: r => {
      const act = items[r.tapIndex];
      if (act === '动作备注') wx.showModal({ title: '动作备注', editable: true, placeholderText: '只属于这次训练（≤200 字）', content: card.note,
        success: m => { if (m.confirm) this.run(repo.workouts.updateExerciseNote(this.data.id, id, m.content || '')); } });
      if (act === '组间歇时长') this.restMenuFor(card.exerciseId, card.name);
      if (act === '调整顺序') this.setData({ sorting: true });
      if (act === '替换动作') this.openPicker('replace', id);
      if (act === '删除动作') this.removeExercise(id);
    } });
  },
  removeExercise(id) {
    const card = this.data.cards.find(c => c.id === id);
    const r = repo.workouts.removeExercise(this.data.id, id);
    if (this.run(r)) this.selectComponent('#undo').show(`已移除 ${card.name}（${card.sets.length} 组）`, { kind: 'exercise', data: r.data });
  },
  sortDone() { this.setData({ sorting: false }); },
  moveUp(e) { const { id, i } = e.currentTarget.dataset; if (i > 0) this.run(repo.workouts.moveExercise(this.data.id, id, i - 1)); },
  moveDown(e) { const { id, i } = e.currentTarget.dataset; if (i < this.data.cards.length - 1) this.run(repo.workouts.moveExercise(this.data.id, id, i + 1)); },
  // ---------- sets
  addSet(e) { if (ui.canWrite()) this.run(repo.workouts.addSet(this.data.id, e.currentTarget.dataset.we, { type: 'normal' })); },
  onSetChange(e) {
    const { s, we } = e.currentTarget.dataset, { field, value } = e.detail, id = this.data.id;
    const f = () => repo.workouts.updateSet(id, s, { [field]: value });
    this.run(f(), { retry: f, keep: () => {
      const ci = this.data.cards.findIndex(c => c.id === we), si = ci < 0 ? -1 : this.data.cards[ci].sets.findIndex(x => x.id === s);
      if (si >= 0) this.setData({ [`cards[${ci}].sets[${si}].${field}`]: value });
    } });
  },
  onToggleType(e) { const { s, t } = e.currentTarget.dataset; this.run(repo.workouts.updateSet(this.data.id, s, { type: t === 'warmup' ? 'normal' : 'warmup' })); },
  onToggleDone(e) {
    const { s, d } = e.currentTarget.dataset;
    const r = repo.workouts.setSetDone(this.data.id, s, !d);
    if (r.code === 'REPS_REQUIRED') { wx.showToast({ title: '先填写次数', icon: 'none' }); this.setData({ shakeSet: s }); setTimeout(() => this.setData({ shakeSet: '' }), 400); return; }
    if (r.ok && !d) { try { wx.vibrateShort({ type: 'light' }); } catch (err) { /* noop */ } }
    if (this.run(r) && !d) this.startRest(e.currentTarget.dataset.we);
  },
  onSetMore(e) {
    const { s, we } = e.currentTarget.dataset;
    const card = this.data.cards.find(c => c.id === we), set = card.sets.find(x => x.id === s);
    const items = [set.type === 'warmup' ? '设为普通组' : '设为热身组', '在下方复制一组', '删除此组'];
    wx.showActionSheet({ itemList: items, success: r => {
      if (r.tapIndex === 0) this.run(repo.workouts.updateSet(this.data.id, s, { type: set.type === 'warmup' ? 'normal' : 'warmup' }));
      if (r.tapIndex === 1) this.run(repo.workouts.duplicateSet(this.data.id, s));
      if (r.tapIndex === 2) this.deleteSet(s, set.label);
    } });
  },
  deleteSet(setId, label) {
    const r = repo.workouts.deleteSet(this.data.id, setId);
    if (this.run(r)) this.selectComponent('#undo').show(label === '热' ? '已删除热身组' : `已删除第 ${label} 组`, { kind: 'set', data: r.data });
  },
  onUndo(e) {
    const p = e.detail.payload;
    this.run(p.kind === 'set' ? repo.workouts.restoreSet(this.data.id, p.data) : repo.workouts.restoreExercise(this.data.id, p.data));
  },
  // ---------- swipe delete
  swipeDelEx(e) { if (ui.canWrite()) this.removeExercise(e.currentTarget.dataset.id); },
  swipeDelSet(e) { if (ui.canWrite()) this.deleteSet(e.currentTarget.dataset.s, e.currentTarget.dataset.label); },
  // ---------- rest timer
  startRest(weId) {
    const card = this.data.cards.find(c => c.id === weId);
    if (!card) return;
    this._restEx = { exerciseId: card.exerciseId, name: card.name };
    const t = this.selectComponent('#rest');
    if (t) t.start(repo.rest.getFor(card.exerciseId), card.name + ' · 组间休息');
  },
  restMenu(e) { const card = this.data.cards.find(c => c.id === e.currentTarget.dataset.id); if (card) this.restMenuFor(card.exerciseId, card.name); },
  onRestSettings() { if (this._restEx) this.restMenuFor(this._restEx.exerciseId, this._restEx.name); },
  restMenuFor(exerciseId, name) {
    const cur = repo.rest.getOverride(exerciseId), dflt = repo.rest.getDefault();
    const mark = v => (v === cur ? '✓ ' : '');
    const items = [(cur ? '' : '✓ ') + `使用默认（${dflt} 秒）`, mark(60) + '60 秒', mark(90) + '90 秒', mark(120) + '120 秒', '自定义秒数…', '修改全局默认…'];
    wx.showActionSheet({ alertText: `${name} · 组间歇`, itemList: items, success: r => {
      const i = r.tapIndex;
      if (i === 0) repo.rest.setFor(exerciseId, 0);
      else if (i >= 1 && i <= 3) repo.rest.setFor(exerciseId, [60, 90, 120][i - 1]);
      else if (i === 4) return wx.showModal({ title: '组间歇（秒）', editable: true, placeholderText: `${R.MIN}–${R.MAX}`, content: String(cur || dflt),
        success: m => { if (m.confirm && Number(m.content) > 0) { repo.rest.setFor(exerciseId, Number(m.content)); this.reload(); } } });
      else if (i === 5) return wx.navigateTo({ url: '/pages/settings/settings' });
      this.reload();
    } });
  },
  // ---------- finish
  complete() {
    if (!ui.canWrite()) return;
    const chk = repo.workouts.completionCheck(this.data.id);
    if (!chk || !chk.canFinish) return wx.showModal({ title: '还不能结束', content: '至少完成一组才能结束训练', showCancel: false, confirmText: '知道了' });
    const parts = [];
    if (chk.willRemove.length) parts.push(`有 ${chk.willRemove.length} 个动作没有完成任何组，结束后将被移除`);
    if (chk.undoneSets) parts.push(`${parts.length ? '另有' : '有'} ${chk.undoneSets} 组未打勾，会保留但不计入统计`);
    const doIt = () => {
      const r = repo.workouts.finalizeWorkout(this.data.id);
      if (ui.handle(r)) wx.redirectTo({ url: '/pages/workout-detail/workout-detail?done=1&id=' + this.data.id }); // toast shown by P2 (REVIEW S19)
    };
    if (!parts.length) return doIt();
    wx.showModal({ title: '完成训练？', content: parts.join('；') + '。', cancelText: '返回检查', confirmText: '完成训练', success: m => { if (m.confirm) doIt(); } });
  },
  finishEdit(fromClose) {
    const r = repo.workouts.finalizeWorkout(this.data.id);
    if (r.ok) return wx.navigateBack();
    if (r.code !== 'NO_DONE_SETS') return ui.handle(r);
    // completed stays completed and is already saved; ≥1 done set is a UI gate (lead #9)
    wx.showModal({ title: '至少完成一组', content: '已完成的训练至少要有一组打勾。修改已自动保存。', cancelText: fromClose ? '仍然离开' : '取消', confirmText: '返回检查',
      success: m => { if (m.cancel && fromClose) wx.navigateBack(); } });
  },
  finishEditTap() { this.finishEdit(false); },
  discard() {
    const sets = this.data.cards.reduce((t, c) => t + c.sets.length, 0);
    ui.confirmDelete({ title: '放弃这次训练？', content: `已录入的 ${sets} 组将被删除`, confirmText: '放弃' }, () => {
      if (ui.handle(repo.workouts.discardDraft())) wx.navigateBack();
    });
  },
});
