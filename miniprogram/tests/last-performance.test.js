// 添加动作时带入该动作最近一次已完成的重量/次数或时长。不改源记录，不覆盖正在填的组。
const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { fresh } = require('./helpers');
const K = require('../utils/repo/keys');
const BENCH = '0025';
const PLANK = '0463';
const OTHER = () => require('../utils/exercises').builtin[5].id;

function detail(be, id) {
  return JSON.parse(JSON.stringify(be.data[K.workoutDetail(id)]));
}
function finishReps(repo, date, exerciseId, sets) {
  const w = repo.workouts.createDraft({ date, exerciseIds: [exerciseId] }).data;
  const we = repo.workouts.getWorkout(w.id).exercises[0];
  sets.forEach((s, i) => {
    const cur = repo.workouts.getWorkout(w.id).exercises[0];
    const patch = { weightKg: s.weightKg, reps: s.reps };
    if (s.type) patch.type = s.type;
    const id = i === 0 ? cur.sets[0].id : repo.workouts.addSet(w.id, we.id, patch).data.id;
    if (i === 0) repo.workouts.updateSet(w.id, id, patch);
    if (s.done !== false) repo.workouts.setSetDone(w.id, id, true);
  });
  assert.ok(repo.workouts.finalizeWorkout(w.id).ok);
  return w.id;
}
function finishTime(repo, date, sets) {
  const w = repo.workouts.createDraft({ date, exerciseIds: [PLANK] }).data;
  const we = repo.workouts.getWorkout(w.id).exercises[0];
  repo.workouts.setExerciseMode(w.id, we.id, 'time');
  sets.forEach((s, i) => {
    const cur = repo.workouts.getWorkout(w.id).exercises[0];
    const id = i === 0 ? cur.sets[0].id : repo.workouts.addSet(w.id, we.id, { durationSec: s.durationSec, weightKg: s.weightKg, reps: s.reps }).data.id;
    if (i === 0) repo.workouts.updateSet(w.id, id, { durationSec: s.durationSec, weightKg: s.weightKg, reps: s.reps });
    if (s.done !== false) repo.workouts.setSetDone(w.id, id, true);
  });
  assert.ok(repo.workouts.finalizeWorkout(w.id).ok);
  return w.id;
}
function carried(repo, date, exerciseId) {
  const draft = repo.workouts.createDraft({ date });
  assert.ok(draft.ok, draft.message);
  const r = repo.workouts.addExercises(draft.data.id, [exerciseId], { carry: true });
  assert.ok(r.ok, r.message);
  return repo.workouts.getWorkout(draft.data.id).exercises[0];
}

