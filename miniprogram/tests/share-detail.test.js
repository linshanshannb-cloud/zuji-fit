// 分享详细版：已完成组、相邻合并、画布分页。精简版仍走原来的手账。
const test = require('node:test');
const assert = require('node:assert');
const SD = require('../utils/share-day');

function set(partial) {
  return Object.assign({ done: true, type: 'normal', weightKg: 20, reps: 12, durationSec: null, index: 0 }, partial);
}
function texts(model) {
  const slices = model.slices || [model];
  const out = [];
  slices.forEach(slice => {
    ((slice.train && slice.train.rows) || []).forEach(row => {
      out.push(row.name || '');
      out.push(row.sub || '');
      (row.lines || []).forEach(line => out.push(line.text));
    });
    ((slice.diet && slice.diet.rows) || []).forEach(row => out.push(row.name));
    if (slice.train && slice.train.summary) out.push(slice.train.summary);
    if (slice.diet && slice.diet.summary) out.push(slice.diet.summary);
  });
  return out.join('\n');
}

test('brief share stays the default and does not list sets', () => {
  const brief = SD.buildShareModel({
    date: '2026-11-18',
    train: [{ kind: 'strength', name: '腿日', minutes: 40, sets: 3, volumeKg: 720, timeSec: 0, createdAt: 1, exercises: [
      { name: '深蹲', mode: 'reps', sets: [set({ index: 1 }), set({ index: 2 }), set({ index: 3 })] },
    ] }],
    diet: [{ name: '米饭', mealLabel: '午餐', kcal: 200, estimate: true, createdAt: 1 }],
  });
  assert.strictEqual(brief.mode, undefined);
  assert.strictEqual(brief.slices, undefined);
  assert.strictEqual(brief.train.rows[0].lines, undefined);
  assert.strictEqual(brief.train.summary, '40 分钟');
  assert.strictEqual(brief.diet.summary, '摄入 200 kcal · 估算');
});

test('detail lists completed sets, merges only adjacent equals, and keeps the three clocks apart', () => {
  const detail = SD.buildShareModel({
    mode: 'detail',
    date: '2026-11-18',
    train: [{
      kind: 'strength', name: '腿日', minutes: 97, volumeKg: 38152, timeSec: 480, createdAt: 1,
      exercises: [
        { name: '杠铃深蹲', mode: 'reps', sets: [
          set({ index: 1, weightKg: 20, reps: 12 }),
          set({ index: 2, weightKg: 20, reps: 12 }),
          set({ index: 3, weightKg: 20, reps: 12 }),
          set({ index: 4, weightKg: 40, reps: 8 }),
          set({ index: 5, weightKg: 20, reps: 12 }),
          set({ index: 6, weightKg: 20, reps: 12, done: false }),
          set({ index: 7, weightKg: 20, reps: 10, type: 'warmup' }),
        ] },
        { name: '日本坐', mode: 'time', sets: [
          set({ index: 1, reps: null, durationSec: 60, weightKg: null }),
          set({ index: 2, reps: null, durationSec: 60, weightKg: null }),
          set({ index: 3, reps: null, durationSec: 90, weightKg: 10 }),
          set({ index: 4, reps: null, durationSec: 60, weightKg: null, done: false }),
        ] },
      ],
    }, {
      kind: 'aerobic', name: '跑步机爬坡', activityType: 'treadmill_incline', minutes: 30, kcal: 240, createdAt: 2,
    }],
    diet: [{ name: '石锅拌饭', mealLabel: '午餐', kcal: 540, estimate: true, createdAt: 1 }],
  });
  const body = texts(detail);
  assert.ok(body.includes('20 kg×12次×3组'), body);
  assert.ok(body.includes('40 kg×8次'), body);
  assert.strictEqual((body.match(/20 kg×12次/g) || []).length, 2, 'the later 20×12 is not merged across the 40×8');
  assert.ok(!body.includes('20 kg×12次×4组'));
  assert.ok(!body.includes('未完成'));
  assert.ok(body.includes('热身 20 kg×10次'));
  assert.ok(body.includes('杠铃深蹲 · 已完成 5 组 · 热身 1 组'));
  assert.ok(body.includes('日本坐 · 已完成 3 组'));
  assert.ok(body.includes('1分钟×2组'));
  assert.ok(body.includes('10 kg×1分30秒'));
  assert.ok(body.includes('总训练重量 38,152 kg'));
  assert.ok(body.includes('用时 97 分钟（含休息）'));
  assert.ok(body.includes('计时 8 分钟（不含休息）'));
  assert.ok(!body.includes('用时 8 分钟'));
  assert.ok(body.includes('跑步机爬坡'));
  assert.ok(body.includes('30 分钟'));
  assert.ok(body.includes('有氧 30 分钟'));
  assert.ok(body.includes('有氧消耗 240 kcal'));
  assert.strictEqual(detail.diet.summary, '摄入 540 kcal · 估算');
  assert.ok(detail.slices.every(s => SD.cardHeight(s) <= SD.exportLimit('ios')));
});

