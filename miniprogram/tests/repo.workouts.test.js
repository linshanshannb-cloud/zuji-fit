const test = require('node:test'); const assert = require('node:assert');
const { fresh } = require('./helpers');
const K = require('../utils/repo/keys');
const BENCH = '0025';
const OTHER = () => require('../utils/exercises').builtin[5].id;

// live draft (today) with one exercise; returns ids
function live(repo, extra = []) {
  repo.init();
  const w = repo.workouts.createDraft({ exerciseIds: [BENCH].concat(extra) }).data;
  const v = repo.workouts.getWorkout(w.id);
  return { w, v, we: v.exercises[0], s0: v.exercises[0].sets[0] };
}
function doneSet(repo, wid, weId, sid, reps = 8, w = 60) { repo.workouts.updateSet(wid, sid, { reps, weightKg: w }); return repo.workouts.setSetDone(wid, sid, true); }

test('#5 in-memory draft: nothing stored until first addExercise; then detail before header; ids/timestamps kept', () => {
  const order = [];
  const { repo, be } = fresh({}, { failOn: k => { order.push(k); return false; } }); repo.init(); order.length = 0;
  const r = repo.workouts.createDraft({});
  assert.ok(r.ok); const h = r.data;
  assert.deepStrictEqual([h.persisted, h.status, h.date, h.startedAt > 0, h.startedAt === h.createdAt], [false, 'draft', '2026-10-17', true, true]);
  assert.deepStrictEqual(order, [], 'nothing written'); assert.strictEqual(repo.workouts.getDraft(), null);
  assert.strictEqual(repo.workouts.getWorkout(h.id).persisted, false);
  assert.ok(repo.workouts.updateWorkout(h.id, { name: '推日', date: '2026-10-16' }).ok, 'edit header in memory');
  assert.deepStrictEqual(order, []);
  assert.strictEqual(repo.workouts.finalizeWorkout(h.id).code, 'NO_DONE_SETS');
  const add = repo.workouts.addExercises(h.id, [BENCH, OTHER()]); assert.ok(add.ok);
  assert.deepStrictEqual(order, [K.workoutDetail(h.id), K.WORKOUTS], 'detail then header');
  const stored = repo.workouts.getDraft();
  assert.deepStrictEqual([stored.id, stored.createdAt, stored.startedAt, stored.name, stored.date, stored.exerciseCount], [h.id, h.createdAt, h.startedAt, '推日', '2026-10-16', 2]);
  assert.strictEqual(repo.workouts.getPending(), null);
  const v = repo.workouts.getWorkout(h.id);
  assert.deepStrictEqual(v.exercises.map(e => [e.order, e.sets.length, e.sets[0].weightKg, e.sets[0].reps, e.sets[0].done]), [[0, 1, null, null, false], [1, 1, null, null, false]]);
  // deleting all exercises keeps the stored draft; only discard removes it
  v.exercises.forEach(e => repo.workouts.removeExercise(h.id, e.id));
  assert.strictEqual(repo.workouts.getDraft().exerciseCount, 0);
  const dup = repo.workouts.createDraft({});
  assert.deepStrictEqual([dup.code, dup.data.id], ['DRAFT_EXISTS', h.id]);
  assert.ok(repo.workouts.discardDraft().ok); assert.strictEqual(be.data[K.workoutDetail(h.id)], undefined); assert.strictEqual(repo.workouts.getDraft(), null);
  // leaving before first add: discard -> nothing stored
  const p2 = repo.workouts.createDraft({ date: '2026-10-01' }).data;
  assert.strictEqual(p2.startedAt, null, 'backfill has no timer');
  repo.workouts.discardPending(); assert.strictEqual(repo.workouts.getWorkout(p2.id), null);
  assert.strictEqual(repo.workouts.createDraft({ date: '2026-10-18' }).code, 'FUTURE_DATE');
  assert.strictEqual(repo.workouts.createDraft({ date: '2026-02-30' }).code, 'INVALID_DATE');
  assert.strictEqual(repo.workouts.createDraft({ name: 'x'.repeat(31) }).code, 'TEXT_TOO_LONG');
  const p3 = repo.workouts.createDraft({}).data;
  assert.strictEqual(repo.workouts.addExercises(p3.id, ['nope']).code, 'UNKNOWN_EXERCISE');
  assert.strictEqual(repo.workouts.getDraft(), null, 'invalid id leaves nothing behind');
  assert.ok(repo.workouts.getPending(), 'pending kept for retry');
  const now = repo.workouts.createDraft({ exerciseIds: [BENCH] }); assert.ok(now.ok && now.data.exerciseCount === 1, 'with exerciseIds persists immediately');
});

