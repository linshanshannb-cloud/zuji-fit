// 编辑与删除：已完成训练的编辑规则、组的删除/撤销位置、身体数据增删改
const test = require('node:test');
const assert = require('node:assert');
const H = require('./_harness');

function done(repo, opts = {}) {
  const r = repo.workouts.createDraft({ date: opts.date }); repo.workouts.addExercises(r.data.id, opts.ids || ['0025']);
  const v = repo.workouts.getWorkout(r.data.id);
  v.exercises.forEach(e => { repo.workouts.updateSet(r.data.id, e.sets[0].id, { weightKg: 50, reps: 5 }); repo.workouts.setSetDone(r.data.id, e.sets[0].id, true); });
  assert.ok(repo.workouts.completeWorkout(r.data.id).ok); return r.data.id;
}

test('E1 完成时清理：没打勾组的动作被删，未打勾的组保留但不计入；只有热身组打勾也算"至少一组"', () => {
  const { repo } = H.fresh();
  const r = repo.workouts.createDraft({}); repo.workouts.addExercises(r.data.id, ['0025', '0294', '1060']);
  const v = repo.workouts.getWorkout(r.data.id), [a, b] = v.exercises;
  repo.workouts.updateSet(r.data.id, a.sets[0].id, { weightKg: 60, reps: 8 }); repo.workouts.setSetDone(r.data.id, a.sets[0].id, true);
  repo.workouts.addSet(r.data.id, a.id, {}); // 未打勾
  repo.workouts.updateSet(r.data.id, b.sets[0].id, { weightKg: 10, reps: 10, type: 'warmup' }); repo.workouts.setSetDone(r.data.id, b.sets[0].id, true);
  const chk = repo.workouts.completionCheck(r.data.id);
  assert.deepStrictEqual(chk.willRemove.length, 1); assert.strictEqual(chk.undoneSets, 1);
  assert.ok(repo.workouts.completeWorkout(r.data.id).ok);
  const w = repo.workouts.getWorkout(r.data.id);
  assert.strictEqual(w.exercises.length, 2); assert.strictEqual(w.setCount, 1); assert.strictEqual(w.volumeKg, 480);
  assert.deepStrictEqual(H.checkWorkout(r.data.id), []);
  assert.strictEqual(repo.workouts.completeWorkout(r.data.id).code, 'NOT_DRAFT');
});

test('E2 编辑已完成训练：改日期后日历跟着移动，completedAt 不变，status 保持 completed', () => {
  const { repo } = H.fresh();
  const id = done(repo, { date: '2026-10-10' });
  const before = repo.workouts.getHeader(id);
  assert.ok(repo.workouts.updateWorkout(id, { date: '2026-09-30', name: '腿日' }).ok);
  const h = repo.workouts.getHeader(id);
  assert.strictEqual(h.completedAt, before.completedAt); assert.strictEqual(h.status, 'completed');
  assert.deepStrictEqual(repo.workouts.completedDates(), { '2026-09-30': 1 });
  assert.strictEqual(repo.workouts.workoutsOn('2026-10-10').length, 0);
  assert.strictEqual(repo.workouts.updateWorkout(id, { date: '2026-10-18' }).code, 'FUTURE_DATE');
});

test('E3 编辑已完成训练：取消所有勾选 → 完成编辑被拦（NO_DONE_SETS），但数据已保存且仍为 completed', () => {
  const { repo } = H.fresh();
  const id = done(repo);
  const s = repo.workouts.getWorkout(id).exercises[0].sets[0];
  assert.ok(repo.workouts.setSetDone(id, s.id, false).ok);
  assert.strictEqual(repo.workouts.finalizeWorkout(id).code, 'NO_DONE_SETS');
  const h = repo.workouts.getHeader(id);
  assert.strictEqual(h.status, 'completed'); assert.strictEqual(h.setCount, 0);
});

test('E4 已完成训练删光动作（×→仍然离开）：仍是 completed、仍有摘要卡；按 DATA_MODEL §4 规则 6（10-17 09:56 版）不点亮日期', () => {
  const { repo } = H.fresh();
  const id = done(repo, { date: '2026-10-12' });
  const we = repo.workouts.getWorkout(id).exercises[0];
  assert.ok(repo.workouts.removeExercise(id, we.id).ok);
  assert.strictEqual(repo.workouts.getHeader(id).status, 'completed');
  assert.strictEqual(repo.workouts.workoutsOn('2026-10-12').length, 1, '摘要卡仍在');
  assert.strictEqual(repo.workouts.completedDates()['2026-10-12'], undefined, '文档规定 0 个动作不打点（注意：同一天"有摘要卡、无圆点"，见问题清单）');
});

