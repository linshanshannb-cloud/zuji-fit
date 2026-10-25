// 跨月 / 闰年 / 月末 / 时区；日历与图表数据是否与真实记录一致
// 时区：默认用进程 TZ（qa/run-tz-matrix.js 会在多个 TZ 下重跑本文件）
const test = require('node:test');
const assert = require('node:assert');
const H = require('./_harness');
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

test('D1 本地日期：早上 7:59（UTC 前一天）today() 仍是本地当天；午夜边界', () => {
  H.fresh({}, [2026, 10, 17, 7, 59]);
  const { repo } = H.boot();
  const r = repo.workouts.createDraft({}); assert.strictEqual(r.data.date, '2026-10-17');
  H.setNow(2026, 10, 17, 23, 59); const r2 = H.boot().repo.body.saveBody({ weightKg: 70 }); assert.strictEqual(r2.data.date, '2026-10-17');
  H.setNow(2026, 10, 18, 0, 0); const r3 = H.boot().repo.body.saveBody({ weightKg: 71 }); assert.strictEqual(r3.data.date, '2026-10-18');
});

test('D2 monthGrid：闰年 2 月 29 天、非闰年 28 天、2100 不是闰年；42 格连续无重复；周一开头', () => {
  const { D } = H.fresh();
  const check = (y, m, days) => {
    const g = D.monthGrid(y, m); assert.strictEqual(g.length, 42);
    assert.strictEqual(g.filter(c => c.inMonth).length, days, `${y}-${m}`);
    assert.strictEqual(new Set(g.map(c => c.date)).size, 42);
    assert.strictEqual(new Date(g[0].date.replace(/-/g, '/')).getDay(), 1, '第一格应是周一');
    for (let i = 1; i < 42; i++) { const a = new Date(g[i - 1].date.replace(/-/g, '/')), b = new Date(g[i].date.replace(/-/g, '/')); assert.strictEqual(Math.round((b - a) / 864e5), 1); }
  };
  check(2024, 2, 29); check(2026, 2, 28); check(2100, 2, 28); check(2000, 2, 29); check(2026, 3, 31); check(2026, 11, 30); check(2026, 12, 31);
  assert.strictEqual(D.daysInMonth(2024, 2), 29); assert.strictEqual(D.daysInMonth(2026, 2), 28);
  assert.deepStrictEqual(D.addMonths(2026, 12, 1), { year: 2027, month: 1 }); assert.deepStrictEqual(D.addMonths(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepStrictEqual(D.addMonths(2024, 2, 12), { year: 2025, month: 2 });
});

test('D3 图表"近 30/90 天"跨月 / 跨闰日 / 跨年：起点 = 今天往前 N−1 天', () => {
  const cases = [[[2024, 3, 1], 30, '2024-02-01'], [[2026, 3, 1], 30, '2026-01-31'], [[2026, 1, 15], 90, '2025-10-18'], [[2024, 2, 29], 30, '2024-01-31'], [[2026, 10, 31], 30, '2026-10-02']];
  for (const [at, n, from] of cases) {
    const { repo } = H.fresh({}, [...at, 12, 0]);
    repo.body.saveBody({ date: from, weightKg: 70 });
    const prev = new Date(from.replace(/-/g, '/')); prev.setDate(prev.getDate() - 1);
    repo.body.saveBody({ date: ymd(prev.getFullYear(), prev.getMonth() + 1, prev.getDate()), weightKg: 71 });
    const s = repo.body.bodySeries('weightKg', n);
    assert.strictEqual(s.from, from, `${at} 近${n}天`);
    assert.deepStrictEqual(s.points.map(p => p.date), [from], '区间外前一天不应计入');
    const st = repo.body.bodyStats('weightKg', n);
    assert.strictEqual(st.previous.value, 71, '"较上次"可以取区间外的前一条'); assert.strictEqual(st.delta, -1);
  }
});

test('D4 训练日历：2 月 29 日、月末、跨年的训练在对应月份标记；草稿和空训练不标记；同日多次只一个点、摘要卡按 createdAt', () => {
  const { repo } = H.fresh({}, [2026, 10, 17, 10, 0]);
  const mk = (date, ids = ['0025'], finish = true) => {
    const r = repo.workouts.createDraft({ date }); repo.workouts.addExercises(r.data.id, ids);
    const s = repo.workouts.getWorkout(r.data.id).exercises[0].sets[0];
    repo.workouts.updateSet(r.data.id, s.id, { weightKg: 40, reps: 5 }); repo.workouts.setSetDone(r.data.id, s.id, true);
    if (finish) assert.ok(repo.workouts.completeWorkout(r.data.id).ok); return r.data.id;
  };
  const a = mk('2024-02-29'), b = mk('2025-12-31'), c = mk('2026-01-01'), d1 = mk('2026-09-30'), d2 = mk('2026-09-30'); mk('2026-10-16', ['0025'], false);
  const marks = repo.workouts.completedDates();
  assert.deepStrictEqual(marks, { '2024-02-29': 1, '2025-12-31': 1, '2026-01-01': 1, '2026-09-30': 2 });
  // 页面按 year/month 算月范围（calendar.js:11）
  const D = H.boot({ init: false }).D; const { repo: r2 } = H.boot();
  const range = (y, m) => r2.workouts.completedDates(`${y}-${D.pad(m)}-01`, `${y}-${D.pad(m)}-${D.pad(D.daysInMonth(y, m))}`);
  assert.deepStrictEqual(Object.keys(range(2024, 2)), ['2024-02-29']);
  assert.deepStrictEqual(Object.keys(range(2025, 12)), ['2025-12-31']);
  assert.deepStrictEqual(Object.keys(range(2026, 1)), ['2026-01-01']);
  assert.deepStrictEqual(r2.workouts.daySummaries('2026-09-30').map(w => w.id), [d1, d2]);
  assert.deepStrictEqual(r2.workouts.completedDates('2026-10-01', '2026-10-31'), {}, '草稿不标记');
  void a; void b; void c;
});

test('D5 日历/图表与真实记录一致：随机 160 次身体记录写入 + 删改，独立重算对比', () => {
  const { repo } = H.fresh({}, [2026, 10, 17, 9, 0]);
  const rand = H.rng(7);
  const truth = {};
  for (let i = 0; i < 160; i++) {
    const dt = new Date(2026, 9, 17 - Math.floor(rand() * 200)); const date = ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
    const w = Math.round((60 + rand() * 20) * 10) / 10, f = rand() < 0.5 ? Math.round(rand() * 300) / 10 : '';
    const r = repo.body.saveBody({ date, weightKg: w, bodyFatPct: f });
    assert.ok(r.ok);
    truth[date] = { weightKg: w, bodyFatPct: f === '' ? (truth[date] ? truth[date].bodyFatPct : null) : f };
  }
  // 再随机删 / 改
  const ids = repo.body.listBody().map(r => r.id);
  ids.slice(0, 20).forEach(id => { const r = repo.body.getBody(id); repo.body.deleteBody(id); delete truth[r.date]; });
  ids.slice(20, 30).forEach(id => { const r = repo.body.getBody(id); repo.body.updateBody(id, { bodyFatPct: '' }); truth[r.date].bodyFatPct = null; });
  const dates = Object.keys(truth).sort();
  assert.deepStrictEqual(repo.body.listBody().map(r => r.date), dates);
  for (const field of ['weightKg', 'bodyFatPct']) for (const range of [30, 90, 'all']) {
    const s = repo.body.bodySeries(field, range);
    const from = range === 'all' ? null : (() => { const d = new Date(2026, 9, 17 - (range - 1)); return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); })();
    const exp = dates.filter(d => truth[d][field] != null && (!from || d >= from)).map(d => ({ date: d, value: truth[d][field] }));
    assert.deepStrictEqual(s.points, exp, `${field} ${range}`);
    const rows = repo.body.bodyRows(field, range);
    assert.deepStrictEqual(rows.map(r => r.date), exp.map(p => p.date).reverse(), '列表与图表同源');
    const st = repo.body.bodyStats(field, range);
    if (exp.length) assert.strictEqual(st.current.value, exp[exp.length - 1].value);
    // chartLayout：点数一致、x 随日期单调递增、y 与数值反向、都在画布内
    const L = repo.series.chartLayout(s, 320, 180);
    assert.strictEqual(L.points.length, exp.length);
    for (let i = 1; i < L.points.length; i++) assert.ok(L.points[i].x > L.points[i - 1].x);
    L.points.forEach(p => { assert.ok(p.x >= L.pad.l - 1e-9 && p.x <= 320 - L.pad.r + 1e-9 && p.y >= L.pad.t - 1e-9 && p.y <= 180 - L.pad.b + 1e-9); });
    for (let i = 1; i < L.points.length; i++) { const a = L.points[i - 1], b = L.points[i]; if (a.value > b.value) assert.ok(a.y < b.y); if (a.value < b.value) assert.ok(a.y > b.y); }
  }
  // 身体日历标记（body.js:25 的规则）与真实记录一致
  const marks = {}; repo.body.listBody().forEach(r => { marks[r.date] = r.weightKg != null; });
  assert.deepStrictEqual(Object.keys(marks).sort(), dates);
});

test('D6 chartLayout x 与日期成比例（跨夏令时也不变形），单点居中、所有值相同不除零', () => {
  const { repo } = H.fresh({}, [2026, 11, 10, 12, 0]);
  const s = { from: '2026-10-25', to: '2026-11-10', points: [{ date: '2026-10-25', value: 1 }, { date: '2026-11-02', value: 2 }, { date: '2026-11-10', value: 3 }] };
  const L = repo.series.chartLayout(s, 200, 100, { l: 0, r: 0, t: 0, b: 0 });
  assert.ok(Math.abs(L.points[1].x - 100) < 1e-6, 'x=' + L.points[1].x);
  const one = repo.series.chartLayout({ from: '2026-11-10', to: '2026-11-10', points: [{ date: '2026-11-10', value: 70 }] }, 200, 100, { l: 0, r: 0, t: 0, b: 0 });
  assert.strictEqual(one.points[0].x, 100); assert.ok(isFinite(one.points[0].y));
  const flat = repo.series.chartLayout({ from: '2026-11-01', to: '2026-11-10', points: [{ date: '2026-11-01', value: 70 }, { date: '2026-11-10', value: 70 }] }, 200, 100);
  flat.points.forEach(p => assert.ok(isFinite(p.y)));
});

test('D7 显示格式：跨年显示年份、同年不显示；2 月 29 日周几正确', () => {
  H.fresh();
  const F = require(require('path').join(H.MP, 'utils/format'));
  assert.strictEqual(F.dateLabel('2024-02-29', '2024-03-01'), '2月29日 周四');
  assert.strictEqual(F.dateLabel('2025-12-30', '2026-01-02'), '2025年12月30日 周二');
  assert.strictEqual(F.kg(60), '60'); assert.strictEqual(F.kg(62.5), '62.5'); assert.strictEqual(F.thousands(4320), '4,320'); assert.strictEqual(F.fixed1(78), '78.0');
  assert.strictEqual(F.signed(-0.04), '±0.0');
});
