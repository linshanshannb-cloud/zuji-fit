// 训练容量与两套时长：卡片和详情同口径；整次用时与计时组累计分开；不猜缺失起止，不改历史。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { fresh } = require('./helpers');
const F = require('../utils/format');
const M = require('../utils/repo/model');
const K = require('../utils/repo/keys');
const BENCH = '0025';
const PLANK = '0463';

function card(mode, sets) {
  return { id: 'we_' + mode, mode, sets };
}
function set(extra) {
  return Object.assign({ done: true, type: 'normal', weightKg: null, reps: null, durationSec: null }, extra);
}

test('volume is weight × reps once: no per-side doubling, bodyweight and unfinished add nothing', () => {
  const reps = card('reps', [
    set({ weightKg: 30, reps: 10 }),
    set({ weightKg: 30, reps: 10 }),
    set({ weightKg: null, reps: 12 }),
    set({ weightKg: 0, reps: 8 }),
    set({ weightKg: 100, reps: 10, done: false }),
    set({ weightKg: 80, reps: 5, type: 'warmup' }),
  ]);
  const oneSide = M.summaryFromCards([card('reps', [set({ weightKg: 30, reps: 10 })])]);
  const both = M.summaryFromCards([reps]);
  assert.strictEqual(oneSide.volumeKg, 300, 'one logged set is not doubled for the other side');
  assert.strictEqual(both.volumeKg, 600, 'only the two finished loaded sets');
  assert.strictEqual(both.setCount, 4, 'bodyweight sets count as sets, warm-up and unfinished do not');
  assert.strictEqual(both.timeSec, 0);
  assert.strictEqual(F.strengthCardSub(both.volumeKg, both.timeSec, null), '600 kg');
  assert.strictEqual(F.strengthCardSub(0, 0, null), '0 kg');
});

test('timed load stays out of volume; seconds are not treated as minutes or added twice', () => {
  const timed = card('time', [
    set({ weightKg: 20, durationSec: 60 }),
    set({ weightKg: null, durationSec: 60 }),
    set({ weightKg: 40, durationSec: 300, type: 'warmup' }),
    set({ weightKg: 10, durationSec: 200, done: false }),
  ]);
  const sum = M.summaryFromCards([timed]);
  assert.strictEqual(sum.volumeKg, 0, 'timed weight is not weight × seconds');
  assert.strictEqual(sum.timeSec, 120, 'two finished holds, in seconds');
  assert.strictEqual(sum.setCount, 2);
  assert.strictEqual(F.dur(sum.timeSec), '2分钟');
  assert.strictEqual(F.strengthCardSub(sum.volumeKg, sum.timeSec, null), '', 'time-only 0 kg stays hidden');
  const again = M.summaryFromCards([timed]);
  assert.strictEqual(again.timeSec, sum.timeSec, 'recounting the same cards does not stack');
});

test('mixed workout keeps session minutes and timed-set seconds apart, including a large total', () => {
  const mixed = M.summaryFromCards([
    card('reps', [set({ weightKg: 80, reps: 8 }), set({ weightKg: 100, reps: 5 })]),
    card('time', [set({ durationSec: 60, weightKg: 15 }), set({ durationSec: 45 })]),
  ]);
  assert.strictEqual(mixed.volumeKg, 1140);
  assert.strictEqual(mixed.timeSec, 105);
  assert.strictEqual(mixed.setCount, 4);
  const stats = F.strengthStats(8, 37, 38152, 8 * 60);
  assert.deepStrictEqual(stats.map(s => s.role), ['exercises', 'sets', 'volume', 'timed']);
  assert.strictEqual(stats[2].v, '38,152');
  assert.strictEqual(stats[2].unit, 'kg');
  assert.strictEqual(stats[2].k, '总训练重量');
  assert.ok(stats[2].hint.includes('不是体重'));
  assert.strictEqual(stats[3].v, '8分钟');
  assert.strictEqual(stats[3].k, '计时组累计');
  assert.ok(stats[3].hint.includes('不含休息'));
  assert.ok(!stats[2].v.includes('分钟') && !stats[3].v.includes('38'));
  assert.strictEqual(F.strengthCardSub(38152, 480, 97), '38,152 kg · 用时 97 分钟');
  assert.strictEqual(F.strengthSummary(8, 37, 38152, 480), '8 个动作 · 37 组 · 38,152 kg · 计时 8分钟');
});

