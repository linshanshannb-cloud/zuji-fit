#!/usr/bin/env node
/**
 * V1–V6 静态检查：24 试点视频/海报存在、字段不断链、主包无 mp4、体积门槛、详情页属性、列表无 video。
 * 2026-10-19：海报已迁主包 assets/video-posters/；video 仍在 packageVideo*；无 preloadRule。
 * Usage: node qa/check-videos.js
 * Exit 0 = all pass; non-zero = failures printed.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const MAP = path.join(ROOT, 'assets/videos/VIDEO_NAME_MAP.json');
const EX = path.join(ROOT, 'data/exercises.json');
const APP = path.join(MP, 'app.json');
const POSTER_DIR = path.join(MP, 'assets/video-posters');
const DETAIL_JS = path.join(MP, 'pages/exercise-detail/exercise-detail.js');
const DETAIL_WXML = path.join(MP, 'pages/exercise-detail/exercise-detail.wxml');

const fail = [];
const ok = [];
const check = (name, cond, detail = '') => {
  if (cond) ok.push(name);
  else fail.push(name + (detail ? ': ' + detail : ''));
};

const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));
const ids = map.map(r => r.id);
check('V1a map has 24', ids.length === 24, String(ids.length));

const exercises = JSON.parse(fs.readFileSync(EX, 'utf8'));
const byId = Object.fromEntries(exercises.map(e => [e.id, e]));

// main-package poster directory
const posterFiles = fs.existsSync(POSTER_DIR)
  ? fs.readdirSync(POSTER_DIR).filter(f => f.endsWith('.jpg'))
  : [];
check('V1b video-posters dir has 24 jpg', posterFiles.length === 24, String(posterFiles.length));

for (const id of ids) {
  const e = byId[id];
  check(`V2 field ${id}`, !!(e && e.video && e.poster), e ? `video=${e.video} poster=${e.poster}` : 'missing exercise');
  if (!e || !e.video || !e.poster) continue;
  check(
    `V2 poster main-pack ${id}`,
    /^assets\/video-posters\/\d{4}\.jpg$/.test(e.poster),
    e.poster
  );
  check(
    `V2 video subpack ${id}`,
    /^packageVideo[ABC]\/videos\/\d{4}\.mp4$/.test(e.video),
    e.video
  );
  const vp = path.join(MP, e.video);
  const pp = path.join(MP, e.poster);
  check(`V1 file mp4 ${id}`, fs.existsSync(vp), vp);
  check(`V1 file jpg ${id}`, fs.existsSync(pp), pp);
  if (fs.existsSync(vp)) {
    const sz = fs.statSync(vp).size;
    check(`V3 video size ${id}`, sz <= 200 * 1024, sz + 'B');
  }
  if (fs.existsSync(pp)) {
    const sz = fs.statSync(pp).size;
    check(`V3 poster size ${id}`, sz <= 40 * 1024, sz + 'B');
  }
}


// dual-source: miniprogram/data/exercises.js must match root json posters/videos
const EX_JS = path.join(MP, 'data/exercises.js');
check('V2b exercises.js exists', fs.existsSync(EX_JS));
if (fs.existsSync(EX_JS)) {
  const bundled = require(EX_JS);
  check('V2b exercises.js has list', Array.isArray(bundled.list), typeof bundled.list);
  if (Array.isArray(bundled.list)) {
    const bById = Object.fromEntries(bundled.list.map(e => [e.id, e]));
    for (const id of ids) {
      const je = byId[id];
      const be = bById[id];
      check(`V2b js field ${id}`, !!(be && be.video && be.poster), be ? `video=${be.video} poster=${be.poster}` : 'missing');
      if (!be || !je) continue;
      check(`V2b js/json poster align ${id}`, be.poster === je.poster, `js=${be.poster} json=${je.poster}`);
      check(`V2b js/json video align ${id}`, be.video === je.video, `js=${be.video} json=${je.video}`);
      check(`V2b js poster main-pack ${id}`, /^assets\/video-posters\/\d{4}\.jpg$/.test(be.poster), be.poster);
    }
  }
}

// non-pilot must not have video/poster
const nonPilotWith = exercises.filter(e => !ids.includes(e.id) && (e.video || e.poster));
check('V2 non-pilot clean', nonPilotWith.length === 0, nonPilotWith.map(e => e.id).join(','));

// app.json subpackages + no preloadRule
const app = JSON.parse(fs.readFileSync(APP, 'utf8'));
const roots = (app.subpackages || []).map(p => p.root);
check('V4 subpackages declared', roots.includes('packageVideoA') && roots.includes('packageVideoB') && roots.includes('packageVideoC'), roots.join(','));
check('V4 no preloadRule', !app.preloadRule, JSON.stringify(app.preloadRule || null));

// no mp4 outside packageVideo*
function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walk(p, acc);
    } else if (ent.name.endsWith('.mp4')) acc.push(p);
  }
  return acc;
}
const allMp4 = walk(MP);
const outside = allMp4.filter(p => !p.includes(`${path.sep}packageVideo`));
check('V4 main pack no mp4', outside.length === 0, outside.map(p => path.relative(MP, p)).join(','));

// package size caps
function dirSize(d) {
  let n = 0;
  if (!fs.existsSync(d)) return 0;
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    n += ent.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return n;
}
for (const root of ['packageVideoA', 'packageVideoB', 'packageVideoC']) {
  const sz = dirSize(path.join(MP, root));
  check(`V3 subpack ${root} ≤2MB`, sz <= 2 * 1024 * 1024, sz + 'B');
}
function mainSize(dir) {
  let n = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['packageVideoA', 'packageVideoB', 'packageVideoC', 'node_modules', 'tests', 'scripts'].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    n += ent.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return n;
}
const mainSz = mainSize(MP);
check('V3 main ≤2MB', mainSz <= 2 * 1024 * 1024, mainSz + 'B');
const totalSz = dirSize(MP) - dirSize(path.join(MP, 'node_modules')) - dirSize(path.join(MP, 'tests'));
check('V3 total ≤20MB', totalSz <= 20 * 1024 * 1024, totalSz + 'B');

// V5 detail page attributes + loadSubpackage / onCoverTap
const wxml = fs.readFileSync(DETAIL_WXML, 'utf8');
const detailJs = fs.readFileSync(DETAIL_JS, 'utf8');
check('V5 autoplay', /\bautoplay\b/.test(wxml));
check('V5 loop', /\bloop\b/.test(wxml));
check('V5 muted', /\bmuted\b/.test(wxml));
check('V5 poster bound', /poster="\{\{/.test(wxml));
check('V5 controls false', /controls="\{\{false\}\}"/.test(wxml) || /controls="{{false}}"/.test(wxml) || /show-controls="\{\{false\}\}"/.test(wxml));
check('V5 object-fit contain', /object-fit="contain"/.test(wxml));
check('V5 binderror', /binderror="onVideoError"/.test(wxml));
check('V5 onCoverTap bind', /bindtap="onCoverTap"/.test(wxml));
check('V5 loadSubpackage', /wx\.loadSubpackage\s*\(/.test(detailJs));
check('V5 onCoverTap fn', /onCoverTap\s*\(/.test(detailJs));
check('V5 pending cover flow', /_pendingVideo/.test(detailJs) && /_loadPackageThenShowVideo/.test(detailJs));

// V6 list pages
for (const page of ['library', 'exercise-picker']) {
  const dir = path.join(MP, 'pages', page);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(wxml|js|wxss)$/.test(f)) continue;
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    check(`V6 ${page}/${f} no video tag`, !/<video[\s>]/.test(t));
    check(`V6 ${page}/${f} no .mp4`, !/\.mp4/.test(t));
  }
}

console.log(`PASS ${ok.length}  FAIL ${fail.length}`);
if (fail.length) {
  console.log('--- failures ---');
  fail.forEach(f => console.log('✗', f));
  process.exit(1);
}
console.log('All video static checks passed.');
process.exit(0);
