// 一键全部完成：只勾已填好的组，不改重量时长，不改起止时间，可撤销这次批量。
const test = require('node:test');
const assert = require('node:assert');
const { fresh } = require('./helpers');
const K = require('../utils/repo/keys');
const S = require('../utils/storage');
const BENCH = '0025';
const PLANK = '0463';

function snap(be, id) {
  return {
    detail: JSON.parse(JSON.stringify(be.data[K.workoutDetail(id)])),
    header: JSON.parse(JSON.stringify(be.data[K.WORKOUTS].find(w => w.id === id))),
  };
}

test('marks filled reps and timed sets across exercises, including warmup and bodyweight', () => {
  const { repo, be } = fresh();
  repo.init();
  const w = repo.workouts.createDraft({ date: '2026-10-15', exerciseIds: [BENCH, PLANK] }).data;
  const v = repo.workouts.getWorkout(w.id);
  const [bench, plank] = v.exercises;
  const clock = { startedAt: repo.workouts.getHeader(w.id).startedAt, completedAt: repo.workouts.getHeader(w.id).completedAt };
  assert.strictEqual(clock.startedAt, null, '补录没有开始时间');
  repo.workouts.updateSet(w.id, bench.sets[0].id, { weightKg: 40, reps: 8 });
  const warm = repo.workouts.addSet(w.id, bench.id, { weightKg: 20, reps: 10, type: 'warmup' }).data;
  const bw = repo.workouts.addSet(w.id, bench.id, { weightKg: null, reps: 12 }).data;
  const zero = repo.workouts.addSet(w.id, bench.id, { weightKg: 0, reps: 6 }).data;
  const blank = repo.workouts.addSet(w.id, bench.id, { reps: null, weightKg: null }).data;
  repo.workouts.updateSet(w.id, plank.sets[0].id, { durationSec: 45, weightKg: 10 });
  const noTime = repo.workouts.addSet(w.id, plank.id, { durationSec: null }).data;
  const already = repo.workouts.addSet(w.id, bench.id, { weightKg: 50, reps: 5 }).data;
  const prior = repo.workouts.setSetDone(w.id, already.id, true).data;
  const before = snap(be, w.id);
  const r = repo.workouts.completeFilledSets(w.id);
  assert.ok(r.ok, r.message);
  assert.strictEqual(r.data.marked.length, 5);
  const got = repo.workouts.getWorkout(w.id);
  const sets = {};
  got.exercises.forEach(e => e.sets.forEach(s => { sets[s.id] = s; }));
  [bench.sets[0].id, warm.id, bw.id, zero.id, plank.sets[0].id].forEach(id => assert.strictEqual(sets[id].done, true, id));
  assert.strictEqual(sets[warm.id].type, 'warmup');
  assert.strictEqual(sets[warm.id].weightKg, 20);
  assert.strictEqual(sets[bw.id].weightKg, null);
  assert.strictEqual(sets[bw.id].reps, 12);
  assert.strictEqual(sets[zero.id].weightKg, 0);
  assert.strictEqual(sets[plank.sets[0].id].durationSec, 45);
  assert.strictEqual(sets[plank.sets[0].id].weightKg, 10);
  assert.strictEqual(sets[blank.id].done, false);
  assert.strictEqual(sets[noTime.id].done, false);
  assert.strictEqual(sets[already.id].done, true);
  assert.strictEqual(sets[already.id].doneAt, prior.doneAt);
  assert.strictEqual(got.startedAt, null);
  assert.strictEqual(got.completedAt, null);
  assert.strictEqual(got.volumeKg, 570);
  assert.strictEqual(got.timeSec, 45);
  assert.ok(r.data.skipped.some(s => s.reason === '未填次数'));
  assert.ok(r.data.skipped.some(s => s.reason === '未填时长'));
  assert.ok(repo.workouts.completeAllNote(r.data).includes('已勾选 5 组'));
  const added = repo.workouts.addSet(w.id, bench.id, { reps: null, weightKg: null }).data;
  assert.strictEqual(added.done, false);
  const again = repo.workouts.completeFilledSets(w.id);
  assert.deepStrictEqual(again.data.marked, []);
  assert.ok(repo.workouts.completeAllNote(again.data).includes('没有可完成的组'));
  assert.notStrictEqual(before.detail.sets.filter(s => s.done).length, got.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0));
});

