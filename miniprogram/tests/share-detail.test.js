// 详细版按手账稿排：主题大标题、组号分层、热身橙色、未完成不出现。精简版不走这里。
const test = require('node:test');
const assert = require('node:assert');
const SD = require('../utils/share-day');

function set(partial) {
  return Object.assign({ done: true, type: 'normal', weightKg: 20, reps: 12, durationSec: null, index: 1 }, partial);
}
function flat(model) {
  const slices = model.slices || [model];
  const bits = [];
  slices.forEach(s => {
    bits.push(s.theme || '');
    bits.push(s.dateLabel || '');
    bits.push(s.cont || '');
    (s.blocks || []).forEach(b => {
      bits.push(b.type + ':' + (b.name || b.label || b.text || ''));
      (b.rows || []).forEach(r => bits.push([r.label, r.main, r.times].filter(Boolean).join(' ')));
      (b.lines || []).forEach(line => bits.push(line.k + ' ' + line.v));
      if (b.meta) bits.push(b.meta);
      if (b.parts) bits.push(b.parts);
      if (b.kcal) bits.push(b.kcal);
    });
  });
  return bits.join('\n');
}

test('brief share is unchanged and does not use the detail layout', () => {
  const brief = SD.buildShareModel({
    date: '2026-11-18',
    train: [{ kind: 'strength', givenName: '腿日', name: '腿日', minutes: 40, sets: 3, createdAt: 1 }],
    diet: [{ name: '米饭', mealLabel: '午餐', kcal: 200, estimate: true, createdAt: 1 }],
  });
  assert.strictEqual(brief.layout, undefined);
  assert.strictEqual(brief.train.summary, '40 分钟');
  assert.strictEqual(brief.diet.summary, '摄入 200 kcal · 估算');
  assert.ok(!brief.train.rows[0].rows);
});

test('ordinary day is one short page: merged sets, warmup, timed hold, diet total', () => {
  const detail = SD.buildShareModel({
    mode: 'detail', date: '2026-11-18',
    train: [{
      kind: 'strength', givenName: '腿日', name: '腿日', minutes: 52, volumeKg: 1040, timeSec: 240, createdAt: 1,
      exercises: [
        { name: '杠铃深蹲', sets: [
          set({ index: 1, weightKg: 20, reps: 10, type: 'warmup' }),
          set({ index: 2, weightKg: 20, reps: 12 }),
          set({ index: 3, weightKg: 20, reps: 12 }),
          set({ index: 4, weightKg: 20, reps: 12 }),
          set({ index: 5, weightKg: 40, reps: 8 }),
          set({ index: 6, weightKg: 100, reps: 5, done: false }),
        ] },
        { name: '日本坐', mode: 'time', sets: [1, 2, 3, 4].map(i => set({ index: i, reps: null, weightKg: null, durationSec: 60 })) },
      ],
    }, { kind: 'aerobic', name: '跑步机爬坡', activityType: 'treadmill_incline', minutes: 30, kcal: 240, createdAt: 2 }],
    diet: [
      { name: '牛奶', mealLabel: '早餐', kcal: 120, createdAt: 1 },
      { name: '石锅拌饭', mealLabel: '午餐', kcal: 540, estimate: true, createdAt: 2 },
    ],
  });
  assert.strictEqual(detail.slices.length, 1);
  assert.strictEqual(detail.theme, '腿日');
  assert.ok(detail.height <= 2048, 'height ' + detail.height);
  const body = flat(detail);
  assert.ok(body.includes('力量整次 52 分钟（含休息）'));
  assert.ok(body.includes('有氧 30 分钟'));
  assert.ok(body.includes('计时组 4 分钟（不含休息）'));
  assert.ok(body.includes('训练量 1,040 kg'));
  assert.ok(body.includes('1–3组 20 kg 12次'));
  assert.ok(body.includes('4组 40 kg 8次'));
  assert.ok(body.includes('热身 20 kg 10次'));
  assert.ok(!body.includes('100 kg'));
  assert.ok(body.includes('1–4组 1 分钟'));
  assert.ok(body.includes('跑步机爬坡'));
  assert.ok(body.includes('660'));
  assert.ok(!body.includes('示例数据'));
  assert.ok(!/exercise:[\s\S]*工作组/.test(body));
  const ex = detail.slices[0].blocks.filter(b => b.type === 'exercise');
  ex.forEach(b => assert.ok(!('workLabel' in b)));
  assert.strictEqual(detail.slices[0].blocks.filter(b => b.type === 'stats').length, 1);
  assert.strictEqual(detail.slices[0].blocks.filter(b => b.type === 'session').length, 0);
});

