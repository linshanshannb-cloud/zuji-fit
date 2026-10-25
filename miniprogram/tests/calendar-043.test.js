// 0.4.3：日历格子部位/容量摘要、休息日存取。
const test = require('node:test'); const assert = require('node:assert');
const DM = require('../utils/daymark');
const { fresh } = require('./helpers');
const S = (n, w, reps = 10, extra = {}) => Array.from({ length: n }, () => Object.assign({ done: true, type: 'normal', weightKg: w, reps }, extra));
const ex = (bodyPart, sets, target) => ({ exercise: { bodyPart, target }, sets });

test('volumeLabel: t / kg / sets fallback', () => {
  assert.strictEqual(DM.volumeLabel(3240, 12), '3.2t');
  assert.strictEqual(DM.volumeLabel(3000, 12), '3t');
  assert.strictEqual(DM.volumeLabel(999.6, 3), '1t');
  assert.strictEqual(DM.volumeLabel(850, 5), '850kg');
  assert.strictEqual(DM.volumeLabel(125400, 40), '125t');
  assert.strictEqual(DM.volumeLabel(0, 8), '8组', 'bodyweight only -> sets');
  assert.strictEqual(DM.volumeLabel(0, 0), '');
});

test('partsLabel: top 1–2 groups by done sets, short names, other dropped when specific exists', () => {
  assert.strictEqual(DM.partsLabel([ex('chest', S(4, 60))]), '胸');
  assert.strictEqual(DM.partsLabel([ex('back', S(5, 50)), ex('arms', S(3, 20)), ex('chest', S(1, 60))]), '背·臂');
  assert.strictEqual(DM.partsLabel([ex('legs', S(3, 80), 'glutes'), ex('core', S(2, 0))]), '臀·腹');
  assert.strictEqual(DM.partsLabel([ex('cardio', S(6, 0)), ex('shoulders', S(1, 10))]), '肩');
  assert.strictEqual(DM.partsLabel([ex('cardio', S(2, 0))]), '全身');
  // 未完成组 / 热身组不计
  assert.strictEqual(DM.partsLabel([ex('chest', S(5, 60, 10, { done: false })), ex('back', S(1, 40))]), '背');
  assert.strictEqual(DM.partsLabel([ex('chest', S(5, 20, 10, { type: 'warmup' }))]), '');
});

test('dayMark merges multiple workouts of the same day', () => {
  const w1 = { exerciseCount: 1, volumeKg: 2400, setCount: 4, exercises: [ex('chest', S(4, 60))] };
  const w2 = { exerciseCount: 1, volumeKg: 800, setCount: 4, exercises: [ex('arms', S(4, 20))] };
  assert.deepStrictEqual(DM.dayMark([w1, w2]), { parts: '胸·臂', vol: '3.2t' });
  assert.strictEqual(DM.dayMark([{ exerciseCount: 0 }]), null);
});

test('buildInfo from real repo: auto-updates after finishing; training wins over rest', () => {
  const { repo } = fresh(); repo.init();
  const w = repo.workouts.createDraft({ date: '2026-10-15', exerciseIds: ['0025', '0017'] }).data;
  const v = repo.workouts.getWorkout(w.id);
  const [bench, pull] = v.exercises;
  repo.workouts.updateSet(w.id, bench.sets[0].id, { weightKg: 60, reps: 10 }); repo.workouts.setSetDone(w.id, bench.sets[0].id, true);
  repo.workouts.updateSet(w.id, pull.sets[0].id, { reps: 8 }); repo.workouts.setSetDone(w.id, pull.sets[0].id, true);
  repo.workouts.addSet(w.id, bench.id, {});
  const s2 = repo.workouts.getWorkout(w.id).exercises[0].sets[1];
  repo.workouts.updateSet(w.id, s2.id, { weightKg: 60, reps: 10 }); repo.workouts.setSetDone(w.id, s2.id, true);
  assert.deepStrictEqual(DM.buildInfo(repo, '2026-10-01', '2026-10-31'), {}, 'draft not shown');
  assert.ok(repo.workouts.finalizeWorkout(w.id).ok);
  assert.ok(repo.restDays.mark('2026-10-15').ok); assert.ok(repo.restDays.mark('2026-10-14').ok);
  const info = DM.buildInfo(repo, '2026-10-01', '2026-10-31');
  assert.deepStrictEqual(info['2026-10-15'], { tags: [{ id: 'p0', text: '胸', kind: 'part' }, { id: 'p1', text: '背', kind: 'part' }], more: 0 });
  assert.deepStrictEqual(info['2026-10-14'], { rest: true });
});