test('all done is not a new success, and undo only clears the batch', () => {
  const { repo, be } = fresh();
  repo.init();
  const w = repo.workouts.createDraft({ exerciseIds: [BENCH] }).data;
  const v = repo.workouts.getWorkout(w.id);
  repo.workouts.updateSet(w.id, v.exercises[0].sets[0].id, { weightKg: 30, reps: 5 });
  repo.workouts.setSetDone(w.id, v.exercises[0].sets[0].id, true);
  const extra = repo.workouts.addSet(w.id, v.exercises[0].id, { weightKg: 35, reps: 5 }).data;
  const first = repo.workouts.completeFilledSets(w.id);
  assert.deepStrictEqual(first.data.marked, [extra.id]);
  const mid = snap(be, w.id);
  const second = repo.workouts.completeFilledSets(w.id);
  assert.deepStrictEqual(second.data.marked, []);
  assert.strictEqual(repo.workouts.completeAllNote(second.data), '都已经完成了');
  assert.deepStrictEqual(snap(be, w.id).detail, mid.detail);
  const undone = repo.workouts.undoCompleteFilled(w.id, first.data.marked);
  assert.ok(undone.ok);
  const after = repo.workouts.getWorkout(w.id);
  const byId = {};
  after.exercises[0].sets.forEach(s => { byId[s.id] = s; });
  assert.strictEqual(byId[v.exercises[0].sets[0].id].done, true);
  assert.strictEqual(byId[extra.id].done, false);
  assert.strictEqual(byId[extra.id].weightKg, 35);
  assert.strictEqual(after.startedAt, mid.header.startedAt);
  assert.strictEqual(after.completedAt, mid.header.completedAt);
});

test('old reps data, empty plan, failed save, and copy leave the source alone', () => {
  const { repo, be } = fresh();
  repo.init();
  const w = repo.workouts.createDraft({ date: '2026-10-10', exerciseIds: [BENCH] }).data;
  const v = repo.workouts.getWorkout(w.id);
  repo.workouts.updateSet(w.id, v.exercises[0].sets[0].id, { weightKg: 20, reps: 8 });
  const key = K.workoutDetail(w.id);
  const raw = JSON.parse(JSON.stringify(be.data[key]));
  delete raw.exercises[0].mode;
  delete raw.sets[0].durationSec;
  be.data[key] = raw;
  const marked = repo.workouts.completeFilledSets(w.id);
  assert.deepStrictEqual(marked.data.marked, [v.exercises[0].sets[0].id]);
  assert.strictEqual(repo.workouts.getWorkout(w.id).exercises[0].sets[0].reps, 8);
  const done = repo.workouts.completeWorkout(w.id);
  assert.ok(done.ok, done.message);
  const empty = repo.workouts.createDraft({ date: '2026-10-11', exerciseIds: [BENCH] });
  assert.ok(empty.ok, empty.message);
  repo.workouts.updateSet(empty.data.id, repo.workouts.getWorkout(empty.data.id).exercises[0].sets[0].id, { reps: null });
  const beforeEmpty = snap(be, empty.data.id);
  const none = repo.workouts.completeFilledSets(empty.data.id);
  assert.deepStrictEqual(none.data.marked, []);
  assert.ok(repo.workouts.completeAllNote(none.data).includes('没有可完成的组'));
  assert.deepStrictEqual(snap(be, empty.data.id).detail, beforeEmpty.detail);
  repo.workouts.updateSet(empty.data.id, repo.workouts.getWorkout(empty.data.id).exercises[0].sets[0].id, { weightKg: 15, reps: 8 });
  const pending = snap(be, empty.data.id);
  const be2 = S.memoryBackend(be.data, { failOn: k => (k === K.WORKOUTS ? new Error('setStorageSync:fail write') : false) });
  repo._setBackend(be2);
  const failed = repo.workouts.completeFilledSets(empty.data.id);
  assert.strictEqual(failed.code, 'WRITE_FAILED');
  assert.strictEqual(be2.data[K.WORKOUTS].find(h => h.id === empty.data.id).startedAt, pending.header.startedAt);
  assert.deepStrictEqual(be2.data[K.workoutDetail(empty.data.id)].sets.map(s => s.done), pending.detail.sets.map(s => s.done));
  repo._setBackend(be);
  assert.ok(repo.workouts.discardDraft().ok);
  const src = snap(be, w.id);
  const copy = repo.workouts.repeatFrom(w.id);
  assert.ok(copy.ok, copy.message);
  const copied = repo.workouts.getWorkout(copy.data.workoutId);
  assert.ok(copied.exercises[0].sets.every(s => s.done === false));
  assert.strictEqual(repo.workouts.getWorkout(w.id).exercises[0].sets[0].done, true);
  assert.strictEqual(repo.workouts.getHeader(w.id).completedAt, src.header.completedAt);
  assert.strictEqual(repo.workouts.getHeader(w.id).startedAt, src.header.startedAt);
});

