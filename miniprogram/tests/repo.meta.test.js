const test = require('node:test'); const assert = require('node:assert');
const { fresh, BASE } = require('./helpers');
const K = require('../utils/repo/keys');
const { migrate_0_to_1 } = require('../utils/repo/migrate');
const S = require('../utils/storage');

const V0 = {
  fit_workouts_v1: [
    { id: 'w_old1', date: '2026-10-02', note: ' leg ', exercises: [
      { exerciseId: 'ph-squat', name: '杠铃深蹲', sets: [{ reps: 5, weight: 100 }, { reps: 5, weight: 102.5 }] },
      { exerciseId: '0025', name: '杠铃卧推', sets: [{ reps: 8, weight: 0 }, { reps: 1000, weight: 20 }, { reps: 5.5, weight: 1200 }, { reps: null, weight: 10 }] }] },
    { id: 'w_old0', date: '2026-10-01', note: '', exercises: [] },
  ],
  fit_body_v1: [
    { id: 'b_o1', date: '2026-10-01', weight: 72.4, bodyFat: null, waist: 81.5, chest: 98.04, hip: 301, arm: 0 },
    { id: 'b_o2', date: '2026-10-02', weight: 72, bodyFat: 150, waist: null, chest: null, hip: null, arm: null },
    { id: 'b_o4', date: '2026-09-30', weight: 'abc', bodyFat: null, waist: 82, chest: null, hip: null, arm: null },
    { id: 'b_o3', date: '2026-10-03', weight: null, bodyFat: null, waist: null, chest: null, hip: null, arm: null },
  ],
};

test('migrate_0_to_1 pure mapping', () => {
  const r = migrate_0_to_1({ workouts: V0.fit_workouts_v1, body: V0.fit_body_v1 }, BASE);
  assert.deepStrictEqual(r.workouts.map(w => w.id), ['w_old0', 'w_old1']);
  const w = r.workouts[1];
  assert.deepStrictEqual([w.status, w.name, w.note, w.startedAt, w.completedAt, w.createdAt >= BASE, w.updatedAt],
    ['completed', '', 'leg', null, BASE, true, BASE]);
  assert.deepStrictEqual([w.exerciseCount, w.setCount, w.volumeKg], [2, 3, 1012.5], 'null-reps sets not counted');
  const bench = r.details.w_old1.sets.filter(x => x.workoutExerciseId === r.details.w_old1.exercises[1].id);
  assert.deepStrictEqual(bench.map(x => [x.weightKg, x.reps, x.done]), [[0, 8, true], [20, null, false], [null, null, false], [10, null, false]],
    'reps>999 / non-integer -> null (not clamped); weight>999.9 -> null; null reps -> done=false');
  const d = r.details.w_old1;
  assert.deepStrictEqual(d.exercises.map(e => [e.order, e.exerciseId, e.nameSnapshot, e.note, e.workoutId]),
    [[0, 'ph-squat', '杠铃深蹲', '', 'w_old1'], [1, '0025', '杠铃卧推', '', 'w_old1']]);
  assert.ok(d.exercises.every(e => /^we_/.test(e.id)));
  const s = d.sets.filter(x => x.workoutExerciseId === d.exercises[0].id);
  assert.deepStrictEqual(s.map(x => [x.index, x.weightKg, x.reps, x.type, x.done, x.doneAt]), [[1, 100, 5, 'normal', true, null], [2, 102.5, 5, 'normal', true, null]]);
  assert.ok(d.sets.every(x => /^s_/.test(x.id)));
  assert.deepStrictEqual(r.details.w_old0, { workoutId: 'w_old0', exercises: [], sets: [] });
  assert.deepStrictEqual(r.body.map(b => [b.id, b.weightKg, b.bodyFatPct, b.waistCm, b.extra, b.note]),
    [['b_o4', null, null, 82, null, ''], ['b_o1', 72.4, null, 81.5, { chestCm: 98 }, ''], ['b_o2', 72, null, null, null, '']], 'bodyFat>100 -> null; extra range-checked & rounded; fully empty dropped');
  assert.deepStrictEqual(r.meta, { schemaVersion: 1, createdAt: BASE, migratedAt: BASE, migratedFrom: 0 });
  assert.deepStrictEqual(migrate_0_to_1({}, BASE).workouts, []);
});

