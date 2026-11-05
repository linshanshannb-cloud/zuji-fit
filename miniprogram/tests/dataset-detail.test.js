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
  assert.ok(p.data.ex.illSrc.includes('/videos/0001-') && p.data.ex.illSrc.endsWith('.gif'));
  assert.ok(p.data.ex.steps.length >= 3);
  assert.ok(/[\u4e00-\u9fff]/.test(p.data.ex.steps[0].text));
  p.onIllError();
  assert.strictEqual(p.data.ex.mediaMode, 'text');
  assert.strictEqual(p.data.ex.remoteGif, false);
});

test('kept openGym-only exercise without media stays a text placeholder', () => {
  const p = loadPage('1204');
  assert.strictEqual(p.data.ex.mediaMode, 'text');
  assert.ok(p.data.ex.steps.length >= 1);
});
