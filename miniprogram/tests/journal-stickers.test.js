const test = require('node:test');
const assert = require('node:assert');
const JS = require('../utils/journal-stickers');

test('journal stickers use photo assets and fall back to a real bowl or shoe', () => {
  assert.ok(JS.foodSticker('石锅拌饭').endsWith('/bibimbap.png'));
  assert.ok(JS.foodSticker('炸鸡').endsWith('/fried-chicken.png'));
  assert.ok(JS.foodSticker('蓝莓').endsWith('/blueberries.png'));
  assert.ok(JS.foodSticker('牛肉面').endsWith('/bibimbap.png'));
  assert.ok(JS.foodSticker('不知道是什么').endsWith('/bibimbap.png'));
  assert.ok(JS.trainSticker('strength').endsWith('/dumbbell.png'));
  assert.ok(JS.trainSticker('aerobic', 'run').endsWith('/shoe.png'));
  assert.ok(JS.trainSticker('aerobic', 'elliptical').endsWith('/elliptical.png'));
  assert.ok(JS.trainSticker('aerobic', 'cycle').endsWith('/shoe.png'));
  assert.ok(JS.trainSticker('aerobic', 'stair_climber').endsWith('/shoe.png'));
  assert.ok(!JS.foodSticker('米饭').includes('dumbbell'));
  assert.ok(!JS.trainSticker('strength').includes('bibimbap'));
  assert.ok(!JS.foodSticker('炸鸡').includes('meat'));
});