test('addToCurrentDraft (F5): creates today draft if none, appends otherwise', () => {
  const { repo } = fresh(); repo.init();
  const a = repo.workouts.addToCurrentDraft(BENCH);
  assert.deepStrictEqual([a.ok, a.data.created], [true, true]);
  const b = repo.workouts.addToCurrentDraft(OTHER());
  assert.deepStrictEqual([b.data.created, b.data.workoutId], [false, a.data.workoutId]);
  assert.strictEqual(repo.workouts.getWorkout(a.data.workoutId).exercises.length, 2);
  assert.strictEqual(repo.workouts.getDraft().date, '2026-10-17');
});

test('exercises: order, reorder/move, note, replace keeps sets, remove + undo restore', () => {
  const { repo } = fresh();
  const { w, we: a } = live(repo, [BENCH, OTHER()]);
  const [, b, c] = repo.workouts.getWorkout(w.id).exercises;
  assert.strictEqual(repo.workouts.addExercise(w.id, 'nope').code, 'UNKNOWN_EXERCISE');
  assert.ok(repo.workouts.reorderExercises(w.id, [c.id, a.id, b.id]).ok);
  assert.deepStrictEqual(repo.workouts.getWorkout(w.id).exercises.map(e => [e.id, e.order]), [[c.id, 0], [a.id, 1], [b.id, 2]]);
  assert.strictEqual(repo.workouts.reorderExercises(w.id, [a.id, b.id]).code, 'INVALID_ORDER');
  assert.strictEqual(repo.workouts.reorderExercises(w.id, [a.id, a.id, b.id]).code, 'INVALID_ORDER');
  assert.ok(repo.workouts.moveExercise(w.id, b.id, 0).ok);
  assert.deepStrictEqual(repo.workouts.getWorkout(w.id).exercises.map(e => e.id), [b.id, c.id, a.id]);
  assert.strictEqual(repo.workouts.updateExerciseNote(w.id, a.id, '  握距窄 ').data.note, '握距窄');
  assert.strictEqual(repo.workouts.updateExerciseNote(w.id, a.id, 'x'.repeat(201)).code, 'TEXT_TOO_LONG');
  // replace keeps sets
  repo.workouts.addSet(w.id, c.id, { reps: 5 });
  const rep = repo.workouts.replaceExercise(w.id, c.id, BENCH).data;
  assert.deepStrictEqual([rep.exerciseId, rep.nameSnapshot], [BENCH, '杠铃卧推']);
  assert.strictEqual(repo.workouts.getWorkout(w.id).exercises[1].sets.length, 2);
  // remove + undo
  const rm = repo.workouts.removeExercise(w.id, c.id);
  assert.strictEqual(rm.data.sets.length, 2); assert.strictEqual(rm.data.exercise.order, 1);
  let v = repo.workouts.getWorkout(w.id);
  assert.deepStrictEqual(v.exercises.map(e => [e.id, e.order]), [[b.id, 0], [a.id, 1]]);
  assert.ok(repo.workouts.restoreExercise(w.id, rm.data).ok);
  v = repo.workouts.getWorkout(w.id);
  assert.deepStrictEqual(v.exercises.map(e => [e.id, e.order]), [[b.id, 0], [c.id, 1], [a.id, 2]], 'back at original order');
  assert.strictEqual(v.exercises[1].sets.length, 2);
  assert.strictEqual(repo.workouts.restoreExercise(w.id, rm.data).code, 'ALREADY_RESTORED');
  assert.strictEqual(repo.workouts.getHeader(w.id).exerciseCount, 3);
});

