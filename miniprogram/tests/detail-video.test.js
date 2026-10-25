// 0.4.2：详情页云视频——https 优先、downloadFile 兜底、失败只给友好提示（不弹技术细节）。
const test = require('node:test'); const assert = require('node:assert');
const { fresh } = require('./helpers');
function setup({ tempOk = true, dlOk = true } = {}) {
  fresh();
  const log = { toasts: [], modals: 0, dl: 0 };
  global.wx = {
    getStorageSync: () => ({}), setStorageSync() {}, removeStorageSync() {},
    showToast: o => log.toasts.push(o.title), showModal: () => { log.modals++; }, showLoading() {}, hideLoading() {},
    createVideoContext: () => ({ playbackRate() {} }),
    getFileSystemManager: () => ({ saveFile() {}, access: o => o.fail(), getFileInfo: o => o.success({ size: 1 }) }),
    cloud: {
      getTempFileURL: o => (tempOk ? o.success({ fileList: [{ status: 0, tempFileURL: 'https://x/anim/0025.mp4' }] }) : o.fail({ errMsg: 'boom' })),
      downloadFile: o => { log.dl++; return dlOk ? o.success({ statusCode: 200, tempFilePath: 'wxfile://tmp/a.mp4' }) : o.fail({ errMsg: 'file data is empty' }); },
    },
  };
  let def; global.Page = d => { def = d; };
  delete require.cache[require.resolve('../pages/exercise-detail/exercise-detail.js')];
  require('../pages/exercise-detail/exercise-detail.js');
  const p = Object.assign({}, def); p.data = JSON.parse(JSON.stringify(def.data));
  p.setData = function (d, cb) { Object.keys(d).forEach(k => { const ks = k.split('.'); let o = this.data; ks.slice(0, -1).forEach(x => { o = o[x]; }); o[ks[ks.length - 1]] = d[k]; }); if (cb) cb(); };
  p.onLoad({ id: '0025' });
  return { p, log };
}
test('https temp url is used first', () => {
  const { p, log } = setup();
  assert.strictEqual(p.data.ex.mediaMode, 'video'); assert.strictEqual(p.data.ex.videoSrc, 'https://x/anim/0025.mp4'); assert.strictEqual(log.dl, 0);
});
test('getTempFileURL fail → downloadFile local path', () => {
  const { p, log } = setup({ tempOk: false });
  assert.strictEqual(p.data.ex.videoSrc, 'wxfile://tmp/a.mp4'); assert.strictEqual(log.dl, 1);
});
test('https play error → retry local; second error → friendly toast only', () => {
  const { p, log } = setup();
  p.onAnimError({ detail: { errMsg: 'MEDIA_ERR_NETWORK' } });
  assert.strictEqual(p.data.ex.videoSrc, 'wxfile://tmp/a.mp4');
  p.onAnimError({ detail: { errMsg: 'MEDIA_ERR_SRC_NOT_SUPPORTED' } });
  assert.strictEqual(p.data.ex.mediaMode, 'image');
  assert.deepStrictEqual(log.toasts, ['视频加载失败，请稍后重试']); assert.strictEqual(log.modals, 0);
});
test('all sources fail → cover + friendly toast, no modal', () => {
  const { p, log } = setup({ tempOk: false, dlOk: false });
  assert.notStrictEqual(p.data.ex.mediaMode, 'video');
  assert.deepStrictEqual(log.toasts, ['视频加载失败，请稍后重试']); assert.strictEqual(log.modals, 0);
});
