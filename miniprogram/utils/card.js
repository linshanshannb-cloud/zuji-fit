// 动作库卡片封面：数据集 180×180 缩略图 > 本地视频海报 > 自制线稿。
// 缩略图是远程 URL，不进主包。加载失败时 coverFallback 按同一顺序退一级。
const MEDIA = require('./dataset-media');
const abs = p => (!p || typeof p !== 'string' ? '' : p.indexOf('://') > 0 || p[0] === '/' ? p : '/' + p);

function covers(e) {
  const poster = abs(e && e.poster);
  const ill = abs(e && e.illustration);
  const remote = e && e.mediaId ? MEDIA.thumbUrl(e.id, e.mediaId) : '';
  const chain = [remote, poster, ill].filter(Boolean);
  return { img: chain[0] || '', fallback: chain[1] || '', fallbacks: chain.slice(1) };
}

function cardOf(e, zhOf, groupZh) {
  const c = covers(e);
  return {
    id: e.id, nameZh: e.nameZh, pending: !!e.translationPending, custom: !!e.custom,
    img: c.img, fallback: c.fallback, hasVideo: !!e.video, initial: String(e.nameZh || '').slice(0, 1),
    part: groupZh || '', equip: zhOf ? zhOf('equipment', e.equipment) : '',
  };
}

function coverFallback(item) {
  if (!item) return item;
  const rest = (item.fallbacks && item.fallbacks.length) ? item.fallbacks : (item.fallback && item.img !== item.fallback ? [item.fallback] : []);
  if (rest.length) return Object.assign({}, item, { img: rest[0], fallback: rest[1] || '', fallbacks: rest.slice(1) });
  return Object.assign({}, item, { img: '', fallback: '', fallbacks: [] });
}

module.exports = { cardOf, covers, coverFallback, abs };
