// 「分享当天」的图内容。纯数据，不画布、不读存储。消耗和摄入分开，不合成一个总热量。
const D = require('./date');
const JS = require('./journal-stickers');
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MAX = 4;
const SKIP_MEAL = { '其他记录': 1, '': 1 };

function dateParts(date) {
  const d = D.parse(date);
  return { dateLabel: (d.getMonth() + 1) + '月' + d.getDate() + '日', weekLabel: WEEK[d.getDay()] };
}

function pos(n) { return typeof n === 'number' && n > 0 ? n : 0; }

function trainSummary(rows) {
  let kcal = 0, min = 0, anyKcal = false, anyMin = false;
  rows.forEach(r => {
    if (pos(r.kcal)) { kcal += r.kcal; anyKcal = true; }
    if (pos(r.minutes)) { min += r.minutes; anyMin = true; }
  });
  if (!rows.length) return '还没有记录';
  if (anyKcal && anyMin) return '消耗 ' + kcal + ' kcal · ' + min + ' 分钟';
  if (anyKcal) return '消耗 ' + kcal + ' kcal';
  if (anyMin) return min + ' 分钟';
  return '';
}

function dietSummary(rows) {
  if (!rows.length) return '还没有记录';
  let kcal = 0, any = false;
  rows.forEach(r => { if (pos(r.kcal)) { kcal += r.kcal; any = true; } });
  return any ? '摄入 ' + kcal + ' kcal' : '';
}

function trainSub(row) {
  const bits = [];
  if (pos(row.minutes)) bits.push(row.minutes + ' 分钟');
  if (row.kind !== 'aerobic' && pos(row.sets)) bits.push(row.sets + ' 组');
  if (row.kind === 'aerobic' && pos(row.kcal)) bits.push('消耗 ' + row.kcal + ' kcal');
  return bits.join(' · ');
}

function buildShareModel(input) {
  input = input || {};
  const parts = dateParts(input.date);
  const train = (input.train || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const diet = (input.diet || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const trainShown = train.slice(0, MAX);
  const dietShown = diet.slice(0, MAX);
  return {
    date: input.date,
    dateLabel: parts.dateLabel,
    weekLabel: parts.weekLabel,
    rest: !train.length && !diet.length,
    train: {
      empty: !train.length,
      summary: trainSummary(train),
      more: Math.max(0, train.length - MAX),
      rows: trainShown.map((row, i) => ({
        sticker: row.kind === 'aerobic' ? JS.trainSticker('aerobic', row.activityType, row.name) : JS.trainSticker('strength'),
        tag: row.kind === 'aerobic' ? '有氧' : '力量',
        name: row.name || (row.kind === 'aerobic' ? '有氧' : '力量'),
        sub: trainSub(row),
        rot: i % 2 ? 6 : -7,
      })),
    },
    diet: {
      empty: !diet.length,
      summary: dietSummary(diet),
      more: Math.max(0, diet.length - MAX),
      rows: dietShown.map((row, i) => {
        const meal = row.mealLabel && !SKIP_MEAL[row.mealLabel] ? row.mealLabel : '';
        return {
          sticker: JS.foodSticker(row.name),
          name: row.name || '饮食',
          sub: meal,
          kcalText: pos(row.kcal) ? row.kcal + ' kcal' : '',
          rot: i % 2 ? 6 : -7,
        };
      }),
    },
  };
}

module.exports = { buildShareModel, dateParts, MAX };
