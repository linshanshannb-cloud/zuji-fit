const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');

function absPath(p) {
  if (!p || typeof p !== 'string') return '';
  if (p.indexOf('://') > 0) return p; // cloud:// / https://
  return p.startsWith('/') ? p : '/' + p;
}

const _urlCache = {};
const FAIL_MSG = '视频加载失败，请稍后重试';
const CACHE_KEY = 'cloudVideoCache_v2';
try { wx.removeStorageSync('cloudVideoCache_v1'); } catch (e) { /* ignore */ }
function _loadCache() { try { return wx.getStorageSync(CACHE_KEY) || {}; } catch (e) { return {}; } }
function _saveCache(m) { try { wx.setStorageSync(CACHE_KEY, m); } catch (e) { /* ignore */ } }
/** 下载到本地（备选路径）；返回 wxfile 路径 */
function _download(src, cb) {
  const fs = typeof wx.getFileSystemManager === 'function' ? wx.getFileSystemManager() : null;
  const persisted = _loadCache()[src];
  const go = () => {
    if (!wx.cloud || typeof wx.cloud.downloadFile !== 'function') return cb({ errMsg: 'wx.cloud 不可用' });
    try { wx.showLoading({ title: '视频加载中', mask: false }); } catch (e) { /* ignore */ }
    wx.cloud.downloadFile({
      fileID: src,
      success: (res) => {
        try { wx.hideLoading(); } catch (e) { /* ignore */ }
        if (!res || !res.tempFilePath || (res.statusCode && res.statusCode !== 200)) return cb({ errMsg: 'downloadFile statusCode=' + (res && res.statusCode) + '\n' + src });
        cb(null, res.tempFilePath);
        if (fs) fs.saveFile({ tempFilePath: res.tempFilePath, success: (r) => { const m = _loadCache(); m[src] = r.savedFilePath; _saveCache(m); }, fail: () => {} });
      },
      fail: (err) => {
        try { wx.hideLoading(); } catch (e) { /* ignore */ }
        cb({ errMsg: 'downloadFile fail: ' + ((err && err.errMsg) || JSON.stringify(err)) + '\n' + src });
      },
    });
  };
  if (persisted && fs) fs.access({ path: persisted, success: () => cb(null, persisted), fail: go });
  else go();
}
/** 首选 getTempFileURL 的 https 地址（流式播放）；失败退回 downloadFile。mode: 'https' | 'local' */
function resolveSrc(src, cb, mode) {
  if (!src || src.indexOf('cloud://') !== 0) return cb(null, src);
  if (mode === 'local') return _download(src, cb);
  if (_urlCache[src]) return cb(null, _urlCache[src]);
  if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') return _download(src, cb);
  wx.cloud.getTempFileURL({
    fileList: [src],
    success: (res) => {
      const f = (res && res.fileList && res.fileList[0]) || {};
      if (f.status === 0 && f.tempFileURL) { _urlCache[src] = f.tempFileURL; cb(null, f.tempFileURL); }
      else { console.warn('[ex-detail] getTempFileURL bad', f); _download(src, cb); }
    },
    fail: (err) => { console.warn('[ex-detail] getTempFileURL fail', err); _download(src, cb); },
  });
}
function _dropCache(src) {
  delete _urlCache[src];
  const m = _loadCache();
  if (m[src]) { delete m[src]; _saveCache(m); }
}




/** 封面只用主包资源（poster 已迁到 assets/video-posters，或 illustration） */
function coverOf(ex) {
  return absPath(ex && ex.poster) || absPath(ex && ex.illustration) || '';
}

function mediaOf(ex) {
  const videoSrc = absPath(ex && ex.video);
  const posterSrc = absPath(ex && ex.poster); // 主包 assets/video-posters
  const illOnly = absPath(ex && ex.illustration); // 主包线稿
  // 有视频：封面优先主包海报（真实帧），无海报再用线稿；无视频：线稿优先。绝不引用 packageVideo*
  const cover = videoSrc ? (posterSrc || illOnly) : (illOnly || posterSrc);
  const illSrc = cover;
  if (videoSrc) {
    return {
      mediaMode: 'video',
      videoSrc,
      posterSrc: posterSrc || illSrc,
      illSrc: cover,
    };
  }
  if (cover) {
    return { mediaMode: 'image', videoSrc: '', posterSrc: '', illSrc: cover };
  }
  return { mediaMode: 'text', videoSrc: '', posterSrc: '', illSrc: '' };
}