test('session clock is start-to-finish and is not invented when the ends are missing or reversed', () => {
  const t0 = Date.UTC(2026, 10, 18, 10, 28);
  assert.strictEqual(F.sessionMinutes(t0, t0 + 97 * 60000), 97);
  assert.strictEqual(F.sessionMinutes(t0, t0 + 20 * 1000), 1, 'a real short span still rounds up to 1 minute');
  assert.strictEqual(F.sessionMinutes(t0, t0 + 90 * 1000), 2);
  assert.strictEqual(F.sessionMinutes(null, t0), null);
  assert.strictEqual(F.sessionMinutes(t0, null), null);
  assert.strictEqual(F.sessionMinutes(t0, t0 - 1), null);
  assert.strictEqual(F.sessionMinutes('18:28', 97), null);
  assert.strictEqual(F.sessionLine(null, t0), '补录');
  assert.strictEqual(F.sessionLine(t0, null), F.hm(t0) + ' 开始');
  assert.strictEqual(F.sessionLine(t0, t0 - 60000), F.hm(t0) + ' 开始');
  const line = F.sessionLine(t0, t0 + 97 * 60000);
  assert.ok(line.includes('训练用时 97 分钟（含休息）'));
  assert.ok(line.includes(F.hm(t0) + ' 开始'));
  assert.ok(!line.includes('8分钟'));
});

test('missing volume is not shown as zero; a stored zero still is', () => {
  const missing = F.strengthStats(3, 9, null, 0);
  assert.strictEqual(missing.find(s => s.role === 'volume').v, '缺失');
  assert.strictEqual(F.strengthCardSub(undefined, 0, 40), '重量缺失 · 用时 40 分钟');
  const zero = F.strengthStats(1, 3, 0, 0);
  assert.strictEqual(zero.find(s => s.role === 'volume').v, '0');
  assert.strictEqual(zero.find(s => s.role === 'volume').unit, 'kg');
  assert.strictEqual(F.strengthStats(1, 2, 0, 60).some(s => s.role === 'volume'), false);
});

