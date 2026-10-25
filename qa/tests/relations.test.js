// 关联一致性：训练 / 动作 / 组 / 身体数据，删除后的悬挂引用，随机操作后的不变量
const test = require('node:test');
const assert = require('node:assert');
const H = require('./_harness');

function seedWorkout(repo, { date, ids = ['0025', '0294'], reps = 8, w = 60 } = {}) {
  const r = repo.workouts.createDraft({ date }); assert.ok(r.ok, JSON.stringify(r));
  const a = repo.workouts.addExercises(r.data.id, ids); assert.ok(a.ok, JSON.stringify(a));
  const v = repo.workouts.getWorkout(r.data.id);
  v.exercises.forEach(e => { const s = e.sets[0]; repo.workouts.updateSet(r.data.id, s.id, { weightKg: w, reps }); repo.workouts.setSetDone(r.data.id, s.id, true); });
  return r.data.id;
}

test('R1 删除训练：头和详情 key 都被删，没有孤立 key；个人最佳/引用随之消失', () => {
  const { repo } = H.fresh();
  const id = seedWorkout(repo);
  assert.ok(repo.workouts.completeWorkout(id).ok);
  assert.deepStrictEqual(H.checkWorkout(id), []);
  assert.ok(repo.workouts.personalBest('0025'));
  assert.ok(repo.workouts.referencedExerciseIds()['0025']);
  assert.ok(repo.workouts.deleteWorkout(id).ok);
  assert.strictEqual(H.raw('fit_workout_' + id), undefined);
  assert.strictEqual((H.raw('fit_workouts') || []).length, 0);
  assert.strictEqual(repo.workouts.personalBest('0025'), null);
  assert.ok(!repo.workouts.referencedExerciseIds()['0025']);
  assert.deepStrictEqual(repo.workouts.completedDates(), {});
});

test('R2 删除训练中的动作：级联删除它的组，order 重排；撤销后组和位置恢复；重复撤销被拒', () => {
  const { repo } = H.fresh();
  const id = seedWorkout(repo, { ids: ['0025', '0294', '0025'] });
  const v = repo.workouts.getWorkout(id);
  const mid = v.exercises[1];
  repo.workouts.addSet(id, mid.id, {});
  const rm = repo.workouts.removeExercise(id, mid.id); assert.ok(rm.ok);
  assert.strictEqual(rm.data.sets.length, 2);
  const d = H.raw('fit_workout_' + id);
  assert.ok(!d.sets.some(s => s.workoutExerciseId === mid.id), '被删动作的组仍在');
  assert.deepStrictEqual(H.checkWorkout(id), []);
  assert.ok(repo.workouts.restoreExercise(id, rm.data).ok);
  const v2 = repo.workouts.getWorkout(id);
  assert.strictEqual(v2.exercises[1].id, mid.id); assert.strictEqual(v2.exercises[1].sets.length, 2);
  assert.strictEqual(repo.workouts.restoreExercise(id, rm.data).code, 'ALREADY_RESTORED');
  assert.deepStrictEqual(H.checkWorkout(id), []);
});

test('R3 动作库里已不存在的 exerciseId（悬挂引用）：详情/日历/最佳都不报错，显示 nameSnapshot', () => {
  const { repo } = H.fresh();
  const id = seedWorkout(repo);
  repo.workouts.completeWorkout(id);
  const d = H.raw('fit_workout_' + id);
  d.exercises[0].exerciseId = 'GONE-9999'; // 模拟动作库更新后删掉了这个 id
  H.store.mem['fit_workout_' + id] = JSON.stringify(d);
  const v = repo.workouts.getWorkout(id);
  assert.strictEqual(v.exercises[0].displayName, '杠铃卧推');
  assert.strictEqual(v.exercises[0].exercise.unknown, true);
  assert.doesNotThrow(() => repo.workouts.daySummaries(v.date));
  assert.ok(repo.workouts.personalBest('GONE-9999'), '历史最佳仍可算');
  assert.strictEqual(repo.exercises.get('GONE-9999').unknown, true);
  // 不允许新加 / 替换成不存在的动作
  assert.strictEqual(repo.workouts.addExercise(id, 'GONE-9999').code, 'UNKNOWN_EXERCISE');
  assert.strictEqual(repo.workouts.replaceExercise(id, v.exercises[1].id, 'nope').code, 'UNKNOWN_EXERCISE');
  // 失败的批量添加不能部分写入
  const before = H.raw('fit_workout_' + id).exercises.length;
  assert.strictEqual(repo.workouts.addExercises(id, ['0025', 'nope']).code, 'UNKNOWN_EXERCISE');
  assert.strictEqual(H.raw('fit_workout_' + id).exercises.length, before);
});

test('R4 自定义动作被引用后删除 = 归档；历史照常显示，但不能再添加；未引用则真删', () => {
  const { repo } = H.fresh();
  const c = repo.exercises.addCustom({ nameZh: '弹力带划船', bodyPart: 'back' }); assert.ok(c.ok);
  const c2 = repo.exercises.addCustom({ nameZh: '没用过', bodyPart: 'core' }); assert.ok(c2.ok);
  const r = repo.workouts.createDraft({}); repo.workouts.addExercises(r.data.id, [c.data.id]);
  assert.deepStrictEqual(repo.deleteCustomExercise(c.data.id).data, { archived: true });
  assert.deepStrictEqual(repo.deleteCustomExercise(c2.data.id).data, { deleted: true });
  assert.strictEqual(repo.workouts.getWorkout(r.data.id).exercises[0].displayName, '弹力带划船');
  assert.strictEqual(repo.workouts.addExercise(r.data.id, c.data.id).code, 'ARCHIVED_EXERCISE');
  assert.ok(!repo.exercises.all().some(e => e.id === c.data.id), '归档动作不应出现在动作库');
});

