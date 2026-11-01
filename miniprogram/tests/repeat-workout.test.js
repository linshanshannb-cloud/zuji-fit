// 从历史力量训练再练一次：带上组结构和重量，清空完成，源记录不变。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { fresh } = require('./helpers');
const D = require('../utils/date');
const K = require('../utils/repo/keys');
const S = require('../utils/storage');
const BENCH = '0025';
const PLANK = '0463';
const OTHER = '0294';

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function detailOf(be, id) { return clone(be.data[K.workoutDetail(id)]); }
function headerOf(be, id) { return clone((be.data[K.WORKOUTS] || []).find(w => w.id === id)); }

function doneWorkout(repo, { date, name = '背', note = '', exerciseIds = [BENCH], fill } = {}) {
  const w = repo.workouts.createDraft({ date, name, note, exerciseIds }).data;
  const v = repo.workouts.getWorkout(w.id);
  if (fill) fill(repo, w.id, v);
  else {
    v.exercises.forEach(e => {
      const s = e.sets[0];
      if (e.mode === 'time') repo.workouts.updateSet(w.id, s.id, { durationSec: 20 });
      else repo.workouts.updateSet(w.id, s.id, { weightKg: 40, reps: 5 });
      const done = repo.workouts.setSetDone(w.id, s.id, true);
      assert.ok(done.ok, done.message);
    });
  }
  const fin = repo.workouts.finalizeWorkout(w.id);
  assert.ok(fin.ok, fin.message);
  return w.id;
}

function setsOf(ex) {
  return ex.sets.map(s => ({
    weightKg: s.weightKg, reps: s.reps, durationSec: s.durationSec, type: s.type,
    done: s.done, doneAt: s.doneAt, restSec: Object.prototype.hasOwnProperty.call(s, 'restSec') ? s.restSec : undefined,
    timer: s.timer,
  }));
}

