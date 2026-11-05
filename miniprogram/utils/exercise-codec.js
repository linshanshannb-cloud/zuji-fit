// Pack / expand the built-in catalogue so the main package keeps an index,
// while description + steps live in the exercise-detail subpackage.
// Runtime records still use the long schema (empty description/steps until the detail page hydrates them).
const CLOUD_PREFIX = 'cloud://cloud1-d8gn4xfqredd566d1.636c-cloud1-d8gn4xfqredd566d1-1511089058/anim/';
const CATEGORY_ZH = {
  strength: '力量',
  calisthenics: '自重训练',
  isometric: '等长训练',
  cardio: '有氧',
  stretching: '拉伸',
};
const F_VIDEO = 1;
const F_POSTER = 2;
const F_ILL = 4;
const F_UF_EMPTY = 8;
const F_HIDDEN = 16; // no dataset mediaId: kept for history, omitted from the library list

function expectedVideo(id) { return CLOUD_PREFIX + id + '.mp4'; }
function expectedPoster(id) { return '/assets/video-posters/' + id + '.jpg'; }
function expectedIllustration(id) { return '/assets/exercises/' + id + '.png'; }

function packRecord(e) {
  let flags = 0;
  if (e.video) {
    if (e.video !== expectedVideo(e.id)) throw new Error('unexpected video for ' + e.id + ': ' + e.video);
    flags |= F_VIDEO;
  }
  if (e.poster) {
    if (e.poster !== expectedPoster(e.id)) throw new Error('unexpected poster for ' + e.id + ': ' + e.poster);
    flags |= F_POSTER;
  }
  if (e.illustration) {
    if (e.illustration !== expectedIllustration(e.id)) throw new Error('unexpected illustration for ' + e.id + ': ' + e.illustration);
    flags |= F_ILL;
  }
  const uf = e.untranslatedFields || [];
  if (!uf.length) flags |= F_UF_EMPTY;
  else if (!(uf.length === 1 && uf[0] === 'description')) throw new Error('unexpected untranslatedFields for ' + e.id + ': ' + JSON.stringify(uf));
  if (e.translationPending) throw new Error('translationPending is not packed for ' + e.id);
  if (!e.mediaId || e.hidden) flags |= F_HIDDEN;
  const row = [
    e.id, e.nameZh, e.nameEn, e.bodyPart, e.bodyPartDetail || '', e.target || '',
    (e.secondary || []).join(','), e.equipment, e.category, flags,
  ];
  // Dataset media id only. The JPEG/GIF stay on jsDelivr; nothing is bundled.
  if (e.mediaId) row.push(e.mediaId);
  return row;
}

function expandRow(row) {
  const [id, nameZh, nameEn, bodyPart, bodyPartDetail, target, sec, equipment, category, flags] = row;
  const e = {
    id, nameZh, nameEn, bodyPart, bodyPartDetail, target,
    secondary: sec ? String(sec).split(',') : [],
    equipment, category,
    categoryZh: CATEGORY_ZH[category] || category,
    description: '',
    steps: [],
    translationPending: false,
    untranslatedFields: (flags & F_UF_EMPTY) ? [] : ['description'],
  };
  if (flags & F_VIDEO) e.video = expectedVideo(id);
  if (flags & F_POSTER) e.poster = expectedPoster(id);
  if (flags & F_ILL) e.illustration = expectedIllustration(id);
  if (row[10]) e.mediaId = row[10];
  if (flags & F_HIDDEN) e.hidden = true;
  return e;
}

function expandPack(packed) {
  return {
    source: packed.source,
    placeholder: !!packed.placeholder,
    generatedFrom: packed.generatedFrom,
    list: (packed.rows || []).map(expandRow),
    filters: packed.filters,
    muscles: packed.muscles || null,
  };
}

module.exports = {
  CLOUD_PREFIX, CATEGORY_ZH, packRecord, expandRow, expandPack,
  expectedVideo, expectedPoster, expectedIllustration,
};
