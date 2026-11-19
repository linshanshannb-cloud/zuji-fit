const D = require('../../../utils/date');
const repo = require('../../../utils/repo/index');
const SD = require('../../../utils/share-day');
const { drawShareCard, W } = require('./draw');

function loadImage(canvas, src) {
  return new Promise(resolve => {
    const img = canvas.createImage();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function platform() {
  try {
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    return sys.platform || '';
  } catch (e) { return ''; }
}
function strengthSource(w) {
  const full = repo.workouts.getWorkout(w.id);
  return {
    kind: 'strength',
    givenName: w.name || '',
    name: w.displayName, minutes: w.durationMin, sets: w.setCount,
    volumeKg: w.volumeKg, timeSec: w.timeSec, createdAt: w.createdAt || 0,
    detailMissing: !!(full && full.detailMissing),
    exercises: ((full && full.exercises) || []).map(e => ({
      name: e.displayName, mode: e.mode === 'time' ? 'time' : 'reps',
      sets: (e.sets || []).map(s => ({
        index: s.index, type: s.type, done: s.done === true,
        weightKg: s.weightKg, reps: s.reps, durationSec: s.durationSec,
      })),
    })),
  };
}

Page({
  data: { path: '', paths: [], mode: 'brief', busy: true, fail: '', saving: false, saved: false },
  onLoad(q) {
    const date = (q && q.date) || D.today();
    const ws = repo.workouts.daySummaries(date);
    const as = repo.aerobic.daySummaries(date);
    const board = repo.diet.problem() ? { entries: [] } : repo.diet.dayBoard(date);
    const train = ws.map(strengthSource).concat(as.map(a => ({
      kind: 'aerobic', name: a.title, activityType: a.activityType, minutes: a.durationMin, kcal: a.estimatedKcal, createdAt: a.createdAt || 0,
    })));
    const diet = (board.entries || []).map((e, i) => ({
      name: e.displayName || e.name, mealLabel: e.mealLabel, kcal: typeof e.kcal === 'number' ? e.kcal : null, estimate: !!e.estimate, createdAt: e.createdAt || i,
    }));
    this.source = { date, train, diet, platform: platform() };
    this.model = SD.buildShareModel(Object.assign({ mode: 'brief' }, this.source));
  },
  onReady() { this.render(); },
  onUnload() { if (this._savedTimer) clearTimeout(this._savedTimer); },
  setMode(e) {
    const mode = e.currentTarget.dataset.mode === 'detail' ? 'detail' : 'brief';
    if (!this.source || mode === this.data.mode) return;
    this.setData({ mode, busy: true, fail: '', path: '', paths: [], saved: false, saving: false });
    this.model = SD.buildShareModel(Object.assign({ mode }, this.source));
    this.render();
  },
  render() {
    const gen = (this._gen = (this._gen || 0) + 1);
    const query = wx.createSelectorQuery();
    query.select('#card').fields({ node: true, size: true }).exec(res => {
      if (gen !== this._gen) return;
      const node = res && res[0] && res[0].node;
      if (!node) { this.setData({ busy: false, fail: '画布没有准备好' }); return; }
      const ctx = node.getContext('2d');
      const slices = this.model && this.model.slices && this.model.slices.length ? this.model.slices : [this.model];
      const srcs = [];
      const add = s => { if (s && srcs.indexOf(s) < 0) srcs.push(s); };
      slices.forEach(slice => {
        if (slice && slice.layout === 'detail') {
          add(slice.heroSticker);
          (slice.blocks || []).forEach(b => add(b.sticker));
          return;
        }
        const rows = ((slice.train && slice.train.rows) || []).concat((slice.diet && slice.diet.rows) || []);
        rows.forEach(row => add(row.sticker));
      });
      Promise.all(srcs.map(src => loadImage(node, src).then(img => [src, img]))).then(pairs => {
        if (gen !== this._gen) return;
        const images = {};
        pairs.forEach(pair => { images[pair[0]] = pair[1]; });
        this.exportSlices(node, ctx, slices, images, 0, [], gen);
      });
    });
  },
  // 单张画布不超过设备导出上限。内容放不下就分成多张，不删动作、饮食或总热量。
  exportSlices(node, ctx, slices, images, i, paths, gen) {
    if (gen !== this._gen) return;
    if (i >= slices.length) {
      this.setData({ paths, path: paths[0] || '', busy: false, fail: paths.length ? '' : '图片没有生成' });
      return;
    }
    const slice = slices[i];
    const limit = SD.exportLimit(this.source && this.source.platform);
    const h = slice.layout === 'detail' ? slice.height : SD.cardHeight(slice);
    let scale = slice.exportScale || 1;
    if (Math.max(W, h) * scale > limit) scale = limit / Math.max(W, h);
    const bw = Math.max(1, Math.floor(W * scale));
    const bh = Math.max(1, Math.floor(h * scale));
    node.width = bw;
    node.height = bh;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawShareCard(ctx, slice, images);
    wx.canvasToTempFilePath({
      canvas: node, destWidth: bw, destHeight: bh, fileType: 'png',
      success: r => this.exportSlices(node, ctx, slices, images, i + 1, paths.concat([r.tempFilePath]), gen),
      fail: () => { if (gen === this._gen) this.setData({ busy: false, fail: '图片没有生成', paths: [], path: '' }); },
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
    const paths = this.data.paths && this.data.paths.length ? this.data.paths : (this.data.path ? [this.data.path] : []);
    if (!paths.length || this.data.saving) return;
    this.setData({ saving: true, saved: false });
    const stop = () => this.setData({ saving: false });
    const done = () => {
      this.setData({ saving: false, saved: true });
      if (this._savedTimer) clearTimeout(this._savedTimer);
      this._savedTimer = setTimeout(() => this.setData({ saved: false }), 2000);
      if (paths.length > 1) wx.showToast({ title: '已保存' + paths.length + '张', icon: 'none' });
    };
    const denied = () => {
      stop();
      wx.showModal({
        title: '需要相册权限',
        content: '保存图片只写入手账图片，不会读取相册里的其他照片。',
        confirmText: '去设置', cancelText: '取消',
        success: r => { if (r.confirm) wx.openSetting({}); },
      });
    };
    const go = (i) => {
      if (i >= paths.length) return done();
      wx.saveImageToPhotosAlbum({
        filePath: paths[i],
        success: () => go(i + 1),
        fail: err => {
          stop();
          const msg = (err && err.errMsg) || '';
          if (/auth|deny|denied|authorize/i.test(msg)) denied();
          else wx.showToast({ title: '没有保存', icon: 'none' });
        },
      });
    };
    if (!wx.getSetting) return go(0);
    wx.getSetting({
      success: s => {
        if (s.authSetting && s.authSetting['scope.writePhotosAlbum'] === false) denied();
        else go(0);
      },
      fail: () => go(0),
    });
  },
});
