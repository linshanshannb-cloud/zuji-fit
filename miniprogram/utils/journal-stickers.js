// 日历手账贴纸。图片在分包 pages/journal-pack。主包只做关键词匹配。
// 咖啡 / 汉堡 / 汽水 按用户指定单独成类。对应 PNG 未到之前，文件是碗的占位，名字已定好，到图后按文件名替换。
const ROOT = '/pages/journal-pack/stickers/';
const src = name => ROOT + name + '.png';

function norm(text) {
  return String(text || '').replace(/\s+/g, '').toLowerCase();
}

function hit(text, words) {
  const raw = norm(text);
  if (!raw) return false;
  const sorted = words.slice().sort((a, b) => b.length - a.length);
  for (let i = 0; i < sorted.length; i++) {
    const word = norm(sorted[i]);
    if (!word || raw.indexOf(word) < 0) continue;
    if (word === '面' && raw.indexOf('面包') >= 0 && !/面条|拉面|炒面|刀削|面片|米线|螺蛳粉/.test(raw)) continue;
    if (word === '跑' && raw.indexOf('跑步机') >= 0) continue;
    return true;
  }
  return false;
}

// 先命中先得。细的词写在更前的组里。
const FOOD = [
  { key: 'fried-chicken', words: ['韩式炸鸡', '炸鸡翅', '鸡米花', '鸡块', '炸鸡'] },
  { key: 'bibimbap', words: ['石锅拌饭', '拌饭', '石锅'] },
  { key: 'hotpot', words: ['鸳鸯锅', '麻辣烫', '冒菜', '火锅', '涮'] },
  { key: 'japanese', words: ['三文鱼', '刺身', '寿司', '日料'] },
  { key: 'burger', words: ['芝士堡', '牛肉堡', '鸡腿堡', '汉堡', 'burger'] },
  { key: 'western', words: ['意大利面', '意面', '披萨', '西餐'] },
  { key: 'milktea', words: ['珍珠奶茶', '奶茶', '奶绿', '波霸'] },
  { key: 'coffee', words: ['卡布奇诺', 'cappuccino', '手冲', '浓缩', '拿铁', '美式', '摩卡', 'coffee', 'latte', '咖啡'] },
  { key: 'soda', words: ['气泡水', '碳酸', '雪碧', '可乐', '汽水', '饮料', '饮品', '果茶'] },
  { key: 'noodles', words: ['日式拉面', '螺蛳粉', '面条', '拉面', '米线', '炒面', '刀削', '面片', '面'] },
  { key: 'rice', words: ['蛋炒饭', '米饭', '盖饭', '炒饭', '盒饭', '白饭', '饭'] },
  { key: 'dumplings', words: ['水饺', '煎饺', '蒸饺', '饺子', '馄饨', '云吞'] },
  { key: 'fried', words: ['天妇罗', '炸物', '油炸', '炸串', '薯条', '炸虾', '炸排'] },
  { key: 'beef', words: ['牛腩', '肥牛', '牛排', '牛肉'] },
  { key: 'chicken', words: ['白斩鸡', '宫保鸡', '鸡胸', '鸡柳', '鸡腿', '鸡肉'] },
  { key: 'pork', words: ['红烧肉', '五花', '猪排', '排骨', '猪肉'] },
  { key: 'lamb', words: ['羊蝎子', '羊肉串', '烤羊', '羊排', '羊肉'] },
  { key: 'eggs', words: ['水煮蛋', '蛋羹', '煎蛋', '蒸蛋', '鸡蛋'] },
  { key: 'fish', words: ['清蒸鱼', '鲈鱼', '鳕鱼', '鱼片', '鱼排', '鱼'] },
  { key: 'blueberries', words: ['蓝莓', '浆果', '草莓', '水果', '莓'] },
];

const CARDIO = [
  { key: 'elliptical', words: ['椭圆仪', '椭圆机'], types: ['elliptical'] },
  { key: 'treadmill', words: ['跑步机', '走步机'], types: ['treadmill_incline'] },
  { key: 'stair', words: ['楼梯机', '台阶机', '爬楼机'], types: ['stair_climber'] },
  { key: 'bike', words: ['动感单车', '公路车', '自行车', '骑行', '单车', '骑车'], types: ['cycle'] },
  { key: 'rower', words: ['划船机', '划船'], types: ['row'] },
  { key: 'jumprope', words: ['跳绳'], types: ['jump_rope'] },
  { key: 'swim', words: ['自由泳', '蛙泳', '游泳'], types: ['swim'] },
  { key: 'shoe', words: ['户外跑', '慢跑', '夜跑', '跑步', '跑'], types: ['run', 'walk'] },
];

function foodKey(name) {
  const text = norm(name);
  for (let i = 0; i < FOOD.length; i++) if (hit(text, FOOD[i].words)) return FOOD[i].key;
  return 'bowl';
}

function cardioKey(activityType, name) {
  const text = norm(name);
  const type = String(activityType || '');
  for (let i = 0; i < CARDIO.length; i++) {
    if (hit(text, CARDIO[i].words)) return CARDIO[i].key;
  }
  for (let i = 0; i < CARDIO.length; i++) {
    if (CARDIO[i].types.indexOf(type) >= 0) return CARDIO[i].key;
  }
  return 'shoe';
}

const SMALL = { coffee: 1, soda: 1, milktea: 1, blueberries: 1, eggs: 1 };
function foodLarge(name) { return !SMALL[foodKey(name)]; }
function foodSticker(name) { return src(foodKey(name)); }

function trainSticker(kind, activityType, name) {
  if (kind !== 'aerobic') return src('dumbbell');
  return src(cardioKey(activityType, name));
}

module.exports = { src, norm, foodKey, cardioKey, foodSticker, foodLarge, trainSticker, FOOD, CARDIO };
