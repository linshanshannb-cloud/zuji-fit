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
function durLabel(sec) {
  const text = F.dur(sec);
  return text.endsWith('分钟') ? text.slice(0, -2) + ' 分钟' : text;
}
function textWidth(s, px) {
  let w = 0;
  String(s || '').split('').forEach(ch => { w += ch.charCodeAt(0) > 255 ? px : px * 0.55; });
  return w;
}
function wrapPieces(text, px, maxW) {
  const parts = String(text || '').split(' · ').filter(Boolean);
  if (!parts.length) return [];
  const lines = [];
  let cur = '';
  parts.forEach(part => {
    const next = cur ? cur + ' · ' + part : part;
    if (cur && textWidth(next, px) > maxW) { lines.push(cur); cur = part; }
    else cur = next;
  });
  if (cur) lines.push(cur);
  return lines;
}
function wrapLine(s, px, maxW) {
  const out = [];
  let cur = '';
  String(s || '').split('').forEach(ch => {
    if (cur && textWidth(cur + ch, px) > maxW) { out.push(cur); cur = ch; }
    else cur += ch;
  });
  if (cur || !out.length) out.push(cur);
  return out;
}
function setKey(set, mode) {
  if (mode === 'time') {
    const dur = typeof set.durationSec === 'number' && set.durationSec > 0 ? F.dur(set.durationSec) : '时长缺失';
    const weighted = typeof set.weightKg === 'number' && set.weightKg > 0;
    return (weighted ? F.kg(set.weightKg) + ' kg×' : '') + dur;
  }
  const w = set.weightKg == null ? '自重' : F.kg(set.weightKg) + ' kg';
  const reps = typeof set.reps === 'number' ? set.reps : 0;
  return w + '×' + reps + '次';
}
// 只合并相邻且重量、次数（或时长）都相同的已完成组。中间隔了不同组或热身就断开。
function groupSetLines(sets, mode) {
  const done = (sets || []).filter(s => s && s.done === true).map((s, i) => ({ s, i }))
    .sort((a, b) => (Number(a.s.index) || 0) - (Number(b.s.index) || 0) || a.i - b.i)
    .map(x => x.s);
  if (!done.length) return [];
  let normal = 0, warm = 0;
  done.forEach(s => { if (s.type === 'warmup') warm += 1; else normal += 1; });
  const runs = [];
  done.forEach(s => {
    const isWarm = s.type === 'warmup';
    const key = setKey(s, mode);
    const last = runs[runs.length - 1];
    if (last && last.warm === isWarm && last.key === key) last.n += 1;
    else runs.push({ warm: isWarm, key, n: 1 });
  });
  return { normal, warm, runs };
}
function exerciseBlocks(ex) {
  const mode = ex && ex.mode === 'time' ? 'time' : 'reps';
  const grouped = groupSetLines(ex && ex.sets, mode);
  if (!grouped.runs) return [];
  const title = (ex.name || '动作') + ' · 已完成 ' + grouped.normal + ' 组' + (grouped.warm ? ' · 热身 ' + grouped.warm + ' 组' : '');
  const lines = [{ kind: 'ex', text: title }];
  grouped.runs.forEach(r => {
    lines.push({ kind: r.warm ? 'warm' : 'set', text: (r.warm ? '热身 ' : '') + r.key + (r.n > 1 ? '×' + r.n + '组' : '') });
  });
  return lines;
}
function wrapBlocks(lines) {
  const out = [];
  (lines || []).forEach(line => {
    wrapLine(line.text, line.kind === 'ex' ? 24 : 22, 740).forEach(text => out.push({ kind: line.kind, text }));
  });
  return out;
}
function workoutStatLines(row) {
  const bits = [];
  const vol = F.volumeBit(row.volumeKg, row.timeSec);
  if (vol) bits.push('总训练重量 ' + vol);
  if (typeof row.minutes === 'number' && row.minutes > 0) bits.push('用时 ' + row.minutes + ' 分钟（含休息）');
  if ((Number(row.timeSec) || 0) > 0) bits.push('计时 ' + durLabel(row.timeSec) + '（不含休息）');
  const lines = [];
  bits.forEach(bit => wrapLine(bit, 22, 740).forEach(text => lines.push({ kind: 'meta', text })));
  return lines;
}
function detailTrainSummary(rows) {
  let vol = 0, volKnown = false, session = 0, sessionN = 0, missingSession = 0, timeSec = 0, kcal = 0, aeroMin = 0, anyAero = false;
  (rows || []).forEach(r => {
    if (r.kind === 'aerobic') {
      anyAero = true;
      if (pos(r.kcal)) kcal += r.kcal;
      if (pos(r.minutes)) aeroMin += r.minutes;
      return;
    }
    if (typeof r.volumeKg === 'number' && isFinite(r.volumeKg)) { vol += r.volumeKg; volKnown = true; }
    if (typeof r.minutes === 'number' && r.minutes > 0) { session += r.minutes; sessionN += 1; }
    else missingSession += 1;
    timeSec += Math.max(0, Math.round(Number(r.timeSec) || 0));
  });
  const bits = [];
  if (volKnown) bits.push('总训练重量 ' + F.thousands(vol) + ' kg');
  if (sessionN) bits.push('用时 ' + session + ' 分钟（含休息）' + (missingSession ? ' · 部分无用时' : ''));
  if (timeSec > 0) bits.push('计时 ' + durLabel(timeSec) + '（不含休息）');
  if (anyAero && aeroMin) bits.push('有氧 ' + aeroMin + ' 分钟');
  if (kcal) bits.push('有氧消耗 ' + kcal + ' kcal');
  return bits.join(' · ');
}
function detailTrainRow(row, i) {
  if (row.kind === 'aerobic') return trainRow(row, i);
  const lines = workoutStatLines(row);
  if (row.detailMissing) lines.push({ kind: 'note', text: '训练详情缺失，不能展开各组' });
  else {
    let any = false;
    (row.exercises || []).forEach(ex => {
      const block = exerciseBlocks(ex);
      if (!block.length) return;
      any = true;
      block.forEach(line => lines.push(line));
    });
    if (!any && !row.detailMissing) lines.push({ kind: 'note', text: '没有已完成的组' });
  }
  const base = trainRow(row, i);
  base.sub = '';
  base.lines = wrapBlocks(lines);
  return base;
}
function pageModel(parts, trainRows, dietRows, trainSummaryText, dietSummaryText, flags) {
  flags = flags || {};
  const trainLines = flags.trainSkip ? null : wrapPieces(trainSummaryText, 22, 900);
  const dietLines = flags.dietSkip ? null : wrapPieces(dietSummaryText, 22, 900);
  return {
    date: parts.date,
    dateLabel: parts.dateLabel,
    weekLabel: parts.weekLabel,
    rest: false,
    mode: 'detail',
    train: flags.trainSkip ? { skip: true, empty: true, rows: [], summary: '', more: 0 } : {
      empty: !trainRows.length,
      summary: trainSummaryText,
      summaryLines: trainSummaryText ? trainLines : [],
      more: 0,
      rows: trainRows,
    },
    diet: flags.dietSkip ? { skip: true, empty: true, rows: [], summary: '', more: 0 } : {
      empty: !dietRows.length,
      summary: dietSummaryText,
      summaryLines: dietSummaryText ? dietLines : [],
      more: 0,
      rows: dietRows,
    },
  };
}
function splitWideRow(row, parts, trainSummaryText, maxH) {
  const one = lines => Object.assign({}, row, { lines, compact: false });
  const fits = r => cardHeight(pageModel(parts, [r], [], trainSummaryText, '', { dietSkip: true })) <= maxH;
  if (!row.lines || row.lines.length <= 1 || fits(row)) return [row];
  const chunks = [];
  let buf = [];
  const trial = (ls, cont) => {
    const r = Object.assign({}, row, {
      compact: cont,
      sub: cont ? '' : row.sub,
      lines: cont ? [{ kind: 'ex', text: (row.name || '动作') + '（续）' }].concat(ls) : ls,
    });
    return fits(r);
  };
  row.lines.forEach(line => {
    if (trial(buf.concat([line]), chunks.length > 0)) buf.push(line);
    else {
      if (buf.length) chunks.push(buf);
      buf = [line];
      if (!trial(buf, chunks.length > 0)) { chunks.push(buf); buf = []; }
    }
  });
  if (buf.length) chunks.push(buf);
  return chunks.map((ls, i) => Object.assign({}, row, {
    compact: i > 0,
    sub: i > 0 ? '' : row.sub,
    lines: i ? [{ kind: 'ex', text: (row.name || '动作') + '（续）' }].concat(ls) : ls,
  }));
}
function paginate(parts, trainRows, dietRows, trainSummaryText, dietSummaryText, maxH) {
  const hasTrain = trainRows.length > 0;
  const hasDiet = dietRows.length > 0;
  const pieces = [];
  trainRows.forEach(row => splitWideRow(row, parts, trainSummaryText, maxH).forEach(p => pieces.push({ side: 'train', row: p })));
  dietRows.forEach(row => pieces.push({ side: 'diet', row }));
  if (!pieces.length) return [pageModel(parts, [], dietRows, trainSummaryText, dietSummaryText, {})];
  const pages = [];
  let train = [], diet = [];
  const flush = () => {
    if (!train.length && !diet.length) return;
    pages.push(pageModel(parts, train, diet, trainSummaryText, dietSummaryText, {
      trainSkip: hasTrain ? (!train.length && pages.length > 0) : false,
      dietSkip: hasDiet ? !diet.length : false,
    }));
    train = [];
    diet = [];
  };
  const fits = (t, d, trainSkip, dietSkip) => cardHeight(pageModel(parts, t, d, trainSummaryText, dietSummaryText, { trainSkip, dietSkip })) <= maxH;
  pieces.forEach(piece => {
    const t = piece.side === 'train' ? train.concat([piece.row]) : train;
    const d = piece.side === 'diet' ? diet.concat([piece.row]) : diet;
    const trainSkip = hasTrain ? (!t.length && pages.length > 0) : false;
    const dietSkip = hasDiet ? !d.length : false;
    if (!train.length && !diet.length || fits(t, d, trainSkip, dietSkip)) {
      train = t;
      diet = d;
    } else {
      flush();
      if (piece.side === 'train') train = [piece.row];
      else diet = [piece.row];
    }
  });
  flush();
  return pages.length ? pages : [pageModel(parts, [], [], trainSummaryText, dietSummaryText, {})];
}
function buildDetailModel(input, parts, train, diet) {
  const maxH = input.exportMaxH || exportLimit(input.platform);
  const trainRows = [];
  train.forEach((row, i) => { const built = detailTrainRow(row, i); if (built) trainRows.push(built); });
  const dietRows = diet.map(dietRow);
  const trainText = train.length ? detailTrainSummary(train) : '';
  const dietText = dietSummary(diet);
  const pages = paginate(parts, trainRows, dietRows, trainText, dietText, maxH);
  const slices = pages.map((p, i) => Object.assign({}, p, { page: pages.length > 1 ? { i: i + 1, n: pages.length } : null }));
  const model = Object.assign({}, slices[0], { slices, mode: 'detail' });
  model.train = Object.assign({}, model.train, { summary: trainText, more: 0 });
  model.diet = Object.assign({}, model.diet, { summary: dietText, more: 0 });
  return model;
}
function buildShareModel(input) {
  input = input || {};
  const parts = dateParts(input.date);
  const train = (input.train || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const diet = (input.diet || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (input.mode === 'detail' && (train.length || diet.length)) return buildDetailModel(input, parts, train, diet);
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

module.exports = { buildShareModel, dateParts, cardHeight, rowSpan, MAX_H, exportLimit, groupSetLines };
