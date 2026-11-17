const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const JS = require('../utils/journal-stickers');

test('sticker keywords: designer order, with coffee burger soda overrides', () => {
  const food = name => JS.foodKey(name);
  assert.strictEqual(food('椭圆机'), 'bowl');
  assert.strictEqual(food('炸鸡翅'), 'fried-chicken');
  assert.strictEqual(food('石锅拌饭'), 'bibimbap');
  assert.strictEqual(food('牛肉汉堡'), 'burger');
  assert.strictEqual(food('芝士堡'), 'burger');
  assert.strictEqual(food('鸡腿堡'), 'burger');
  assert.strictEqual(food('意面'), 'western');
  assert.strictEqual(food('牛排'), 'beef');
  assert.strictEqual(food('牛肉面'), 'noodles');
  assert.strictEqual(food('珍珠奶茶'), 'milktea');
  assert.strictEqual(food('奶茶'), 'milktea');
  assert.strictEqual(food('果茶'), 'soda');
  assert.strictEqual(food('可乐'), 'soda');
  assert.strictEqual(food('饮料'), 'soda');
  assert.strictEqual(food('拿铁'), 'coffee');
  assert.strictEqual(food('美式'), 'coffee');
  assert.strictEqual(food('Latte'), 'coffee');
  assert.strictEqual(food('卡布奇诺'), 'coffee');
  assert.strictEqual(food('水果'), 'blueberries');
  assert.strictEqual(food('苹果'), 'bowl');
  assert.strictEqual(food('包子'), 'bao');
  assert.strictEqual(food(''), 'bowl');
  assert.ok(JS.foodSticker('炸鸡').endsWith('/fried-chicken.png'));
  assert.strictEqual(JS.foodLarge('汉堡'), true);
  assert.strictEqual(JS.foodLarge('拿铁'), false);
  assert.strictEqual(JS.foodLarge('可乐'), false);
  assert.ok(JS.trainSticker('strength', 'cycle', '动感单车').endsWith('/dumbbell.png'));
  assert.ok(JS.trainSticker('aerobic', 'cycle', '').endsWith('/bike.png'));
  assert.ok(JS.trainSticker('aerobic', 'elliptical', '椭圆机').endsWith('/elliptical.png'));
  assert.ok(JS.trainSticker('aerobic', 'treadmill_incline', '跑步机爬坡').endsWith('/treadmill.png'));
  assert.ok(JS.trainSticker('aerobic', 'stair_climber', '爬楼机').endsWith('/stair.png'));
  assert.ok(JS.trainSticker('aerobic', 'jump_rope', '').endsWith('/jumprope.png'));
  assert.ok(JS.trainSticker('aerobic', 'swim', '').endsWith('/swim.png'));
  assert.ok(JS.trainSticker('aerobic', 'row', '').endsWith('/rower.png'));
  assert.ok(JS.trainSticker('aerobic', 'custom', '随便动动').endsWith('/shoe.png'));
  assert.ok(JS.trainSticker('aerobic', 'run', '夜跑').endsWith('/shoe.png'));
});