test('R5 恢复组到已被删除的动作：返回 NOT_FOUND，不产生悬挂组', () => {
  const { repo } = H.fresh();
  const id = seedWorkout(repo);
  const v = repo.workouts.getWorkout(id), we = v.exercises[0];
  const ds = repo.workouts.deleteSet(id, we.sets[0].id); assert.ok(ds.ok);
  repo.workouts.removeExercise(id, we.id);
  assert.strictEqual(repo.workouts.restoreSet(id, ds.data).code, 'NOT_FOUND');
  assert.deepStrictEqual(H.checkWorkout(id), []);
});

test('R6 只能有一个已写入的草稿；内存草稿不写存储；放弃草稿删干净', () => {
  const { repo } = H.fresh();
  const p = repo.workouts.createDraft({}); assert.strictEqual(p.data.persisted, false);
  assert.strictEqual(H.raw('fit_workouts'), undefined, '内存草稿不应写入');
  repo.workouts.addExercises(p.data.id, ['0025']);
  assert.strictEqual(repo.workouts.createDraft({}).code, 'DRAFT_EXISTS');
  assert.ok(repo.workouts.discardDraft().ok);
  assert.strictEqual(H.raw('fit_workout_' + p.data.id), undefined);
  assert.deepStrictEqual(H.raw('fit_workouts'), []);
});

test('R7 随机操作 600 步（加/删/恢复/排序/改组/勾选/完成/编辑/删训练）后不变量始终成立', () => {
  const { repo } = H.fresh();
  const rand = H.rng(20261017);
  const pick = a => a[Math.floor(rand() * a.length)];
  const ex = repo.exercises.all().slice(0, 40).map(e => e.id);
  let undo = [];
  const live = () => (H.raw('fit_workouts') || []).map(w => w.id);
  for (let step = 0; step < 600; step++) {
    const ids = live();
    if (!ids.length || rand() < 0.08) {
      if (!repo.workouts.getDraft()) { const days = Math.floor(rand() * 40); const dt = new Date(2026, 9, 17 - days); const ds = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        const r = repo.workouts.createDraft({ date: ds }); repo.workouts.addExercises(r.data.id, [pick(ex), pick(ex)]); }
      continue;
    }
    const id = pick(ids), v = repo.workouts.getWorkout(id);
    const we = v.exercises.length ? pick(v.exercises) : null, set = we && we.sets.length ? pick(we.sets) : null;
    const op = Math.floor(rand() * 13);
    if (op === 0) repo.workouts.addExercises(id, [pick(ex)]);
    else if (op === 1 && we) { const r = repo.workouts.removeExercise(id, we.id); if (r.ok) undo.push(['e', id, r.data]); }
    else if (op === 2 && undo.length) { const [k, wid, data] = undo.pop(); k === 'e' ? repo.workouts.restoreExercise(wid, data) : repo.workouts.restoreSet(wid, data); }
    else if (op === 3 && v.exercises.length > 1) repo.workouts.moveExercise(id, we.id, Math.floor(rand() * v.exercises.length));
    else if (op === 4 && we) repo.workouts.addSet(id, we.id, rand() < 0.5 ? {} : { type: 'warmup' });
    else if (op === 5 && set) { const r = repo.workouts.deleteSet(id, set.id); if (r.ok) undo.push(['s', id, r.data]); }
    else if (op === 6 && set) repo.workouts.updateSet(id, set.id, { weightKg: Math.round(rand() * 2000) / 10, reps: Math.floor(rand() * 15) });
    else if (op === 7 && set) repo.workouts.setSetDone(id, set.id, rand() < 0.7);
    else if (op === 8 && set) repo.workouts.duplicateSet(id, set.id);
    else if (op === 9) repo.workouts.finalizeWorkout(id);
    else if (op === 10 && set) repo.workouts.updateSet(id, set.id, { type: set.type === 'warmup' ? 'normal' : 'warmup' });
    else if (op === 11 && rand() < 0.3) repo.workouts.deleteWorkout(id);
    else if (op === 12 && we) repo.workouts.replaceExercise(id, we.id, pick(ex));
    for (const wid of live()) { const errs = H.checkWorkout(wid); assert.deepStrictEqual(errs, [], `step ${step} op ${op} workout ${wid}`); }
    assert.ok((H.raw('fit_workouts') || []).filter(w => w.status === 'draft').length <= 1, '草稿多于 1 个');
  }
  // 存储里没有孤立的详情 key
  const ids = new Set(live());
  Object.keys(H.store.mem).filter(k => k.startsWith('fit_workout_')).forEach(k => assert.ok(ids.has(k.slice(12)), '孤立详情 ' + k));
});

test('R8 （损坏数据）详情里出现指向不存在动作的组：统计口径应与显示一致', () => {
  const { repo } = H.fresh();
  const id = seedWorkout(repo, { ids: ['0025'] }); repo.workouts.completeWorkout(id);
  const d = H.raw('fit_workout_' + id);
  d.sets.push({ id: 's_orphan', workoutExerciseId: 'we_missing', index: 1, weightKg: 100, reps: 10, type: 'normal', done: true, doneAt: 1 });
  H.store.mem['fit_workout_' + id] = JSON.stringify(d);
  const v = repo.workouts.getWorkout(id);
  const shownSets = v.exercises.reduce((t, e) => t + e.sets.filter(s => s.done && s.type === 'normal').length, 0);
  assert.strictEqual(v.setCount, shownSets, `summary 计入了不显示的孤立组：setCount=${v.setCount} 显示=${shownSets}`);
});