test('init: new user writes meta only', () => {
  const { repo, be } = fresh();
  const st = repo.init();
  assert.deepStrictEqual([st.mode, st.migrated], ['normal', false]);
  assert.strictEqual(be.data[K.META].schemaVersion, 1); assert.strictEqual(be.data[K.META].migratedFrom, null);
  assert.deepStrictEqual(Object.keys(be.data), [K.META]);
});

test('init: v0 migration end-to-end, legacy kept, meta last, idempotent re-run', () => {
  const order = [];
  const { repo, be } = fresh(V0, { failOn: k => { order.push(k); return false; } });
  const st = repo.init();
  assert.strictEqual(st.migrated, true);
  assert.strictEqual(order[order.length - 1], K.META, 'meta written last');
  assert.ok(order.indexOf(K.workoutDetail('w_old1')) < order.indexOf(K.WORKOUTS), 'detail before headers');
  assert.ok(be.data.fit_workouts_v1 && be.data.fit_body_v1, 'legacy keys kept');
  assert.strictEqual(repo.workouts.listWorkouts().length, 2);
  assert.strictEqual(repo.workouts.getWorkout('w_old1').exercises[0].displayName, '杠铃深蹲', 'unknown id falls back to nameSnapshot');
  assert.strictEqual(repo.body.getBodyByDate('2026-10-01').extra.chestCm, 98);
  // second launch: meta present -> no re-migration
  const before = JSON.stringify(be.data[K.WORKOUTS]);
  assert.strictEqual(repo.init().migrated, false);
  assert.strictEqual(JSON.stringify(be.data[K.WORKOUTS]), before);
});

test('init: migration failure leaves no meta, blocks writes, retries cleanly next launch', () => {
  let failing = true;
  const { repo, be } = fresh(V0, { failOn: k => failing && k === K.BODY });
  const st = repo.init();
  assert.strictEqual(st.mode, 'error'); assert.strictEqual(st.error.code, 'QUOTA_EXCEEDED');
  assert.strictEqual(be.data[K.META], undefined);
  assert.strictEqual(repo.body.saveBody({ weightKg: 70 }).code, 'READ_ONLY');
  assert.strictEqual(repo.workouts.createDraft({ exerciseIds: ['0025'] }).code, 'READ_ONLY');
  failing = false;
  const st2 = repo.init();
  assert.deepStrictEqual([st2.mode, st2.migrated], ['normal', true]);
  assert.strictEqual(repo.workouts.listWorkouts().length, 2);
  assert.strictEqual(S.keys().filter(k => k.startsWith(K.DETAIL_PREFIX)).length, 2, 'no duplicate details');
});

test('version guard: newer schema -> read-only, nothing written', () => {
  const meta = { schemaVersion: 2, createdAt: 1 };
  const { repo, be } = fresh({ fit_meta: meta, fit_workouts: [], fit_body: [{ id: 'b1', date: '2026-10-01', weightKg: 70 }], fit_workout_orphan: {} });
  const snapshot = JSON.stringify(be.data);
  const st = repo.init();
  assert.strictEqual(st.mode, 'readonly'); assert.strictEqual(repo.isReadOnly(), true);
  assert.strictEqual(repo.body.listBody().length, 1, 'reads still work');
  assert.strictEqual(repo.body.saveBody({ weightKg: 70 }).code, 'READ_ONLY');
  assert.strictEqual(repo.workouts.createDraft({ exerciseIds: ['0025'] }).code, 'READ_ONLY');
  assert.strictEqual(repo.body.deleteBody('b1').code, 'READ_ONLY');
  assert.strictEqual(JSON.stringify(be.data), snapshot, 'no key written or removed (orphan not cleaned)');
});

