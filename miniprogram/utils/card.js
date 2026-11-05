// 动作库卡片封面：本地视频抽帧海报 > 数据集 180×180 缩略图 > 自制线稿。
// 缩略图是远程 URL，不进主包。加载失败时交给 coverFallback 退到下一级。
const MEDIA = require('./dataset-media');
const abs = p => (!p || typeof p !== 'string' ? '' : p.indexOf('://') > 0 || p[0] === '/' ? p : '/' + p);

function covers(e) {
  const poster = abs(e && e.poster);
  const ill = abs(e && e.illustration);
  const remote = e && e.mediaId ? MEDIA.thumbUrl(e.id, e.mediaId) : '';
  if (poster) return { img: poster, fallback: remote || ill };
  if (remote) return { img: remote, fallback: ill };
  return { img: ill, fallback: '' };
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
  if (item.fallback && item.img !== item.fallback) return Object.assign({}, item, { img: item.fallback, fallback: '' });
  return Object.assign({}, item, { img: '', fallback: '' });
}

module.exports = { cardOf, covers, coverFallback, abs };
