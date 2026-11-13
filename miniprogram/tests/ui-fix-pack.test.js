// 月份圆片、分享胶囊、预览页并排按钮。防止退回细箭头、手绘方框和 184px 窄按钮。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('month chips, share pill, and preview buttons match the approved layout', () => {
  const calW = read('components/month-calendar/month-calendar.wxml');
  const calC = read('components/month-calendar/month-calendar.wxss');
  assert.ok(calW.includes('/images/icons/chevron-left@3x.png'));
  assert.ok(calW.includes('/images/icons/chevron-right@3x.png'));
  assert.ok(!calW.includes('nav-chev'));
  assert.ok(calC.includes('.nav-chip') && calC.includes('border: 1px solid #E3DBD0'));
  assert.ok(calC.includes('margin-right: -12rpx') && calC.includes('margin-left: -8rpx'));
  assert.ok(!/\.nav-chev\s*\{/.test(calC));

  const pageW = read('pages/calendar/calendar.wxml');
  const pageC = read('pages/calendar/calendar.wxss');
  const head = pageW.slice(pageW.indexOf('class="day-head"'), pageW.indexOf('class="peer'));
  assert.ok(head.includes('分享') && head.includes('/images/icons/share-ink@3x.png'));
  assert.ok(!head.includes('wx:if'));
  assert.ok(!pageW.includes('share-box') && !/\.share-box/.test(pageC));
  assert.ok(pageC.includes('.share-pill') && pageC.includes('height: 56rpx'));

  const shareW = read('pages/journal-pack/share/share.wxml');
  const shareC = read('pages/journal-pack/share/share.wxss');
  const shareJ = read('pages/journal-pack/share/share.js');
  assert.ok(shareW.indexOf('保存图片') < shareW.indexOf('发给好友'));
  assert.ok(shareW.includes('保存中…') && shareW.includes('已保存'));
  assert.ok(shareC.includes('width: auto !important') && shareC.includes('padding: 0 !important'));
  assert.ok(shareC.includes('button.btn-pri::after { border: none; }'));
  assert.ok(shareC.includes('#E04E17') && !shareC.includes('box-shadow: 0 12rpx'));
  assert.ok(shareJ.includes('saving: false, saved: false') && shareJ.includes('2000'));
  assert.ok(!shareJ.includes('已保存到相册'));
  ['chevron-left@3x.png', 'chevron-right@3x.png', 'share-ink@3x.png'].forEach(name => {
    assert.ok(fs.existsSync(path.join(root, 'images/icons', name)), name);
  });
});