describe('last performance', { concurrency: false }, () => {
test('newest completed history fills sets in order; drafts, undone sets, and the open workout do not', () => {
  const { repo, be } = fresh();
  repo.init();
  const older = finishReps(repo, '2026-10-01', BENCH, [{ weightKg: 20, reps: 12 }]);
  const newer = finishReps(repo, '2026-10-05', BENCH, [
    { weightKg: 20, reps: 10, type: 'warmup' },
    { weightKg: 40, reps: 8 },
    { weightKg: 50, reps: 5, done: false },
    { weightKg: 45, reps: 6 },
  ]);
  const src = detail(be, newer);
  const open = repo.workouts.createDraft({ date: '2026-10-17' }).data;
  repo.workouts.addExercises(open.id, [BENCH]);
  const self = repo.workouts.getWorkout(open.id).exercises[0];
  repo.workouts.updateSet(open.id, self.sets[0].id, { weightKg: 99, reps: 9 });
  repo.workouts.setSetDone(open.id, self.sets[0].id, true);
  const added = repo.workouts.addExercises(open.id, [BENCH], { carry: true });
  assert.ok(added.ok);
  const got = repo.workouts.getWorkout(open.id).exercises[1];
  assert.strictEqual(got.carriedFrom, '2026-10-05');
  assert.deepStrictEqual(got.sets.map(s => [s.type, s.weightKg, s.reps, s.done, s.doneAt, s.durationSec]), [
    ['warmup', 20, 10, false, null, null],
    ['normal', 40, 8, false, null, null],
    ['normal', 45, 6, false, null, null],
  ]);
  assert.deepStrictEqual(detail(be, newer), src);
  assert.strictEqual(repo.workouts.getWorkout(older).exercises[0].sets[0].weightKg, 20);
  assert.strictEqual(repo.workouts.getWorkout(open.id).exercises[0].sets[0].weightKg, 99);
  const extra = repo.workouts.addSet(open.id, got.id, {}).data;
  assert.strictEqual(extra.done, false);
  assert.strictEqual(extra.reps, 6);
});

test('bodyweight, zero load, timed seconds, old reps data, and no history', () => {
  const { repo, be } = fresh();
  repo.init();
  finishReps(repo, '2026-10-02', BENCH, [{ weightKg: null, reps: 12 }, { weightKg: 0, reps: 8 }]);
  const bw = carried(repo, '2026-10-17', BENCH);
  assert.deepStrictEqual(bw.sets.map(s => [s.weightKg, s.reps, s.done]), [[null, 12, false], [0, 8, false]]);
  repo.workouts.discardDraft();
  const timedId = finishTime(repo, '2026-10-03', [{ durationSec: 45, weightKg: 10, reps: 45 }, { durationSec: 60, done: false }]);
  const timed = carried(repo, '2026-10-17', PLANK);
  assert.strictEqual(timed.mode, 'time');
  assert.strictEqual(timed.carriedFrom, '2026-10-03');
  assert.deepStrictEqual(timed.sets.map(s => [s.durationSec, s.reps, s.weightKg, s.done]), [[45, null, 10, false]]);
  assert.strictEqual(repo.workouts.getWorkout(timedId).exercises[0].sets[0].reps, 45);
  repo.workouts.discardDraft();
  const oldId = finishReps(repo, '2026-10-04', BENCH, [{ weightKg: 30, reps: 5 }]);
  const raw = detail(be, oldId);
  delete raw.exercises[0].mode;
  raw.sets.forEach(s => { delete s.durationSec; });
  be.data[K.workoutDetail(oldId)] = raw;
  repo.workouts.discardDraft();
  const old = carried(repo, '2026-10-17', BENCH);
  assert.strictEqual(old.mode, 'reps');
  assert.deepStrictEqual([old.sets[0].weightKg, old.sets[0].reps, old.sets[0].durationSec], [30, 5, null]);
  repo.workouts.discardDraft();
  const broken = detail(be, oldId);
  broken.sets[0].weightKg = '不是重量';
  be.data[K.workoutDetail(oldId)] = broken;
  const skipped = carried(repo, '2026-10-17', BENCH);
  assert.strictEqual(skipped.carriedFrom, '2026-10-02');
  assert.deepStrictEqual(skipped.sets.map(s => s.weightKg), [null, 0]);
  repo.workouts.discardDraft();
  repo.workouts.deleteWorkout(oldId);
  const none = carried(repo, '2026-10-17', OTHER());
  assert.strictEqual(none.carriedFrom, undefined);
  assert.deepStrictEqual([none.sets.length, none.sets[0].weightKg, none.sets[0].reps, none.sets[0].done], [1, null, null, false]);
});

test('backfill ignores later days, same-day uses the earlier completed workout, and edits are read live', () => {
  const { repo, be } = fresh();
  repo.init();
  const early = finishReps(repo, '2026-10-10', BENCH, [{ weightKg: 20, reps: 5 }]);
  const laterSame = finishReps(repo, '2026-10-10', BENCH, [{ weightKg: 40, reps: 5 }]);
  const future = finishReps(repo, '2026-10-16', BENCH, [{ weightKg: 80, reps: 5 }]);
  const past = carried(repo, '2026-10-09', BENCH);
  assert.strictEqual(past.carriedFrom, undefined);
  assert.strictEqual(past.sets[0].weightKg, null);
  repo.workouts.discardDraft();
  const same = carried(repo, '2026-10-10', BENCH);
  assert.strictEqual(same.carriedFrom, '2026-10-10');
  assert.strictEqual(same.sets[0].weightKg, 40);
  repo.workouts.discardDraft();
  const beforeFuture = carried(repo, '2026-10-12', BENCH);
  assert.strictEqual(beforeFuture.sets[0].weightKg, 40);
  assert.notStrictEqual(beforeFuture.sets[0].weightKg, 80);
  repo.workouts.discardDraft();
  const morning = repo.workouts.getHeader(early);
  const afternoon = repo.workouts.getHeader(laterSame);
  assert.ok(afternoon.completedAt > morning.completedAt);
  const addedToMorning = repo.workouts.addExercises(early, [BENCH], { carry: true });
  assert.ok(addedToMorning.ok);
  const onMorning = repo.workouts.getWorkout(early).exercises[1];
  assert.strictEqual(onMorning.carriedFrom, undefined);
  assert.strictEqual(onMorning.sets[0].reps, null);
  repo.workouts.updateSet(future, repo.workouts.getWorkout(future).exercises[0].sets[0].id, { weightKg: 70, reps: 4 });
  repo.workouts.discardDraft();
  const live = carried(repo, '2026-10-17', BENCH);
  assert.strictEqual(live.sets[0].weightKg, 70);
  assert.strictEqual(live.sets[0].reps, 4);
  const headers = be.data[K.WORKOUTS];
  const a = headers.find(h => h.id === early);
  const b = headers.find(h => h.id === laterSame);
  a.completedAt = 5;
  b.completedAt = 5;
  be.data[K.WORKOUTS] = headers;
  repo.workouts.discardDraft();
  const tied = carried(repo, '2026-10-11', BENCH);
  const winner = early > laterSame ? early : laterSame;
  assert.strictEqual(tied.sets[0].weightKg, repo.workouts.getWorkout(winner).exercises[0].sets[0].weightKg);
});

test('library add, replace, template, and copy keep their own rules', () => {
  const { repo, be } = fresh();
  repo.init();
  const hist = finishReps(repo, '2026-10-08', BENCH, [{ weightKg: 100, reps: 3 }]);
  const srcSnap = detail(be, hist);
  const fromLibrary = repo.workouts.addToCurrentDraft(BENCH, { carry: true });
  assert.ok(fromLibrary.ok && fromLibrary.data.created);
  assert.strictEqual(repo.workouts.getWorkout(fromLibrary.data.workoutId).exercises[0].sets[0].weightKg, 100);
  assert.strictEqual(repo.workouts.getWorkout(fromLibrary.data.workoutId).exercises[0].sets[0].done, false);
  const plain = repo.workouts.addExercises(fromLibrary.data.workoutId, [BENCH]);
  assert.ok(plain.ok);
  assert.strictEqual(repo.workouts.getWorkout(fromLibrary.data.workoutId).exercises[1].sets[0].weightKg, null);
  repo.workouts.discardDraft();
  const otherId = finishReps(repo, '2026-10-09', OTHER(), [{ weightKg: 77, reps: 4 }]);
  const otherSnap = detail(be, otherId);
  const host = repo.workouts.createDraft({ date: '2026-10-17', exerciseIds: [OTHER()] }).data;
  const hostWe = repo.workouts.getWorkout(host.id).exercises[0];
  repo.workouts.updateSet(host.id, hostWe.sets[0].id, { weightKg: 77, reps: 4 });
  const replaced = repo.workouts.replaceExercise(host.id, hostWe.id, BENCH);
  assert.ok(replaced.ok, replaced.message);
  const after = repo.workouts.getWorkout(host.id).exercises[0];
  assert.strictEqual(after.exerciseId, BENCH);
  assert.strictEqual(after.carriedFrom, '2026-10-08');
  assert.deepStrictEqual([after.sets[0].weightKg, after.sets[0].reps, after.sets[0].done], [100, 3, false]);
  assert.notStrictEqual(after.sets[0].weightKg, 77);
  repo.workouts.discardDraft();
  const applied = repo.templates.apply({ id: 'preset_gym_chest', date: '2026-10-17' });
  assert.ok(applied.ok, applied.message);
  const templated = repo.workouts.getWorkout(applied.data.workoutId).exercises[0];
  assert.strictEqual(templated.exerciseId, BENCH);
  assert.strictEqual(templated.carriedFrom, undefined);
  assert.strictEqual(templated.sets[0].weightKg, null);
  assert.strictEqual(templated.sets.length, 1);
  repo.workouts.discardDraft();
  const copy = repo.workouts.repeatFrom(otherId);
  assert.ok(copy.ok, copy.message);
  const copied = repo.workouts.getWorkout(copy.data.workoutId).exercises[0];
  assert.strictEqual(copied.sets[0].weightKg, 77);
  assert.strictEqual(copied.sets[0].done, false);
  assert.strictEqual(copied.carriedFrom, undefined);
  assert.deepStrictEqual(detail(be, hist), srcSnap);
  assert.deepStrictEqual(detail(be, otherId), otherSnap);
  const marked = repo.workouts.completeFilledSets(copy.data.workoutId);
  assert.ok(marked.ok && marked.data.marked.length === 1);
});

test('reopening the editor does not refill from history', () => {
  const { repo, be } = fresh();
  repo.init();
  const hist = finishReps(repo, '2026-10-06', BENCH, [{ weightKg: 55, reps: 5 }]);
  const draft = repo.workouts.createDraft({ date: '2026-10-17' }).data;
  assert.ok(repo.workouts.addExercises(draft.id, [BENCH], { carry: true }).ok);
  let def;
  global.Page = d => { def = d; };
  global.wx = {
    showToast() {}, showModal() {}, navigateTo() {}, navigateBack() {},
    getWindowInfo: () => ({ windowWidth: 375 }),
    getSystemInfoSync: () => ({ windowWidth: 375 }),
    getMenuButtonBoundingClientRect: () => ({ left: 280, top: 24, height: 32 }),
  };
  const file = require.resolve('../pages/workout-edit/workout-edit.js');
  delete require.cache[file];
  require(file);
  const page = Object.assign({}, def);
  page.data = JSON.parse(JSON.stringify(def.data));
  page.setData = function (d) { Object.assign(this.data, d); };
  page.selectComponent = () => ({ show() {} });
  page.onLoad({ id: draft.id });
  assert.strictEqual(page.data.cards[0].sets[0].weightKg, 55);
  assert.strictEqual(page.data.cards[0].carriedFromLabel, '10月6日');
  assert.ok(page.data.cards[0].carriedFrom);
  const setId = repo.workouts.getWorkout(hist).exercises[0].sets[0].id;
  repo.workouts.updateSet(hist, setId, { weightKg: 15, reps: 2 });
  page.onShow();
  page.onShow();
  assert.strictEqual(page.data.cards[0].sets[0].weightKg, 55);
  assert.strictEqual(page.data.cards[0].sets[0].reps, 5);
  assert.strictEqual(repo.workouts.getWorkout(hist).exercises[0].sets[0].weightKg, 15);
  const edit = fs.readFileSync(path.join(__dirname, '../pages/workout-edit/workout-edit.wxml'), 'utf8');
  const lib = fs.readFileSync(path.join(__dirname, '../pages/library/library.js'), 'utf8');
  const detailPage = fs.readFileSync(path.join(__dirname, '../pages/exercise-detail/exercise-detail.js'), 'utf8');
  assert.ok(edit.includes('沿用上次'));
  assert.ok(lib.includes('carry: true'));
  assert.ok(detailPage.includes('carry: true'));
  assert.ok(!fs.readFileSync(path.join(__dirname, '../utils/repo/templates.js'), 'utf8').includes('carry'));
  assert.strictEqual(be.data[K.workoutDetail(draft.id)].sets[0].done, false);
});

test('weight typed in the editor is stored and shown when the exercise is added again', () => {
  const { repo, be } = fresh();
  repo.init();
  let pageDef = null;
  let rowDef = null;
  global.Page = d => { pageDef = d; };
  global.Component = d => { rowDef = d; };
  global.wx = {
    showToast() {}, showModal(o) { if (o.success) o.success({ confirm: true }); },
    vibrateShort() {}, navigateTo() {}, navigateBack() {}, redirectTo() {},
    getWindowInfo: () => ({ windowWidth: 375 }),
    getSystemInfoSync: () => ({ windowWidth: 375 }),
    getMenuButtonBoundingClientRect: () => ({ left: 280, top: 24, height: 32 }),
  };
  function editor() {
    const file = require.resolve('../pages/workout-edit/workout-edit.js');
    delete require.cache[file];
    require(file);
    const inst = Object.assign({}, pageDef);
    inst.data = JSON.parse(JSON.stringify(pageDef.data));
    inst.setData = function (d) { Object.assign(this.data, d); };
    inst.selectComponent = () => ({ show() {}, start() {} });
    return inst;
  }
  function commitBlur(page, setId, weId, field, raw) {
    const file = require.resolve('../components/set-row/set-row.js');
    delete require.cache[file];
    require(file);
    const row = Object.assign({ data: JSON.parse(JSON.stringify(rowDef.data)) }, rowDef.methods);
    let emitted = null;
    row.setData = function (d) { Object.assign(this.data, d); };
    row.triggerEvent = (name, detail) => { emitted = { name, detail }; };
    row.data.set = page.data.cards.flatMap(c => c.sets).find(s => s.id === setId) || {};
    row.onBlur({ currentTarget: { dataset: { f: field } }, detail: { value: raw } });
    page.onSetChange({ currentTarget: { dataset: { s: setId, we: weId } }, detail: emitted.detail });
  }
  function digitValue(set) {
    const file = require.resolve('../components/set-row/set-row.js');
    delete require.cache[file];
    require(file);
    const inst = { data: JSON.parse(JSON.stringify(rowDef.data)) };
    inst.setData = function (d) { Object.assign(this.data, d); };
    rowDef.observers.set.call(inst, set);
    assert.strictEqual(inst.data.weightReady, true);
    return { w: inst.data.w, r: inst.data.r };
  }
  const first = repo.workouts.createDraft({ date: '2026-10-17' }).data;
  const ed = editor();
  ed.onLoad({ id: first.id });
  ed.onPicked([BENCH], 'add');
  let card = ed.data.cards[0];
  ed.onToggleType({ currentTarget: { dataset: { s: card.sets[0].id, t: 'normal', we: card.id } } });
  commitBlur(ed, ed.data.cards[0].sets[0].id, ed.data.cards[0].id, 'weightKg', '20');
  commitBlur(ed, ed.data.cards[0].sets[0].id, ed.data.cards[0].id, 'reps', '10');
  ed.onToggleDone({ currentTarget: { dataset: { s: ed.data.cards[0].sets[0].id, d: false, we: ed.data.cards[0].id } } });
  const more = [['62.5', '8'], ['70', '5'], ['0', '12'], ['', '10']];
  more.forEach(([kg, reps]) => {
    card = ed.data.cards[0];
    ed.addSet({ currentTarget: { dataset: { we: card.id } } });
    const added = ed.data.cards[0].sets[ed.data.cards[0].sets.length - 1];
    commitBlur(ed, added.id, ed.data.cards[0].id, 'weightKg', kg);
    commitBlur(ed, added.id, ed.data.cards[0].id, 'reps', reps);
    ed.onToggleDone({ currentTarget: { dataset: { s: added.id, d: false, we: ed.data.cards[0].id } } });
  });
  ed.complete();
  const sourceId = first.id;
  const raw = detail(be, sourceId);
  delete raw.exercises[0].mode;
  raw.sets.forEach(s => { delete s.durationSec; });
  be.data[K.workoutDetail(sourceId)] = raw;
  const before = detail(be, sourceId);
  assert.deepStrictEqual(before.sets.map(s => [s.weightKg, s.reps, s.done]), [
    [20, 10, true], [62.5, 8, true], [70, 5, true], [0, 12, true], [null, 10, true],
  ]);
  const again = repo.workouts.createDraft({ date: '2026-10-17' }).data;
  const ed2 = editor();
  ed2.onLoad({ id: again.id });
  ed2.onPicked([BENCH], 'add');
  const sets = ed2.data.cards[0].sets;
  assert.deepStrictEqual(sets.map(s => [s.type, s.weightKg, s.reps, s.done, s.doneAt]), [
    ['warmup', 20, 10, false, null],
    ['normal', 62.5, 8, false, null],
    ['normal', 70, 5, false, null],
    ['normal', 0, 12, false, null],
    ['normal', null, 10, false, null],
  ]);
  assert.deepStrictEqual(sets.map(s => digitValue(s)), [
    { w: '20', r: '10' },
    { w: '62.5', r: '8' },
    { w: '70', r: '5' },
    { w: '0', r: '12' },
    { w: '', r: '10' },
  ]);
  assert.deepStrictEqual(detail(be, sourceId), before);
  const wxml = fs.readFileSync(path.join(__dirname, '../components/set-row/set-row.wxml'), 'utf8');
  const weightInput = wxml.split('data-f="weightKg"').find(part => part.includes('type="digit"'));
  assert.ok(weightInput && weightInput.includes('wx:if="{{weightReady}}"'));
  assert.ok(wxml.includes('type="number"'));
});
});