test('#10 sets: addSet copies weight/reps only, type normal unless explicit; done rules; delete + undo; duplicate', () => {
  const { repo } = fresh();
  const { w, we, s0 } = live(repo);
  assert.strictEqual(repo.workouts.setSetDone(w.id, s0.id, true).code, 'REPS_REQUIRED');
  assert.strictEqual(repo.workouts.updateSet(w.id, s0.id, { weightKg: '60.04', reps: '8', type: 'warmup' }).data.weightKg, 60);
  const s2 = repo.workouts.addSet(w.id, we.id).data;
  assert.deepStrictEqual([s2.index, s2.weightKg, s2.reps, s2.type, s2.done], [2, 60, 8, 'normal', false], 'warmup type not copied; live draft -> not done');
  const s3 = repo.workouts.addSet(w.id, we.id, { type: 'warmup', weightKg: 40, reps: 10 }).data;
  assert.strictEqual(s3.type, 'warmup');
  for (const bad of [{ weightKg: -1 }, { weightKg: 1000 }, { weightKg: 'abc' }]) assert.strictEqual(repo.workouts.updateSet(w.id, s0.id, bad).code, 'INVALID_WEIGHT');
  for (const bad of [{ reps: 1.5 }, { reps: 1000 }, { reps: -2 }]) assert.strictEqual(repo.workouts.updateSet(w.id, s0.id, bad).code, 'INVALID_REPS');
  assert.strictEqual(repo.workouts.updateSet(w.id, s0.id, { type: 'drop' }).code, 'INVALID_TYPE');
  repo.workouts.updateSet(w.id, s0.id, { type: 'normal' });
  const d = repo.workouts.setSetDone(w.id, s0.id, true).data; assert.ok(d.done && d.doneAt > 0);
  assert.strictEqual(repo.workouts.updateSet(w.id, s0.id, { reps: '' }).code, 'REPS_REQUIRED');
  repo.workouts.setSetDone(w.id, s2.id, true); repo.workouts.setSetDone(w.id, s3.id, true);
  let h = repo.workouts.getHeader(w.id); assert.deepStrictEqual([h.setCount, h.volumeKg], [2, 960], 'warmup excluded');
  const un = repo.workouts.setSetDone(w.id, s2.id, false).data; assert.deepStrictEqual([un.done, un.doneAt], [false, null]);
  h = repo.workouts.getHeader(w.id); assert.deepStrictEqual([h.setCount, h.volumeKg], [1, 480]);
  repo.workouts.updateSet(w.id, s0.id, { weightKg: '' }); assert.strictEqual(repo.workouts.getHeader(w.id).volumeKg, 0, 'null weight counts 0');
  // delete + undo at original index
  const del = repo.workouts.deleteSet(w.id, s2.id); assert.strictEqual(del.data.index, 2);
  assert.deepStrictEqual(repo.workouts.getWorkout(w.id).exercises[0].sets.map(s => [s.id, s.index]), [[s0.id, 1], [s3.id, 2]]);
  assert.ok(repo.workouts.restoreSet(w.id, del.data).ok);
  assert.deepStrictEqual(repo.workouts.getWorkout(w.id).exercises[0].sets.map(s => [s.id, s.index]), [[s0.id, 1], [s2.id, 2], [s3.id, 3]]);
  assert.strictEqual(repo.workouts.restoreSet(w.id, del.data).code, 'ALREADY_RESTORED');
  const dupl = repo.workouts.duplicateSet(w.id, s0.id).data;
  assert.deepStrictEqual([dupl.index, dupl.reps, dupl.done], [2, 8, false]);
  assert.deepStrictEqual(repo.workouts.getWorkout(w.id).exercises[0].sets.map(s => s.index), [1, 2, 3, 4]);
  assert.strictEqual(repo.workouts.deleteSet(w.id, 'missing').code, 'NOT_FOUND');
});

test('backfill (F2): new sets with reps default to done', () => {
  const { repo } = fresh(); repo.init();
  const w = repo.workouts.createDraft({ date: '2026-10-10', exerciseIds: [BENCH] }).data;
  const v = repo.workouts.getWorkout(w.id), we = v.exercises[0];
  assert.strictEqual(we.sets[0].done, false, 'initial empty set cannot be done (reps null)');
  repo.workouts.updateSet(w.id, we.sets[0].id, { reps: 5, weightKg: 100 });
  const s = repo.workouts.addSet(w.id, we.id).data;
  assert.deepStrictEqual([s.done, s.doneAt > 0], [true, true]);
  assert.strictEqual(repo.workouts.addSet(w.id, we.id, { done: false }).data.done, false);
});