test('saved workout: card matches detail, stale header is not rewritten, edit and copy leave history', () => {
  const { repo, be } = fresh();
  repo.init();
  const w = repo.workouts.createDraft({ date: '2026-10-15', exerciseIds: [BENCH, PLANK] }).data;
  const view = repo.workouts.getWorkout(w.id);
  const [bench, plank] = view.exercises;
  assert.ok(repo.workouts.updateSet(w.id, bench.sets[0].id, { weightKg: 100, reps: 8 }).ok);
  assert.ok(repo.workouts.setSetDone(w.id, bench.sets[0].id, true).ok);
  const undone = repo.workouts.addSet(w.id, bench.id, { weightKg: 200, reps: 5 }).data;
  assert.strictEqual(undone.done, false);
  assert.ok(repo.workouts.updateSet(w.id, plank.sets[0].id, { durationSec: 60, weightKg: 20 }).ok);
  assert.ok(repo.workouts.setSetDone(w.id, plank.sets[0].id, true).ok);
  const hold2 = repo.workouts.addSet(w.id, plank.id, { durationSec: 60 }).data;
  assert.ok(repo.workouts.setSetDone(w.id, hold2.id, true).ok);
  assert.ok(repo.workouts.finalizeWorkout(w.id).ok);
  const header = be.data[K.WORKOUTS].find(h => h.id === w.id);
  const started = Date.UTC(2026, 10, 18, 10, 28);
  header.startedAt = started;
  header.completedAt = started + 97 * 60000;
  header.volumeKg = 1;
  const before = JSON.parse(JSON.stringify(be.data));
  const got = repo.workouts.getWorkout(w.id);
  assert.strictEqual(got.volumeKg, 800, 'detail recomputes; timed 20kg is not added');
  assert.strictEqual(got.timeSec, 120);
  assert.strictEqual(got.exercises.find(e => e.id === bench.id).sets.find(s => s.id === undone.id).done, false);
  const [sum] = repo.workouts.daySummaries('2026-10-15');
  assert.strictEqual(sum.volumeKg, 800);
  assert.strictEqual(sum.timeSec, 120);
  assert.strictEqual(sum.durationMin, 97);
  assert.strictEqual(be.data[K.WORKOUTS].find(h => h.id === w.id).volumeKg, 1, 'reading does not repair the stored header');
  assert.deepStrictEqual(be.data[K.workoutDetail(w.id)], before[K.workoutDetail(w.id)]);

  let def;
  global.Page = d => { def = d; };
  global.wx = { showToast() {}, showModal() {}, navigateTo() {}, navigateBack() {} };
  const calPath = require.resolve('../pages/calendar/calendar.js');
  delete require.cache[calPath];
  require(calPath);
  const cal = Object.assign({}, def);
  cal.data = JSON.parse(JSON.stringify(def.data));
  cal.setData = function (d) { Object.assign(this.data, d); };
  cal.onLoad();
  cal.onSelect({ detail: { date: '2026-10-15' } });
  const row = cal.data.trainRows.find(r => r.kind === 'strength');
  assert.strictEqual(row.name, '腹·胸 · 力量');
  assert.strictEqual(row.sub, '800 kg · 用时 97 分钟');
  assert.ok(cal.data.trainRows.filter(r => r.kind === 'aerobic').length === 0);
  assert.ok(!JSON.stringify(cal.data.info).includes('平板'));

  const detailPath = require.resolve('../pages/workout-detail/workout-detail.js');
  delete require.cache[detailPath];
  require(detailPath);
  const detail = Object.assign({}, def);
  detail.data = JSON.parse(JSON.stringify(def.data));
  detail.setData = function (d) { Object.assign(this.data, d); };
  detail.onLoad({ id: w.id });
  detail.onShow();
  assert.ok(detail.data.w.time.includes('训练用时 97 分钟（含休息）'));
  assert.ok(!detail.data.w.time.includes('2分钟'));
  const vol = detail.data.w.stats.find(s => s.role === 'volume');
  const timed = detail.data.w.stats.find(s => s.role === 'timed');
  assert.strictEqual(vol.v, '800');
  assert.strictEqual(vol.unit, 'kg');
  assert.strictEqual(timed.v, '2分钟');
  assert.notStrictEqual(vol.role, timed.role);

  const doneBefore = repo.workouts.getWorkout(w.id).exercises.map(e => e.sets.map(s => s.done));
  const clock = { startedAt: header.startedAt, completedAt: header.completedAt };
  assert.ok(repo.workouts.updateSet(w.id, hold2.id, { durationSec: 90 }).ok);
  const edited = repo.workouts.getWorkout(w.id);
  assert.strictEqual(edited.timeSec, 150, '60 + 90, not 60 + 60 + 90');
  assert.strictEqual(edited.volumeKg, 800);
  assert.strictEqual(edited.startedAt, clock.startedAt);
  assert.strictEqual(edited.completedAt, clock.completedAt);
  assert.deepStrictEqual(edited.exercises.map(e => e.sets.map(s => s.done)), doneBefore);

  const srcDetail = JSON.parse(JSON.stringify(be.data[K.workoutDetail(w.id)]));
  const srcHeader = JSON.parse(JSON.stringify(be.data[K.WORKOUTS].find(h => h.id === w.id)));
  const copy = repo.workouts.repeatFrom(w.id);
  assert.ok(copy.ok);
  const copied = repo.workouts.getWorkout(copy.data.workoutId);
  assert.strictEqual(copied.volumeKg, 0, 'copied sets are not done, so load is not counted yet');
  assert.strictEqual(copied.timeSec, 0);
  assert.ok(copied.exercises.every(e => e.sets.every(s => s.done === false)));
  assert.notStrictEqual(copied.startedAt, srcHeader.startedAt);
  assert.deepStrictEqual(be.data[K.workoutDetail(w.id)], srcDetail);
  assert.strictEqual(be.data[K.WORKOUTS].find(h => h.id === w.id).completedAt, srcHeader.completedAt);
  assert.strictEqual(be.data[K.WORKOUTS].find(h => h.id === w.id).volumeKg, srcHeader.volumeKg);
});

test('old reps record without mode, duration, or a clock keeps its load and does not grow a guessed duration', () => {
  const { repo, be } = fresh();
  repo.init();
  const w = repo.workouts.createDraft({ date: '2026-10-10', exerciseIds: [BENCH] }).data;
  const we = repo.workouts.getWorkout(w.id).exercises[0];
  assert.ok(repo.workouts.updateSet(w.id, we.sets[0].id, { weightKg: 50, reps: 10 }).ok);
  assert.ok(repo.workouts.setSetDone(w.id, we.sets[0].id, true).ok);
  assert.ok(repo.workouts.finalizeWorkout(w.id).ok);
  const key = K.workoutDetail(w.id);
  const d = JSON.parse(JSON.stringify(be.data[key]));
  d.exercises.forEach(e => { delete e.mode; });
  d.sets.forEach(s => { delete s.durationSec; });
  be.data[key] = d;
  const h = be.data[K.WORKOUTS].find(x => x.id === w.id);
  h.startedAt = null;
  h.completedAt = 1;
  delete h.timeSec;
  const got = repo.workouts.getWorkout(w.id);
  assert.strictEqual(got.volumeKg, 500);
  assert.strictEqual(got.timeSec, 0);
  assert.strictEqual(F.sessionLine(got.startedAt, got.completedAt), '补录');
  const [sum] = repo.workouts.daySummaries(got.date);
  assert.strictEqual(sum.durationMin, null);
  assert.strictEqual(sum.volumeKg, 500);
  assert.strictEqual(F.strengthCardSub(sum.volumeKg, sum.timeSec, sum.durationMin), '500 kg');
});