test('warmup between identical sets breaks the run, and zero load stays visible', () => {
  const detail = SD.buildShareModel({
    mode: 'detail', exportMaxH: 4096, date: '2026-11-18',
    train: [{
      kind: 'strength', name: '自重日', minutes: null, volumeKg: 0, timeSec: 0, createdAt: 1,
      exercises: [{ name: '引体向上', sets: [
        set({ index: 1, weightKg: null, reps: 8 }),
        set({ index: 2, weightKg: null, reps: 8, type: 'warmup' }),
        set({ index: 3, weightKg: null, reps: 8 }),
        set({ index: 4, weightKg: 0, reps: 8 }),
      ] }],
    }],
    diet: [],
  });
  const lines = detail.train.rows[0].lines.map(l => l.text);
  assert.ok(lines.includes('自重×8次'));
  assert.ok(lines.includes('热身 自重×8次'));
  assert.ok(lines.includes('0 kg×8次'));
  assert.strictEqual(lines.filter(t => t === '自重×8次').length, 2);
  const body = texts(detail);
  assert.ok(body.includes('总训练重量 0 kg'));
  assert.ok(!body.includes('用时'));
  assert.ok(!body.includes('计时'));
});

test('old reps records without mode still expand, and timed weight is not added into volume', () => {
  const detail = SD.buildShareModel({
    mode: 'detail', date: '2026-11-01',
    train: [{
      kind: 'strength', name: '旧记录', minutes: 20, volumeKg: 500, timeSec: 60, createdAt: 1,
      exercises: [{ name: '卧推', sets: [set({ index: 1, weightKg: 50, reps: 10 })] }, { name: '平板', mode: 'time', sets: [set({ index: 1, weightKg: 15, reps: null, durationSec: 60 })] }],
    }],
    diet: [],
  });
  const body = texts(detail);
  assert.ok(body.includes('50 kg×10次'));
  assert.ok(body.includes('15 kg×1分钟'));
  assert.ok(body.includes('总训练重量 500 kg'));
  assert.ok(!body.includes('515'));
});

test('pure timed, several workouts, long names, and a missing detail stay on the card', () => {
  const longName = '超长动作名'.repeat(12);
  const detail = SD.buildShareModel({
    mode: 'detail', date: '2026-11-18',
    train: [
      { kind: 'strength', name: '计时', minutes: 15, volumeKg: 0, timeSec: 180, createdAt: 1, exercises: [
        { name: longName, mode: 'time', sets: [set({ index: 1, durationSec: 45, weightKg: null, reps: null }), set({ index: 2, durationSec: null, weightKg: null, reps: null })] },
      ] },
      { kind: 'strength', name: '第二次', minutes: null, volumeKg: 100, timeSec: 0, createdAt: 2, detailMissing: true, exercises: [] },
    ],
    diet: [],
  });
  const body = texts(detail);
  assert.ok(body.includes('45秒'));
  assert.ok(body.includes('时长缺失'));
  assert.ok(body.includes(longName.slice(0, 8)) && body.includes(longName.slice(-4)));
  assert.ok(body.includes('训练详情缺失，不能展开各组'));
  assert.ok(body.includes('部分无用时'));
  assert.ok(body.includes('计时 3 分钟（不含休息）'));
  assert.strictEqual(detail.train.more, 0);
});