test('complete (draft): R-C check, prune exercises without done sets, keep unticked sets', () => {
  const { repo, be } = fresh();
  const { w, we: a } = live(repo, [BENCH, BENCH]);
  const [, b, c] = repo.workouts.getWorkout(w.id).exercises;
  assert.strictEqual(repo.workouts.completionCheck(w.id).canFinish, false);
  assert.strictEqual(repo.workouts.finalizeWorkout(w.id).code, 'NO_DONE_SETS');
  repo.workouts.updateSet(w.id, b.sets[0].id, { reps: 5, weightKg: 100 }); // b: never done
  doneSet(repo, w.id, c.id, c.sets[0].id);
  const s2 = repo.workouts.addSet(w.id, c.id).data; // unticked
  const chk = repo.workouts.completionCheck(w.id);
  assert.deepStrictEqual([chk.canFinish, chk.doneSets, chk.willRemove.length, chk.undoneSets], [true, 1, 2, 1]);
  const r = repo.workouts.finalizeWorkout(w.id); assert.ok(r.ok);
  assert.strictEqual(r.data.status, 'completed'); assert.ok(r.data.completedAt > 0);
  const v = repo.workouts.getWorkout(w.id);
  assert.deepStrictEqual(v.exercises.map(e => [e.id, e.order]), [[c.id, 0]]);
  assert.deepStrictEqual(v.exercises[0].sets.map(s => s.id), [c.sets[0].id, s2.id], 'unticked set kept');
  assert.deepStrictEqual([r.data.exerciseCount, r.data.setCount, r.data.volumeKg], [1, 1, 480]);
  assert.strictEqual(be.data[K.workoutDetail(w.id)].sets.some(s => [a.id, b.id].includes(s.workoutExerciseId)), false);
  assert.strictEqual(repo.workouts.completeWorkout(w.id).code, 'NOT_DRAFT');
  assert.strictEqual(repo.workouts.getDraft(), null);
  assert.deepStrictEqual(repo.workouts.completedDates(), { '2026-10-17': 1 });
  assert.strictEqual(repo.workouts.workoutsOn('2026-10-17')[0].displayName, '10月17日训练');
});

test('#9 edit completed: stays completed, no auto-prune, finalize needs ≥1 done set, completedAt unchanged', () => {
  const { repo } = fresh();
  const { w, we } = live(repo);
  doneSet(repo, w.id, we.id, we.sets[0].id);
  const done = repo.workouts.finalizeWorkout(w.id).data;
  // edit: add an exercise with only unticked sets -> stays after finalize
  const extra = repo.workouts.addExercise(w.id, OTHER()).data;
  const chk = repo.workouts.completionCheck(w.id);
  assert.deepStrictEqual([chk.status, chk.willRemove, chk.exercisesWithoutDone.length], ['completed', [], 1]);
  const f = repo.workouts.finalizeWorkout(w.id); assert.ok(f.ok);
  assert.deepStrictEqual([f.data.status, f.data.completedAt], ['completed', done.completedAt]);
  assert.ok(repo.workouts.getWorkout(w.id).exercises.some(e => e.id === extra.id), 'not removed');
  // untick everything -> finalize rejected, data still saved, still completed
  repo.workouts.setSetDone(w.id, we.sets[0].id, false);
  assert.strictEqual(repo.workouts.finalizeWorkout(w.id).code, 'NO_DONE_SETS');
  assert.strictEqual(repo.workouts.getHeader(w.id).status, 'completed');
  // warmup done set counts for the ≥1 rule
  repo.workouts.updateSet(w.id, we.sets[0].id, { type: 'warmup' }); repo.workouts.setSetDone(w.id, we.sets[0].id, true);
  assert.ok(repo.workouts.finalizeWorkout(w.id).ok);
  assert.ok(repo.workouts.updateWorkout(w.id, { name: '推日', note: '好', date: '2026-10-15' }).ok);
  assert.strictEqual(repo.workouts.getHeader(w.id).date, '2026-10-15');
  assert.strictEqual(repo.workouts.getHeader(w.id).completedAt, done.completedAt);
});

test('day summaries, personal best, duration', () => {
  const { repo } = fresh();
  const { w, we } = live(repo, [OTHER(), BENCH, BENCH]);
  doneSet(repo, w.id, we.id, we.sets[0].id, 8, 60);
  const s2 = repo.workouts.addSet(w.id, we.id, { reps: 10, weightKg: 60 }).data; repo.workouts.setSetDone(w.id, s2.id, true);
  const s3 = repo.workouts.addSet(w.id, we.id, { reps: 3, weightKg: 100, type: 'warmup' }).data; repo.workouts.setSetDone(w.id, s3.id, true);
  repo.workouts.finalizeWorkout(w.id);
  const [sum] = repo.workouts.daySummaries('2026-10-17');
  assert.ok(sum.durationMin >= 1); assert.strictEqual(sum.top.length, 1); assert.strictEqual(sum.more, 0);
  assert.deepStrictEqual(sum.top[0], { name: '杠铃卧推', sets: 2, best: { weightKg: 60, reps: 10 } });
  assert.deepStrictEqual(repo.workouts.personalBest(BENCH), { date: '2026-10-17', workoutId: w.id, weightKg: 60, reps: 10 }, 'warmup ignored, tie -> more reps');
  assert.strictEqual(repo.workouts.personalBest(OTHER()), null);
});