Page({
  data: { ex: null, mode: '', best: '—', readOnly: false, isCustom: false, playing: false, rates: [0.5, 1, 1.5, 2], rate: 1 },
  _loading: false,
  onLoad(o) {
    const ex = repo.exercises.get(decodeURIComponent(o.id || ''));
    this.setData({ mode: o.mode || '', readOnly: repo.isReadOnly(), isCustom: !!(ex && ex.custom && !ex.unknown) });
    if (ex.unknown) return;
    const d = repo.exercises.display(ex);
    const media = mediaOf(ex);

    const base = {
      id: ex.id,
      nameZh: ex.nameZh,
      nameEn: F.capFirst(ex.nameEn),
      ph: F.lastTwo(ex.nameZh),
      pending: ex.translationPending,
      target: d.targetZh,
      secondary: d.secondaryZh,
      info: [
        { k: '部位', v: d.bodyPartZh + (ex.bodyPartDetail ? ' · ' + repo.exercises.zhOf('bodyPartDetail', ex.bodyPartDetail) : '') },
        { k: '器械', v: d.equipmentZh },
        { k: '类别', v: ex.categoryZh || '—' },
        { k: '我的最佳', v: '—', best: true },
      ],
      steps: ex.steps.map((s, i) => ({ no: (i < 9 ? '0' : '') + (i + 1), text: s })),
    };

    if (media.mediaMode === 'video') {
      // 先显示主包封面，再取云端视频地址
      const cover = media.illSrc;
      this.setData({
        playing: false,
        ex: Object.assign({}, base, {
          mediaMode: cover ? 'image' : 'text',
          videoSrc: media.videoSrc,
          posterSrc: media.posterSrc,
          illSrc: cover,
          _pendingVideo: true,
          _loadErr: '',
        }),
      }, () => {
        // setData 完成后再取视频地址，避免 this.data.ex 仍是旧值
        this._loadVideo();
      });
    } else {
      this.setData({ playing: false, ex: Object.assign({}, base, media, { _pendingVideo: false, _loadErr: '' }) });
    }
  },

  _toast(msg) {
    try {
      wx.showToast({ title: String(msg || ''), icon: 'none', duration: 2500 });
    } catch (e) { /* ignore */ }
  },
  /** 云视频：getTempFileURL 的 https 地址优先，失败退回 downloadFile 本地路径（见 resolveSrc / onAnimError） */
  _loadVideo() {
    const ex = this.data.ex;
    if (!ex || !ex.videoSrc) return;
    if (this._loading) return;
    const keepCover = (err) => {
      this._loading = false;
      console.error('[ex-detail] video load fail', err);
      const cover = ex.posterSrc || ex.illSrc;
      this.setData({ playing: false, 'ex.mediaMode': cover ? 'image' : 'text', 'ex._pendingVideo': false, 'ex._loadErr': (err && err.errMsg) || 'load fail' });
      this._toast(FAIL_MSG);
    };
    const show = (mode) => {
      const fileId = ex._fileId || ex.videoSrc;
      this._srcMode = mode || 'https';
      this._loading = true;
      resolveSrc(fileId, (err, url) => {
        this._loading = false;
        if (err || !url) { keepCover(err); return; }
        console.log('[ex-detail] show video', url);
        this.setData({ playing: true, 'ex._fileId': fileId, 'ex.videoSrc': url, 'ex.mediaMode': 'video', 'ex._pendingVideo': false, 'ex._loadErr': '' });
      }, this._srcMode);
    };
    this._show = show;
    show();
  },
  onShow() {
    if (!this.data.ex) return;
    if (this.data.isCustom) {
      const ex = repo.exercises.get(this.data.ex.id);
      if (!ex || ex.unknown || ex.archived) return wx.navigateBack();
      const d = repo.exercises.display(ex);
      this.setData({
        'ex.nameZh': ex.nameZh,
        'ex.ph': F.lastTwo(ex.nameZh),
        'ex.info[0].v': d.bodyPartZh + (ex.bodyPartDetail ? ' · ' + repo.exercises.zhOf('bodyPartDetail', ex.bodyPartDetail) : ''),
        'ex.info[1].v': d.equipmentZh,
        'ex.info[2].v': ex.categoryZh || '—',
      });
    }
    const b = repo.workouts.personalBest(this.data.ex.id);
    this.setData({ 'ex.info[3].v': b ? `${F.kg(b.weightKg)}kg × ${b.reps}` : '—' });
  },
  onHide() { this._pause(); },
  onUnload() { clearTimeout(this._rateT); this._pause(); },
  onPlay() { this.setData({ playing: true }); this._applyRate(); },
  onPause() { this.setData({ playing: false }); },
  /** 倍速：iOS 需在开始播放后再设置 playbackRate；每次 play 事件重新应用 */
  setRate(e) { const r = Number(e.currentTarget.dataset.r) || 1; this.setData({ rate: r }); this._applyRate(); },
  _applyRate() {
    if (!this.data.ex || this.data.ex.mediaMode !== 'video' || typeof wx.createVideoContext !== 'function') return;
    const ctx = wx.createVideoContext('exVideo', this);
    const r = this.data.rate;
    try { ctx.playbackRate(r); } catch (e) { console.warn('[ex-detail] playbackRate', e); }
    // iOS 偶发首次设置不生效：稍后再设一次
    clearTimeout(this._rateT); this._rateT = setTimeout(() => { try { ctx.playbackRate(r); } catch (e) { /* ignore */ } }, 300);
  },
  _pause() {
    if (this.data.ex && this.data.ex.mediaMode === 'video') this.setData({ 'ex.mediaMode': 'image', playing: false });
  },
  /** 封面点击：重新加载视频；已是视频则交给 togglePlay */
  onCoverTap() {
    const ex = this.data.ex;
    if (!ex || !ex.videoSrc) return;
    if (ex.mediaMode === 'video') {
      this.togglePlay();
      return;
    }
    // 图片/文字态：重新取视频并播放
    this._loading = false;
    this.setData({ 'ex._pendingVideo': true, 'ex._loadErr': '' });
    this._loadVideo();
  },
  /** 动图态点击 → 回封面（暂停）；封面态点击 → onCoverTap 播放 */
  togglePlay() {
    if (!this.data.ex) return;
    if (this.data.ex.mediaMode === 'video') this.setData({ 'ex.mediaMode': 'image', playing: false });
    else if (this.data.ex.videoSrc) this.onCoverTap();
  },
  onAnimError(ev) {
    const d = (ev && ev.detail) || {};
    const ex = this.data.ex || {};
    const src = ex.videoSrc || '';
    console.error('[ex-detail] video error', d, src);
    if (ex._fileId) _dropCache(ex._fileId);
    if (this._srcMode !== 'local' && ex._fileId && this._show) {
      // https 播放失败 → 退回 downloadFile 本地路径再试一次
      this._srcMode = 'local';
      this.setData({ 'ex.mediaMode': 'image', playing: false });
      this._show('local');
      return;
    }
    const report = (size) => {
      console.error('[ex-detail] video play fail', { errMsg: d.errMsg, src, size, fileID: ex._fileId || '' });
      this._fallbackImage(d.errMsg ? d : { errMsg: '视频播放失败' });
    };
    const fs = typeof wx.getFileSystemManager === 'function' ? wx.getFileSystemManager() : null;
    if (fs && src && src.indexOf('http') !== 0) {
      fs.getFileInfo({ filePath: src, success: (r) => report(r.size + ' B'), fail: (e) => report('getFileInfo fail: ' + (e && e.errMsg)) });
    } else report('n/a (https)');
    this._srcMode = 'https';
  },
  _fallbackImage(err) {
    // 有视频失败时优先主包海报，再线稿
    const cover = (this.data.ex && (this.data.ex.posterSrc || this.data.ex.illSrc)) || '';
    const msg = (err && (err.errMsg || err.message || err.errCode)) || '视频播放失败';
    console.error('[ex-detail] fallback image', msg);
    if (cover) {
      this.setData({
        'ex.mediaMode': 'image',
        'ex.illSrc': cover,
        'ex._pendingVideo': false,
        'ex._loadErr': String(msg),
        playing: false,
      });
    } else {
      this.setData({ 'ex.mediaMode': 'text', 'ex._pendingVideo': false, 'ex._loadErr': String(msg), playing: false });
    }
    this._toast(FAIL_MSG);
  },
  onIllError() {
    if (!this.data.ex || this.data.ex.mediaMode === 'text') return;
    // 主包封面挂了才退文字；等视频时也允许退，避免一直空白
    this.setData({ 'ex.mediaMode': 'text', 'ex.illSrc': '', playing: false });
  },
  addToWorkout() {
    if (!ui.canWrite()) return;
    const r = repo.workouts.addToCurrentDraft(this.data.ex.id);
    if (!ui.handle(r)) return;
    if (r.data.created) return wx.navigateTo({ url: '/pages/workout-edit/workout-edit?id=' + r.data.workoutId });
    this._lastWid = r.data.workoutId;
    wx.showModal({
      title: '已加入当前训练',
      content: '已追加到草稿末尾',
      confirmText: '去查看',
      cancelText: '留在这里',
      success: m => { if (m.confirm) wx.navigateTo({ url: '/pages/workout-edit/workout-edit?id=' + r.data.workoutId }); },
    });
  },
  select() {
    const ch = this.getOpenerEventChannel && this.getOpenerEventChannel();
    if (ch && ch.emit) ch.emit('select', this.data.ex.id);
    wx.navigateBack();
  },
  editCustom() {
    if (!this.data.isCustom || !ui.canWrite()) return;
    wx.navigateTo({ url: '/pages/custom-exercise-edit/custom-exercise-edit?id=' + encodeURIComponent(this.data.ex.id) });
  },
  deleteCustom() {
    if (!this.data.isCustom || !ui.canWrite()) return;
    ui.confirmDelete({
      title: '删除自定义动作？',
      content: '若已有训练记录引用，将归档保留历史；否则永久删除。',
      confirmText: '删除',
    }, () => {
      const r = repo.deleteCustomExercise(this.data.ex.id);
      if (!ui.handle(r)) return;
      wx.showToast({ title: r.data && r.data.archived ? '已归档（历史仍可见）' : '已删除', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 350);
    });
  },
});
