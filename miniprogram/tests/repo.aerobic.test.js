// 有氧 MVP：类型/时长/kcal、日历标签、同日并列
const test = require('node:test'); const assert = require('node:assert');
const { fresh } = require('./helpers');
const DM = require('../utils/daymark');
const T = require('../utils/aerobic-types');

test('estimateKcal: elliptical 30min -> 225', () => {
  assert.strictEqual(T.estimateKcal('elliptical', 30), 225);
  assert.strictEqual(T.estimateKcal('treadmill_incline', 40), 333);
});

test('aerobic create/update/remove + future rejected + custom name required', () => {
  const { repo, be } = fresh(); repo.init();
  assert.strictEqual(repo.aerobic.create({ date: '2026-10-20', activityType: 'run', durationMin: 30, estimatedKcal: 300 }).code, 'FUTURE_DATE');
  const r = repo.aerobic.create({
    date: '2026-10-15', activityType: 'elliptical', durationMin: 30,
    estimatedKcal: 225, kcalSource: 'reference',
  });
  assert.ok(r.ok, r.message); assert.ok(r.data.id.startsWith('a_'));
  assert.strictEqual(r.data.activityName, '椭圆仪');
  assert.ok(Array.isArray(be.data.fit_aerobics) && be.data.fit_aerobics.length === 1);

  assert.strictEqual(repo.aerobic.create({
    date: '2026-10-15', activityType: 'custom', activityName: '', durationMin: 20, estimatedKcal: 100,
  }).code, 'NAME_REQUIRED');

  const c = repo.aerobic.create({
    date: '2026-10-15', activityType: 'custom', activityName: '战绳', durationMin: 20,
    estimatedKcal: 260, kcalSource: 'user_override',
  });
  assert.ok(c.ok); assert.strictEqual(c.data.activityName, '战绳');

  const u = repo.aerobic.update(r.data.id, { durationMin: 40, estimatedKcal: 300, kcalSource: 'user_override' });
  assert.ok(u.ok); assert.strictEqual(u.data.durationMin, 40);

  const cards = repo.aerobic.daySummaries('2026-10-15');
  assert.strictEqual(cards.length, 2);

  assert.ok(repo.aerobic.remove(r.data.id).ok);
  assert.strictEqual(repo.aerobic.get(r.data.id), null);
  assert.strictEqual(repo.aerobic.daySummaries('2026-10-15').length, 1);
});

test('buildInfo: strength + aerobic tags coexist; no rest when training', () => {
  const { repo } = fresh(); repo.init();
  const w = repo.workouts.createDraft({ date: '2026-10-15', exerciseIds: ['0025'] }).data;
  const v = repo.workouts.getWorkout(w.id);
  const bench = v.exercises[0];
  repo.workouts.updateSet(w.id, bench.sets[0].id, { weightKg: 60, reps: 10 });
  repo.workouts.setSetDone(w.id, bench.sets[0].id, true);
  assert.ok(repo.workouts.finalizeWorkout(w.id).ok);
  assert.ok(repo.aerobic.create({
    date: '2026-10-15', activityType: 'stair_climber', durationMin: 20, estimatedKcal: 183,
  }).ok);
  assert.ok(repo.restDays.mark('2026-10-15').ok);
  const info = DM.buildInfo(repo, '2026-10-01', '2026-10-31');
  assert.ok(info['2026-10-15'].tags.some(t => t.kind === 'part'));
  assert.ok(info['2026-10-15'].tags.some(t => t.kind === 'aero' && t.text.includes('爬楼')));
  assert.ok(!info['2026-10-15'].rest);
});

test('read-only blocks aerobic write', () => {
  const { repo } = fresh(); repo.init();
  require('../utils/storage').setReadOnly(true);
  assert.strictEqual(repo.aerobic.create({
    date: '2026-10-15', activityType: 'walk', durationMin: 30, estimatedKcal: 125,
  }).code, 'READ_ONLY');
});
