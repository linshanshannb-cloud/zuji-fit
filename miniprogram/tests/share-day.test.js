const test = require('node:test');
const assert = require('node:assert');
const SD = require('../utils/share-day');

test('share card keeps burn and intake apart, caps rows, and allows an empty day', () => {
  const empty = SD.buildShareModel({ date: '2026-11-12', train: [], diet: [] });
  assert.strictEqual(empty.rest, true);
  assert.strictEqual(empty.dateLabel, '11月12日');
  assert.strictEqual(empty.weekLabel, '周四');
  assert.strictEqual(empty.train.summary, '还没有记录');
  const full = SD.buildShareModel({
    date: '2026-11-12',
    train: [
      { kind: 'strength', name: '上肢推', minutes: 45, sets: 6, createdAt: 1 },
      { kind: 'aerobic', name: '跑步机', activityType: 'treadmill_incline', minutes: 45, kcal: 320, createdAt: 2 },
    ],
    diet: [
      { name: '石锅拌饭', mealLabel: '午餐', kcal: 540, createdAt: 1 },
      { name: '韩式炸鸡', mealLabel: '晚餐', kcal: 480, createdAt: 2 },
      { name: '珍珠奶茶', mealLabel: '加餐', kcal: 160, createdAt: 3 },
    ],
  });
  assert.strictEqual(full.rest, false);
  assert.strictEqual(full.train.summary, '消耗 320 kcal · 90 分钟');
  assert.strictEqual(full.diet.summary, '摄入 1180 kcal');
  assert.ok(!full.train.summary.includes('摄入') && !full.diet.summary.includes('消耗'));
  assert.strictEqual(full.train.rows[0].tag, '力量');
  assert.ok(full.train.rows[1].sticker.endsWith('/treadmill.png'));
  assert.ok(full.train.rows[1].sub.includes('消耗 320 kcal'));
  assert.strictEqual(full.diet.rows[2].sub, '加餐');
  const many = SD.buildShareModel({
    date: '2026-11-12',
    train: [1, 2, 3, 4, 5].map(i => ({ kind: 'strength', name: '第' + i, minutes: 10, createdAt: i })),
    diet: [],
  });
  assert.strictEqual(many.train.rows.length, 5);
  assert.strictEqual(many.train.more, 0);
  assert.strictEqual(many.diet.empty, true);
  assert.strictEqual(many.rest, false);
  const meals = ['早餐', '午餐', '晚餐', '加餐'];
  const foods = [];
  meals.forEach((meal, mi) => {
    for (let i = 0; i < 6; i++) foods.push({ name: meal + i, mealLabel: meal, kcal: 100, createdAt: mi * 10 + i });
  });
  const busy = SD.buildShareModel({
    date: '2026-11-13',
    train: [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ kind: 'strength', name: '训练' + i, minutes: 10, sets: 3, createdAt: i })),
    diet: foods,
  });
  assert.strictEqual(busy.train.rows.length, 8);
  assert.strictEqual(busy.diet.rows.length, 24);
  assert.strictEqual(busy.train.more, 0);
  assert.strictEqual(busy.diet.more, 0);
  assert.strictEqual(busy.train.summary, '80 分钟');
  assert.strictEqual(busy.diet.summary, '摄入 2400 kcal');
  const h = SD.cardHeight(busy);
  assert.ok(h > 1440 && h <= SD.MAX_H, 'height ' + h);
  const huge = [];
  for (let i = 0; i < 80; i++) huge.push({ name: '食物' + i, mealLabel: '午餐', kcal: 10, createdAt: i });
  const capped = SD.buildShareModel({ date: '2026-11-13', train: [], diet: huge });
  assert.ok(capped.diet.rows.length < 80);
  assert.ok(capped.diet.more > 0);
  assert.strictEqual(capped.diet.summary, '摄入 800 kcal');
  assert.ok(SD.cardHeight(capped) <= SD.MAX_H);
  const noKcal = SD.buildShareModel({
    date: '2026-11-12',
    train: [{ kind: 'strength', name: '推', minutes: 20, createdAt: 1 }],
    diet: [{ name: '苹果', mealLabel: '加餐', kcal: null, createdAt: 1 }],
  });
  assert.strictEqual(noKcal.train.summary, '20 分钟');
  assert.ok(!noKcal.train.summary.includes('0 kcal'));
  assert.strictEqual(noKcal.diet.summary, '');
});