test('复制字段齐全：顺序、模式、重量、次数或时长、组类型、组间歇；完成和计时清空；备注不带', () => {
  const { repo, be } = fresh();
  repo.init();
  const src = doneWorkout(repo, {
    date: '2026-10-10', name: '背', note: '肩胛收紧', exerciseIds: [BENCH, PLANK, BENCH],
    fill(repo2, id, v) {
      const [a, plank, b] = v.exercises;
      assert.ok(repo2.workouts.updateExerciseNote(id, a.id, '握距宽').ok);
      assert.ok(repo2.workouts.updateSet(id, a.sets[0].id, { weightKg: 20, reps: 12, type: 'warmup' }).ok);
      assert.ok(repo2.workouts.setSetDone(id, a.sets[0].id, true).ok);
      const a2 = repo2.workouts.addSet(id, a.id, { weightKg: 62.5, reps: 8, type: 'normal' });
      assert.ok(a2.ok, a2.message);
      assert.ok(repo2.workouts.setSetDone(id, a2.data.id, true).ok);
      const a3 = repo2.workouts.addSet(id, a.id, { weightKg: 0, reps: 6 });
      assert.ok(a3.ok, a3.message);
      assert.ok(repo2.workouts.setSetDone(id, a3.data.id, true).ok);
      assert.ok(repo2.workouts.setExerciseMode(id, plank.id, 'reps').ok);
      const plankSet = repo2.workouts.getWorkout(id).exercises.find(e => e.id === plank.id).sets[0];
      assert.ok(repo2.workouts.updateSet(id, plankSet.id, { weightKg: null, reps: 15, durationSec: 45 }).ok);
      assert.ok(repo2.workouts.setSetDone(id, plankSet.id, true).ok);
      assert.ok(repo2.workouts.setExerciseMode(id, b.id, 'time').ok);
      const bSet = repo2.workouts.getWorkout(id).exercises.find(e => e.id === b.id).sets[0];
      assert.ok(repo2.workouts.updateSet(id, bSet.id, { weightKg: 10, durationSec: 30, reps: null }).ok);
      assert.ok(repo2.workouts.setSetDone(id, bSet.id, true).ok);
    },
  });
  const raw = be.data[K.workoutDetail(src)];
  raw.sets.find(s => s.reps === 8).restSec = 75;
  raw.sets.find(s => s.durationSec === 30).timer = { endAt: 123, total: 30 };
  repo.rest.setFor(BENCH, 120);
  const restBefore = repo.rest.getOverride(BENCH);
  const srcDetail = detailOf(be, src);
  const srcHeader = headerOf(be, src);
  const localDay = D.fmt(new Date(2026, 9, 17, 10, 0, 0));

  const r = repo.workouts.repeatFrom(src);
  assert.deepStrictEqual([r.ok, r.data.mode, r.data.added], [true, 'create', 3], r.message);
  const copy = repo.workouts.getWorkout(r.data.workoutId);
  assert.strictEqual(copy.date, localDay, '目标日是本地日历今天，而不是 UTC 日期字符串');
  assert.strictEqual(copy.status, 'draft');
  assert.strictEqual(copy.name, '再练：背');
  assert.strictEqual(copy.note, '');
  assert.strictEqual(copy.completedAt, null);
  assert.strictEqual(typeof copy.startedAt, 'number');
  assert.deepStrictEqual(copy.exercises.map(e => e.exerciseId), [BENCH, PLANK, BENCH]);
  assert.deepStrictEqual(copy.exercises.map(e => e.mode), ['reps', 'reps', 'time']);
  assert.ok(copy.exercises.every(e => e.note === ''));
  assert.deepStrictEqual(setsOf(copy.exercises[0]), [
    { weightKg: 20, reps: 12, durationSec: null, type: 'warmup', done: false, doneAt: null, restSec: undefined, timer: undefined },
    { weightKg: 62.5, reps: 8, durationSec: null, type: 'normal', done: false, doneAt: null, restSec: 75, timer: undefined },
    { weightKg: 0, reps: 6, durationSec: null, type: 'normal', done: false, doneAt: null, restSec: undefined, timer: undefined },
  ]);
  assert.deepStrictEqual(setsOf(copy.exercises[1]), [
    { weightKg: null, reps: 15, durationSec: 45, type: 'normal', done: false, doneAt: null, restSec: undefined, timer: undefined },
  ]);
  assert.deepStrictEqual(setsOf(copy.exercises[2]), [
    { weightKg: 10, reps: null, durationSec: 30, type: 'normal', done: false, doneAt: null, restSec: undefined, timer: undefined },
  ]);
  const srcIds = new Set(srcDetail.sets.map(s => s.id).concat(srcDetail.exercises.map(e => e.id)));
  copy.exercises.forEach(e => {
    assert.ok(!srcIds.has(e.id));
    e.sets.forEach(s => assert.ok(!srcIds.has(s.id)));
  });
  assert.strictEqual(copy.exerciseCount, 3);
  assert.strictEqual(copy.setCount, 0, '未完成的组不计入组数');
  assert.strictEqual(copy.volumeKg, 0);
  assert.deepStrictEqual(detailOf(be, src), srcDetail);
  assert.deepStrictEqual(headerOf(be, src), srcHeader);
  assert.strictEqual(repo.workouts.getWorkout(src).exercises[0].note, '握距宽');
  assert.strictEqual(repo.workouts.getWorkout(src).exercises[0].sets[1].done, true);
  assert.strictEqual(repo.rest.getOverride(BENCH), restBefore, '组间歇偏好不因再练改写');
  assert.strictEqual(be.data[K.AEROBICS], undefined);
  assert.strictEqual(be.data[K.DIET_PLAN], undefined);
  assert.strictEqual(be.data[K.TEMPLATES], undefined);
});

test('训练名为空时用源日期；超长名称截到 30 字', () => {
  const { repo } = fresh();
  repo.init();
  const blank = doneWorkout(repo, { date: '2026-10-10', name: '' });
  const named = repo.workouts.repeatFrom(blank);
  assert.strictEqual(repo.workouts.getWorkout(named.data.workoutId).name, '再练：10月10日训练');
  repo.workouts.discardDraft();
  const id = doneWorkout(repo, { date: '2026-10-09', name: '甲'.repeat(30) });
  const r = repo.workouts.repeatFrom(id);
  const name = repo.workouts.getWorkout(r.data.workoutId).name;
  assert.strictEqual(name, ('再练：' + '甲'.repeat(30)).slice(0, 30));
  assert.strictEqual(name.length, 30);
});

