// 重新打开后数据恢复（清 require 缓存 + 同一存储重新 init）、迁移幂等、只读模式
const test = require('node:test');
const assert = require('node:assert');
const H = require('./_harness');

function fullFlow(repo) {
  const r = repo.workouts.createDraft({ name: '推日', note: '状态好' });
  repo.workouts.addExercises(r.data.id, ['0025', '0294']);
  const v = repo.workouts.getWorkout(r.data.id);
  repo.workouts.updateSet(r.data.id, v.exercises[0].sets[0].id, { weightKg: 60, reps: 8 });
  repo.workouts.setSetDone(r.data.id, v.exercises[0].sets[0].id, true);
  repo.workouts.addSet(r.data.id, v.exercises[0].id, { type: 'normal' });
  repo.workouts.addSet(r.data.id, v.exercises[0].id, { type: 'warmup', weightKg: 20, reps: 10 });
  repo.workouts.updateExerciseNote(r.data.id, v.exercises[0].id, '握距窄一点');
  assert.ok(repo.workouts.finalizeWorkout(r.data.id).ok);
  repo.body.saveBody({ date: '2026-10-15', weightKg: '72.44', waistCm: '81.5' });
  repo.body.saveBody({ weightKg: 72.1, bodyFatPct: 18.2, note: '早起' });
  repo.prefs.set('bodyView', 'calendar');
  return r.data.id;
}

test('P1 冷启动后（清模块缓存，同一存储）训练/组/身体数据/偏好全部恢复，且不重复迁移', () => {
  let { repo } = H.fresh();
  const id = fullFlow(repo);
  const before = { w: repo.workouts.getWorkout(id), body: repo.body.listBody(), ds: repo.workouts.completedDates(), pb: repo.workouts.personalBest('0025') };
  const snap = H.snapshot();
  const b2 = H.boot(); repo = b2.repo;
  assert.strictEqual(b2.status.mode, 'normal'); assert.strictEqual(b2.status.migrated, false);
  assert.deepStrictEqual(repo.workouts.getWorkout(id), before.w);
  assert.deepStrictEqual(repo.body.listBody(), before.body);
  assert.deepStrictEqual(repo.workouts.completedDates(), before.ds);
  assert.deepStrictEqual(repo.workouts.personalBest('0025'), before.pb);
  assert.strictEqual(repo.prefs.get('bodyView', 'chart'), 'calendar');
  assert.deepStrictEqual(H.snapshot(), snap, 'init 不应改动已有数据');
  assert.strictEqual(before.body[0].weightKg, 72.4);
});

test('P2 已写入的草稿重开后还在（横幅）；只开页面没加动作的内存草稿重开后消失', () => {
  let { repo } = H.fresh();
  const a = repo.workouts.createDraft({}); repo.workouts.addExercises(a.data.id, ['0025']);
  repo = H.boot().repo;
  assert.strictEqual(repo.workouts.getDraft().id, a.data.id);
  repo.workouts.discardDraft();
  const p = repo.workouts.createDraft({}); assert.strictEqual(p.data.persisted, false);
  repo = H.boot().repo;
  assert.strictEqual(repo.workouts.getDraft(), null); assert.strictEqual(repo.workouts.getHeader(p.data.id), null);
});

const V0 = {
  fit_workouts_v1: [
    { id: 'old1', date: '2024-02-29', note: ' 闰日 ', exercises: [{ exerciseId: '0025', name: '卧推', sets: [{ reps: 8, weight: 60 }, { reps: null, weight: 60 }, { reps: 2.5, weight: -3 }] }] },
    { id: 'old2', date: '2026-02-29', exercises: [] }, // 非法日期 → 跳过
    { id: 'old3', date: '2025-12-31', exercises: [] }, // 空训练 → 保留
  ],
  fit_body_v1: [{ id: 'b1', date: '2025-12-31', weight: 70, bodyFat: 120, waist: 80, chest: 98, hip: null, arm: 400 }, { id: 'b2', date: '2026-01-01', weight: null, waist: 82 }, { id: 'b3', date: '2026-01-02' }],
};
test('P3 v0 迁移：闰日保留、非法日期跳过、空训练保留、非法组值 → null、体脂>100 → null；重启幂等，旧 key 保留', () => {
  let b = H.fresh(V0);
  assert.strictEqual(b.status.mode, 'normal'); assert.strictEqual(b.status.migrated, true);
  const ws = H.raw('fit_workouts');
  assert.deepStrictEqual(ws.map(w => w.date), ['2024-02-29', '2025-12-31']);
  const d = H.raw('fit_workout_old1');
  assert.deepStrictEqual(d.sets.map(s => [s.weightKg, s.reps, s.done]), [[60, 8, true], [60, null, false], [null, null, false]]);
  assert.strictEqual(ws[0].volumeKg, 480); assert.strictEqual(ws[0].note, '闰日');
  const body = H.raw('fit_body');
  assert.deepStrictEqual(body.map(r => [r.date, r.weightKg, r.bodyFatPct, r.waistCm]), [['2025-12-31', 70, null, 80], ['2026-01-01', null, null, 82]]);
  assert.deepStrictEqual(body[0].extra, { chestCm: 98 });
  assert.ok(H.raw('fit_workouts_v1') && H.raw('fit_body_v1'), '旧 key 应保留一个版本');
  const snap = H.snapshot();
  b = H.boot(); assert.strictEqual(b.status.migrated, false);
  assert.deepStrictEqual(H.snapshot(), snap);
  // 2024-02-29 的训练出现在日历
  assert.deepStrictEqual(b.repo.workouts.completedDates('2024-02-01', '2024-02-29'), { '2024-02-29': 1 });
});

