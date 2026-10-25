// 关于 / 数据来源（QA Q9）: attribution and licence notice for the bundled exercise text.
// The full licence is also bundled as a JS string, because .txt files may be dropped from the uploaded package.
const LICENSE = require('../../data/license-openGym');
Page({
  data: { full: false, license: '' },
  toggle() { this.setData({ full: !this.data.full, license: this.data.full ? '' : LICENSE }); },
});
