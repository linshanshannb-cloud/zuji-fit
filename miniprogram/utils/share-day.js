// 「分享当天」的图内容。纯数据，不画布、不读存储。消耗和摄入分开，不合成一个总热量。
const D = require('./date');
const JS = require('./journal-stickers');
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const SKIP_MEAL = { '其他记录': 1, '': 1 };
const ROW_GAP = 16;
const MAX_H = 8000;

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

function dietLarge(sticker) {
  return !/coffee|soda|milktea|blueberries|eggs/.test(sticker || '');
}
function rowSpan(row) {
  const size = row.large ? 172 : 140;
  return Math.max(148, size + 8);
}
function rowsSpan(rows) {
  let h = 0;
  (rows || []).forEach((row, i) => { if (i) h += ROW_GAP; h += rowSpan(row); });
  return h;
}
function cardHeight(model) {
  model = model || {};
  let y = 280;
  if (!model.train && !model.diet) return 1440;
  if (model.rest) {
    y = 280 + 130 + 140;
    y = y + 8 + 140;
  } else {
    const train = model.train || { empty: true, rows: [] };
    const diet = model.diet || { empty: true, rows: [] };
    y += 36;
    if (train.empty) y += 12 + 140;
    else {
      y += 8 + rowsSpan(train.rows);
      if (train.more) y += 40;
    }
    y += 48;
    y += 36;
    if (diet.empty) y += 12 + 140;
    else {
      y += 8 + rowsSpan(diet.rows);
      if (diet.more) y += 40;
    }
  }
  return Math.max(1440, y + 120);
}
function trainRow(row, i) {
  return {
    sticker: row.kind === 'aerobic' ? JS.trainSticker('aerobic', row.activityType, row.name) : JS.trainSticker('strength'),
    tag: row.kind === 'aerobic' ? '有氧' : '力量',
    name: row.name || (row.kind === 'aerobic' ? '有氧' : '力量'),
    sub: trainSub(row),
    rot: i % 2 ? 6 : -7,
    large: false,
  };
}
function dietRow(row, i) {
  const meal = row.mealLabel && !SKIP_MEAL[row.mealLabel] ? row.mealLabel : '';
  const sticker = JS.foodSticker(row.name);
  return {
    sticker,
    name: row.name || '饮食',
    sub: meal,
    kcalText: pos(row.kcal) ? row.kcal + ' kcal' : '',
    rot: i % 2 ? 6 : -7,
    large: dietLarge(sticker),
  };
}
function fitRows(trainRows, dietRows) {
  let train = trainRows;
  let diet = dietRows;
  let trainMore = 0;
  let dietMore = 0;
  const heightOf = () => cardHeight({
    rest: false,
    train: { empty: !train.length, rows: train, more: trainMore },
    diet: { empty: !diet.length, rows: diet, more: dietMore },
  });
  while (heightOf() > MAX_H && (diet.length > 1 || train.length > 1)) {
    if (diet.length >= train.length && diet.length > 1) {
      diet = diet.slice(0, diet.length - 1);
      dietMore += 1;
    } else if (train.length > 1) {
      train = train.slice(0, train.length - 1);
      trainMore += 1;
    } else break;
  }
  return { train, diet, trainMore, dietMore };
}
function buildShareModel(input) {
  input = input || {};
  const parts = dateParts(input.date);
  const train = (input.train || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const diet = (input.diet || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const trainRows = train.map(trainRow);
  const dietRows = diet.map(dietRow);
  const fit = fitRows(trainRows, dietRows);
  return {
    date: input.date,
    dateLabel: parts.dateLabel,
    weekLabel: parts.weekLabel,
    rest: !train.length && !diet.length,
    train: {
      empty: !train.length,
      summary: trainSummary(train),
      more: fit.trainMore,
      rows: fit.train,
    },
    diet: {
      empty: !diet.length,
      summary: dietSummary(diet),
      more: fit.dietMore,
      rows: fit.diet,
    },
  };
}

module.exports = { buildShareModel, dateParts, cardHeight, MAX_H };