test('the editor button marks the open workout only, undo leaves storage, and detail stays read-only', () => {
  const fs = require('fs');
  const path = require('path');
  const { repo } = fresh();
  repo.init();
  const w = repo.workouts.createDraft({ date: '2026-10-12', exerciseIds: [BENCH, PLANK] }).data;
  const v = repo.workouts.getWorkout(w.id);
  const [bench, plank] = v.exercises;
  repo.workouts.updateSet(w.id, bench.sets[0].id, { weightKg: 20, reps: 8 });
  repo.workouts.updateSet(w.id, plank.sets[0].id, { durationSec: 30 });
  const started = repo.workouts.getHeader(w.id).startedAt;
  let def;
  let vibrated = 0;
  const toasts = [];
  let undoPayload = null;
  global.Page = d => { def = d; };
  global.wx = {
    showToast(o) { toasts.push(o.title); }, showModal() {}, navigateTo() {}, navigateBack() {},
    vibrateShort() { vibrated += 1; },
    getWindowInfo: () => ({ windowWidth: 320 }),
    getSystemInfoSync: () => ({ windowWidth: 320 }),
    getMenuButtonBoundingClientRect: () => ({ left: 240, top: 24, height: 32 }),
  };
  const file = require.resolve('../pages/workout-edit/workout-edit.js');
  delete require.cache[file];
  require(file);
  const page = Object.assign({}, def);
  page.data = JSON.parse(JSON.stringify(def.data));
  page.setData = function (d) { Object.assign(this.data, d); };
  page.selectComponent = () => ({ show(text, payload) { undoPayload = { text, payload }; } });
  let rested = 0;
  page.startRest = () => { rested += 1; };
  page.onLoad({ id: w.id });
  page.completeAll();
  assert.strictEqual(vibrated, 0);
  assert.strictEqual(rested, 0);
  assert.ok(page.data.completeNote.includes('已勾选 2 组'));
  assert.strictEqual(undoPayload.payload.kind, 'completeAll');
  assert.strictEqual(undoPayload.payload.ids.length, 2);
  const after = repo.workouts.getWorkout(w.id);
  assert.ok(after.exercises.every(e => e.sets[0].done));
  assert.strictEqual(after.startedAt, started);
  assert.strictEqual(after.completedAt, null);
  assert.strictEqual(after.status, 'draft');
  page.completeAll();
  assert.ok(toasts.includes('都已经完成了'));
  assert.strictEqual(undoPayload.payload.ids.length, 2);
  page.onUndo({ detail: { payload: undoPayload.payload } });
  const back = repo.workouts.getWorkout(w.id);
  assert.ok(back.exercises.every(e => e.sets[0].done === false));
  assert.strictEqual(back.exercises[0].sets[0].reps, 8);
  assert.strictEqual(back.exercises[1].sets[0].durationSec, 30);
  assert.strictEqual(back.startedAt, started);
  const root = path.join(__dirname, '..');
  const edit = fs.readFileSync(path.join(root, 'pages/workout-edit/workout-edit.wxml'), 'utf8');
  const detail = fs.readFileSync(path.join(root, 'pages/workout-detail/workout-detail.wxml'), 'utf8');
  assert.ok(edit.includes('一键全部完成'));
  assert.ok(!detail.includes('一键全部完成'));
});
