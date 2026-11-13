const D = require('../../../utils/date');
const repo = require('../../../utils/repo/index');
const SD = require('../../../utils/share-day');
const { drawShareCard } = require('./draw');

function loadImage(canvas, src) {
  return new Promise(resolve => {
    const img = canvas.createImage();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

Page({
  data: { path: '', busy: true, fail: '', saving: false, saved: false },
  onLoad(q) {
    const date = (q && q.date) || D.today();
    const ws = repo.workouts.daySummaries(date);
    const as = repo.aerobic.daySummaries(date);
    const board = repo.diet.problem() ? { entries: [] } : repo.diet.dayBoard(date);
    const train = ws.map(w => ({
      kind: 'strength', name: w.displayName, minutes: w.durationMin, sets: w.setCount, createdAt: w.createdAt || 0,
    })).concat(as.map(a => ({
      kind: 'aerobic', name: a.title, activityType: a.activityType, minutes: a.durationMin, kcal: a.estimatedKcal, createdAt: a.createdAt || 0,
    })));
    const diet = (board.entries || []).map((e, i) => ({
      name: e.displayName || e.name, mealLabel: e.mealLabel, kcal: typeof e.kcal === 'number' ? e.kcal : null, createdAt: e.createdAt || i,
    }));
    this.model = SD.buildShareModel({ date, train, diet });
  },
  onReady() { this.render(); },
  onUnload() { if (this._savedTimer) clearTimeout(this._savedTimer); },
  render() {
    const query = wx.createSelectorQuery();
    query.select('#card').fields({ node: true, size: true }).exec(res => {
      const node = res && res[0] && res[0].node;
      if (!node) { this.setData({ busy: false, fail: '画布没有准备好' }); return; }
      const ctx = node.getContext('2d');
      node.width = 1080;
      node.height = 1440;
      const srcs = [];
      this.model.train.rows.concat(this.model.diet.rows).forEach(row => { if (srcs.indexOf(row.sticker) < 0) srcs.push(row.sticker); });
      Promise.all(srcs.map(src => loadImage(node, src).then(img => [src, img]))).then(pairs => {
        const images = {};
        pairs.forEach(pair => { images[pair[0]] = pair[1]; });
        drawShareCard(ctx, this.model, images);
        wx.canvasToTempFilePath({
          canvas: node, destWidth: 1080, destHeight: 1440, fileType: 'png',
          success: r => this.setData({ path: r.tempFilePath, busy: false, fail: '' }),
          fail: () => this.setData({ busy: false, fail: '图片没有生成' }),
        });
      });
    });
  },
  onShareAppMessage() {
    const m = this.model || {};
    return {
      title: (m.dateLabel || '今天') + ' · 组迹',
      path: '/pages/calendar/calendar',
      imageUrl: this.data.path || '',
    };
  },
  save() {
    const path = this.data.path;
    if (!path || this.data.saving) return;
    this.setData({ saving: true, saved: false });
    const stop = () => this.setData({ saving: false });
    const done = () => {
      this.setData({ saving: false, saved: true });
      if (this._savedTimer) clearTimeout(this._savedTimer);
      this._savedTimer = setTimeout(() => this.setData({ saved: false }), 2000);
    };
    const denied = () => {
      stop();
      wx.showModal({
        title: '需要相册权限',
        content: '保存图片只写入这一张手账，不会读取相册里的其他照片。',
        confirmText: '去设置', cancelText: '取消',
        success: r => { if (r.confirm) wx.openSetting({}); },
      });
    };
    const go = () => wx.saveImageToPhotosAlbum({
      filePath: path,
      success: done,
      fail: err => {
        stop();
        const msg = (err && err.errMsg) || '';
        if (/auth|deny|denied|authorize/i.test(msg)) denied();
        else wx.showToast({ title: '没有保存', icon: 'none' });
      },
    });
    if (!wx.getSetting) return go();
    wx.getSetting({
      success: s => {
        if (s.authSetting && s.authSetting['scope.writePhotosAlbum'] === false) denied();
        else go();
      },
      fail: go,
    });
  },
});