test('今天没有力量训练就新建草稿；有氧不算力量训练', () => {
  const { repo, be } = fresh();
  repo.init();
  const aero = repo.aerobic.create({
    date: '2026-10-17', activityType: 'run', durationMin: 20, estimatedKcal: 160, note: '慢跑',
  });
  assert.ok(aero.ok, aero.message);
  const aeroBefore = clone(be.data[K.AEROBICS]);
  const missed = repo.workouts.repeatFrom(aero.data.id);
  assert.strictEqual(missed.code, 'NOT_FOUND');
  assert.deepStrictEqual(be.data[K.AEROBICS], aeroBefore);
  assert.strictEqual(be.data[K.WORKOUTS], undefined);
  const src = doneWorkout(repo, { date: '2026-10-10', name: '背' });
  const r = repo.workouts.repeatFrom(src);
  assert.strictEqual(r.data.mode, 'create');
  assert.strictEqual(repo.workouts.getWorkout(r.data.workoutId).date, '2026-10-17');
  assert.strictEqual(repo.workouts.getDraft().id, r.data.workoutId);
  assert.deepStrictEqual(be.data[K.AEROBICS], aeroBefore);
  const detailWxml = fs.readFileSync(path.join(__dirname, '../pages/workout-detail/workout-detail.wxml'), 'utf8');
  const aeroWxml = fs.readFileSync(path.join(__dirname, '../pages/aerobic-detail/aerobic-detail.wxml'), 'utf8');
  assert.ok(detailWxml.includes('再练一次'));
  assert.ok(!aeroWxml.includes('再练一次'));
});

test('今天已有力量训练则追加：不改名、不覆盖原组、同名动作不合并', () => {
  const { repo, be } = fresh();
  repo.init();
  const src = doneWorkout(repo, { date: '2026-10-10', name: '背', note: '源备注' });
  const today = doneWorkout(repo, { date: '2026-10-01', name: '今天补录', note: '留着' });
  assert.ok(repo.workouts.updateWorkout(today, { date: '2026-10-17' }).ok);
  const host = repo.workouts.getHeader(today);
  assert.strictEqual(host.startedAt, null, '补录训练没有开始计时');
  const srcDetail = detailOf(be, src);
  const srcHeader = headerOf(be, src);
  const before = repo.workouts.getWorkout(today);
  const r = repo.workouts.repeatFrom(src);
  assert.deepStrictEqual([r.ok, r.data.mode, r.data.workoutId, r.data.added], [true, 'append', today, 1]);
  const after = repo.workouts.getWorkout(today);
  assert.strictEqual(after.name, '今天补录');
  assert.strictEqual(after.note, '留着');
  assert.strictEqual(after.status, 'completed');
  assert.strictEqual(after.exercises.length, 2, '同名动作追加成新的一项，不把组合并进去');
  assert.strictEqual(after.exercises[0].id, before.exercises[0].id);
  assert.strictEqual(after.exercises[0].sets.length, 1);
  assert.deepStrictEqual([after.exercises[0].sets[0].weightKg, after.exercises[0].sets[0].done], [40, true]);
  assert.strictEqual(after.exercises[1].exerciseId, BENCH);
  assert.deepStrictEqual([after.exercises[1].sets[0].weightKg, after.exercises[1].sets[0].reps, after.exercises[1].sets[0].done, after.exercises[1].sets[0].doneAt], [40, 5, false, null]);
  assert.notStrictEqual(after.exercises[1].sets[0].id, before.exercises[0].sets[0].id);
  assert.deepStrictEqual(detailOf(be, src), srcDetail);
  assert.deepStrictEqual(headerOf(be, src), srcHeader);
  const again = repo.workouts.repeatFrom(src);
  assert.strictEqual(again.data.mode, 'append');
  assert.strictEqual(repo.workouts.getWorkout(today).exercises.length, 3);
  assert.deepStrictEqual(detailOf(be, src), srcDetail);
});

