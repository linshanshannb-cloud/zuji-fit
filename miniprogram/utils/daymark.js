// 日历格子摘要（纯函数）。F06：格子内力量部位标签 + 有氧类型标签并排；禁止双色点。
const M = require('./muscle');
const { isCountable } = require('./repo/model');
const AT = require('./aerobic-types');
const SHORT = { chest: '胸', back: '背', shoulders: '肩', arms: '臂', legs: '腿', glutes: '臀', core: '腹', other: '全身' };
const ORDER = M.GROUPS.map(g => g.key);
// exercises: 组装后的动作 [{exercise, sets}]（可跨多次训练合并）
function rankedPartKeys(exercises) {
  const n = {};
  (exercises || []).forEach(e => {
    const c = (e.sets || []).filter(isCountable).length; if (!c) return;
    const g = M.groupOf(e.exercise); n[g] = (n[g] || 0) + c;
  });
  let keys = Object.keys(n);
  if (keys.length > 1) keys = keys.filter(k => k !== 'other');
  keys.sort((a, b) => n[b] - n[a] || ORDER.indexOf(a) - ORDER.indexOf(b));
  return keys;
}
// 旧接口：最多 2 个（dayMark / 单测）
function partsLabel(exercises) {
  return rankedPartKeys(exercises).slice(0, 2).map(k => SHORT[k]).join('·');
}
// T12：格子标签最多 3 个部位短名
function partsList(exercises) {
  return rankedPartKeys(exercises).slice(0, AT.CELL_MAX_PARTS).map(k => SHORT[k]);
}
function trim(x) { return String(x).replace(/\.0$/, ''); }
function volumeLabel(volumeKg, setCount) {
  const v = Number(volumeKg) || 0;
  if (v <= 0) return setCount > 0 ? setCount + '组' : '';
  if (v >= 100000) return Math.round(v / 1000) + 't';
  if (Math.round(v) >= 1000) return trim((Math.round(v / 100) / 10).toFixed(1)) + 't';
  return Math.round(v) + 'kg';
}
// workouts: getWorkout() 结果数组（同一天）——保留旧接口供单测
function dayMark(workouts) {
  const list = (workouts || []).filter(w => w && w.exerciseCount > 0);
  if (!list.length) return null;
  const exs = [].concat.apply([], list.map(w => w.exercises || []));
  const vol = list.reduce((t, w) => t + (w.volumeKg || 0), 0), sets = list.reduce((t, w) => t + (w.setCount || 0), 0);
  return { parts: partsLabel(exs), vol: volumeLabel(vol, sets) };
}
// 截断标签：T9 可见上限 4，超出 +N；T10 文案过长省略
function truncateTag(text, maxChars) {
  const s = String(text || '');
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(1, maxChars - 1)) + '…';
}
function buildTags(partNames, aeroNames) {
  const tags = [];
  (partNames || []).forEach((p, i) => { if (p) tags.push({ id: 'p' + i, text: truncateTag(p, 4), kind: 'part' }); });
  (aeroNames || []).forEach((n, i) => { if (n) tags.push({ id: 'a' + i, text: truncateTag(n, 4), kind: 'aero' }); });
  if (tags.length <= AT.CELL_MAX_TAGS) return { tags, more: 0 };
  return { tags: tags.slice(0, AT.CELL_MAX_TAGS), more: tags.length - AT.CELL_MAX_TAGS };
}
// T11：同日多条有氧同名合并
function uniqueAeroNames(aerobics) {
  const seen = {}, out = [];
  (aerobics || []).forEach(a => {
    const n = (a && a.activityName) || AT.nameOf(a && a.activityType, a && a.activityName);
    if (!n || seen[n]) return;
    seen[n] = true; out.push(n);
  });
  return out;
}
// 按日期汇总 [from, to] 内的已完成力量训练（详情）与有氧记录
function collect(repo, from, to) {
  const byDate = {};
  repo.workouts.listWorkouts({ from, to }).forEach(h => {
    if (h.exerciseCount > 0) (byDate[h.date] = byDate[h.date] || { workouts: [], aerobics: [] }).workouts.push(repo.workouts.getWorkout(h.id));
  });
  if (repo.aerobic) {
    repo.aerobic.list({ from, to }).forEach(a => {
      (byDate[a.date] = byDate[a.date] || { workouts: [], aerobics: [] }).aerobics.push(a);
    });
  }
  return byDate;
}
function dayExercises(day) {
  return [].concat.apply([], ((day && day.workouts) || []).filter(w => w && w.exerciseCount > 0).map(w => w.exercises || []));
}
// 日历 info：{date: {tags, more}} 训练日；{date: {rest:true}} 休息日（有训练则优先）
function buildInfo(repo, from, to) {
  const byDate = collect(repo, from, to);
  const info = {};
  Object.keys(byDate).forEach(d => {
    const day = byDate[d];
    const parts = partsList(dayExercises(day));
    const aeros = uniqueAeroNames(day.aerobics);
    if (!parts.length && !aeros.length) return;
    const built = buildTags(parts, aeros);
    info[d] = built;
  });
  Object.keys(repo.restDays.list(from, to)).forEach(d => { if (!info[d]) info[d] = { rest: true }; });
  return info;
}
// v0.5 紧凑格子（行高 96rpx）：最多两行——力量部位合并一行「胸·背」，有氧一行「跑步」/「跑步+1」。
// inf: buildInfo 的单日值（或旧 {parts}）。返回 { part, aero, train, rest }
function cellLines(inf) {
  inf = inf || {};
  const tags = Array.isArray(inf.tags) ? inf.tags : [];
  let parts = tags.filter(t => t.kind === 'part').map(t => t.text);
  const aeros = tags.filter(t => t.kind === 'aero').map(t => t.text);
  if (!tags.length && inf.parts) parts = String(inf.parts).split('·').filter(Boolean); // 兼容旧 {parts, vol}
  const extra = Math.max(0, aeros.length - 1) + (tags.length ? inf.more || 0 : 0);
  const aero = !aeros.length ? '' : extra ? aeros[0].replace(/…$/, '').slice(0, 2) + '+' + extra : aeros[0];
  const part = parts.join('·');
  const train = !!(part || aero);
  return { part, aero, train, rest: !train && !!inf.rest };
}
// 所选日汇总卡：全部部位（排名、短名，不截断）+ 有氧类型名（同名合并）
function dayParts(repo, date) {
  const day = collect(repo, date, date)[date];
  if (!day) return { parts: [], aeros: [] };
  return { parts: rankedPartKeys(dayExercises(day)).map(k => SHORT[k]), aeros: uniqueAeroNames(day.aerobics) };
}
module.exports = { SHORT, partsLabel, partsList, volumeLabel, dayMark, buildInfo, buildTags, uniqueAeroNames, truncateTag, cellLines, dayParts };