test('orphan detail keys cleaned at launch', () => {
  const { repo, be } = fresh({ fit_meta: { schemaVersion: 1 }, fit_workouts: [{ id: 'w_a', status: 'completed', date: '2026-10-01', createdAt: 1 }],
    fit_workout_w_a: { workoutId: 'w_a', exercises: [], sets: [] }, fit_workout_w_zombie: { workoutId: 'w_zombie', exercises: [], sets: [] } });
  repo.init();
  assert.ok(be.data.fit_workout_w_a); assert.strictEqual(be.data.fit_workout_w_zombie, undefined);
});

test('storage write failure surfaces as error result and leaves data intact', () => {
  let fail = false;
  const { repo, be } = fresh({}, { failOn: () => fail });
  repo.init();
  repo.body.saveBody({ date: '2026-10-01', weightKg: 70 });
  const w = repo.workouts.createDraft({ exerciseIds: ['0025'] }).data;
  fail = true;
  const r = repo.body.saveBody({ date: '2026-10-02', weightKg: 71 });
  assert.deepStrictEqual([r.ok, r.code], [false, 'QUOTA_EXCEEDED']); assert.match(r.message, /空间不足/);
  assert.strictEqual(be.data[K.BODY].length, 1);
  assert.strictEqual(repo.workouts.addExercise(w.id, '0025').code, 'QUOTA_EXCEEDED');
  assert.strictEqual(repo.workouts.createDraft({ exerciseIds: ['0025'] }).code, 'DRAFT_EXISTS');
  fail = new Error('setStorageSync:fail unknown');
  assert.strictEqual(repo.body.saveBody({ weightKg: 1 }).code, 'WRITE_FAILED');
  fail = false;
  assert.ok(repo.body.saveBody({ date: '2026-10-02', weightKg: 71 }).ok);
});

test('header write failure after detail write: detail rolled back (no partial write)', () => {
  let fail = false;
  const { repo, be } = fresh({}, { failOn: k => fail && k === K.WORKOUTS });
  repo.init();
  const w = repo.workouts.createDraft({ exerciseIds: ['0025'] }).data;
  const s = repo.workouts.getWorkout(w.id).exercises[0].sets[0]; repo.workouts.updateSet(w.id, s.id, { reps: 10, weightKg: 10 });
  const snap = JSON.stringify(be.data);
  fail = true;
  assert.strictEqual(repo.workouts.setSetDone(w.id, s.id, true).code, 'QUOTA_EXCEEDED');
  fail = false;
  assert.strictEqual(JSON.stringify(be.data), snap, 'storage unchanged after failed ops');
  assert.strictEqual(repo.workouts.getHeader(w.id).status, 'draft');
});

test('launch self-heal recomputes stale header summaries from details', () => {
  const { repo, be } = fresh({ fit_meta: { schemaVersion: 1 }, fit_workouts: [{ id: 'w1', status: 'completed', date: '2026-10-01', createdAt: 1, exerciseCount: 1, setCount: 3, volumeKg: 99 }],
    fit_workout_w1: { workoutId: 'w1', exercises: [], sets: [] } });
  repo.init();
  assert.deepStrictEqual([be.data.fit_workouts[0].exerciseCount, be.data.fit_workouts[0].setCount, be.data.fit_workouts[0].volumeKg], [0, 0, 0]);
});

