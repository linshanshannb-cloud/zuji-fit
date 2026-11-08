#!/usr/bin/env node
/**
 * 云视频静态检查：已有 cloud://…/anim/<id>.mp4 与主包海报不断链，
 * 主包 ≤2MB，详情分包（含步骤正文）≤2MB，安装包内没有数据集 GIF / 本地 mp4。
 * Usage: node qa/check-videos.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');
const EX = path.join(ROOT, 'data/exercises.json');
const APP = path.join(MP, 'app.json');
const DETAIL_JS = path.join(MP, 'pages/exercise-detail/exercise-detail.js');
const DETAIL_WXML = path.join(MP, 'pages/exercise-detail/exercise-detail.wxml');
const CLOUD = 'cloud://cloud1-d8gn4xfqredd566d1.636c-cloud1-d8gn4xfqredd566d1-1511089058/anim/';

const fail = [];
const ok = [];
const check = (name, cond, detail = '') => {
  if (cond) ok.push(name);
  else fail.push(name + (detail ? ': ' + detail : ''));
};

const exercises = JSON.parse(fs.readFileSync(EX, 'utf8'));
const byId = Object.fromEntries(exercises.map(e => [e.id, e]));
check('V1 catalogue ≥1324', exercises.length >= 1324, String(exercises.length));
const bench = byId['0025'];
check('V2 0025 杠铃卧推', bench && bench.nameZh === '杠铃卧推' && bench.nameEn === 'barbell bench press');
check('V2 0025 cloud video', bench && bench.video === CLOUD + '0025.mp4', bench && bench.video);
check('V2 0025 poster file', bench && fs.existsSync(path.join(MP, 'assets/video-posters/0025.jpg')));

const withV = exercises.filter(e => e.video);
check('V2 cloud videos ≥200', withV.length >= 200, String(withV.length));
for (const e of withV) {
  if (e.video !== CLOUD + e.id + '.mp4') fail.push('V2 video ' + e.id);
}
const withP = exercises.filter(e => e.poster);
for (const e of withP) {
  const rel = String(e.poster).replace(/^\//, '');
  if (!/^assets\/video-posters\/\d+\.jpg$/.test(rel) || !fs.existsSync(path.join(MP, rel))) fail.push('V2 poster ' + e.id + ' ' + e.poster);
}
if (!fail.some(f => f.startsWith('V2 video') || f.startsWith('V2 poster'))) ok.push('V2 every cloud video and poster');

const bundled = require(path.join(MP, 'data/exercises.js'));
check('V2b index count', bundled.list.length === exercises.length, String(bundled.list.length));
const b25 = bundled.list.find(e => e.id === '0025');
check('V2b index keeps 0025 video', b25 && b25.video === bench.video);
check('V2b index omits step text', b25 && b25.steps.length === 0);
const text = require(path.join(MP, 'pages/exercise-detail/exercise-text.js'));
check('V2b detail steps', text['0025'] && text['0025'].s.length === bench.steps.length, text['0025'] && String(text['0025'].s.length));

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walk(p, acc);
    } else acc.push(p);
  }
  return acc;
}
const files = walk(MP);
check('V4 no local mp4', !files.some(p => p.endsWith('.mp4')), files.filter(p => p.endsWith('.mp4')).join(','));
check('V4 no bundled gif', !files.some(p => p.endsWith('.gif')));
const MEDIA = require(path.join(MP, 'utils/dataset-media.js'));
const cloudRoot = CLOUD.slice(0, CLOUD.indexOf('anim/'));
check('V7 cover fileID', MEDIA.thumbUrl('0001', '2gPfomN') === cloudRoot + 'images/0001-2gPfomN.jpg', MEDIA.thumbUrl('0001', '2gPfomN'));
check('V7 gif fileID', MEDIA.gifUrl('0001', '2gPfomN') === cloudRoot + 'videos/0001-2gPfomN.gif', MEDIA.gifUrl('0001', '2gPfomN'));
const jsdelivr = files.filter(p => /\.(js|wxml|wxss|json)$/.test(p) && /jsdelivr\.net/.test(fs.readFileSync(p, 'utf8')));
check('V7 no jsdelivr runtime', jsdelivr.length === 0, jsdelivr.map(p => path.relative(MP, p)).join(','));

const app = JSON.parse(fs.readFileSync(APP, 'utf8'));
function dirSize(d) {
  let n = 0;
  if (!fs.existsSync(d)) return 0;
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    n += ent.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return n;
}
function mainSize(dir) {
  const pc = JSON.parse(fs.readFileSync(path.join(dir, 'project.config.json'), 'utf8'));
  const rules = (pc.packOptions || {}).ignore || [];
  const roots = (app.subpackages || []).map(s => s.root.replace(/\/$/, ''));
  const ignored = rel => {
    const norm = rel.replace(/\\/g, '/');
    if (roots.some(r => norm === r || norm.startsWith(r + '/'))) return true;
    return rules.some(rule => {
      const v = String(rule.value || '').replace(/\\/g, '/');
      if (rule.type === 'folder') return norm === v || norm.startsWith(v + '/');
      if (rule.type === 'file') return norm === v;
      if (rule.type === 'suffix') return norm.endsWith(v);
      return false;
    });
  };
  let n = 0;
  (function go(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      const rel = path.relative(dir, p);
      if (ignored(rel)) continue;
      if (ent.isDirectory()) go(p);
      else n += fs.statSync(p).size;
    }
  })(dir);
  return n;
}
const mainSz = mainSize(MP);
check('V3 main ≤2MB', mainSz <= 2 * 1024 * 1024, mainSz + 'B');
check('V3 main ≤1900KB', mainSz <= 1900 * 1024, mainSz + 'B');
const detailRoot = (app.subpackages || []).find(s => (s.pages || []).includes('exercise-detail'));
check('V3 detail subpackage declared', !!(detailRoot && detailRoot.root === 'pages/exercise-detail'));
if (detailRoot) {
  const sz = dirSize(path.join(MP, detailRoot.root));
  check('V3 detail subpackage ≤2MB', sz <= 2 * 1024 * 1024, sz + 'B');
}

const wxml = fs.readFileSync(DETAIL_WXML, 'utf8');
const detailJs = fs.readFileSync(DETAIL_JS, 'utf8');
check('V5 autoplay', /\bautoplay\b/.test(wxml));
check('V5 loop', /\bloop\b/.test(wxml));
check('V5 muted', /\bmuted\b/.test(wxml));
check('V5 object-fit contain', /object-fit="contain"/.test(wxml));
check('V5 binderror', /binderror="onAnimError"/.test(wxml));
check('V5 onCoverTap', /onCoverTap\s*\(/.test(detailJs) && /bindtap="onCoverTap"/.test(wxml));
check('V5 gif attribution', /Gym visual/.test(wxml));
check('V6 library has no video tag', !/<video[\s>]/.test(fs.readFileSync(path.join(MP, 'pages/library/library.wxml'), 'utf8')));

console.log(`PASS ${ok.length}  FAIL ${fail.length}  main ${mainSz}B`);
if (fail.length) {
  console.log('--- failures ---');
  fail.forEach(f => console.log('✗', f));
  process.exit(1);
}
console.log('All video static checks passed.');
process.exit(0);
