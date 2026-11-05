// 有数据集图时列表封面：JPEG → 线稿 → 占位。不回退本地 video-posters（AI 抽帧）。
// 没有 mediaId 的隐藏条目若被单独展示，仍可用本地海报。详情页云视频不走这里。
const MEDIA = require('./dataset-media');
const abs = p => (!p || typeof p !== 'string' ? '' : p.indexOf('://') > 0 || p[0] === '/' ? p : '/' + p);

function covers(e) {
  const poster = abs(e && e.poster);
  const ill = abs(e && e.illustration);
  const remote = e && e.mediaId ? MEDIA.thumbUrl(e.id, e.mediaId) : '';
  const chain = e && e.mediaId ? [remote, ill] : [poster, ill];
  const list = chain.filter(Boolean);
  return { img: list[0] || '', fallback: list[1] || '', fallbacks: list.slice(1) };
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
