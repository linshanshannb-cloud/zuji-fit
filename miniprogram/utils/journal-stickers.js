// 日历手账贴纸。只引用分包里的实物透明 PNG。没有同等贴纸的关键词退回实物碗（拌饭）或跑鞋。
const ROOT = '/pages/journal-pack/stickers/';
const src = name => ROOT + name + '.png';
const BOWL = 'bibimbap';

const FOOD = [
  { key: 'fried-chicken', words: ['炸鸡', '鸡排', '炸翅', '鸡腿', '鸡块', '鸡'] },
  { key: 'blueberries', words: ['蓝莓', '草莓', '葡萄', '莓'] },
  { key: 'bibimbap', words: ['拌饭', '石锅', '米饭', '炒饭', '盖饭', '粥', '寿司', '饭'] },
];

const CARDIO = {
  elliptical: 'elliptical',
  treadmill_incline: 'shoe',
  stair_climber: 'shoe',
  run: 'shoe',
  walk: 'shoe',
  cycle: 'shoe',
  row: 'shoe',
  swim: 'shoe',
  jump_rope: 'shoe',
  custom: 'shoe',
};

function foodSticker(name) {
  const text = String(name || '');
  const hit = FOOD.find(row => row.words.some(word => text.includes(word)));
  return src(hit ? hit.key : BOWL);
}

function trainSticker(kind, activityType) {
  if (kind !== 'aerobic') return src('dumbbell');
  return src(CARDIO[activityType] || 'shoe');
}

module.exports = { src, foodSticker, trainSticker, FOOD, CARDIO, BOWL };
