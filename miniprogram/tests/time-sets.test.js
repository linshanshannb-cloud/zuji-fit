// 按时长计组（1.0.1）：模式默认值、时长校验、汇总/最佳/旧数据兼容、模式切换、自定义动作计组方式、格式化、提示音 helper。
const test = require('node:test'); const assert = require('node:assert');
const { fresh } = require('./helpers');
const K = require('../utils/repo/keys');
const F = require('../utils/format');
const E = require('../utils/exercises');
const M = require('../utils/repo/model');
const PLANK = '0463', BENCH = '0025';

function live(repo, ids) {
  repo.init();
  const w = repo.workouts.createDraft({ exerciseIds: ids }).data;
  return { w, v: repo.workouts.getWorkout(w.id) };
}

test('library defaults: isometric holds -> time, everything else -> reps; custom chooses', () => {
  ['0463', '0715', '1246', '2135', '3419'].forEach(id => assert.strictEqual(E.defaultMode(E.byId[id]), 'time', id));
  assert.strictEqual(E.defaultMode(E.byId[BENCH]), 'reps');
  assert.strictEqual(E.defaultMode(E.byId['1202']), 'reps');
  assert.strictEqual(E.defaultMode({ id: 'c_1', trackMode: 'time' }), 'time');
  assert.strictEqual(E.defaultMode({ id: 'c_2' }), 'reps');
  assert.strictEqual(E.defaultMode(null), 'reps');
});

test('new exercise gets its default mode; time set needs duration (not reps) to be done', () => {
  const { repo } = fresh();
  const { w, v } = live(repo, [PLANK, BENCH]);
  const [plank, bench] = v.exercises;
  assert.strictEqual(plank.mode, 'time'); assert.strictEqual(bench.mode, 'reps');
  assert.strictEqual(plank.sets[0].durationSec, null);
  const sid = plank.sets[0].id;
  assert.strictEqual(repo.workouts.setSetDone(w.id, sid, true).code, 'DURATION_REQUIRED');
  assert.strictEqual(repo.workouts.updateSet(w.id, sid, { reps: 10 }).ok, true); // reps alone does not count
  assert.strictEqual(repo.workouts.setSetDone(w.id, sid, true).code, 'DURATION_REQUIRED');
  assert.strictEqual(repo.workouts.updateSet(w.id, sid, { durationSec: '45.5' }).code, 'INVALID_DURATION');
  assert.strictEqual(repo.workouts.updateSet(w.id, sid, { durationSec: 3601 }).code, 'INVALID_DURATION');
  assert.strictEqual(repo.workouts.updateSet(w.id, sid, { durationSec: 'abc' }).code, 'INVALID_DURATION');
  assert.ok(repo.workouts.updateSet(w.id, sid, { durationSec: 60 }).ok);
  assert.ok(repo.workouts.setSetDone(w.id, sid, true).ok);
  // clearing the duration of a done set is refused
  assert.strictEqual(repo.workouts.updateSet(w.id, sid, { durationSec: null }).code, 'DURATION_REQUIRED');
  // reps mode still requires reps
  assert.strictEqual(repo.workouts.setSetDone(w.id, bench.sets[0].id, true).code, 'REPS_REQUIRED');
});

test('summary: timeSec from time sets; volume only from reps sets; warmup / undone ignored; weight optional', () => {
  const { repo } = fresh();
  const { w, v } = live(repo, [PLANK, BENCH]);
  const [plank, bench] = v.exercises;
  repo.workouts.updateSet(w.id, plank.sets[0].id, { durationSec: 60 }); repo.workouts.setSetDone(w.id, plank.sets[0].id, true);
  const s2 = repo.workouts.addSet(w.id, plank.id, { durationSec: 45, weightKg: 10 }).data; repo.workouts.setSetDone(w.id, s2.id, true);
  const s3 = repo.workouts.addSet(w.id, plank.id, { durationSec: 300, type: 'warmup' }).data; repo.workouts.setSetDone(w.id, s3.id, true);
  repo.workouts.addSet(w.id, plank.id, { durationSec: 200 }); // not done
  repo.workouts.updateSet(w.id, bench.sets[0].id, { reps: 5, weightKg: 100 }); repo.workouts.setSetDone(w.id, bench.sets[0].id, true);
  const got = repo.workouts.getWorkout(w.id);
  assert.strictEqual(got.timeSec, 105); assert.strictEqual(got.volumeKg, 500); assert.strictEqual(got.setCount, 3, 'warmup not counted');
  assert.ok(repo.workouts.finalizeWorkout(w.id).ok);
  const hdr = repo.workouts.listWorkouts()[0]; assert.strictEqual(hdr.timeSec, 105);
  const [sum] = repo.workouts.daySummaries(hdr.date);
  assert.strictEqual(sum.timeSec, 105);
  const top = sum.top.find(t => t.name.includes('平板'));
  assert.strictEqual(top.mode, 'time'); assert.strictEqual(top.best.durationSec, 60, 'longest hold wins; warmup ignored');
});

