// 存储写入失败：setStorageSync 抛错时不崩溃、返回错误码、数据不丢、不出现"报错但已部分写入"
const test = require('node:test');
const assert = require('node:assert');
const H = require('./_harness');

function base() {
  const { repo } = H.fresh();
  const r = repo.workouts.createDraft({}); repo.workouts.addExercises(r.data.id, ['0025', '0294']);
  const v = repo.workouts.getWorkout(r.data.id);
  repo.workouts.updateSet(r.data.id, v.exercises[0].sets[0].id, { weightKg: 60, reps: 8 });
  repo.workouts.setSetDone(r.data.id, v.exercises[0].sets[0].id, true);
  repo.body.saveBody({ date: '2026-10-16', weightKg: 70 });
  return { repo, wid: r.data.id, v: repo.workouts.getWorkout(r.data.id) };
}
const ops = ({ repo, wid, v }) => ({
  addExercises: () => repo.workouts.addExercises(wid, ['1060']),
  removeExercise: () => repo.workouts.removeExercise(wid, v.exercises[1].id),
  moveExercise: () => repo.workouts.moveExercise(wid, v.exercises[1].id, 0),
  addSet: () => repo.workouts.addSet(wid, v.exercises[0].id, {}),
  updateSet: () => repo.workouts.updateSet(wid, v.exercises[0].sets[0].id, { weightKg: 65 }),
  setSetDone: () => repo.workouts.setSetDone(wid, v.exercises[0].sets[0].id, false),
  deleteSet: () => repo.workouts.deleteSet(wid, v.exercises[0].sets[0].id),
  updateWorkout: () => repo.workouts.updateWorkout(wid, { name: 'x' }),
  completeWorkout: () => repo.workouts.completeWorkout(wid),
  deleteWorkout: () => repo.workouts.deleteWorkout(wid),
  saveBody: () => repo.body.saveBody({ weightKg: 71 }),
  updateBody: () => repo.body.updateBody(repo.body.listBody()[0].id, { weightKg: 72 }),
  deleteBody: () => repo.body.deleteBody(repo.body.listBody()[0].id),
});

test('S1 每个写操作：任何一次 setStorageSync 抛"空间不足"都不抛异常，返回 QUOTA_EXCEEDED', () => {
  for (const name of Object.keys(ops(base()))) {
    const ctx = base(); H.store.failSet = () => true;
    let r; assert.doesNotThrow(() => { r = ops(ctx)[name](); }, name);
    assert.strictEqual(r.ok, false, name); assert.strictEqual(r.code, 'QUOTA_EXCEEDED', name);
    H.store.failSet = null;
  }
  const ctx = base(); H.store.failSet = () => new Error('setStorageSync:fail unknown');
  assert.strictEqual(ops(ctx).updateSet().code, 'WRITE_FAILED');
});

test('S2 失败即无副作用：第 1 次写失败时存储完全不变', () => {
  for (const name of Object.keys(ops(base()))) {
    const ctx = base(); const snap = H.snapshot();
    H.store.failSet = () => true; ops(ctx)[name](); H.store.failSet = null;
    assert.deepStrictEqual(H.snapshot(), snap, name);
  }
});

test('S3 原子性：详情写成功、训练头写失败（第 2 次写抛错）时，返回失败的操作不应已部分落盘', () => {
  const leaked = [];
  for (const name of ['removeExercise', 'deleteSet', 'updateSet', 'completeWorkout', 'addExercises']) {
    const ctx = base(); const snap = H.snapshot();
    let n = 0; H.store.failSet = () => (++n === 2);
    const r = ops(ctx)[name](); H.store.failSet = null;
    assert.strictEqual(r.ok, false);
    const changed = JSON.stringify(H.snapshot()) !== JSON.stringify(snap);
    if (changed) {
      const errs = H.checkWorkout(ctx.wid);
      leaked.push(`${name}: 报"保存失败"但详情已改写${errs.length ? '，且头/详情不一致(' + errs[0] + ')' : ''}`);
    }
  }
  assert.deepStrictEqual(leaked, []);
});

test('S4 冷启动后：S3 情况下的训练头派生字段会被重算吗（日历用的是头里的 exerciseCount）', () => {
  const ctx = base(); ctx.repo.workouts.completeWorkout(ctx.wid);
  const v = ctx.repo.workouts.getWorkout(ctx.wid);
  let n = 0; H.store.failSet = () => (++n === 2);
  ctx.repo.workouts.removeExercise(ctx.wid, v.exercises[0].id); H.store.failSet = null;
  const { repo } = H.boot();
  const h = repo.workouts.listWorkouts()[0], w = repo.workouts.getWorkout(ctx.wid);
  assert.strictEqual(h.exerciseCount, w.exercises.length, `列表/日历用的头 exerciseCount=${h.exerciseCount}，详情实际 ${w.exercises.length}`);
});

test('S5 删除训练时 removeStorageSync 失败：仍返回成功，残留详情在下次启动被清理', () => {
  const ctx = base(); H.store.failRemove = () => new Error('remove fail');
  assert.ok(ctx.repo.workouts.deleteWorkout(ctx.wid).ok); H.store.failRemove = null;
  assert.ok(H.raw('fit_workout_' + ctx.wid));
  H.boot(); assert.strictEqual(H.raw('fit_workout_' + ctx.wid), undefined);
});

test('S6 读取失败（getStorageSync 抛错）：API.md 约定查询"never throw"', () => {
  const ctx = base();
  H.store.failGet = () => new Error('getStorageSync:fail');
  const thrown = [];
  for (const [n, f] of Object.entries({ listWorkouts: () => ctx.repo.workouts.listWorkouts(), completedDates: () => ctx.repo.workouts.completedDates(), getDraft: () => ctx.repo.workouts.getDraft(), listBody: () => ctx.repo.body.listBody(), bodyStats: () => ctx.repo.body.bodyStats('weightKg', 30) })) {
    try { f(); } catch (e) { thrown.push(n + ': ' + e.message); }
  }
  H.store.failGet = null;
  assert.deepStrictEqual(thrown, []);
});

test('S7 新用户首次启动写 fit_meta 失败：本次会话被整体锁成只读（连记一条体重都不行）', () => {
  H.store.mem = {}; H.store.failSet = k => k === 'fit_meta';
  const b = H.boot(); H.store.failSet = null;
  assert.strictEqual(b.status.mode, 'error');
  const r = b.repo.body.saveBody({ weightKg: 70 });
  assert.notStrictEqual(r.code, 'READ_ONLY', '一次瞬时写失败就让整个会话只读（PRODUCT_SPEC 7.1 只要求提示重试）');
});

test('S8 偏好写失败被吞掉，不影响业务', () => {
  const ctx = base(); H.store.failSet = k => k === 'fit_ui_prefs';
  assert.strictEqual(ctx.repo.prefs.set('bodyView', 'calendar'), false);
  assert.strictEqual(ctx.repo.prefs.get('bodyView', 'chart'), 'chart');
  assert.ok(ctx.repo.body.saveBody({ weightKg: 70 }).ok);
});

test('S9 （损坏数据）fit_body 被写坏成对象时再保存：不应覆盖/清空原数据（PRODUCT_SPEC 7.2）', () => {
  H.fresh({ fit_meta: { schemaVersion: 1 }, fit_body: { '2026-10-01': { weightKg: 70 } } });
  const { repo } = H.boot();
  repo.body.saveBody({ weightKg: 71 });
  assert.ok(!Array.isArray(H.raw('fit_body')), 'fit_body 原内容被整体覆盖为 [新记录]');
});