test('P4 迁移中途写入失败：本次只读、不写 fit_meta；下次启动重新完整迁移且结果正确无重复', () => {
  H.store.mem = Object.fromEntries(Object.entries(V0).map(([k, v]) => [k, JSON.stringify(v)]));
  H.store.failSet = k => k === 'fit_body';
  let b = H.boot();
  assert.strictEqual(b.status.mode, 'error');
  assert.strictEqual(H.raw('fit_meta'), undefined);
  assert.strictEqual(b.repo.workouts.createDraft({ exerciseIds: ['0025'] }).code, 'READ_ONLY');
  H.store.failSet = null;
  b = H.boot();
  assert.strictEqual(b.status.mode, 'normal'); assert.strictEqual(b.status.migrated, true);
  assert.strictEqual(H.raw('fit_workouts').length, 2); assert.strictEqual(H.raw('fit_body').length, 2);
  assert.ok(H.raw('fit_meta').schemaVersion === 1);
});

test('P5 schemaVersion 比代码新：只读，任何写操作都不落盘', () => {
  H.fresh({ fit_meta: { schemaVersion: 2 }, fit_workouts: [], fit_body: [{ id: 'b', date: '2026-10-01', weightKg: 70, bodyFatPct: null, waistCm: null, note: '', extra: null, createdAt: 1, updatedAt: 1 }] });
  const snap = H.snapshot();
  const { repo, status } = H.boot();
  assert.strictEqual(status.mode, 'readonly');
  const results = [repo.workouts.createDraft({ exerciseIds: ['0025'] }), repo.body.saveBody({ weightKg: 70 }), repo.body.deleteBody('b'), repo.body.updateBody('b', { note: 'x' }), repo.workouts.addToCurrentDraft('0025'), repo.exercises.addCustom({ nameZh: 'x', bodyPart: 'core' })];
  results.forEach(r => assert.strictEqual(r.code, 'READ_ONLY'));
  assert.strictEqual(repo.prefs.set('bodyView', 'calendar'), false);
  assert.deepStrictEqual(H.snapshot(), snap);
});

test('P6 启动时清理孤立详情 key（头已删除、详情残留）', () => {
  H.fresh({ fit_meta: { schemaVersion: 1 }, fit_workouts: [], fit_workout_w_zombie: { workoutId: 'w_zombie', exercises: [], sets: [] } });
  assert.strictEqual(H.raw('fit_workout_w_zombie'), undefined);
});

test('P7 （损坏数据）fit_workouts 不是数组：启动不应让整个小程序永久只读', () => {
  const b = H.fresh({ fit_meta: { schemaVersion: 1 }, fit_workouts: { broken: true } });
  assert.notStrictEqual(b.status.mode, 'error', `init 返回 ${JSON.stringify(b.status)}`);
});

test('P8 v0 迁移：reps = 0 的组应为 done=false（DATA_MODEL §9.2 "done = reps >= 1"），否则出现"已完成但 0 次"的组且无法再编辑', () => {
  const b = H.fresh({ fit_workouts_v1: [{ id: 'z', date: '2026-10-01', exercises: [{ exerciseId: '0025', name: '卧推', sets: [{ reps: 0, weight: 50 }, { reps: 5, weight: 50 }] }] }] });
  const sets = H.raw('fit_workout_z').sets;
  assert.deepStrictEqual(sets.map(s => s.done), [false, true], `实际 done=${JSON.stringify(sets.map(s => s.done))}`);
  void b;
});