test('rest days: mark/unmark persist in fit_rest_days; old data untouched; future rejected; read-only blocked', () => {
  const old = { fit_meta: { schemaVersion: 1, createdAt: 1 }, fit_workouts: [], fit_body: [{ id: 'b1', date: '2026-10-01', weightKg: 70 }], fit_ui_prefs: { restDefault: 90 } };
  const { repo, be } = fresh(old); repo.init();
  assert.deepStrictEqual(repo.restDays.list(), {}, 'missing key = no rest days');
  assert.ok(repo.restDays.mark('2026-10-10').ok); assert.ok(repo.restDays.mark('2026-10-10').ok, 'idempotent');
  assert.ok(repo.restDays.mark('2026-09-30').ok);
  assert.strictEqual(repo.restDays.mark('2026-10-18').code, 'FUTURE_DATE');
  assert.strictEqual(repo.restDays.mark('bad').ok, false);
  assert.deepStrictEqual(repo.restDays.list('2026-10-01', '2026-10-31'), { '2026-10-10': true });
  assert.deepStrictEqual(Object.keys(be.data.fit_rest_days).sort(), ['2026-09-30', '2026-10-10']);
  assert.ok(repo.restDays.isRest('2026-10-10'));
  assert.ok(repo.restDays.unmark('2026-10-10').ok); assert.ok(!repo.restDays.isRest('2026-10-10'));
  assert.ok(repo.restDays.unmark('2026-01-01').ok, 'unmark missing is a no-op');
  assert.deepStrictEqual(be.data.fit_body, old.fit_body); assert.deepStrictEqual(be.data.fit_ui_prefs, old.fit_ui_prefs);
  // survives relaunch
  repo._setBackend(be); repo.init(); assert.ok(repo.restDays.isRest('2026-09-30'));
  require('../utils/storage').setReadOnly(true);
  assert.strictEqual(repo.restDays.mark('2026-10-01').code, 'READ_ONLY');
});

test('rest days: corrupt key is not overwritten', () => {
  const { repo, be } = fresh({ fit_meta: { schemaVersion: 1, createdAt: 1 }, fit_rest_days: 'garbage' }); repo.init();
  assert.deepStrictEqual(repo.restDays.list(), {});
  assert.strictEqual(repo.restDays.mark('2026-10-10').code, 'DATA_CORRUPT');
  assert.strictEqual(be.data.fit_rest_days, 'garbage');
});

// v0.5 训练首屏重设计：紧凑格子两行标签、汇总卡部位、周视图翻周跨月
test('cellLines: strength parts merged on one line, aerobic on the second, +N for extra aerobic; rest / legacy', () => {
  assert.deepStrictEqual(DM.cellLines(DM.buildTags(['胸', '背'], [])), { part: '胸·背', aero: '', train: true, rest: false });
  assert.deepStrictEqual(DM.cellLines(DM.buildTags(['腿'], ['跑步机爬坡'])), { part: '腿', aero: '跑步机…', train: true, rest: false });
  assert.deepStrictEqual(DM.cellLines(DM.buildTags([], ['跑步', '跳绳'])), { part: '', aero: '跑步+1', train: true, rest: false });
  // 3 部位 + 2 有氧：buildTags 截到 4 个 + more 1，有氧仍算 2 种 -> +1
  const b = DM.buildTags(['胸', '背', '肩'], ['跑步机爬坡', '划船']);
  assert.strictEqual(b.more, 1);
  assert.deepStrictEqual(DM.cellLines(b), { part: '胸·背·肩', aero: '跑步+1', train: true, rest: false });
  assert.deepStrictEqual(DM.cellLines({ rest: true }), { part: '', aero: '', train: false, rest: true });
  assert.deepStrictEqual(DM.cellLines(undefined), { part: '', aero: '', train: false, rest: false });
  assert.deepStrictEqual(DM.cellLines({ parts: '背·臂', vol: '3t' }), { part: '背·臂', aero: '', train: true, rest: false }, 'legacy {parts}');
});

function finishedWorkout(repo, date, ids) {
  const w = repo.workouts.createDraft({ date, exerciseIds: ids }).data;
  repo.workouts.getWorkout(w.id).exercises.forEach(e => {
    repo.workouts.updateSet(w.id, e.sets[0].id, { weightKg: 50, reps: 10 }); repo.workouts.setSetDone(w.id, e.sets[0].id, true);
  });
  assert.ok(repo.workouts.finalizeWorkout(w.id).ok); return w.id;
}