test('new food stickers stay specific and do not steal older categories', () => {
  const food = name => JS.foodKey(name);
  const expect = {
    烧烤: 'bbq', 烤肉: 'bbq', 烤串: 'bbq', 撸串: 'bbq', 烤羊肉串: 'bbq',
    薯片: 'chips', 虾条: 'chips',
    啤酒: 'beer', 生啤: 'beer', 精酿: 'beer', 扎啤: 'beer',
    鸡爪: 'chicken-feet', 凤爪: 'chicken-feet', 泡椒凤爪: 'chicken-feet',
    面包: 'bread', 吐司: 'bread', 可颂: 'bread',
    包子: 'bao', 馒头: 'bao', 小笼包: 'bao',
    鸡蛋灌饼: 'pancake', 煎饼: 'pancake', 手抓饼: 'pancake',
    麻婆豆腐: 'tofu', 豆腐: 'tofu',
    小米粥: 'congee', 皮蛋瘦肉粥: 'congee',
    蛋花汤: 'soup', 番茄汤: 'soup',
    蛋糕: 'dessert', 冰淇淋: 'dessert',
    牛奶: 'milk', 酸奶: 'milk',
    沙拉: 'salad', 色拉: 'salad',
    白灼虾: 'shrimp', 虾仁: 'shrimp',
    绿茶: 'tea', 红茶: 'tea',
    西兰花: 'veg', 青菜: 'veg',
  };
  Object.keys(expect).forEach(name => assert.strictEqual(food(name), expect[name], name));
  assert.strictEqual(food('炒土豆片'), 'bowl');
  assert.strictEqual(food('土豆片'), 'bowl');
  assert.strictEqual(food('羊肉串'), 'lamb');
  assert.strictEqual(food('虾饺'), 'dumplings');
  assert.strictEqual(food('炸虾'), 'fried');
  assert.strictEqual(food('薯条'), 'fried');
  assert.strictEqual(food('汤圆'), 'bowl');
  assert.strictEqual(food('奶茶'), 'milktea');
  assert.strictEqual(food('珍珠奶茶'), 'milktea');
  assert.strictEqual(food('果茶'), 'soda');
  assert.strictEqual(food('番茄炒蛋'), 'eggs');
  assert.strictEqual(food('鸡腿'), 'chicken');
  assert.strictEqual(food('可乐'), 'soda');
  assert.strictEqual(food('水果'), 'blueberries');
  assert.strictEqual(food('草莓'), 'blueberries');
  assert.strictEqual(food('苹果'), 'bowl');
  assert.strictEqual(food('水果沙拉'), 'salad');
  assert.strictEqual(food('牛肉面'), 'noodles');
  assert.strictEqual(food('石锅拌饭'), 'bibimbap');
  ['bbq', 'chips', 'beer', 'chicken-feet', 'bread', 'bao', 'pancake', 'tofu', 'congee', 'soup', 'dessert', 'milk', 'salad', 'shrimp', 'tea', 'veg'].forEach(key => {
    const file = path.join(__dirname, '../pages/journal-pack/stickers', key + '.png');
    assert.ok(fs.existsSync(file), key);
    assert.ok(JS.foodSticker(Object.keys(expect).find(name => expect[name] === key)).endsWith('/' + key + '.png'));
  });
  assert.strictEqual(JS.foodLarge('啤酒'), false);
  assert.strictEqual(JS.foodLarge('烧烤'), true);
  const root = path.join(__dirname, '..');
  ['pages/calendar/calendar.js', 'pages/diet-extra/diet-meal/diet-meal.js', 'utils/share-day.js'].forEach(rel => {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(src.includes('foodSticker'), rel);
    assert.ok(!/pages\/journal-pack\/stickers\/bowl/.test(src), rel);
  });
  const share = fs.readFileSync(path.join(root, 'utils/share-day.js'), 'utf8');
  assert.ok(share.includes('foodLarge'));
});

test('rice noodles and glass noodles use the noodles sticker, powders do not', () => {
  const food = name => JS.foodKey(name);
  ['米粉', '桂林米粉', '炒米粉', '河粉', '沙河粉', '螺蛳粉', '粉丝', '粉条', '酸辣粉', '凉粉', '肠粉', '米线'].forEach(name => {
    assert.strictEqual(food(name), 'noodles', name);
    assert.ok(JS.foodSticker(name).endsWith('/noodles.png'), name);
  });
  ['奶粉', '蛋白粉', '淀粉', '面粉'].forEach(name => assert.strictEqual(food(name), 'bowl', name));
  assert.strictEqual(food('牛肉面'), 'noodles');
  assert.strictEqual(food('面包'), 'bread');
  assert.strictEqual(food('意面'), 'western');
});
