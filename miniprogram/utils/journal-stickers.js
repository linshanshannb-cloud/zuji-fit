// 日历、餐次详情、分享共用这一套匹配。图片在分包 pages/journal-pack/stickers。
// 先命中先得，所以具体菜名放在泛类前面。贴纸按食物名现算，不写进营养记录。
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
    if (word === '面' && (raw.indexOf('面包') >= 0 || raw.indexOf('面粉') >= 0) && !/面条|拉面|炒面|刀削|面片|米线|螺蛳粉|凉面|拌面|汤面/.test(raw)) continue;
    if (word === '汤' && raw.indexOf('汤圆') >= 0) continue;
    if ((word === '葡萄' || word === '提子') && raw.indexOf('酒') >= 0) continue;
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
  { key: 'pancake', words: ['鸡蛋灌饼', '煎饼果子', '手抓饼', '葱油饼', '鸡蛋饼', '烙饼', '锅盔', '馅饼', '煎饼'] },
  { key: 'bread', words: ['牛角包', '可颂', '法棍', '贝果', '吐司', '餐包', '面包'] },
  { key: 'bao', words: ['灌汤包', '小笼包', '汤包', '菜包', '肉包', '生煎', '烧麦', '花卷', '馒头', '包子', '小笼'] },
  { key: 'chicken-feet', words: ['泡椒凤爪', '柠檬凤爪', '虎皮凤爪', '柠檬鸡爪', '鸡爪', '凤爪'] },
  { key: 'milktea', words: ['珍珠奶茶', '奶茶', '奶绿', '波霸'] },
  { key: 'coffee', words: ['卡布奇诺', 'cappuccino', '手冲', '浓缩', '拿铁', '美式', '摩卡', 'coffee', 'latte', '咖啡'] },
  { key: 'beer', words: ['啤酒', '生啤', '扎啤', '黑啤', '白啤', '精酿', '听啤', '罐啤', 'beer'] },
  { key: 'soda', words: ['气泡水', '碳酸', '雪碧', '可乐', '汽水', '饮料', '饮品', '果茶'] },
  { key: 'milk', words: ['纯牛奶', '牛奶', '鲜奶', '酸奶', '优格', '纯奶'] },
  { key: 'dumplings', words: ['虾仁饺', '虾饺', '水饺', '煎饺', '蒸饺', '饺子', '馄饨', '云吞'] },
  { key: 'noodles', words: ['日式拉面', '螺蛳粉', '酸辣粉', '桂林米粉', '炒米粉', '沙河粉', '河粉', '肠粉', '凉粉', '米粉', '粉丝', '粉条', '面条', '拉面', '米线', '炒面', '刀削', '面片', '面'] },
  { key: 'rice', words: ['蛋炒饭', '米饭', '盖饭', '炒饭', '盒饭', '白饭', '饭'] },
  { key: 'chips', words: ['薯片', '虾条'] },
  { key: 'fried', words: ['天妇罗', '炸物', '油炸', '炸串', '薯条', '炸虾', '炸排'] },
  { key: 'shrimp', words: ['基围虾', '油焖虾', '白灼虾', '大虾', '虾仁', '虾'] },
  { key: 'bbq', words: ['烤羊肉串', '烧烤', '烤肉', '烤串', '烤翅', '撸串', '烤五花'] },
  { key: 'beef', words: ['牛腩', '肥牛', '牛排', '牛肉'] },
  { key: 'chicken', words: ['白斩鸡', '宫保鸡', '鸡胸', '鸡柳', '鸡腿', '鸡肉'] },
  { key: 'pork', words: ['红烧肉', '五花', '猪排', '排骨', '猪肉'] },
  { key: 'lamb', words: ['羊蝎子', '羊肉串', '烤羊', '羊排', '羊肉'] },
  { key: 'tofu', words: ['麻婆豆腐', '臭豆腐', '豆腐', '豆干', '豆皮', '千张'] },
  { key: 'dessert', words: ['冰淇淋', '甜品', '蛋糕', '布丁', '雪糕', '蛋挞', '泡芙', '月饼'] },
  { key: 'eggs', words: ['番茄炒蛋', '水煮蛋', '蛋羹', '煎蛋', '蒸蛋', '炒蛋', '鸡蛋'] },
  { key: 'fish', words: ['清蒸鱼', '鲈鱼', '鳕鱼', '鱼片', '鱼排', '鱼'] },
  { key: 'salad', words: ['蔬菜沙拉', '沙拉', '色拉'] },
  { key: 'veg', words: ['西兰花', '青菜', '生菜', '菠菜', '白菜', '菜心'] },
  { key: 'tea', words: ['绿茶', '红茶', '乌龙', '花茶', '清茶', '茶'] },
  { key: 'congee', words: ['皮蛋瘦肉粥', '小米粥', '南瓜粥', '八宝粥', '白粥', '粥'] },
  { key: 'soup', words: ['番茄蛋花汤', '西红柿汤', '蛋花汤', '紫菜汤', '胡辣汤', '酸辣汤', '番茄汤', '味噌汤', '例汤', '汤'] },
  { key: 'blueberries', words: ['蓝莓', '浆果', '草莓', '莓'] },
  { key: 'banana', words: ['香蕉', '芭蕉'] },
  { key: 'apple', words: ['苹果'] },
  { key: 'citrus', words: ['葡萄柚', '橙子', '橘子', '桔子', '柑橘', '柚子', '柠檬', '柳橙', '金桔', '青柠'] },
  { key: 'grapes', words: ['葡萄', '提子'] },
  { key: 'fruit', words: ['水果拼盘', '水果', '果盘', '猕猴桃', '奇异果', '火龙果', '水蜜桃', '哈密瓜', '西瓜', '樱桃', '芒果', '菠萝', '凤梨', '牛油果', '榴莲', '黄桃', '蜜桃', '蟠桃', '桃子', '雪梨', '鸭梨', '梨子', '梨'] },
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

const SMALL = { coffee: 1, soda: 1, milktea: 1, blueberries: 1, eggs: 1, beer: 1, tea: 1, milk: 1, chips: 1 };
function foodLarge(name) { return !SMALL[foodKey(name)]; }
function foodSticker(name) { return src(foodKey(name)); }

function trainSticker(kind, activityType, name) {
  if (kind !== 'aerobic') return src('dumbbell');
  return src(cardioKey(activityType, name));
}

module.exports = { src, norm, foodKey, cardioKey, foodSticker, foodLarge, trainSticker, FOOD, CARDIO };