test('今天同时有已完成和草稿时追加到草稿；多条已完成则追加到最近一条', () => {
  const { repo } = fresh();
  repo.init();
  const src = doneWorkout(repo, { date: '2026-10-10' });
  const older = doneWorkout(repo, { date: '2026-10-17', name: '较早' });
  const newer = doneWorkout(repo, { date: '2026-10-17', name: '较近' });
  const picked = repo.workouts.repeatFrom(src);
  assert.strictEqual(picked.data.workoutId, newer);
  assert.strictEqual(repo.workouts.getWorkout(older).exercises.length, 1);
  assert.strictEqual(repo.workouts.getWorkout(newer).exercises.length, 2);
  repo.workouts.deleteWorkout(newer);
  const draft = repo.workouts.createDraft({ date: '2026-10-17', name: '进行中', exerciseIds: [OTHER] }).data;
  const ontoDraft = repo.workouts.repeatFrom(src);
  assert.deepStrictEqual([ontoDraft.data.mode, ontoDraft.data.workoutId], ['append', draft.id]);
  const view = repo.workouts.getWorkout(draft.id);
  assert.strictEqual(view.name, '进行中');
  assert.deepStrictEqual(view.exercises.map(e => e.exerciseId), [OTHER, BENCH]);
  assert.strictEqual(view.exercises[1].sets[0].done, false);
  assert.strictEqual(repo.workouts.getWorkout(older).exercises.length, 1);
});

test('另一天的草稿不会挡住追加；今天没有训练时则先返回草稿冲突', () => {
  const { repo, be } = fresh();
  repo.init();
  const src = doneWorkout(repo, { date: '2026-10-10', note: '源' });
  const today = doneWorkout(repo, { date: '2026-10-17', name: '今天' });
  const draft = repo.workouts.createDraft({ date: '2026-10-16', name: '昨天没练完', exerciseIds: [OTHER] }).data;
  const appended = repo.workouts.repeatFrom(src);
  assert.strictEqual(appended.data.workoutId, today);
  assert.strictEqual(repo.workouts.getWorkout(draft.id).exercises.map(e => e.exerciseId).join(), OTHER);
  repo.workouts.deleteWorkout(today);
  const srcDetail = detailOf(be, src);
  const blocked = repo.workouts.repeatFrom(src);
  assert.strictEqual(blocked.code, 'DRAFT_EXISTS');
  assert.strictEqual(blocked.data.id, draft.id);
  assert.strictEqual(repo.workouts.getDraft().id, draft.id);
  assert.strictEqual(repo.workouts.getWorkout(draft.id).exercises.length, 1);
  assert.deepStrictEqual(detailOf(be, src), srcDetail);
  assert.strictEqual(repo.workouts.listWorkouts({ status: 'completed' }).length, 1);
});

test('未落库的今天草稿会接上复制内容；未落库的其他日期草稿不会被静默丢掉', () => {
  const { repo } = fresh();
  repo.init();
  const src = doneWorkout(repo, { date: '2026-10-10' });
  const pending = repo.workouts.createDraft({ date: '2026-10-17', name: '今早' }).data;
  assert.strictEqual(pending.persisted, false);
  const r = repo.workouts.repeatFrom(src);
  assert.deepStrictEqual([r.data.mode, r.data.workoutId], ['append', pending.id]);
  const view = repo.workouts.getWorkout(pending.id);
  assert.strictEqual(view.name, '今早');
  assert.strictEqual(view.note, '');
  assert.strictEqual(view.exercises.length, 1);
  assert.strictEqual(view.exercises[0].sets[0].done, false);
  assert.strictEqual(repo.workouts.getPending(), null);
  repo.workouts.deleteWorkout(pending.id);
  const other = repo.workouts.createDraft({ date: '2026-10-16', name: '还开着' }).data;
  const blocked = repo.workouts.repeatFrom(src);
  assert.strictEqual(blocked.code, 'DRAFT_EXISTS');
  assert.strictEqual(blocked.data.id, other.id);
  assert.strictEqual(repo.workouts.getPending().id, other.id);
  assert.strictEqual(repo.workouts.listWorkouts({ status: 'draft' }).length, 0);
});