test('a failed edit is counted from the cards once and does not clear stored sets', () => {
  const { repo, be } = fresh();
  repo.init();
  const buf = require('../utils/edit-buffer');
  buf.resetAll();
  const w = repo.workouts.createDraft({ exerciseIds: [PLANK, BENCH] }).data;
  const v = repo.workouts.getWorkout(w.id);
  const [plank, bench] = v.exercises;
  assert.ok(repo.workouts.updateSet(w.id, plank.sets[0].id, { durationSec: 60 }).ok);
  assert.ok(repo.workouts.setSetDone(w.id, plank.sets[0].id, true).ok);
  assert.ok(repo.workouts.updateSet(w.id, bench.sets[0].id, { weightKg: 40, reps: 5 }).ok);
  assert.ok(repo.workouts.setSetDone(w.id, bench.sets[0].id, true).ok);
  assert.ok(repo.workouts.finalizeWorkout(w.id).ok);
  const stored = JSON.parse(JSON.stringify(be.data));
  buf.upsert(w.id, {
    key: 'set:' + plank.sets[0].id + ':durationSec',
    apply(cards) {
      const c = cards.find(x => x.id === plank.id);
      const s = c.sets.find(x => x.id === plank.sets[0].id);
      s.durationSec = 180;
    },
  });
  let def;
  global.Page = d => { def = d; };
  global.wx = {
    showToast() {}, showModal() {}, navigateTo() {}, navigateBack() {},
    getWindowInfo: () => ({ windowWidth: 320 }),
    getSystemInfoSync: () => ({ windowWidth: 320 }),
    getMenuButtonBoundingClientRect: () => ({ left: 240, top: 24, height: 32 }),
  };
  const file = require.resolve('../pages/workout-edit/workout-edit.js');
  delete require.cache[file];
  require(file);
  const page = Object.assign({}, def);
  page.data = JSON.parse(JSON.stringify(def.data));
  page.setData = function (d) { Object.assign(this.data, d); };
  page.onLoad({ id: w.id });
  assert.ok(page.data.w.summary.includes('计时 3分钟'), page.data.w.summary);
  assert.ok(page.data.w.summary.includes('200 kg'), page.data.w.summary);
  assert.ok(!page.data.w.summary.includes('4分钟'));
  assert.strictEqual(page.data.cards.find(c => c.id === plank.id).sets[0].done, true);
  assert.deepStrictEqual(be.data[K.workoutDetail(w.id)], stored[K.workoutDetail(w.id)]);
  const failed = {
    key: 'set:' + bench.sets[0].id + ':reps',
    apply(cards) {
      const c = cards.find(x => x.id === bench.id);
      c.sets[0].reps = 8;
    },
  };
  page.run({ ok: false, code: 'WRITE_FAILED' }, { op: failed });
  assert.ok(page.data.w.summary.includes('320 kg'), page.data.w.summary);
  assert.ok(page.data.w.summary.includes('计时 3分钟'));
  assert.strictEqual(repo.workouts.getWorkout(w.id).volumeKg, 200, 'the failed edit is not written');
  assert.strictEqual(repo.workouts.getWorkout(w.id).timeSec, 60);
  buf.resetAll();
});

test('detail stats sit in separate cells, and the calendar card keeps aerobic as 有氧', () => {
  const root = path.join(__dirname, '..');
  const wxml = fs.readFileSync(path.join(root, 'pages/workout-detail/workout-detail.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'pages/workout-detail/workout-detail.wxss'), 'utf8');
  const cal = fs.readFileSync(path.join(root, 'pages/calendar/calendar.js'), 'utf8');
  assert.ok(wxml.includes('stat-grid') && wxml.includes('stat-cell') && wxml.includes('item.unit'));
  assert.ok(!wxml.includes('class="row stats"'));
  assert.ok(wxss.includes('width: 50%') && wxss.includes('flex-wrap: wrap'));
  assert.ok(wxml.includes('复制到今天') && wxml.includes('编辑训练') && wxml.includes('删除'));
  assert.ok(cal.includes("c.title + ' · 有氧'") && cal.includes('strengthCardSub'));
  assert.ok(cal.includes("trainSticker('aerobic'"));
  assert.ok(!cal.includes('有氧+1'));
});
