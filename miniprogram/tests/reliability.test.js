// Data-reliability: corrupt records, missing detail, replace scores, write-failure copy.
const test = require('node:test');
const assert = require('node:assert');
const { fresh } = require('./helpers');
const K = require('../utils/repo/keys');
const M = require('../utils/repo/model');
const ui = require('../utils/ui');
const BENCH = '0025';

function seeded() {
  const ctx = fresh();
  ctx.repo.init();
  const w = ctx.repo.workouts.createDraft({ exerciseIds: [BENCH] }).data;
  const v = ctx.repo.workouts.getWorkout(w.id);
  ctx.repo.workouts.updateSet(w.id, v.exercises[0].sets[0].id, { weightKg: 60, reps: 8 });
  ctx.repo.workouts.setSetDone(w.id, v.exercises[0].sets[0].id, true);
  ctx.repo.workouts.finalizeWorkout(w.id);
  return ctx;
}
function queries(repo, id, date) {
  repo.workouts.listWorkouts();
  repo.workouts.getWorkout(id);
  repo.workouts.daySummaries(date);
  repo.workouts.personalBest(BENCH);
  repo.workouts.completedDates();
  repo.workouts.completionCheck(id);
  repo.workouts.referencedExerciseIds();
}

test('B model reads null elements without throwing', () => {
  const detail = { exercises: [null, { id: 'we', exerciseId: BENCH, order: 0 }], sets: [null, { id: 's', workoutExerciseId: 'we', index: 1, done: true, type: 'normal', weightKg: 10, reps: 2 }] };
  assert.doesNotThrow(() => M.computeSummary(detail));
  assert.doesNotThrow(() => M.assemble({ date: '2026-10-17' }, detail, () => null));
  assert.strictEqual(M.computeSummary(detail).setCount, 1);
  const insp = M.inspectDetail(detail);
  assert.strictEqual(insp.ok, false);
  assert.ok(insp.issues.some(i => i.kind === 'empty' && i.raw === null));
  assert.strictEqual(insp.exercises.length, 1);
  assert.strictEqual(insp.sets.length, 1);
});

test('B internal damage: queries do not throw, good records stay readable, raw is not overwritten', () => {
  const { repo, be } = seeded();
  const w = repo.workouts.listWorkouts()[0];
  const key = K.workoutDetail(w.id);
  const raw = be.data[key];
  const goodId = raw.exercises[0].id;
  raw.exercises.push(null);
  raw.exercises.push({ exerciseId: BENCH, order: 1, note: '', nameSnapshot: '缺 id' });
  raw.exercises.push({ id: 'we_bad', exerciseId: 12, order: 2, note: '', nameSnapshot: '类型错' });
  raw.sets.push(null);
  raw.sets.push({ id: 's_type', workoutExerciseId: goodId, index: 9, weightKg: 10, reps: '8', type: 'normal', done: false, doneAt: null });
  raw.sets.push({ id: 's_or', workoutExerciseId: 'we_missing', index: 1, weightKg: 100, reps: 10, type: 'normal', done: true, doneAt: 1 });
  const before = JSON.parse(JSON.stringify(raw));
  assert.doesNotThrow(() => queries(repo, w.id, w.date));
  const view = repo.workouts.getWorkout(w.id);
  assert.strictEqual(view.detailCorrupt, true);
  assert.strictEqual(view.exercises.length, 1);
  assert.strictEqual(view.exercises[0].sets.length, 1);
  assert.strictEqual(view.exercises[0].sets[0].weightKg, 60);
  assert.strictEqual(view.exercises[0].sets[0].done, true);
  const kinds = view.integrity.issues.map(i => i.kind).sort();
  assert.ok(kinds.includes('empty') && kinds.includes('missing_id') && kinds.includes('type') && kinds.includes('orphan'), kinds.join(','));
  assert.ok(view.integrity.issues.some(i => i.kind === 'empty' && i.raw === null));
  assert.strictEqual(repo.health().ok, false);
  assert.ok(repo.health().corruptKeys.includes(key));
  assert.strictEqual(repo.workouts.addSet(w.id, goodId, { reps: 3 }).code, 'DATA_CORRUPT');
  assert.strictEqual(repo.workouts.updateSet(w.id, view.exercises[0].sets[0].id, { weightKg: 70 }).code, 'DATA_CORRUPT');
  assert.deepStrictEqual(be.data[key], before, 'damaged detail was overwritten');
  const other = repo.workouts.createDraft({ exerciseIds: [BENCH] }).data;
  const ov = repo.workouts.getWorkout(other.id);
  assert.ok(repo.workouts.updateSet(other.id, ov.exercises[0].sets[0].id, { reps: 4, weightKg: 20 }).ok, 'a healthy workout stays writable');
  assert.deepStrictEqual(be.data[key], before);
  const st = repo.init();
  assert.strictEqual(st.mode, 'corrupt');
  assert.deepStrictEqual(be.data[key], before, 'launch must not repair by rewriting');
  assert.strictEqual(repo.workouts.getWorkout(w.id).exercises[0].sets[0].weightKg, 60);
});