test('detail keeps every diet row and the full intake when the day is long', () => {
  const foods = [];
  for (let i = 0; i < 40; i++) foods.push({ name: '食物' + i, mealLabel: '午餐', kcal: 10, estimate: i < 3, createdAt: i });
  const train = [];
  for (let i = 0; i < 6; i++) train.push({
    kind: 'strength', name: '训练' + i, minutes: 10, volumeKg: 100, timeSec: 0, createdAt: i,
    exercises: [{ name: '动作' + i, sets: [set({ index: 1, weightKg: 10, reps: 10 })] }],
  });
  const detail = SD.buildShareModel({ mode: 'detail', exportMaxH: 2200, date: '2026-11-18', train, diet: foods });
  const slices = detail.slices;
  assert.ok(slices.length > 1, 'pages ' + slices.length);
  slices.forEach(s => assert.ok(SD.cardHeight(s) <= 2200, 'height ' + SD.cardHeight(s)));
  const body = texts(detail);
  for (let i = 0; i < 40; i++) assert.ok(body.includes('食物' + i), 'food ' + i);
  for (let i = 0; i < 6; i++) assert.ok(body.includes('动作' + i));
  assert.ok(slices.some(s => s.diet && s.diet.summary === '摄入 400 kcal · 含估算'));
  assert.strictEqual(detail.train.more, 0);
  assert.strictEqual(detail.diet.more, 0);
  const brief = SD.buildShareModel({ date: '2026-11-18', train, diet: foods });
  assert.strictEqual(brief.diet.summary, detail.diet.summary);
  assert.ok(brief.train.rows.every(r => !r.lines));
});

test('no training still shares diet, and an empty day stays a rest card', () => {
  const dietOnly = SD.buildShareModel({
    mode: 'detail', date: '2026-11-18', train: [],
    diet: [{ name: '牛奶', mealLabel: '早餐', kcal: 120, createdAt: 1 }],
  });
  assert.strictEqual(dietOnly.rest, false);
  assert.strictEqual(dietOnly.train.empty, true);
  assert.strictEqual(dietOnly.diet.summary, '摄入 120 kcal');
  assert.strictEqual(dietOnly.diet.rows[0].name, '牛奶');
  const rest = SD.buildShareModel({ mode: 'detail', date: '2026-11-18', train: [], diet: [] });
  assert.strictEqual(rest.rest, true);
  assert.strictEqual(SD.exportLimit('ios'), 4096);
  assert.strictEqual(SD.exportLimit('android'), 8192);
});

test('switching the same input does not change diet totals or invent strength volume', () => {
  const input = {
    date: '2026-11-18',
    train: [{ kind: 'strength', name: '推', minutes: 30, volumeKg: 240, timeSec: 0, createdAt: 1, exercises: [
      { name: '卧推', sets: [set({ index: 1, weightKg: 20, reps: 12 }), set({ index: 2, weightKg: 20, reps: 12 }), set({ index: 3, weightKg: 20, reps: 12 })] },
    ] }],
    diet: [{ name: '面条', mealLabel: '午餐', kcal: 300, estimate: false, createdAt: 1 }],
  };
  const brief = SD.buildShareModel(input);
  const detail = SD.buildShareModel(Object.assign({ mode: 'detail' }, input));
  assert.strictEqual(brief.diet.summary, detail.diet.summary);
  assert.deepStrictEqual(brief.diet.rows.map(r => r.name), detail.diet.rows.map(r => r.name));
  assert.ok(texts(detail).includes('20 kg×12次×3组'));
  assert.ok(!texts(brief).includes('20 kg×12次×3组'));
  assert.strictEqual(brief.train.summary, '30 分钟');
  assert.ok(detail.train.summary.includes('总训练重量 240 kg'));
  assert.ok(detail.train.summary.includes('用时 30 分钟（含休息）'));
});