test('personal best is per mode and prefers the requested mode', () => {
  const { repo } = fresh();
  const { w, v } = live(repo, [PLANK]);
  const we = v.exercises[0];
  repo.workouts.updateSet(w.id, we.sets[0].id, { durationSec: 90, weightKg: 5 }); repo.workouts.setSetDone(w.id, we.sets[0].id, true);
  const s2 = repo.workouts.addSet(w.id, we.id, { durationSec: 90, weightKg: 10 }).data; repo.workouts.setSetDone(w.id, s2.id, true);
  repo.workouts.finalizeWorkout(w.id);
  const b = repo.workouts.personalBest(PLANK, 'time');
  assert.strictEqual(b.durationSec, 90); assert.strictEqual(b.weightKg, 10, 'tie on duration -> heavier'); assert.strictEqual(b.mode, 'time');
  assert.strictEqual(F.bestLabel(b), '10kg × 1分30秒');
  assert.strictEqual(repo.workouts.personalBest(PLANK, 'reps').durationSec, 90, 'falls back to the only mode with data');
  assert.strictEqual(repo.workouts.personalBest(BENCH, 'reps'), null);
});

test('switching mode: un-ticks done sets that have no value for the new mode, keeps the rest', () => {
  const { repo } = fresh();
  const { w, v } = live(repo, [BENCH]);
  const we = v.exercises[0];
  repo.workouts.updateSet(w.id, we.sets[0].id, { reps: 8, weightKg: 60 }); repo.workouts.setSetDone(w.id, we.sets[0].id, true);
  const s2 = repo.workouts.addSet(w.id, we.id, { reps: 8, durationSec: 30, weightKg: 60 }).data; repo.workouts.setSetDone(w.id, s2.id, true);
  const r = repo.workouts.setExerciseMode(w.id, we.id, 'time');
  assert.ok(r.ok); assert.deepStrictEqual(r.data, { mode: 'time', reset: 1 });
  let got = repo.workouts.getWorkout(w.id);
  assert.strictEqual(got.exercises[0].mode, 'time');
  assert.deepStrictEqual(got.exercises[0].sets.map(s => s.done), [false, true]);
  assert.strictEqual(got.timeSec, 30); assert.strictEqual(got.volumeKg, 0); assert.strictEqual(got.setCount, 1);
  assert.strictEqual(repo.workouts.setExerciseMode(w.id, we.id, 'bogus').code, 'INVALID_MODE');
  assert.deepStrictEqual(repo.workouts.setExerciseMode(w.id, we.id, 'time').data, { mode: 'time', reset: 0 });
  repo.workouts.setExerciseMode(w.id, we.id, 'reps'); // reps 8 still there for set 2, set 1 was un-ticked earlier
  got = repo.workouts.getWorkout(w.id);
  assert.strictEqual(got.exercises[0].mode, 'reps'); assert.strictEqual(got.volumeKg, 480);
});

test('replace exercise adopts the new exercise default mode; duplicate/add copy duration', () => {
  const { repo } = fresh();
  const { w, v } = live(repo, [BENCH]);
  const we = v.exercises[0];
  assert.ok(repo.workouts.replaceExercise(w.id, we.id, PLANK).ok);
  const got = repo.workouts.getWorkout(w.id).exercises[0];
  assert.strictEqual(got.mode, 'time');
  repo.workouts.updateSet(w.id, got.sets[0].id, { durationSec: 40 });
  const d = repo.workouts.duplicateSet(w.id, got.sets[0].id).data; assert.strictEqual(d.durationSec, 40);
  const a = repo.workouts.addSet(w.id, got.id, {}).data; assert.strictEqual(a.durationSec, 40, 'new set copies the last set duration');
});