test('B bad header rows: other workouts stay readable, the index is not rewritten', () => {
  const { repo, be } = seeded();
  const w = repo.workouts.listWorkouts()[0];
  const detailBefore = JSON.parse(JSON.stringify(be.data[K.workoutDetail(w.id)]));
  be.data[K.WORKOUTS].push(null);
  be.data[K.WORKOUTS].push({ status: 'completed', date: '2026-10-01', createdAt: 2 });
  be.data[K.WORKOUTS].push({ id: 5, status: 'draft', date: '2026-10-02', createdAt: 3 });
  const before = JSON.parse(JSON.stringify(be.data[K.WORKOUTS]));
  assert.doesNotThrow(() => queries(repo, w.id, w.date));
  const listed = repo.workouts.listWorkouts();
  assert.deepStrictEqual(listed.map(x => x.id), [w.id]);
  assert.strictEqual(repo.workouts.getWorkout(w.id).exercises[0].sets[0].reps, 8);
  const issues = repo.health().issues[K.WORKOUTS] || [];
  assert.ok(issues.some(i => i.kind === 'empty' && i.raw === null));
  assert.ok(issues.some(i => i.kind === 'missing_id'));
  assert.ok(issues.some(i => i.kind === 'type'));
  assert.strictEqual(repo.health().ok, false);
  assert.strictEqual(repo.workouts.updateWorkout(w.id, { name: '改名' }).code, 'DATA_CORRUPT');
  assert.deepStrictEqual(be.data[K.WORKOUTS], before);
  assert.deepStrictEqual(be.data[K.workoutDetail(w.id)], detailBefore);
  assert.ok(repo.body.saveBody({ date: '2026-10-16', weightKg: 70 }).ok, 'unrelated keys stay writable');
  assert.strictEqual(repo.init().mode, 'corrupt');
  assert.deepStrictEqual(be.data[K.WORKOUTS], before);
  assert.deepStrictEqual(be.data[K.workoutDetail(w.id)], detailBefore, 'orphan cleanup must not delete a real detail');
});

test('C missing detail is not an empty workout: edits do not create one, restore shows it again', () => {
  const { repo, be } = seeded();
  const w = repo.workouts.listWorkouts()[0];
  const key = K.workoutDetail(w.id);
  const detail = JSON.parse(JSON.stringify(be.data[key]));
  const headerBefore = JSON.parse(JSON.stringify(be.data[K.WORKOUTS]));
  delete be.data[key];
  const view = repo.workouts.getWorkout(w.id);
  assert.strictEqual(view.detailMissing, true);
  assert.strictEqual(view.detailCorrupt, false);
  assert.strictEqual(view.exercises.length, 0);
  assert.strictEqual(view.exerciseCount, headerBefore[0].exerciseCount);
  assert.strictEqual(view.setCount, headerBefore[0].setCount);
  assert.strictEqual(repo.workouts.daySummaries(w.date)[0].detailMissing, true);
  for (const r of [
    repo.workouts.addExercise(w.id, BENCH),
    repo.workouts.updateWorkout(w.id, { name: '不该写上' }),
    repo.workouts.updateSet(w.id, 's', { reps: 1 }),
    repo.workouts.finalizeWorkout(w.id),
  ]) assert.strictEqual(r.code, 'DETAIL_MISSING', r.code + ' ' + r.message);
  assert.deepStrictEqual(be.data[K.WORKOUTS], headerBefore);
  assert.strictEqual(be.data[key], undefined);
  assert.strictEqual(repo.init().mode, 'normal');
  assert.strictEqual(be.data[key], undefined, 'launch must not recreate an empty detail');
  assert.deepStrictEqual(be.data[K.WORKOUTS], headerBefore);
  be.data[key] = detail;
  const back = repo.workouts.getWorkout(w.id);
  assert.strictEqual(back.detailMissing, false);
  assert.strictEqual(back.exercises.length, 1);
  assert.strictEqual(back.exercises[0].sets[0].weightKg, 60);
  assert.strictEqual(back.exercises[0].sets[0].done, true);
  assert.ok(repo.workouts.updateWorkout(w.id, { name: '恢复后可改' }).ok);
});

test('E WRITE_FAILED is not reported as out of space; QUOTA_EXCEEDED is', () => {
  const toasts = [], modals = [];
  global.wx = {
    showToast: o => toasts.push(o.title),
    showModal: o => modals.push(o.content || ''),
  };
  ui._resetFails();
  const write = { ok: false, code: 'WRITE_FAILED', message: '保存失败，请重试' };
  assert.strictEqual(ui.handle(write), false);
  assert.strictEqual(toasts.at(-1), '保存失败，请重试');
  assert.doesNotMatch(toasts.at(-1), /空间|缓存/);
  ui.handle(write);
  assert.strictEqual(modals.length, 1);
  assert.doesNotMatch(modals[0], /空间|缓存|清理/);
  assert.match(modals[0], /还在/);
  ui._resetFails();
  const quota = { ok: false, code: 'QUOTA_EXCEEDED', message: '存储空间不足，请清理后重试' };
  ui.handle(quota);
  assert.match(toasts.at(-1), /存储空间不足/);
  ui.handle(quota);
  assert.match(modals.at(-1), /手机存储空间不足/);
  assert.match(modals.at(-1), /清理微信缓存/);
  ui._resetFails();
});
