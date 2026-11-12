const test = require('node:test');
const assert = require('node:assert');
const JS = require('../utils/journal-stickers');

test('journal stickers: food keywords, cardio equipment, bowl fallback, not in the matcher as a main-package file', () => {
  assert.ok(JS.foodSticker('石锅拌饭').endsWith('/bibimbap.png'));
  assert.ok(JS.foodSticker('牛肉面').endsWith('/noodles.png') || JS.foodSticker('牛肉面').endsWith('/meat.png'));
  assert.ok(JS.foodSticker('蓝莓').endsWith('/blueberries.png'));
  assert.ok(JS.foodSticker('美式咖啡').endsWith('/drink.png'));
  assert.ok(JS.foodSticker('不知道是什么').endsWith('/bowl.png'));
  assert.ok(JS.trainSticker('strength').endsWith('/dumbbell.png'));
  assert.ok(JS.trainSticker('aerobic', 'run').endsWith('/shoe.png'));
  assert.ok(JS.trainSticker('aerobic', 'cycle').endsWith('/bike.png'));
  assert.ok(JS.trainSticker('aerobic', 'stair_climber').endsWith('/shoe.png'));
  assert.ok(!JS.foodSticker('米饭').includes('dumbbell'));
  assert.ok(!JS.trainSticker('strength').includes('bibimbap'));
});
