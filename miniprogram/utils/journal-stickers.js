// 日历手账贴纸。图片在分包 pages/journal-pack，主包只留关键词匹配。
const ROOT = '/pages/journal-pack/stickers/';
const src = name => ROOT + name + '.png';

const FOOD = [
  { key: 'bibimbap', words: ['拌饭', '米饭', '炒饭', '盖饭', '粥', '寿司', '饭'] },
  { key: 'noodles', words: ['面', '粉', '饺', '馄饨', '拉面'] },
  { key: 'meat', words: ['肉', '鸡', '牛', '猪', '鱼', '虾', '蛋', '排', '腿'] },
  { key: 'blueberries', words: ['蓝莓', '莓', '草莓', '葡萄'] },
  { key: 'fruit', words: ['果', '苹果', '香蕉', '橙', '梨', '桃'] },
  { key: 'drink', words: ['奶', '咖啡', '茶', '汁', '豆浆', '酒', '可乐', '水'] },
  { key: 'snack', words: ['饼', '糖', '巧克力', '零食', '薯', '坚果', '面包', '蛋糕'] },
];

const CARDIO = {
  treadmill_incline: 'shoe',
  stair_climber: 'shoe',
  run: 'shoe',
  walk: 'shoe',
  cycle: 'bike',
  row: 'row',
  swim: 'swim',
  jump_rope: 'rope',
  elliptical: 'mat',
  custom: 'shoe',
};

function foodSticker(name) {
  const text = String(name || '');
  const hit = FOOD.find(row => row.words.some(word => text.includes(word)));
  return src(hit ? hit.key : 'bowl');
}

function trainSticker(kind, activityType) {
  if (kind !== 'aerobic') return src('dumbbell');
  return src(CARDIO[activityType] || 'shoe');
}

module.exports = { src, foodSticker, trainSticker, FOOD, CARDIO };
