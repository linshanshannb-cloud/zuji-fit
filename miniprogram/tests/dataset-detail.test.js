// 数据集新增动作：无云视频时详情页播远程 GIF，并带上中文步骤；GIF 失败退回文字占位。
const test = require('node:test');
const assert = require('node:assert');
const { fresh } = require('./helpers');

function loadPage(id) {
  fresh();
  global.wx = {
    getStorageSync: () => ({}), setStorageSync() {}, removeStorageSync() {},
    showToast() {}, showModal() {}, showLoading() {}, hideLoading() {},
    createVideoContext: () => ({ playbackRate() {} }),
    getFileSystemManager: () => ({ saveFile() {}, access(o) { o.fail(); }, getFileInfo(o) { o.success({ size: 1 }); } }),
  };
  let def;
  global.Page = d => { def = d; };
  const page = require.resolve('../pages/exercise-detail/exercise-detail.js');
  delete require.cache[page];
  require(page);
  const p = Object.assign({}, def);
  p.data = JSON.parse(JSON.stringify(def.data));
  p.setData = function (d, cb) {
    Object.keys(d).forEach(k => {
      const ks = k.split('.');
      let o = this.data;
      ks.slice(0, -1).forEach(x => { o = o[x]; });
      o[ks[ks.length - 1]] = d[k];
    });
    if (cb) cb();
  };
  p.onLoad({ id });
  return p;
}

test('new dataset exercise: remote GIF + Chinese steps; image error falls back to text', () => {
  const p = loadPage('0001');
  assert.strictEqual(p.data.ex.nameZh, '3/4 仰卧起坐');
  assert.strictEqual(p.data.ex.mediaMode, 'image');
  assert.strictEqual(p.data.ex.remoteGif, true);
  assert.strictEqual(p.data.ex.illSrc, 'cloud://cloud1-d8gn4xfqredd566d1.636c-cloud1-d8gn4xfqredd566d1-1511089058/videos/0001-2gPfomN.gif');
  assert.ok(!p.data.ex.illSrc.includes('jsdelivr') && !p.data.ex.illSrc.includes('github'));
  assert.ok(p.data.ex.steps.length >= 3);
  assert.ok(/[\u4e00-\u9fff]/.test(p.data.ex.steps[0].text));
  p.onIllError();
  assert.strictEqual(p.data.ex.mediaMode, 'text');
  assert.strictEqual(p.data.ex.remoteGif, false);
});

test('covers and gifs use cloud fileIDs; existing anim mp4 is unchanged', () => {
  const fs = require('fs');
  const path = require('path');
  const MEDIA = require('../utils/dataset-media');
  const E = require('../utils/exercises');
  const root = 'cloud://cloud1-d8gn4xfqredd566d1.636c-cloud1-d8gn4xfqredd566d1-1511089058/';
  assert.strictEqual(MEDIA.CLOUD_ROOT, root);
  assert.strictEqual(MEDIA.thumbUrl('0001', '2gPfomN'), root + 'images/0001-2gPfomN.jpg');
  assert.strictEqual(MEDIA.gifUrl('0001', '2gPfomN'), root + 'videos/0001-2gPfomN.gif');
  assert.strictEqual(MEDIA.thumbUrl('', 'x'), '');
  assert.strictEqual(MEDIA.gifUrl('0001', ''), '');
  assert.strictEqual(E.byId['0025'].video, root + 'anim/0025.mp4');
  assert.ok(E.builtin.filter(e => e.video).every(e => e.video === root + 'anim/' + e.id + '.mp4'));
  function walk(dir, acc) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules') continue;
        walk(p, acc);
      } else if (/\.(js|wxml|wxss|json)$/.test(ent.name)) acc.push(p);
    }
    return acc;
  }
  const hits = walk(path.join(__dirname, '..'), []).filter(p => /jsdelivr\.net/.test(fs.readFileSync(p, 'utf8')));
  assert.deepStrictEqual(hits.map(p => path.relative(path.join(__dirname, '..'), p)), []);
});

test('dataset GIF wins over old mp4 and line art; GIF error stays on the local cover', () => {
  const fs = require('fs');
  const path = require('path');
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/exercise-detail/exercise-detail.wxml'), 'utf8');
  assert.ok(wxml.includes('wx:if="{{ex.videoSrc}}" class="speed'), '倍速只跟旧 mp4 走');
  assert.ok(wxml.includes('wx:if="{{ex.remoteGif}}"'));
  const bench = loadPage('0025');
  assert.strictEqual(bench.data.ex.nameZh, '杠铃卧推');
  assert.strictEqual(bench.data.ex.mediaMode, 'image');
  assert.strictEqual(bench.data.ex.remoteGif, true);
  assert.strictEqual(bench.data.ex.videoSrc, '');
  assert.strictEqual(bench.data.ex.illSrc, 'cloud://cloud1-d8gn4xfqredd566d1.636c-cloud1-d8gn4xfqredd566d1-1511089058/videos/0025-EIeI8Vf.gif');
  bench.onIllError();
  assert.strictEqual(bench.data.ex.mediaMode, 'image');
  assert.strictEqual(bench.data.ex.remoteGif, false);
  assert.strictEqual(bench.data.ex.videoSrc, '');
  assert.ok(bench.data.ex.illSrc.includes('/assets/video-posters/0025.jpg'));
  assert.ok(!String(bench.data.ex.illSrc).includes('.mp4'));
  const decline = loadPage('0033');
  assert.strictEqual(decline.data.ex.nameZh, '杠铃下斜卧推');
  assert.strictEqual(decline.data.ex.mediaMode, 'image');
  assert.strictEqual(decline.data.ex.remoteGif, true);
  assert.strictEqual(decline.data.ex.videoSrc, '');
  assert.strictEqual(decline.data.ex.illSrc, 'cloud://cloud1-d8gn4xfqredd566d1.636c-cloud1-d8gn4xfqredd566d1-1511089058/videos/0033-GrO65fd.gif');
  assert.ok(!decline.data.ex.illSrc.includes('0033.png'));
});

test('kept openGym-only exercise without media stays a text placeholder', () => {
  const p = loadPage('1204');
  assert.strictEqual(p.data.ex.mediaMode, 'text');
  assert.ok(p.data.ex.steps.length >= 1);
});
