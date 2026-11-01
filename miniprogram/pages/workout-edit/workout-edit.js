// P3 新建/编辑训练. Every edit is written immediately through the repo (sync storage), so "autosave" = per-edit write.
const D = require('../../utils/date');
const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const R = require('../../utils/rest');
const buf = require('../../utils/edit-buffer');
// Centered nav title area = windowWidth - 2 * capsule gap. Below ~170px (e.g. 320pt iPhone SE) drop weekday + status tag (REVIEW M1).
function navNarrow() {
  try { const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(), cap = wx.getMenuButtonBoundingClientRect();
    return win.windowWidth - 2 * (win.windowWidth - cap.left + 8) < 170; } catch (e) { return false; }
}
const SAVE_FAIL = ['QUOTA_EXCEEDED', 'WRITE_FAILED', 'DATA_CORRUPT'];
function cloneCards(cards) {
  return (cards || []).map(c => Object.assign({}, c, { sets: (c.sets || []).map(s => Object.assign({}, s)) }));
}
function decorate(cards) {
  cards.forEach(c => {
    let k = 0;
    c.sets.forEach(s => { s.label = s.type === 'warmup' ? '热' : String(++k); });
    c.doneCount = c.sets.filter(s => s && s.done).length;
  });
  return cards;
}
Page({
  data: { id: '', w: null, cards: [], expanded: '', sorting: false, saveState: 'saved', canRetry: false, info: false, form: {}, today: '', shakeSet: '', narrow: false, readOnly: false, detailMissing: false, detailCorrupt: false },
  onLoad(o) { this.setData({ id: o.id || '', today: D.today(), narrow: navNarrow(), readOnly: repo.isReadOnly() }); this.reload(); },
  onShow() { if (this._loaded) this.reload(); this._loaded = true; },
  onUnload() { // leaving before the first exercise: in-memory draft is discarded (DATA_MODEL §4.1). Unsaved edits stay in edit-buffer.
    const p = repo.workouts.getPending(); if (p && p.id === this.data.id) repo.workouts.discardPending();
  },
  reload() {
    const w = repo.workouts.getWorkout(this.data.id);
    if (!w) { buf.clear(this.data.id); wx.showToast({ title: '训练不存在', icon: 'none' }); return setTimeout(() => wx.navigateBack(), 400); }
    const detailMissing = !!w.detailMissing, detailCorrupt = !!w.detailCorrupt;
    const cards = w.exercises.map(e => ({
      id: e.id, name: e.displayName, exerciseId: e.exerciseId, note: e.note, unknown: !!(e.exercise && e.exercise.unknown),
      part: e.exercise && !e.exercise.unknown ? repo.exercises.zhOf('bodyPart', e.exercise.bodyPart) : '',
      bodyweight: !!(e.exercise && e.exercise.equipment === 'body_weight'),
      mode: e.mode === 'time' ? 'time' : 'reps',
      restLabel: repo.rest.getFor(e.exerciseId) + 's' + (repo.rest.getOverride(e.exerciseId) ? '' : '（默认）'),
      sets: e.sets.map(s => Object.assign({}, s)),
    }));
    if (!detailMissing) { buf.apply(this.data.id, cards); decorate(cards); }
    else decorate(cards);
    let expanded = this.data.expanded;
    if (!cards.some(c => c.id === expanded)) expanded = cards.length ? cards[cards.length - 1].id : '';
    const pending = !detailMissing && !detailCorrupt && buf.has(this.data.id);
    this.setData({ cards, expanded, detailMissing, detailCorrupt, readOnly: repo.isReadOnly() || detailMissing || detailCorrupt,
      saveState: pending ? 'failed' : 'saved', canRetry: pending,
      w: { id: w.id, status: w.status, persisted: w.persisted !== false, dateLabel: F.dateLabel(w.date), dateShort: F.md(w.date), date: w.date,
        name: w.name, note: w.note, placeholder: F.md(w.date) + '训练', summary: F.strengthSummary(w.exerciseCount, w.setCount, w.volumeKg, w.timeSec) } });
  },
  // Run a repo mutation. Success reloads from storage, then replays any still-pending edits on top.
  // Storage failure keeps every failed edit (not just the last) and never flips the status line back to 已自动保存.
  pageWritable() {
    if (!ui.canWrite()) return false;
    if (this.data.detailMissing) { wx.showToast({ title: '训练详情丢失，只能查看', icon: 'none' }); return false; }
    if (this.data.detailCorrupt) { wx.showToast({ title: '记录已损坏，已暂停编辑', icon: 'none' }); return false; }
    return true;
  },
  run(r, opts = {}) {
    const okk = ui.handle(r);
    const id = this.data.id;
    if (r && SAVE_FAIL.includes(r.code)) {
      if (opts.op) buf.upsert(id, opts.op);
      if (opts.op && typeof opts.op.apply === 'function') {
        const cards = cloneCards(this.data.cards);
        opts.op.apply(cards);
        decorate(cards);
        this.setData({ cards });
      }
      this.setData({ saveState: 'failed', canRetry: buf.has(id) });
      return false;
    }
    if (okk) { if (opts.op) buf.forget(id, opts.op.key); }
    else if (opts.op) {
      const cur = buf.list(id).find(x => x.key === opts.op.key);
      if (cur === opts.op) buf.forget(id, opts.op.key); // this attempt is the queued one and it cannot be retried
    }
    this.reload();
    return !!okk;
  },
  retry() {
    if (this.data.saveState !== 'failed' || !buf.has(this.data.id)) return;
    const ops = buf.list(this.data.id);
    for (let i = 0; i < ops.length; i++) { if (!this.run(ops[i].exec(), { op: ops[i] })) return; }
  },
  promptUnsaved(leaving, onLeave) {
    wx.showModal({
      title: '还有未保存的修改',
      content: leaving ? '这些修改还没写入手机。离开后可以回来，点「保存失败 · 重试」再保存。' : '这些修改还没写入手机。请先点「保存失败 · 重试」，再完成。',
      cancelText: leaving ? '仍然离开' : '取消',
      confirmText: '返回重试',
      success: m => { if (leaving && m.cancel && onLeave) onLeave(); },
    });
  },
  // ---------- header / info sheet
  onClose() {
    const leave = () => wx.navigateBack();
    if (buf.has(this.data.id)) return this.promptUnsaved(true, leave);
    const w = this.data.w;
    if (!w || w.status === 'draft') return leave();
    this.finishEdit(true);
  },
  openInfo() { const w = this.data.w; this.setData({ info: true, form: { name: w.name, note: w.note, date: w.date, dateLabel: F.dateLabel(w.date) } }); },
  closeInfo() { this.setData({ info: false }); },
  onInfoInput(e) { this.setData({ ['form.' + e.currentTarget.dataset.k]: e.detail.value }); },
  onInfoDate(e) { this.setData({ 'form.date': e.detail.value, 'form.dateLabel': F.dateLabel(e.detail.value) }); },
  saveInfo() {
    if (!this.pageWritable()) return;
    const { name, note, date } = this.data.form, id = this.data.id;
    const op = { key: 'info', exec: () => repo.workouts.updateWorkout(id, { name, note, date }), apply() {} };
    if (this.run(op.exec(), { op })) this.setData({ info: false });
  },
  // ---------- exercises
  toggleCard(e) { const id = e.currentTarget.dataset.id; this.setData({ expanded: this.data.expanded === id ? '' : id }); },
  openPicker(mode = 'add', weId = '') {
    if (!this.pageWritable()) return;
    const self = this;
    wx.navigateTo({
      url: `/pages/exercise-picker/exercise-picker?mode=${mode}&wid=${this.data.id}`,
      events: { picked(ids) { self.onPicked(ids, mode, weId); } },
    });
  },
  addTap() { this.openPicker('add'); },
  openTemplates() {
    const w = this.data.w;
    if (!w || !this.pageWritable()) return;
    wx.navigateTo({ url: '/pages/templates/templates?date=' + w.date + '&wid=' + encodeURIComponent(this.data.id) });
  },
  confirmReplace(weId, exerciseId) {
    if (!this.pageWritable()) return;
    const card = this.data.cards.find(c => c.id === weId);
    const same = card && card.exerciseId === exerciseId;
    const scored = card && card.sets.some(s => s.done || s.weightKg != null || s.reps != null || s.durationSec != null);
    const id = this.data.id;
    const go = () => {
      const op = { key: 'replace:' + weId, exec: () => repo.workouts.replaceExercise(id, weId, exerciseId), apply() {} };
      this.run(op.exec(), { op });
    };
    if (same || !scored) return go();
    wx.showModal({
      title: '替换这个动作？',
      content: '已录入的重量、次数、时长和完成状态不会带到新动作。',
      cancelText: '取消', confirmText: '替换',
      success: m => { if (m.confirm) go(); },
    });
  },
  onPicked(ids, mode, weId) {
    if (!ids || !ids.length) return;
    if (mode === 'replace') return this.confirmReplace(weId, ids[0]);
    if (!this.pageWritable()) return;
    const id = this.data.id;
    const op = { key: 'addEx:' + ids.join(',') + ':' + Date.now(), exec: () => repo.workouts.addExercises(id, ids), apply() {} };
    const r = op.exec();
    if (r.ok) this.setData({ expanded: r.data[r.data.length - 1].id });
    this.run(r, { op });
  },
  more(e) {
    const id = e.currentTarget.dataset.id, card = this.data.cards.find(c => c.id === id);
    if (!this.pageWritable()) return;
    const items = ['动作备注', '组间歇时长', '调整顺序', '替换动作', '删除动作'];
    wx.showActionSheet({ itemList: items, success: r => {
      const act = items[r.tapIndex];
      if (act === '动作备注') wx.showModal({ title: '动作备注', editable: true, placeholderText: '只属于这次训练（≤200 字）', content: card.note,
        success: m => { if (m.confirm) { const note = m.content || '', wid = this.data.id;
          const op = { key: 'note:' + id, exec: () => repo.workouts.updateExerciseNote(wid, id, note), apply() {} };
          this.run(op.exec(), { op }); } } });
      if (act === '组间歇时长') this.restMenuFor(card.exerciseId, card.name);
      if (act === '调整顺序') this.setData({ sorting: true });
      if (act === '替换动作') this.openPicker('replace', id);
      if (act === '删除动作') this.removeExercise(id);
    } });
  },
  removeExercise(id) {
    const card = this.data.cards.find(c => c.id === id), wid = this.data.id;
    const op = { key: 'delWe:' + id, exec: () => repo.workouts.removeExercise(wid, id), apply() {} };
    const r = op.exec();
    if (this.run(r, { op })) this.selectComponent('#undo').show(`已移除 ${card.name}（${card.sets.length} 组）`, { kind: 'exercise', data: r.data });
  },
  sortDone() { this.setData({ sorting: false }); },
  moveUp(e) { const { id, i } = e.currentTarget.dataset; if (i > 0) this.moveExercise(id, i - 1); },
  moveDown(e) { const { id, i } = e.currentTarget.dataset; if (i < this.data.cards.length - 1) this.moveExercise(id, i + 1); },
  moveExercise(id, to) {
    const wid = this.data.id;
    const op = { key: 'move:' + id, exec: () => repo.workouts.moveExercise(wid, id, to), apply() {} };
    this.run(op.exec(), { op });
  },
  // ---------- sets
  addSet(e) {
    if (!this.pageWritable()) return;
    const we = e.currentTarget.dataset.we, id = this.data.id;
    const tempId = 'tmp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const op = {
      key: 'add:' + tempId,
      exec: () => repo.workouts.addSet(id, we, { type: 'normal' }),
      apply(cards) {
        const c = cards.find(x => x.id === we);
        if (!c || c.sets.some(s => s.id === tempId)) return;
        const last = c.sets[c.sets.length - 1];
        c.sets.push({ id: tempId, type: 'normal', done: false, weightKg: last ? last.weightKg : null, reps: last ? last.reps : null, durationSec: last && last.durationSec != null ? last.durationSec : null });
      },
    };
    this.run(op.exec(), { op });
  },
  onSetChange(e) {
    if (!this.pageWritable()) return;
    const { s, we } = e.currentTarget.dataset, { field, value } = e.detail, id = this.data.id;
    const op = {
      key: 'set:' + s + ':' + field,
      exec: () => repo.workouts.updateSet(id, s, { [field]: value }),
      apply(cards) {
        const c = cards.find(x => x.id === we);
        const set = c && c.sets.find(x => x.id === s);
        if (set) set[field] = value;
      },
    };
    this.run(op.exec(), { op });
  },
  onToggleType(e) {
    if (!this.pageWritable()) return;
    const { s, t } = e.currentTarget.dataset, id = this.data.id, type = t === 'warmup' ? 'normal' : 'warmup';
    const op = { key: 'type:' + s, exec: () => repo.workouts.updateSet(id, s, { type }), apply() {} };
    this.run(op.exec(), { op });
  },
  onToggleDone(e) {
    if (!this.pageWritable()) return;
    const { s, d } = e.currentTarget.dataset, id = this.data.id, next = !d;
    const op = {
      key: 'done:' + s,
      exec: () => repo.workouts.setSetDone(id, s, next),
      apply(cards) { cards.forEach(c => { const set = c.sets.find(x => x.id === s); if (set) set.done = next; }); },
    };
    const r = op.exec();
    if (r.code === 'REPS_REQUIRED' || r.code === 'DURATION_REQUIRED') {
      wx.showToast({ title: r.code === 'DURATION_REQUIRED' ? '请输入时长' : '先填写次数', icon: 'none' });
      this.setData({ shakeSet: s }); setTimeout(() => this.setData({ shakeSet: '' }), 400); return;
    }
    if (r.ok && !d) { try { wx.vibrateShort({ type: 'light' }); } catch (err) { /* noop */ } }
    if (this.run(r, { op }) && !d) this.startRest(e.currentTarget.dataset.we);
  },
  onSetMore(e) {
    if (!this.pageWritable()) return;
    const { s, we } = e.currentTarget.dataset;
    const card = this.data.cards.find(c => c.id === we), set = card.sets.find(x => x.id === s);
    const items = [set.type === 'warmup' ? '设为普通组' : '设为热身组', '在下方复制一组', '删除此组'];
    wx.showActionSheet({ itemList: items, success: r => {
      if (r.tapIndex === 0) this.onToggleType({ currentTarget: { dataset: { s, t: set.type } } });
      if (r.tapIndex === 1) {
        const id = this.data.id;
        const op = { key: 'dup:' + s + ':' + Date.now(), exec: () => repo.workouts.duplicateSet(id, s), apply() {} };
        this.run(op.exec(), { op });
      }
      if (r.tapIndex === 2) this.deleteSet(s, set.label);
    } });
  },
  deleteSet(setId, label) {
    const id = this.data.id;
    const op = { key: 'delSet:' + setId, exec: () => repo.workouts.deleteSet(id, setId), apply() {} };
    const r = op.exec();
    if (this.run(r, { op })) this.selectComponent('#undo').show(label === '热' ? '已删除热身组' : `已删除第 ${label} 组`, { kind: 'set', data: r.data });
  },
  onUndo(e) {
    if (!this.pageWritable()) return;
    const p = e.detail.payload, id = this.data.id;
    const op = { key: 'undo:' + Date.now(), exec: () => (p.kind === 'set' ? repo.workouts.restoreSet(id, p.data) : repo.workouts.restoreExercise(id, p.data)), apply() {} };
    this.run(op.exec(), { op });
  },
  // ---------- swipe delete
  swipeDelEx(e) { if (this.pageWritable()) this.removeExercise(e.currentTarget.dataset.id); },
  swipeDelSet(e) { if (this.pageWritable()) this.deleteSet(e.currentTarget.dataset.s, e.currentTarget.dataset.label); },
  onMode(e) {
    if (!this.pageWritable()) return;
    const weId = e.currentTarget.dataset.id, mode = e.currentTarget.dataset.mode;
    const card = this.data.cards.find(c => c.id === weId);
    if (!card || card.mode === mode || (mode !== 'reps' && mode !== 'time')) return;
    const id = this.data.id;
    const op = {
      key: 'mode:' + weId,
      exec: () => repo.workouts.setExerciseMode(id, weId, mode),
      apply(cards) {
        const c = cards.find(x => x.id === weId);
        if (!c) return;
        c.mode = mode;
        c.sets.forEach(s => {
          if (!s.done) return;
          const ok = mode === 'time' ? s.durationSec >= 1 : s.reps >= 1;
          if (!ok) s.done = false;
        });
      },
    };
    const r = op.exec();
    if (r.ok && r.data && r.data.reset > 0) wx.showToast({ title: mode === 'time' ? '已取消缺少时长的完成勾选' : '已取消缺少次数的完成勾选', icon: 'none' });
    this.run(r, { op });
  },
  // ---------- rest / hold timer
  onSetTimer(e) {
    if (!this.pageWritable()) return;
    const { s, we } = e.currentTarget.dataset;
    const card = this.data.cards.find(c => c.id === we);
    const set = card && card.sets.find(x => x.id === s);
    if (!set || !(set.durationSec >= 1)) {
      wx.showToast({ title: '请输入时长', icon: 'none' });
      this.setData({ shakeSet: s }); setTimeout(() => this.setData({ shakeSet: '' }), 400);
      return;
    }
    this._hold = { setId: s, weId: we };
    const t = this.selectComponent('#rest');
    if (t) t.start(set.durationSec, card.name, { kind: 'hold' });
  },
  onTimerDone(e) {
    const detail = (e && e.detail) || {};
    if (detail.kind !== 'hold' || !this._hold) return;
    const { setId, weId } = this._hold;
    this._hold = null;
    if (!this.pageWritable()) return;
    const id = this.data.id;
    const op = {
      key: 'done:' + setId,
      exec: () => repo.workouts.setSetDone(id, setId, true),
      apply(cards) { cards.forEach(c => { const set = c.sets.find(x => x.id === setId); if (set) set.done = true; }); },
    };
    const r = op.exec();
    if (r.code === 'DURATION_REQUIRED' || r.code === 'REPS_REQUIRED') {
      wx.showToast({ title: r.code === 'DURATION_REQUIRED' ? '请输入时长' : '先填写次数', icon: 'none' });
      return;
    }
    const saved = this.run(r, { op });
    if (saved || SAVE_FAIL.includes(r && r.code)) this.startRest(weId);
  },
  onTimerSkip() { this._hold = null; },
  startRest(weId) {
    this._hold = null;
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
    if (!this.pageWritable()) return;
    if (buf.has(this.data.id)) return this.promptUnsaved(false);
    const chk = repo.workouts.completionCheck(this.data.id);
    if (chk && chk.detailMissing) return wx.showModal({ title: '无法完成', content: '训练详情丢失，只能查看', showCancel: false, confirmText: '知道了' });
    if (!chk || !chk.canFinish) return wx.showModal({ title: '还不能结束', content: '至少完成一组才能结束训练', showCancel: false, confirmText: '知道了' });
    const parts = [];
    if (chk.willRemove.length) parts.push(`有 ${chk.willRemove.length} 个动作没有完成任何组，结束后将被移除`);
    if (chk.undoneSets) parts.push(`${parts.length ? '另有' : '有'} ${chk.undoneSets} 组未打勾，会保留但不计入统计`);
    const doIt = () => {
      const r = repo.workouts.finalizeWorkout(this.data.id);
      if (ui.handle(r)) { buf.clear(this.data.id); wx.redirectTo({ url: '/pages/workout-detail/workout-detail?done=1&id=' + this.data.id }); } // toast shown by P2 (REVIEW S19)
    };
    if (!parts.length) return doIt();
    wx.showModal({ title: '完成训练？', content: parts.join('；') + '。', cancelText: '返回检查', confirmText: '完成训练', success: m => { if (m.confirm) doIt(); } });
  },
  finishEdit(fromClose) {
    if (buf.has(this.data.id)) return this.promptUnsaved(!!fromClose, () => wx.navigateBack());
    if (this.data.detailMissing || this.data.detailCorrupt) {
      if (fromClose) return wx.navigateBack();
      wx.showToast({ title: this.data.detailMissing ? '训练详情丢失，只能查看' : '记录已损坏，已暂停编辑', icon: 'none' });
      return;
    }
    const r = repo.workouts.finalizeWorkout(this.data.id);
    if (r.ok) { buf.clear(this.data.id); return wx.navigateBack(); }
    if (r.code !== 'NO_DONE_SETS') return ui.handle(r);
    // completed stays completed and is already saved; ≥1 done set is a UI gate (lead #9)
    wx.showModal({ title: '至少完成一组', content: '已完成的训练至少要有一组打勾。修改已自动保存。', cancelText: fromClose ? '仍然离开' : '取消', confirmText: '返回检查',
      success: m => { if (m.cancel && fromClose) wx.navigateBack(); } });
  },
  finishEditTap() { this.finishEdit(false); },
  discard() {
    const sets = this.data.cards.reduce((t, c) => t + c.sets.length, 0);
    ui.confirmDelete({ title: '放弃这次训练？', content: `已录入的 ${sets} 组将被删除`, confirmText: '放弃' }, () => {
      if (ui.handle(repo.workouts.discardDraft())) { buf.clear(this.data.id); wx.navigateBack(); }
    });
  },
});
