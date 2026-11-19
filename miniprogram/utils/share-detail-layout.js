// 详细版分享的分页和块。不读存储，不写「示例数据」。画布按 2 倍导出，页高不超过设备单边上限。
const F = require('./format');
const JS = require('./journal-stickers');
const D = require('./date');
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const SKIP = { '其他记录': 1, '': 1 };
const CANVAS_W = 1080;
const AREA = 16777216;
const FOOT = 80;
const MIN_H = 1440;
const TRAIN_PAGE = 1920;

function dateBits(date) {
  const d = D.parse(date);
  return { dateLabel: (d.getMonth() + 1) + '月' + d.getDate() + '日', weekLabel: WEEK[d.getDay()] };
}
function pageCap(input) {
  const side = /android/i.test(String(input && input.platform || '')) ? 8192 : 4096;
  const cap = Math.min(Math.floor(side / 2), Math.floor(AREA / (CANVAS_W * 2)));
  const asked = Number(input && input.exportMaxH);
  return asked > 0 ? Math.min(asked, cap) : cap;
}
function prettyDur(sec) {
  if (!(sec > 0)) return '时长缺失';
  const text = F.dur(sec);
  if (text.endsWith('分钟') && text.indexOf('分') === text.length - 2) return text.slice(0, -2) + ' 分钟';
  if (text.endsWith('秒') && text.indexOf('分') < 0) return text.slice(0, -1) + ' 秒';
  return text;
}
function weightText(set) {
  if (set.weightKg == null) return '自重';
  return F.kg(set.weightKg) + ' kg';
}
function setSig(set, mode) {
  if (mode === 'time') {
    const dur = prettyDur(set.durationSec);
    return (typeof set.weightKg === 'number' && set.weightKg > 0 ? F.kg(set.weightKg) + '|' : '0|') + dur;
  }
  return weightText(set) + '|' + (typeof set.reps === 'number' ? set.reps : 0);
}
function rowVisual(set, mode) {
  if (mode === 'time' && !(typeof set.weightKg === 'number' && set.weightKg > 0)) {
    return { main: prettyDur(set.durationSec), times: '' };
  }
  if (mode === 'time') return { main: weightText(set), times: prettyDur(set.durationSec) };
  return { main: weightText(set), times: (typeof set.reps === 'number' ? set.reps : 0) + '次' };
}
function doneSets(ex) {
  return (ex.sets || []).filter(s => s && s.done === true).map((s, i) => ({ s, i }))
    .sort((a, b) => (Number(a.s.index) || 0) - (Number(b.s.index) || 0) || a.i - b.i)
    .map(x => x.s);
}
// 热身不占工作组号。只合并相邻且签名相同的工作组。
function exerciseRows(ex) {
  const mode = ex && ex.mode === 'time' ? 'time' : 'reps';
  const sets = doneSets(ex || {});
  const rows = [];
  let n = 0;
  let i = 0;
  while (i < sets.length) {
    const s = sets[i];
    if (s.type === 'warmup') {
      rows.push(Object.assign({ warm: true, label: '热身' }, rowVisual(s, mode)));
      i += 1;
      continue;
    }
    const sig = setSig(s, mode);
    let j = i + 1;
    while (j < sets.length && sets[j].type !== 'warmup' && setSig(sets[j], mode) === sig) j += 1;
    const count = j - i;
    const from = n + 1;
    const to = n + count;
    n = to;
    rows.push(Object.assign({
      warm: false,
      label: from === to ? from + '组' : from + '–' + to + '组',
    }, rowVisual(s, mode)));
    i = j;
  }
  return { rows, work: n };
}
function wrapName(name) {
  const chars = [...String(name || '动作')];
  if (chars.length <= 26) return [chars.join('')];
  const lines = [];
  while (chars.length) lines.push(chars.splice(0, 26).join(''));
  return lines;
}
function exerciseH(nameLines, rowCount) {
  return 64 + nameLines.length * 36 + rowCount * 48;
}
function themeOf(train) {
  if (!train.length) return '饮食记录';
  const strengths = train.filter(t => t.kind !== 'aerobic');
  const given = strengths.map(t => String(t.givenName || '').trim()).filter(Boolean);
  if (given.length === 1) return given[0];
  if (given.length > 1) {
    const joined = given.join(' + ');
    return [...joined].length <= 18 ? joined : given[0];
  }
  return '训练记录';
}
function statsBlock(train) {
  const strengths = train.filter(t => t.kind !== 'aerobic');
  const aeros = train.filter(t => t.kind === 'aerobic');
  let session = 0, sessionN = 0, missing = 0, timeSec = 0, vol = 0, volN = 0, work = 0, aeroMin = 0;
  strengths.forEach(w => {
    if (typeof w.minutes === 'number' && w.minutes > 0) { session += w.minutes; sessionN += 1; }
    else missing += 1;
    timeSec += Math.max(0, Math.round(Number(w.timeSec) || 0));
    if (typeof w.volumeKg === 'number' && isFinite(w.volumeKg)) { vol += w.volumeKg; volN += 1; }
    (w.exercises || []).forEach(ex => { work += exerciseRows(ex).work; });
  });
  aeros.forEach(a => { if (typeof a.minutes === 'number' && a.minutes > 0) aeroMin += a.minutes; });
  const lines = [];
  if (sessionN) lines.push({ k: '力量整次', v: session + ' 分钟（含休息）' + (missing ? ' · 部分无用时' : '') });
  if (aeroMin) lines.push({ k: '有氧', v: aeroMin + ' 分钟' });
  const meta = [];
  if (timeSec > 0) meta.push('计时组 ' + prettyDur(timeSec) + '（不含休息）');
  if (strengths.length) meta.push('工作组 ' + work);
  if (volN) meta.push('训练量 ' + F.thousands(vol) + ' kg');
  const parts = [];
  if (strengths.length > 1) {
    strengths.forEach(w => {
      if (typeof w.minutes === 'number' && w.minutes > 0) parts.push((w.givenName || w.name || '训练') + ' ' + w.minutes + ' 分钟');
    });
  }
  const h = 8 + lines.length * 44 + (meta.length ? 36 : 0) + (parts.length ? 32 : 0) + 8;
  return { type: 'stats', lines, meta: meta.join(' · '), parts: parts.join(' · '), h: Math.max(h, 36), keep: false };
}
function blocksFor(train, diet) {
  const blocks = [];
  const strengths = train.filter(t => t.kind !== 'aerobic');
  const showSession = strengths.length > 1;
  if (train.length) blocks.push(statsBlock(train));
  train.forEach(row => {
    if (row.kind === 'aerobic') {
      blocks.push({
        type: 'aerobic', h: 132,
        name: row.name || '有氧',
        sticker: JS.trainSticker('aerobic', row.activityType, row.name),
        sub: (row.minutes ? row.minutes + ' 分钟' : '') + (row.kcal ? (row.minutes ? ' · ' : '') + '消耗 ' + row.kcal + ' kcal' : ''),
      });
      return;
    }
    if (showSession) {
      blocks.push({
        type: 'session', h: 118, keep: true,
        name: row.givenName || row.name || '训练',
        sticker: JS.trainSticker('strength'),
      });
    }
    if (row.detailMissing) {
      blocks.push({ type: 'note', h: 48, text: '训练详情缺失，不能展开各组' });
      return;
    }
    let any = false;
    (row.exercises || []).forEach(ex => {
      const built = exerciseRows(ex);
      if (!built.rows.length) return;
      any = true;
      const nameLines = wrapName(ex.name || '动作');
      blocks.push({
        type: 'exercise', name: ex.name || '动作', nameLines, rows: built.rows,
        h: exerciseH(nameLines, built.rows.length),
      });
    });
    if (!any) blocks.push({ type: 'note', h: 48, text: '没有已完成的组' });
  });
  const meals = [];
  const seen = {};
  diet.forEach(row => {
    const key = row.mealLabel && !SKIP[row.mealLabel] ? row.mealLabel : '其他';
    if (!seen[key]) { seen[key] = { label: key, foods: [] }; meals.push(seen[key]); }
    seen[key].foods.push(row);
  });
  if (meals.length) {
    blocks.push({ type: 'dietHead', h: 56, keep: true });
    meals.forEach(meal => {
      let kcal = 0, anyK = false;
      meal.foods.forEach(f => { if (typeof f.kcal === 'number') { kcal += f.kcal; anyK = true; } });
      blocks.push({
        type: 'meal', h: 44, keep: true, label: meal.label,
        sub: meal.foods.length >= 2 && anyK ? '本餐 ' + kcal + ' kcal' : '',
      });
      meal.foods.forEach(f => blocks.push({
        type: 'food', h: 92, name: f.name || '饮食', sticker: JS.foodSticker(f.name),
        kcal: typeof f.kcal === 'number' ? f.kcal + ' kcal' : '', estimate: !!f.estimate,
      }));
    });
    let total = 0, anyT = false, est = false;
    diet.forEach(f => {
      if (typeof f.kcal === 'number') { total += f.kcal; anyT = true; }
      if (f.estimate) est = true;
    });
    blocks.push({ type: 'total', h: 116, kcal: anyT ? F.thousands(total) : '0', estimate: est, stick: true });
  }
  return blocks;
}
function splitTall(blocks, room) {
  const out = [];
  blocks.forEach(block => {
    if (block.type !== 'exercise' || block.h <= room || block.rows.length <= 1) { out.push(block); return; }
    let buf = [];
    let continued = false;
    const emit = () => {
      if (!buf.length) return;
      const nameLines = wrapName(continued ? block.name + '（续）' : block.name);
      out.push({
        type: 'exercise',
        name: nameLines.join(''),
        nameLines,
        rows: buf.slice(),
        h: exerciseH(nameLines, buf.length),
      });
      buf = [];
      continued = true;
    };
    block.rows.forEach(row => {
      if (buf.length && exerciseH(wrapName(block.name), buf.length + 1) > room) emit();
      buf.push(row);
    });
    emit();
  });
  return out;
}
function measure(kind, blocks) {
  const chrome = kind === 'first' ? 276 : 212;
  let h = chrome + FOOT;
  blocks.forEach(b => { h += b.h; });
  return h;
}
function pack(blocks, cap) {
  const room = Math.max(480, cap - 196 - FOOT);
  const pieces = splitTall(blocks, room);
  const pages = [];
  let cur = [];
  function kindOf() { return pages.length === 0 && cur.length >= 0 && pages.length === 0 ? (pages.length ? 'next' : 'first') : 'next'; }
  function fits(extra) {
    const kind = pages.length === 0 ? 'first' : 'next';
    return measure(kind, cur.concat(extra)) <= cap;
  }
  let i = 0;
  while (i < pieces.length) {
    const group = [pieces[i]];
    if (pieces[i].keep && pieces[i + 1]) group.push(pieces[i + 1]);
    if (cur.length && !fits(group)) {
      pages.push(cur);
      cur = [];
    }
    group.forEach(b => cur.push(b));
    i += group.length;
  }
  if (cur.length) pages.push(cur);
  for (let p = 0; p < pages.length - 1; p++) {
    while (pages[p].length && pages[p][pages[p].length - 1].keep) {
      pages[p + 1].unshift(pages[p].pop());
    }
    if (!pages[p].length) { pages.splice(p, 1); p -= 1; }
  }
  return pages.filter(p => p.length);
}
function dietKcal(diet) {
  let total = 0, any = false, est = 0;
  diet.forEach(f => {
    if (typeof f.kcal === 'number') { total += f.kcal; any = true; }
    if (f.estimate) est += 1;
  });
  const mark = !est ? '' : (est === diet.length ? ' · 估算' : ' · 含估算');
  return { summary: any ? '摄入 ' + total + ' kcal' + mark : '', total, estimate: est > 0 };
}
function build(input, parts, train, diet) {
  const cap = pageCap(input);
  const trainCap = Math.min(TRAIN_PAGE, cap);
  const theme = themeOf(train);
  const all = blocksFor(train, diet);
  const dietAt = all.findIndex(b => b.type === 'dietHead');
  const trainBlocks = dietAt < 0 ? all : all.slice(0, dietAt);
  const dietBlocks = dietAt < 0 ? [] : all.slice(dietAt);
  let pages = pack(trainBlocks, trainCap);
  if (!pages.length) pages = [[]];
  if (dietBlocks.length) {
    const last = pages[pages.length - 1];
    const kind = pages.length === 1 ? 'first' : 'next';
    if (measure(kind, last.concat(dietBlocks)) <= cap) last.push.apply(last, dietBlocks);
    else pages.push.apply(pages, pack(dietBlocks, cap).map(p => p));
  }
  pages = pages.filter(p => p.length);
  if (!pages.length) pages = [[]];
  const hero = JS.trainSticker('strength');
  const slices = pages.map((blocks, i) => {
    const first = i === 0;
    const dietish = blocks.some(b => b.type === 'dietHead' || b.type === 'food' || b.type === 'meal' || b.type === 'total');
    const trainish = blocks.some(b => b.type === 'exercise' || b.type === 'session' || b.type === 'aerobic' || b.type === 'stats' || b.type === 'note');
    let cont = '';
    if (!first && trainish && blocks[0].type !== 'dietHead') cont = '训练续表';
    if (dietish && !blocks.some(b => b.type === 'dietHead') && !trainish) cont = '饮食续表';
    const raw = measure(first ? 'first' : 'next', blocks);
    const height = MIN_H <= cap && raw < MIN_H ? MIN_H : raw;
    return {
      layout: 'detail',
      height: height,
      exportScale: 2,
      date: input.date,
      dateLabel: parts.dateLabel,
      weekLabel: parts.weekLabel,
      theme,
      hero: first,
      heroSticker: hero,
      cont,
      page: { i: i + 1, n: pages.length },
      blocks,
    };
  });
  // 饮食总计只留在最后一页。前面的页如果装进了总计，挪到最后一页。
  const totals = [];
  slices.forEach((s, i) => {
    if (i === slices.length - 1) return;
    const keep = [];
    s.blocks.forEach(b => { if (b.type === 'total') totals.push(b); else keep.push(b); });
    s.blocks = keep;
    s.height = measure(s.hero ? 'first' : 'next', keep);
    if (MIN_H <= cap && s.height < MIN_H) s.height = MIN_H;
  });
  if (totals.length) {
    const last = slices[slices.length - 1];
    totals.forEach(b => { if (!last.blocks.some(x => x.type === 'total')) last.blocks.push(b); });
    last.height = measure(last.hero ? 'first' : 'next', last.blocks);
    if (MIN_H <= cap && last.height < MIN_H) last.height = MIN_H;
  }
  const dietInfo = dietKcal(diet);
  const model = Object.assign({}, slices[0], { slices, mode: 'detail' });
  model.diet = { summary: dietInfo.summary, more: 0, empty: !diet.length, rows: diet.map(d => ({ name: d.name })) };
  model.train = { summary: '', more: 0, empty: !train.length, rows: [] };
  return model;
}
module.exports = { build, themeOf, exerciseRows, pageCap, dateBits };