test('E5 删组 / 撤销：恢复到原位置，index 连续；复制组插在下方', () => {
  const { repo } = H.fresh();
  const r = repo.workouts.createDraft({}); repo.workouts.addExercises(r.data.id, ['0025']);
  const we = repo.workouts.getWorkout(r.data.id).exercises[0];
  [1, 2, 3].forEach(i => repo.workouts.addSet(r.data.id, we.id, { weightKg: i * 10, reps: i }));
  let sets = repo.workouts.getWorkout(r.data.id).exercises[0].sets; // 4 组：null,10,20,30
  const del = repo.workouts.deleteSet(r.data.id, sets[2].id); assert.strictEqual(del.data.index, 3);
  assert.deepStrictEqual(repo.workouts.getWorkout(r.data.id).exercises[0].sets.map(s => [s.index, s.weightKg]), [[1, null], [2, 10], [3, 30]]);
  repo.workouts.restoreSet(r.data.id, del.data);
  assert.deepStrictEqual(repo.workouts.getWorkout(r.data.id).exercises[0].sets.map(s => [s.index, s.weightKg]), [[1, null], [2, 10], [3, 20], [4, 30]]);
  sets = repo.workouts.getWorkout(r.data.id).exercises[0].sets;
  repo.workouts.duplicateSet(r.data.id, sets[1].id);
  assert.deepStrictEqual(repo.workouts.getWorkout(r.data.id).exercises[0].sets.map(s => s.weightKg), [null, 10, 10, 20, 30]);
  assert.deepStrictEqual(H.checkWorkout(r.data.id), []);
});

test('E6 addSet 只复制重量/次数，类型固定 normal（上一组是热身）；补录训练新组默认已完成', () => {
  const { repo } = H.fresh();
  const r = repo.workouts.createDraft({ date: '2026-10-01' }); repo.workouts.addExercises(r.data.id, ['0025']);
  const we = repo.workouts.getWorkout(r.data.id).exercises[0];
  repo.workouts.updateSet(r.data.id, we.sets[0].id, { weightKg: 20, reps: 10, type: 'warmup' });
  const s = repo.workouts.addSet(r.data.id, we.id, {}).data;
  assert.deepStrictEqual([s.type, s.weightKg, s.reps, s.done], ['normal', 20, 10, true]);
  assert.strictEqual(repo.workouts.getHeader(r.data.id).startedAt, null);
});

test('E7 身体数据：同日 saveBody 合并（空值保留原值）、updateBody 清空选填项、不能清空体重、改日期冲突、删除', () => {
  const { repo } = H.fresh();
  const a = repo.body.saveBody({ date: '2026-10-01', weightKg: 70, waistCm: 80, note: 'a' });
  const m = repo.body.saveBody({ date: '2026-10-01', weightKg: '', bodyFatPct: 20 });
  assert.strictEqual(m.merged, true); assert.deepStrictEqual([m.data.weightKg, m.data.waistCm, m.data.bodyFatPct, m.data.note], [70, 80, 20, 'a']);
  assert.strictEqual(m.data.id, a.data.id); assert.strictEqual(repo.body.listBody().length, 1);
  const u = repo.body.updateBody(a.data.id, { waistCm: '', bodyFatPct: '' });
  assert.deepStrictEqual([u.data.waistCm, u.data.bodyFatPct, u.data.weightKg], [null, null, 70]);
  assert.strictEqual(repo.body.updateBody(a.data.id, { weightKg: '' }).code, 'WEIGHT_REQUIRED');
  assert.strictEqual(repo.body.updateBody(a.data.id, { weightKg: null }).code, 'WEIGHT_REQUIRED');
  repo.body.saveBody({ date: '2026-10-02', weightKg: 71 });
  assert.strictEqual(repo.body.updateBody(a.data.id, { date: '2026-10-02' }).code, 'DATE_CONFLICT');
  assert.ok(repo.body.updateBody(a.data.id, { date: '2026-09-30' }).ok);
  assert.deepStrictEqual(repo.body.listBody().map(r => r.date), ['2026-09-30', '2026-10-02'], '改日期后仍按日期升序');
  assert.ok(repo.body.deleteBody(a.data.id).ok); assert.strictEqual(repo.body.deleteBody(a.data.id).code, 'NOT_FOUND');
  assert.strictEqual(repo.body.listBody().length, 1);
});

test('E8 删除不存在的训练 / 组 / 动作：返回 NOT_FOUND，不抛异常、不写存储', () => {
  const { repo } = H.fresh();
  const id = done(repo); const snap = H.snapshot();
  assert.strictEqual(repo.workouts.deleteWorkout('w_nope').code, 'NOT_FOUND');
  assert.strictEqual(repo.workouts.deleteSet(id, 's_nope').code, 'NOT_FOUND');
  assert.strictEqual(repo.workouts.removeExercise(id, 'we_nope').code, 'NOT_FOUND');
  assert.strictEqual(repo.workouts.updateSet('w_nope', 's', {}).code, 'NOT_FOUND');
  assert.deepStrictEqual(H.snapshot(), snap);
});