test('dayParts: ranked full part list + merged aerobic names for one date', () => {
  const { repo } = fresh(); repo.init();
  assert.deepStrictEqual(DM.dayParts(repo, '2026-10-15'), { parts: [], aeros: [] });
  finishedWorkout(repo, '2026-10-15', ['0025', '0017']);
  assert.ok(repo.aerobic.create({ date: '2026-10-15', activityType: 'run', durationMin: 30, estimatedKcal: 300 }).ok);
  assert.ok(repo.aerobic.create({ date: '2026-10-15', activityType: 'run', durationMin: 10, estimatedKcal: 100 }).ok);
  assert.ok(repo.aerobic.create({ date: '2026-10-15', activityType: 'stair_climber', durationMin: 15, estimatedKcal: 140 }).ok);
  assert.deepStrictEqual(DM.dayParts(repo, '2026-10-15'), { parts: ['胸', '背'], aeros: ['跑步', '爬楼机'] });
  assert.deepStrictEqual(DM.dayParts(repo, '2026-10-14'), { parts: [], aeros: [] });
});

function loadCalendarPage() {
  let def; global.Page = d => { def = d; };
  global.wx = { showToast() {}, showActionSheet() {}, showModal() {}, navigateTo() {} };
  const p = require.resolve('../pages/calendar/calendar.js'); delete require.cache[p]; require(p);
  const page = Object.assign({}, def); page.data = JSON.parse(JSON.stringify(def.data));
  page.setData = function (d) { Object.assign(this.data, d); };
  return page;
}

test('calendar page: default week view; ‹ › move selected ±7 days across months/years; toggle; summary card', () => {
  const { repo } = fresh(); repo.init();
  finishedWorkout(repo, '2026-10-15', ['0025', '0017']);
  assert.ok(repo.aerobic.create({ date: '2026-10-15', activityType: 'run', durationMin: 30, estimatedKcal: 300 }).ok);
  assert.ok(repo.aerobic.create({ date: '2026-10-15', activityType: 'run', durationMin: 10, estimatedKcal: 90, kcalSource: 'user_override' }).ok);
  assert.ok(repo.aerobic.create({ date: '2026-09-30', activityType: 'row', durationMin: 20, estimatedKcal: 170 }).ok);
  const pg = loadCalendarPage(); pg.onLoad();
  assert.strictEqual(pg.data.calView, 'week');
  pg.onSelect({ detail: { date: '2026-10-15' } });
  assert.deepStrictEqual([pg.data.year, pg.data.month], [2026, 10]);
  // 汇总卡
  const day = pg.data.day;
  assert.strictEqual(day.strength.parts, '胸 · 背');
  assert.deepStrictEqual(day.strength.stats.map(s => s.v), [2, 2, '1,000']);
  assert.strictEqual(day.aerobic.names, '跑步');
  assert.deepStrictEqual(day.aerobic.stats, [{ v: 40, k: '分钟' }, { v: 390, k: 'kcal（含手改）' }]);
  assert.strictEqual(day.totalMin, 40); assert.strictEqual(day.totalNote, '部分记录无时长', 'backfilled strength has no duration');
  assert.strictEqual(pg.data.cards.length, 3); assert.ok(pg.data.cards.every(c => c.meta));
  // 周视图翻周：10/15 -> 10/8 -> 10/1 -> 9/24（跨月）；网格范围内 9/30 有氧标签存在
  pg.onShift({ detail: { delta: -1 } }); pg.onShift({ detail: { delta: -1 } });
  assert.strictEqual(pg.data.selected, '2026-10-01');
  assert.deepStrictEqual(pg.data.info['2026-09-30'], { tags: [{ id: 'a0', text: '划船', kind: 'aero' }], more: 0 }, 'cross-month day of the visible week has tags');
  pg.onShift({ detail: { delta: -1 } });
  assert.deepStrictEqual([pg.data.selected, pg.data.year, pg.data.month], ['2026-09-24', 2026, 9]);
  assert.deepStrictEqual(pg.data.day, {}, 'no summary on an empty day');
  // 跨年
  pg.onSelect({ detail: { date: '2026-01-02' } }); pg.onShift({ detail: { delta: -1 } });
  assert.deepStrictEqual([pg.data.selected, pg.data.year, pg.data.month], ['2025-12-26', 2025, 12]);
  // 展开 -> 月视图翻月不改所选日；收起回到所选日所在月
  pg.onToggle(); assert.strictEqual(pg.data.calView, 'month');
  pg.onShift({ detail: { delta: 2 } });
  assert.deepStrictEqual([pg.data.selected, pg.data.year, pg.data.month], ['2025-12-26', 2026, 2]);
  pg.onToggle(); assert.deepStrictEqual([pg.data.calView, pg.data.year, pg.data.month], ['week', 2025, 12]);
  pg.onToday(); assert.strictEqual(pg.data.selected, pg.data.today);
});