test('headers sorted; delete removes header then detail', () => {
  const { repo, be } = fresh(); repo.init();
  const mk = d => { const w = repo.workouts.createDraft({ date: d, exerciseIds: [BENCH] }).data; const v = repo.workouts.getWorkout(w.id);
    repo.workouts.updateSet(w.id, v.exercises[0].sets[0].id, { reps: 1 }); repo.workouts.setSetDone(w.id, v.exercises[0].sets[0].id, true); repo.workouts.finalizeWorkout(w.id); return w.id; };
  const x = mk('2026-10-10'), y = mk('2026-10-01'), z = mk('2026-10-10');
  assert.deepStrictEqual(be.data[K.WORKOUTS].map(w => w.id), [y, x, z]);
  assert.ok(repo.workouts.deleteWorkout(x).ok);
  assert.deepStrictEqual(be.data[K.WORKOUTS].map(w => w.id), [y, z]);
  assert.strictEqual(be.data[K.workoutDetail(x)], undefined);
  assert.strictEqual(repo.workouts.deleteWorkout(x).code, 'NOT_FOUND');
  assert.strictEqual(repo.workouts.getWorkout('nope'), null);
});

test('#8 completed workout with 0 exercises: stored and listed, but day not marked as training day', () => {
  const { repo } = fresh({ fit_meta: { schemaVersion: 1 }, fit_workouts: [{ id: 'w_e', status: 'completed', date: '2026-10-05', name: '', note: '', createdAt: 1, exerciseCount: 0, setCount: 0, volumeKg: 0 }],
    fit_workout_w_e: { workoutId: 'w_e', exercises: [], sets: [] } });
  repo.init();
  assert.strictEqual(repo.workouts.listWorkouts().length, 1);
  assert.deepStrictEqual(repo.workouts.completedDates(), {});
  assert.strictEqual(repo.workouts.daySummaries('2026-10-05').length, 1);
});

test('unknown exercise id shows placeholder; archived custom cannot be added but still displays', () => {
  const { repo, be } = fresh({ fit_custom_exercises: [{ id: 'c_arch', custom: true, archived: true, nameZh: '旧自定义', bodyPart: 'back', equipment: 'band' }] });
  repo.init();
  const w = repo.workouts.createDraft({ exerciseIds: [BENCH] }).data;
  assert.strictEqual(repo.workouts.addExercise(w.id, 'c_arch').code, 'ARCHIVED_EXERCISE');
  assert.strictEqual(repo.workouts.createDraft({ exerciseIds: ['c_arch'] }).code, 'DRAFT_EXISTS');
  assert.strictEqual(repo.workouts.replaceExercise(w.id, repo.workouts.getWorkout(w.id).exercises[0].id, 'c_arch').code, 'ARCHIVED_EXERCISE');
  const d = be.data[K.workoutDetail(w.id)];
  d.exercises.push({ id: 'we_x', workoutId: w.id, exerciseId: 'c_arch', order: 1, note: '', nameSnapshot: '旧自定义' });
  d.exercises.push({ id: 'we_y', workoutId: w.id, exerciseId: 'gone', order: 2, note: '', nameSnapshot: '' });
  const v = repo.workouts.getWorkout(w.id);
  assert.strictEqual(v.exercises[1].displayName, '旧自定义');
  assert.deepStrictEqual([v.exercises[2].displayName, v.exercises[2].exercise.unknown], ['未知动作', true]);
});

test('orphan sets (no exercise) are not counted in summaries', () => {
  const { repo, be } = fresh();
  const { w, we } = live(repo);
  doneSet(repo, w.id, we.id, we.sets[0].id, 10, 50);
  be.data[K.workoutDetail(w.id)].sets.push({ id: 's_o', workoutExerciseId: 'we_missing', index: 1, weightKg: 100, reps: 10, type: 'normal', done: true, doneAt: 1 });
  assert.deepStrictEqual([repo.workouts.getWorkout(w.id).setCount, repo.workouts.getWorkout(w.id).volumeKg], [1, 500]);
});

test('stored summaries are recomputed on read', () => {
  const { repo, be } = fresh();
  const { w, we } = live(repo);
  doneSet(repo, w.id, we.id, we.sets[0].id, 10, 50);
  be.data[K.WORKOUTS][0].volumeKg = 12345;
  assert.strictEqual(repo.workouts.getWorkout(w.id).volumeKg, 500);
});
