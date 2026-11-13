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
  assert.strictEqual(many.train.rows.length, 4);
  assert.strictEqual(many.train.more, 1);
  assert.strictEqual(many.diet.empty, true);
  assert.strictEqual(many.rest, false);
  const noKcal = SD.buildShareModel({
    date: '2026-11-12',
    train: [{ kind: 'strength', name: '推', minutes: 20, createdAt: 1 }],
    diet: [{ name: '苹果', mealLabel: '加餐', kcal: null, createdAt: 1 }],
  });
  assert.strictEqual(noKcal.train.summary, '20 分钟');
  assert.ok(!noKcal.train.summary.includes('0 kcal'));
  assert.strictEqual(noKcal.diet.summary, '');
});
