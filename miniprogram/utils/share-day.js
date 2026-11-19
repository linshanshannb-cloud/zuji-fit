// 「分享当天」的图内容。纯数据，不画布、不读存储。消耗和摄入分开，不合成一个总热量。
const D = require('./date');
const F = require('./format');
const JS = require('./journal-stickers');
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const SKIP_MEAL = { '其他记录': 1, '': 1 };
const ROW_GAP = 16;
const MAX_H = 8000;
// 画布导出上限，不是页面 CSS。iOS 上 canvas 单边超过 4096 时 canvasToTempFilePath 会失败或空白；
// Android 常见到 8192。宽固定 1080，所以高度取单边和 16777216 像素面积里更小的那个。
const CANVAS_W = 1080;
const AREA_MAX = 16777216;
function exportLimit(platform) {
  const side = /android/i.test(String(platform || '')) ? 8192 : 4096;
  return Math.min(side, Math.floor(AREA_MAX / CANVAS_W));
}

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
  let kcal = 0, any = false, est = 0;
  rows.forEach(r => {
    if (pos(r.kcal)) { kcal += r.kcal; any = true; }
    if (r.estimate) est += 1;
  });
  if (!any) return '';
  const mark = !est ? '' : (est === rows.length ? ' · 估算' : ' · 含估算');
  return '摄入 ' + kcal + ' kcal' + mark;
}

function trainSub(row) {
  const bits = [];
  if (pos(row.minutes)) bits.push(row.minutes + ' 分钟');
  if (row.kind !== 'aerobic' && pos(row.sets)) bits.push(row.sets + ' 组');
  if (row.kind === 'aerobic' && pos(row.kcal)) bits.push('消耗 ' + row.kcal + ' kcal');
  return bits.join(' · ');
}

function rowSpan(row) {
  if (row && row.compact) return 36 + ((row.lines && row.lines.length) || 0) * 34;
  const size = row && row.large ? 172 : 140;
  const base = Math.max(148, size + 8);
  const n = row && row.lines ? row.lines.length : 0;
  if (!n) return base;
  return Math.max(base, 128 + n * 34 + 12);
}
function rowsSpan(rows) {
  let h = 0;
  (rows || []).forEach((row, i) => { if (i) h += ROW_GAP; h += rowSpan(row); });
  return h;
}
function summaryExtra(block) {
  return block && block.summaryLines && block.summaryLines.length ? block.summaryLines.length * 32 : 0;
}
function cardHeight(model) {
  model = model || {};
  if (model.layout === 'detail') return model.height || 1440;
  let y = 280;
  if (!model.train && !model.diet) return 1440;
  if (model.rest) {
    y = 280 + 130 + 140;
    y = y + 8 + 140;
  } else {
    const train = model.train || { empty: true, rows: [] };
    const diet = model.diet || { empty: true, rows: [] };
    const showTrain = !train.skip;
    const showDiet = !diet.skip;
    if (showTrain) {
      y += 36 + summaryExtra(train);
      if (train.empty) y += 12 + 140;
      else {
        y += 8 + rowsSpan(train.rows);
        if (train.more) y += 40;
      }
    }
    if (showTrain && showDiet) y += 48;
    if (showDiet) {
      y += 36 + summaryExtra(diet);
      if (diet.empty) y += 12 + 140;
      else {
        y += 8 + rowsSpan(diet.rows);
        if (diet.more) y += 40;
      }
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
    large: JS.foodLarge(row.name),
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

const Detail = require('./share-detail-layout');
function buildShareModel(input) {
  input = input || {};
  const parts = dateParts(input.date);
  const train = (input.train || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const diet = (input.diet || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (input.mode === 'detail' && (train.length || diet.length)) return Detail.build(input, parts, train, diet);
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

module.exports = { buildShareModel, dateParts, cardHeight, rowSpan, MAX_H, exportLimit };