test('identical sets separated by a warmup or a different set stay apart, including zero load', () => {
  const detail = SD.buildShareModel({
    mode: 'detail', date: '2026-11-18',
    train: [{
      kind: 'strength', givenName: '自重日', name: '自重日', minutes: null, volumeKg: 0, timeSec: 0, createdAt: 1,
      exercises: [{ name: '引体向上', sets: [
        set({ index: 1, weightKg: null, reps: 8 }),
        set({ index: 2, weightKg: null, reps: 8, type: 'warmup' }),
        set({ index: 3, weightKg: null, reps: 8 }),
        set({ index: 4, weightKg: 0, reps: 8 }),
      ] }],
    }],
    diet: [],
  });
  const rows = detail.slices[0].blocks.find(b => b.type === 'exercise').rows;
  assert.deepStrictEqual(rows.map(r => r.label + ' ' + r.main), ['1组 自重', '热身 自重', '2组 自重', '3组 0 kg']);
  const body = flat(detail);
  assert.ok(body.includes('训练量 0 kg'));
  assert.ok(!body.includes('力量整次'));
  assert.ok(!body.includes('计时组'));
});

test('no custom title becomes 训练记录, timed weight stays out of volume, old sets still expand', () => {
  const detail = SD.buildShareModel({
    mode: 'detail', date: '2026-11-01',
    train: [{
      kind: 'strength', givenName: '', name: '11月1日训练', minutes: 20, volumeKg: 500, timeSec: 60, createdAt: 1,
      exercises: [
        { name: '卧推', sets: [set({ index: 1, weightKg: 50, reps: 10 })] },
        { name: '平板', mode: 'time', sets: [set({ index: 1, weightKg: 15, reps: null, durationSec: 60 })] },
      ],
    }],
    diet: [],
  });
  assert.strictEqual(detail.theme, '训练记录');
  const body = flat(detail);
  assert.ok(body.includes('50 kg'));
  assert.ok(body.includes('15 kg'));
  assert.ok(body.includes('1 分钟'));
  assert.ok(body.includes('训练量 500 kg'));
  assert.ok(!body.includes('515'));
});

test('long names, missing detail, and several workouts keep one stats block', () => {
  const longName = '超长动作名'.repeat(8);
  const detail = SD.buildShareModel({
    mode: 'detail', date: '2026-11-18',
    train: [
      { kind: 'strength', givenName: '上午', name: '上午', minutes: 15, volumeKg: 0, timeSec: 180, createdAt: 1, exercises: [
        { name: longName, mode: 'time', sets: [set({ index: 1, durationSec: 45, weightKg: null, reps: null }), set({ index: 2, durationSec: null, weightKg: null, reps: null })] },
      ] },
      { kind: 'strength', givenName: '下午', name: '下午', minutes: null, volumeKg: 100, timeSec: 0, createdAt: 2, detailMissing: true, exercises: [] },
    ],
    diet: [],
  });
  const body = flat(detail);
  assert.ok(body.includes(longName));
  assert.ok(body.includes('45 秒'));
  assert.ok(body.includes('时长缺失'));
  assert.ok(body.includes('训练详情缺失，不能展开各组'));
  assert.ok(body.includes('部分无用时'));
  assert.strictEqual(detail.slices.reduce((n, s) => n + s.blocks.filter(b => b.type === 'stats').length, 0), 1);
  assert.ok(body.includes('上午 15 分钟'));
});

test('a dense day keeps every food, puts the total only on the last page, and stays inside the canvas cap', () => {
  const foods = ['牛奶', '全麦面包', '水煮蛋', '香蕉', '鸡胸肉沙拉', '米饭', '蔬菜汤', '希腊酸奶', '蓝莓', '牛肉面', '凉拌蔬菜', '乳清蛋白粉'];
  const meals = ['早餐', '早餐', '早餐', '早餐', '午餐', '午餐', '午餐', '加餐', '加餐', '晚餐', '晚餐', '晚间'];
  const diet = foods.map((name, i) => ({ name, mealLabel: meals[i], kcal: 50 + i, estimate: i >= 9, createdAt: i }));
  const reps = (pairs) => pairs.map((p, i) => set({ index: i + 1, weightKg: p[0], reps: p[1], type: p[2] || 'normal' }));
  const train = [
    { kind: 'strength', givenName: '上午胸肩', name: '上午胸肩', minutes: 72, volumeKg: 4000, timeSec: 0, createdAt: 1, exercises: [
      { name: '史密斯机平板卧推', sets: reps([[40, 10, 'warmup'], [60, 10], [70, 8], [80, 6], [80, 6], [75, 8]]) },
      { name: '上斜哑铃飞鸟', sets: reps([[12, 12], [12, 12], [12, 12], [12, 12]]) },
      { name: '坐姿哑铃肩推', sets: reps([[16, 10], [18, 8], [18, 8], [16, 10]]) },
      { name: '哑铃侧平举', sets: reps([[8, 15], [8, 15], [8, 15], [8, 15]]) },
    ] },
    { kind: 'strength', givenName: '下午背部', name: '下午背部', minutes: 88, volumeKg: 6224, timeSec: 240, createdAt: 2, exercises: [
      { name: '宽距高位下拉', sets: reps([[30, 12, 'warmup'], [40, 12], [45, 10], [50, 8], [50, 8], [45, 10], [40, 12]]) },
      { name: '杠铃俯身划船', sets: reps([[50, 10], [60, 8], [70, 6], [70, 6], [60, 8]]) },
      { name: '单臂哑铃划船', sets: reps([[22, 10], [22, 10], [22, 10], [22, 10]]) },
      { name: '平板支撑', mode: 'time', sets: [45, 60, 60, 45, 30].map((sec, i) => set({ index: i + 1, durationSec: sec, weightKg: null, reps: null })) },
    ] },
    { kind: 'aerobic', name: '椭圆机间歇', activityType: 'elliptical', minutes: 40, kcal: 320, createdAt: 3 },
  ];
  const detail = SD.buildShareModel({ mode: 'detail', date: '2026-11-15', train, diet });
  assert.ok(detail.slices.length >= 2, 'pages ' + detail.slices.length);
  detail.slices.forEach(s => {
    assert.ok(s.height <= 2048, s.height);
    assert.strictEqual(s.dateLabel, '11月15日');
    assert.strictEqual(s.theme, '上午胸肩 + 下午背部');
    assert.ok(s.page && s.page.n === detail.slices.length);
  });
  const body = flat(detail);
  foods.forEach(name => assert.ok(body.includes(name), name));
  assert.ok(body.includes('椭圆机间歇'));
  assert.ok(body.includes('3–4组'));
  assert.ok(body.includes('热身'));
  const totals = [];
  detail.slices.forEach((s, i) => s.blocks.forEach(b => { if (b.type === 'total') totals.push(i); }));
  assert.deepStrictEqual(totals, [detail.slices.length - 1]);
  assert.ok(detail.diet.summary.includes('含估算'));
  assert.strictEqual(detail.slices.reduce((n, s) => n + s.blocks.filter(b => b.type === 'stats').length, 0), 1);
});