test('详情丢失或损坏、没有动作、动作不可用时整单失败，不写新训练', () => {
  const { repo, be } = fresh();
  repo.init();
  const missingId = doneWorkout(repo, { date: '2026-10-10' });
  const missingKey = K.workoutDetail(missingId);
  const headers = clone(be.data[K.WORKOUTS]);
  delete be.data[missingKey];
  const missing = repo.workouts.repeatFrom(missingId);
  assert.strictEqual(missing.code, 'DETAIL_MISSING');
  assert.match(missing.message, /不能再练/);
  assert.strictEqual(be.data[missingKey], undefined);
  assert.deepStrictEqual(be.data[K.WORKOUTS], headers);

  const corruptId = doneWorkout(repo, { date: '2026-10-09' });
  const corruptKey = K.workoutDetail(corruptId);
  be.data[corruptKey].exercises.push(null);
  const corruptRaw = clone(be.data[corruptKey]);
  const corruptHeaders = clone(be.data[K.WORKOUTS]);
  const corrupt = repo.workouts.repeatFrom(corruptId);
  assert.strictEqual(corrupt.code, 'DATA_CORRUPT');
  assert.match(corrupt.message, /不能再练/);
  assert.deepStrictEqual(be.data[corruptKey], corruptRaw);
  assert.deepStrictEqual(be.data[K.WORKOUTS], corruptHeaders);

  const empty = repo.workouts.createDraft({ date: '2026-10-08', exerciseIds: [BENCH] }).data;
  const weId = repo.workouts.getWorkout(empty.id).exercises[0].id;
  assert.ok(repo.workouts.removeExercise(empty.id, weId).ok);
  const emptyRes = repo.workouts.repeatFrom(empty.id);
  assert.strictEqual(emptyRes.code, 'EMPTY_WORKOUT');
  assert.strictEqual(repo.workouts.getWorkout(empty.id).exercises.length, 0);
  assert.ok(repo.workouts.discardDraft().ok);

  const unknownId = doneWorkout(repo, { date: '2026-10-07' });
  const unknownKey = K.workoutDetail(unknownId);
  be.data[unknownKey].exercises[0].exerciseId = 'no-such';
  const unknownRaw = clone(be.data[unknownKey]);
  const unknownHeaders = clone(be.data[K.WORKOUTS]);
  const unknown = repo.workouts.repeatFrom(unknownId);
  assert.strictEqual(unknown.code, 'UNKNOWN_EXERCISE');
  assert.deepStrictEqual(be.data[unknownKey], unknownRaw);
  assert.deepStrictEqual(be.data[K.WORKOUTS], unknownHeaders);

  repo.workouts.discardDraft();
  const custom = repo.exercises.addCustom({ nameZh: '单臂划船', bodyPart: 'back' });
  assert.ok(custom.ok, custom.message);
  const archivedId = doneWorkout(repo, { date: '2026-10-06', exerciseIds: [custom.data.id] });
  assert.strictEqual(repo.deleteCustomExercise(custom.data.id).data.archived, true);
  const archivedHeaders = clone(be.data[K.WORKOUTS]);
  const archived = repo.workouts.repeatFrom(archivedId);
  assert.strictEqual(archived.code, 'ARCHIVED_EXERCISE');
  assert.deepStrictEqual(be.data[K.WORKOUTS], archivedHeaders);
  assert.strictEqual(repo.workouts.getDraft(), null);
});

test('只读和存储失败都不改源记录', () => {
  const { repo, be } = fresh();
  repo.init();
  const src = doneWorkout(repo, { date: '2026-10-10', name: '背' });
  const snap = clone(be.data);
  S.setReadOnly(true);
  assert.strictEqual(repo.workouts.repeatFrom(src).code, 'READ_ONLY');
  S.setReadOnly(false);
  assert.deepStrictEqual(be.data[K.workoutDetail(src)], snap[K.workoutDetail(src)]);
  assert.deepStrictEqual(be.data[K.WORKOUTS], snap[K.WORKOUTS]);

  const be2 = S.memoryBackend(be.data, {
    failOn: k => (k === K.WORKOUTS ? new Error('setStorageSync:fail write') : false),
  });
  repo._setBackend(be2);
  const failed = repo.workouts.repeatFrom(src);
  assert.strictEqual(failed.code, 'WRITE_FAILED');
  assert.match(failed.message, /保存失败/);
  assert.deepStrictEqual(be2.data[K.workoutDetail(src)], snap[K.workoutDetail(src)]);
  assert.deepStrictEqual(be2.data[K.WORKOUTS], snap[K.WORKOUTS]);
  const detailKeys = Object.keys(be2.data).filter(k => k.startsWith(K.DETAIL_PREFIX) && !k.startsWith('fit_corrupt_'));
  assert.deepStrictEqual(detailKeys, [K.workoutDetail(src)]);
});
