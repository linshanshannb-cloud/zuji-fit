// 非法输入：负数、空、NaN、Infinity、超大值、字符串、布尔、数组、科学计数/十六进制、文本超长、非法日期
const test = require('node:test');
const assert = require('node:assert');
const H = require('./_harness');

function setup() {
  const { repo } = H.fresh();
  const r = repo.workouts.createDraft({}); repo.workouts.addExercises(r.data.id, ['0025']);
  const s = repo.workouts.getWorkout(r.data.id).exercises[0].sets[0];
  return { repo, wid: r.data.id, sid: s.id };
}

test('I1 组重量：明确非法值全部拒绝，且不改存储', () => {
  const { repo, wid, sid } = setup();
  for (const v of [-1, -0.1, NaN, Infinity, -Infinity, 1000, 999.95, 'abc', '12abc', '5kg', {}, '1e4']) {
    const snap = H.snapshot();
    const r = repo.workouts.updateSet(wid, sid, { weightKg: v });
    assert.strictEqual(r.ok, false, `weightKg=${String(v)} 应被拒绝，实际 ${JSON.stringify(r)}`);
    assert.strictEqual(r.code, 'INVALID_WEIGHT');
    assert.deepStrictEqual(H.snapshot(), snap);
  }
});
test('I2 组重量：合法边界 0 / 999.9 / 空 → null / 1 位小数四舍五入', () => {
  const { repo, wid, sid } = setup();
  const val = v => repo.workouts.updateSet(wid, sid, { weightKg: v }).data.weightKg;
  assert.strictEqual(val(0), 0); assert.strictEqual(val(999.9), 999.9);
  assert.strictEqual(val(''), null); assert.strictEqual(val('  '), null); assert.strictEqual(val(' 62.55 '), 62.6);
});
test('I3 组重量/次数：非"数字+小数点"格式应拒绝（PRODUCT_SPEC 3.3 "只接受数字和一个小数点"）', () => {
  const { repo, wid, sid } = setup();
  const accepted = [];
  for (const v of [true, false, [], [5], '0x1A', '1e2', '５０']) {
    const r = repo.workouts.updateSet(wid, sid, { weightKg: v });
    if (r.ok) accepted.push(`${JSON.stringify(v)}→${r.data.weightKg}`);
  }
  for (const v of [true, [3], '0x3', '1e1']) {
    const r = repo.workouts.updateSet(wid, sid, { reps: v });
    if (r.ok) accepted.push(`reps ${JSON.stringify(v)}→${r.data.reps}`);
  }
  assert.deepStrictEqual(accepted, [], '仓储层接受了：' + accepted.join('，'));
});
test('I4 次数：负数/小数/超大/字符串拒绝；已勾选的组不能把次数改成 0 或空', () => {
  const { repo, wid, sid } = setup();
  for (const v of [-1, 1.5, 1000, 'x', NaN]) assert.strictEqual(repo.workouts.updateSet(wid, sid, { reps: v }).code, 'INVALID_REPS', String(v));
  assert.strictEqual(repo.workouts.setSetDone(wid, sid, true).code, 'REPS_REQUIRED');
  repo.workouts.updateSet(wid, sid, { reps: 0 }); assert.strictEqual(repo.workouts.setSetDone(wid, sid, true).code, 'REPS_REQUIRED');
  repo.workouts.updateSet(wid, sid, { reps: 1 }); assert.ok(repo.workouts.setSetDone(wid, sid, true).ok);
  assert.strictEqual(repo.workouts.updateSet(wid, sid, { reps: 0 }).code, 'REPS_REQUIRED');
  assert.strictEqual(repo.workouts.updateSet(wid, sid, { reps: '' }).code, 'REPS_REQUIRED');
  assert.strictEqual(repo.workouts.updateSet(wid, sid, { type: 'dropset' }).code, 'INVALID_TYPE');
});
test('I5 超大值：999.9kg × 999 次 × 200 组容量不溢出、保留 1 位小数', () => {
  const { repo, wid, sid } = setup();
  const we = repo.workouts.getWorkout(wid).exercises[0];
  repo.workouts.updateSet(wid, sid, { weightKg: 999.9, reps: 999 }); repo.workouts.setSetDone(wid, sid, true);
  for (let i = 0; i < 199; i++) repo.workouts.addSet(wid, we.id, { done: true });
  const h = repo.workouts.getHeader(wid);
  assert.strictEqual(h.setCount, 200); assert.strictEqual(h.volumeKg, Math.round(999.9 * 999 * 200 * 10) / 10);
  assert.ok(JSON.stringify(H.raw('fit_workout_' + wid)).length < 1024 * 1024, '单 key < 1MB');
});
test('I6 文本：名称 30 / 备注 500 / 动作备注 200 边界，trim 后计算', () => {
  const { repo, wid } = setup();
  const we = repo.workouts.getWorkout(wid).exercises[0];
  assert.ok(repo.workouts.updateWorkout(wid, { name: '  ' + 'a'.repeat(30) + '  ' }).ok);
  assert.strictEqual(repo.workouts.updateWorkout(wid, { name: 'a'.repeat(31) }).code, 'TEXT_TOO_LONG');
  assert.strictEqual(repo.workouts.updateWorkout(wid, { note: 'a'.repeat(501) }).code, 'TEXT_TOO_LONG');
  assert.strictEqual(repo.workouts.updateExerciseNote(wid, we.id, 'a'.repeat(201)).code, 'TEXT_TOO_LONG');
  assert.ok(repo.workouts.updateWorkout(wid, { name: null }).ok);
  assert.strictEqual(repo.workouts.getHeader(wid).name, '');
});
test('I7 日期：非法格式 / 不存在的日期 / 未来日期 全部拒绝；闰日 2024-02-29 接受', () => {
  const { repo } = H.fresh();
  for (const d of ['2026-02-29', '2026-13-01', '2026-1-1', '2026-10-32', ' 2026-10-01', '2026/10/01', 20261001, '2100-02-29', '0000-01-01']) {
    assert.strictEqual(repo.body.saveBody({ date: d, weightKg: 70 }).code, 'INVALID_DATE', String(d));
    assert.strictEqual(repo.workouts.createDraft({ date: d }).code, 'INVALID_DATE', String(d));
  }
  assert.strictEqual(repo.body.saveBody({ date: '2026-10-18', weightKg: 70 }).code, 'FUTURE_DATE');
  assert.strictEqual(repo.workouts.createDraft({ date: '2026-10-18' }).code, 'FUTURE_DATE');
  assert.ok(repo.body.saveBody({ date: '2024-02-29', weightKg: 70 }).ok);
  assert.ok(repo.workouts.createDraft({ date: '2024-02-29' }).ok);
});
test('I8 身体数据：体重必填、0/负数/>700/字符串报错（不静默置空）；体脂 >100、腰围 >300 报错；边界接受', () => {
  const { repo } = H.fresh();
  assert.strictEqual(repo.body.saveBody({ weightKg: '' }).code, 'WEIGHT_REQUIRED');
  assert.strictEqual(repo.body.saveBody({ bodyFatPct: 20 }).code, 'WEIGHT_REQUIRED');
  for (const v of [0, -5, 700.1, '70kg', NaN, Infinity]) assert.strictEqual(repo.body.saveBody({ weightKg: v }).code, 'INVALID_BODY_WEIGHT', String(v));
  assert.strictEqual(repo.body.saveBody({ weightKg: 70, bodyFatPct: 100.1 }).code, 'INVALID_BODY_FAT');
  assert.strictEqual(repo.body.saveBody({ weightKg: 70, bodyFatPct: 0 }).code, 'INVALID_BODY_FAT');
  assert.strictEqual(repo.body.saveBody({ weightKg: 70, waistCm: 300.1 }).code, 'INVALID_WAIST');
  assert.strictEqual(repo.body.listBody().length, 0, '失败的保存不应落盘');
  const ok = repo.body.saveBody({ weightKg: 700, bodyFatPct: 100, waistCm: 300 }); assert.ok(ok.ok);
  // 合并时非法值是错误，不能覆盖旧值
  assert.strictEqual(repo.body.saveBody({ weightKg: 'abc' }).code, 'INVALID_BODY_WEIGHT');
  assert.strictEqual(repo.body.listBody()[0].weightKg, 700);
  assert.strictEqual(repo.body.saveBody({ weightKg: 70, note: 'a'.repeat(201) }).code, 'TEXT_TOO_LONG');
});
test('I9 未知身体字段名：bodySeries 抛错（API 文档说明的唯一例外），其他查询对垃圾参数不抛', () => {
  const { repo } = H.fresh();
  assert.throws(() => repo.body.bodySeries('chestCm', 30));
  assert.doesNotThrow(() => { repo.workouts.getWorkout(undefined); repo.workouts.workoutsOn('garbage'); repo.exercises.filter({ q: null }); repo.exercises.get(undefined); repo.workouts.personalBest(null); });
  assert.strictEqual(repo.exercises.filter({ q: '   ' }).length, repo.exercises.all().length);
});