test('corrupt keys: never treated as empty & overwritten; backup kept; other data still writable; reload re-checks', () => {
  const { repo, be } = fresh({ fit_meta: { schemaVersion: 1 }, fit_workouts: { broken: true }, fit_body: { '2026-10-01': { weightKg: 70 } },
    fit_workout_w_x: { workoutId: 'w_x', exercises: [], sets: [] } });
  const st = repo.init();
  assert.strictEqual(st.mode, 'corrupt'); assert.deepStrictEqual(st.health.corruptKeys.sort(), ['fit_body', 'fit_workouts']);
  assert.ok(be.data.fit_workout_w_x, 'orphan cleanup skipped when headers are corrupt');
  assert.deepStrictEqual(repo.workouts.listWorkouts(), []); assert.deepStrictEqual(repo.body.listBody(), []);
  assert.strictEqual(repo.body.saveBody({ weightKg: 71 }).code, 'DATA_CORRUPT');
  assert.strictEqual(repo.workouts.createDraft({ exerciseIds: ['0025'] }).code, 'DATA_CORRUPT');
  assert.deepStrictEqual(be.data.fit_workouts, { broken: true }); assert.deepStrictEqual(be.data.fit_body, { '2026-10-01': { weightKg: 70 } });
  assert.ok(Object.keys(be.data).some(k => k.startsWith('fit_corrupt_fit_body_')), 'raw backup written');
  assert.ok(repo.prefs.set('bodyView', 'calendar'), 'unaffected keys still writable');
  be.data.fit_body = []; // user/support fixes the key
  assert.strictEqual(repo.reload().mode, 'corrupt'); assert.deepStrictEqual(repo.health().corruptKeys, ['fit_workouts']);
  assert.ok(repo.body.saveBody({ weightKg: 71 }).ok);
});

test('corrupt workout detail: shown as empty, writes to it refused, raw kept', () => {
  const { repo, be } = fresh({ fit_meta: { schemaVersion: 1 }, fit_workouts: [{ id: 'w1', status: 'draft', date: '2026-10-17', createdAt: 1, exerciseCount: 1, setCount: 0, volumeKg: 0 }],
    fit_workout_w1: { workoutId: 'w1', exercises: 'oops' } });
  repo.init();
  assert.deepStrictEqual(repo.workouts.getWorkout('w1').exercises, []);
  assert.strictEqual(repo.workouts.addExercise('w1', '0025').code, 'DATA_CORRUPT');
  assert.deepStrictEqual(be.data.fit_workout_w1, { workoutId: 'w1', exercises: 'oops' });
});

test('read failures: queries never throw; writes to unreadable keys refused; meta unreadable -> error, nothing written', () => {
  const S = require('../utils/storage');
  const { repo, be } = fresh({ fit_meta: { schemaVersion: 1 }, fit_body: [{ id: 'b1', date: '2026-10-01', weightKg: 70 }] });
  repo.init();
  const get = be.get; be.get = k => { if (k === 'fit_body') throw new Error('getStorageSync:fail'); return get(k); };
  assert.deepStrictEqual(repo.body.listBody(), []); assert.doesNotThrow(() => repo.body.bodyStats('weightKg', 30));
  assert.strictEqual(repo.body.saveBody({ weightKg: 71 }).code, 'DATA_CORRUPT');
  assert.deepStrictEqual(be.data.fit_body.length, 1);
  be.get = k => { if (k === 'fit_meta') throw new Error('fail'); return get(k); };
  const snap = JSON.stringify(be.data);
  assert.strictEqual(repo.init().mode, 'error'); assert.strictEqual(S.isReadOnly(), true);
  assert.strictEqual(JSON.stringify(be.data), snap);
});

test('garbage fit_meta -> read-only, meta not overwritten', () => {
  const { repo, be } = fresh({ fit_meta: 'v1?', fit_body: [] });
  const st = repo.init(); assert.strictEqual(st.mode, 'readonly'); assert.strictEqual(be.data.fit_meta, 'v1?');
});

test('new user: transient fit_meta write failure does not lock the session', () => {
  let fail = true;
  const { repo } = fresh({}, { failOn: k => fail && k === 'fit_meta' });
  const st = repo.init(); fail = false;
  assert.strictEqual(st.mode, 'error'); assert.strictEqual(repo.isReadOnly(), false);
  assert.ok(repo.body.saveBody({ weightKg: 70 }).ok);
  assert.strictEqual(repo.init().mode, 'normal', 'meta written on next launch');
});
