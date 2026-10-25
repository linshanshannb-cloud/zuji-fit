// 动作库 / 选择器同部位内排序：有图有视频靠前，缺图垫底。
// 图 = poster 或 illustration（与 card.js 一致）；视频 = video 非空。
const abs = p => (!p || typeof p !== 'string' ? '' : p.indexOf('://') > 0 || p[0] === '/' ? p : '/' + p);

function hasImage(e) {
  return !!(abs(e && e.poster) || abs(e && e.illustration));
}
function hasVideo(e) {
  return !!(e && e.video);
}
/** 0 有图有视频 → 1 有图无视频 → 2 无图有视频 → 3 无图无视频（缺图垫底） */
function mediaTier(e) {
  const img = hasImage(e);
  const vid = hasVideo(e);
  if (img && vid) return 0;
  if (img) return 1;
  if (vid) return 2;
  return 3;
}
function byId(a, b) {
  const x = String(a && a.id || '');
  const y = String(b && b.id || '');
  return x < y ? -1 : x > y ? 1 : 0;
}
/**
 * 同部位（或已筛到单分区）内比较。
 * 自定义与内置走同一媒体规则；同档时自定义在前，再按 id。
 */
function compareByMedia(a, b) {
  return mediaTier(a) - mediaTier(b)
    || ((b && b.custom) ? 1 : 0) - ((a && a.custom) ? 1 : 0)
    || byId(a, b);
}
/** 「我的」分区：媒体档优先，再按更新时间新→旧 */
function compareCustomTab(a, b) {
  return mediaTier(a) - mediaTier(b)
    || ((b && b.updatedAt) || 0) - ((a && a.updatedAt) || 0)
    || byId(a, b);
}
function sortByMedia(list) {
  return (list || []).slice().sort(compareByMedia);
}

module.exports = { hasImage, hasVideo, mediaTier, compareByMedia, compareCustomTab, sortByMedia, byId };