test('old data (no mode / durationSec) behaves as reps mode and heals headers without timeSec', () => {
  const { repo, be } = fresh();
  const { w, v } = live(repo, [BENCH]);
  const we = v.exercises[0];
  repo.workouts.updateSet(w.id, we.sets[0].id, { reps: 10, weightKg: 50 }); repo.workouts.setSetDone(w.id, we.sets[0].id, true);
  repo.workouts.finalizeWorkout(w.id);
  // strip the new fields to mimic a 1.0.0 record
  const key = K.workoutDetail(w.id), d = JSON.parse(JSON.stringify(be.data[key]));
  d.exercises.forEach(e => { delete e.mode; }); d.sets.forEach(s => { delete s.durationSec; });
  be.data[key] = d;
  be.data[K.WORKOUTS] = be.data[K.WORKOUTS].map(h => { const c = Object.assign({}, h); delete c.timeSec; return c; });
  assert.strictEqual(M.modeOf(d.exercises[0]), 'reps');
  assert.strictEqual(repo.workouts.healHeaders(), false, 'missing timeSec on a reps-only workout is not a change');
  const got = repo.workouts.getWorkout(w.id);
  assert.strictEqual(got.volumeKg, 500); assert.strictEqual(got.timeSec, 0);
  assert.deepStrictEqual(repo.workouts.daySummaries(got.date)[0].top[0].best, { weightKg: 50, reps: 10 });
  assert.deepStrictEqual(repo.workouts.personalBest(BENCH), Object.assign({ date: got.date, workoutId: w.id }, { weightKg: 50, reps: 10 }));
  // editing an old set still works and does not need durationSec
  assert.ok(repo.workouts.updateSet(w.id, we.sets[0].id, { reps: 12 }).ok);
});

test('custom exercise: trackMode chosen at creation, persisted, editable, defaults to reps', () => {
  const { repo } = fresh(); repo.init();
  const a = repo.exercises.addCustom({ nameZh: '靠墙静蹲', bodyPart: 'legs', trackMode: 'time' }).data;
  const b = repo.exercises.addCustom({ nameZh: '自定义推', bodyPart: 'chest' }).data;
  assert.strictEqual(a.trackMode, 'time'); assert.strictEqual(b.trackMode, 'reps');
  assert.strictEqual(repo.exercises.updateCustom(b.id, { trackMode: 'time' }).data.trackMode, 'time');
  assert.strictEqual(repo.exercises.updateCustom(a.id, { nameZh: '靠墙静蹲2' }).data.trackMode, 'time', 'patch without trackMode keeps it');
  const w = repo.workouts.createDraft({ exerciseIds: [a.id] }).data;
  assert.strictEqual(repo.workouts.getWorkout(w.id).exercises[0].mode, 'time');
});

test('format.dur / bestLabel', () => {
  assert.strictEqual(F.dur(0), '0秒'); assert.strictEqual(F.dur(45), '45秒'); assert.strictEqual(F.dur(60), '1分钟');
  assert.strictEqual(F.dur(90), '1分30秒'); assert.strictEqual(F.dur(3600), '60分钟');
  assert.strictEqual(F.bestLabel({ weightKg: 0, durationSec: 45, mode: 'time' }), '45秒');
  assert.strictEqual(F.bestLabel({ weightKg: 60, reps: 10 }), '60kg×10');
  assert.strictEqual(F.bestLabel(null), '');
});

test('beep helper: configures mute switch, plays once, destroys context; respects the sound pref; never throws without wx', () => {
  const { repo } = fresh(); repo.init();
  const beep = require('../utils/beep');
  assert.strictEqual(beep.play(), false, 'no wx (unit test env) -> quietly false');
  const calls = { opt: null, ctx: [], vib: 0 };
  global.wx = {
    setInnerAudioOption: o => { calls.opt = o; },
    vibrateLong: () => { calls.vib++; },
    createInnerAudioContext: () => { const c = { played: false, destroyed: false, onEnded(f) { c.end = f; }, onError() {}, onStop() {}, play() { c.played = true; }, destroy() { c.destroyed = true; } }; calls.ctx.push(c); return c; },
  };
  try {
    assert.strictEqual(beep.enabled(), true, 'default on');
    beep.alertDone();
    assert.deepStrictEqual(calls.opt, { obeyMuteSwitch: false, mixWithOther: true });
    assert.strictEqual(calls.ctx.length, 1); assert.ok(calls.ctx[0].played); assert.strictEqual(calls.ctx[0].obeyMuteSwitch, false);
    assert.strictEqual(calls.ctx[0].src, beep.SRC); assert.strictEqual(calls.vib, 1);
    calls.ctx[0].end(); assert.ok(calls.ctx[0].destroyed);
    beep.setEnabled(false); beep.alertDone();
    assert.strictEqual(calls.ctx.length, 1, 'muted by pref: no new audio'); assert.strictEqual(calls.vib, 2, 'still vibrates');
    const fs = require('fs'), path = require('path');
    // SRC is the package path WeChat plays (/assets/...). The size check is the file under miniprogram/.
    const f = path.join(__dirname, '..', String(beep.SRC).replace(/^\//, '')); assert.ok(fs.statSync(f).size < 20 * 1024, 'audio file < 20KB');
  } finally { delete global.wx; }
});