test('thirty foods continue onto another page instead of one endless canvas', () => {
  const diet = [];
  for (let i = 0; i < 30; i++) diet.push({ name: '食物' + i, mealLabel: '聚餐', kcal: 10, createdAt: i });
  const detail = SD.buildShareModel({ mode: 'detail', date: '2026-11-21', train: [], diet });
  assert.ok(detail.slices.length >= 2, 'pages ' + detail.slices.length);
  detail.slices.forEach(s => assert.ok(s.height <= SD.exportLimit('ios') / 2 || s.height <= 2048));
  const body = flat(detail);
  for (let i = 0; i < 30; i++) assert.ok(body.includes('食物' + i));
  const totals = [];
  detail.slices.forEach((s, i) => { if (s.blocks.some(b => b.type === 'total')) totals.push(i); });
  assert.deepStrictEqual(totals, [detail.slices.length - 1]);
  assert.strictEqual(detail.theme, '饮食记录');
});

test('an oversized exercise keeps set numbers continuous across the continuation page', () => {
  const sets = [];
  for (let i = 1; i <= 40; i++) sets.push(set({ index: i, weightKg: 20 + (i % 5), reps: 8 }));
  const detail = SD.buildShareModel({
    mode: 'detail', exportMaxH: 1200, date: '2026-11-20',
    train: [{ kind: 'strength', givenName: '测试日', name: '测试日', minutes: 40, volumeKg: 100, timeSec: 0, createdAt: 1, exercises: [{ name: '深蹲', sets }] }],
    diet: [],
  });
  assert.ok(detail.slices.length >= 2);
  const labels = [];
  detail.slices.forEach(s => {
    assert.strictEqual(s.theme, '测试日');
    assert.strictEqual(s.dateLabel, '11月20日');
    s.blocks.forEach(b => { if (b.type === 'exercise') (b.rows || []).forEach(r => labels.push(r.label)); });
  });
  assert.ok(labels[0] === '1组' || labels[0] === '1–1组');
  assert.ok(labels.some(l => l.indexOf('40') >= 0), labels.join(','));
  assert.ok(flat(detail).includes('深蹲（续）'));
  detail.slices.slice(1).forEach(s => assert.ok(s.cont));
});

test('switching modes keeps the diet total and does not invent a muscle title', () => {
  const input = {
    date: '2026-11-18',
    train: [{ kind: 'strength', givenName: '', name: '11月18日训练', minutes: 30, volumeKg: 240, timeSec: 0, createdAt: 1, exercises: [
      { name: '卧推', sets: [set({ index: 1 }), set({ index: 2 }), set({ index: 3 })] },
    ] }],
    diet: [{ name: '面条', mealLabel: '午餐', kcal: 300, createdAt: 1 }],
  };
  const brief = SD.buildShareModel(input);
  const detail = SD.buildShareModel(Object.assign({ mode: 'detail' }, input));
  assert.strictEqual(brief.diet.summary, detail.diet.summary);
  assert.strictEqual(detail.theme, '训练记录');
  assert.ok(!detail.theme.includes('胸'));
  assert.ok(flat(detail).includes('1–3组'));
});
