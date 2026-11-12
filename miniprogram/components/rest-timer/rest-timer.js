// 组间歇 / 组时长倒计时浮层。start(secs, title, { kind }) 开始；按 endAt 时间戳计算剩余，切后台回来自动校准。
// kind: 'rest'（默认，结束文案「休息结束」）| 'hold'（结束文案「时间到」）。
// 结束时播放提示音 + 长振动；若结束时刻比预期晚 3 秒以上（从后台/锁屏回来），只更新状态，不再补响。
// 进行中保持亮屏。事件：skip / done / settings。done 的 detail 为 { kind, late }。
const R = require('../../utils/rest');
const beep = require('../../utils/beep');
Component({
  properties: { bottom: { type: Number, value: 200 } },
  data: { visible: false, left: 0, label: '0:00', title: '', pct: 100, finished: false, doneLabel: '休息结束', showSettings: true, dragY: 0 },
  lifetimes: { detached() { this._clear(); this._screen(false); } },
  pageLifetimes: { show() { if (this._t) this._tick(); } },
  methods: {
    start(secs, title, opts) {
      opts = opts || {};
      this._clear();
      this._kind = opts.kind === 'hold' ? 'hold' : 'rest';
      this._t = R.start(secs, Date.now());
      this._buzzed = false;
      this.setData({
        visible: true, finished: false,
        title: title || (this._kind === 'hold' ? '计时' : '组间休息'),
        doneLabel: this._kind === 'hold' ? '时间到' : '休息结束',
        showSettings: this._kind !== 'hold',
      });
      this._screen(true);
      this._tick();
      this._iv = setInterval(() => this._tick(), 250);
    },
    _tick() {
      if (!this._t) return;
      const left = R.remaining(this._t, Date.now());
      const pct = Math.round((left / this._t.total) * 100);
      if (left !== this.data.left || pct !== this.data.pct) this.setData({ left, label: R.fmt(left), pct });
      if (left <= 0 && !this._buzzed) this._finish();
    },
    _finish() {
      this._buzzed = true;
      clearInterval(this._iv); this._iv = null;
      const late = !!(this._t && Date.now() - this._t.endAt > 3000);
      const kind = this._kind || 'rest';
      if (!late) { try { beep.alertDone(); } catch (e) { /* audio must not break the timer */ } }
      this._screen(false);
      this.setData({ finished: true, label: '0:00', pct: 0 });
      // Schedule hide before the done handler: it may start a new countdown and clear this timer.
      this._hide = setTimeout(() => this.close(), 2500);
      this.triggerEvent('done', { kind, late });
    },
    plus() { this._adj(15); },
    minus() { this._adj(-15); },
    _adj(d) {
      if (!this._t || this.data.finished) return;
      this._t = R.adjust(this._t, d, Date.now());
      this._tick();
    },
    skip() { this.triggerEvent('skip'); this.close(); },
    settings() { this.triggerEvent('settings'); },
    // 拖标题或进度条挪开浮层。按钮不在拖动手势里，避免把点击吃掉。dragY 留在组件上，这次打开页面都记得。
    onDragStart(e) {
      const t = e.touches && e.touches[0];
      if (!t) return;
      this._drag = { y: t.clientY, origin: this.data.dragY || 0 };
      this._measure();
    },
    onDragMove(e) {
      if (!this._drag) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const dy = t.clientY - this._drag.y;
      if (!this._drag.moved) {
        if (Math.abs(dy) < 8) return;
        this._drag.moved = true;
      }
      const next = this._clamp(this._drag.origin + dy);
      if (next !== this.data.dragY) this.setData({ dragY: next });
    },
    onDragEnd() { this._drag = null; },
    _measure() {
      if (this._barH || typeof wx === 'undefined' || !wx.createSelectorQuery) return;
      try {
        wx.createSelectorQuery().in(this).select('.rt').boundingClientRect(r => {
          if (r && r.height) this._barH = r.height;
        }).exec();
      } catch (err) { /* layout can wait */ }
    },
    _screenSize() {
      if (this._screenInfo && this._screenInfo.windowHeight) return this._screenInfo;
      let info = null;
      try { if (typeof wx !== 'undefined' && wx.getSystemInfoSync) info = wx.getSystemInfoSync(); } catch (err) { /* use fallback */ }
      this._screenInfo = info && info.windowHeight ? info : { windowHeight: 800, windowWidth: 375, statusBarHeight: 44 };
      return this._screenInfo;
    },
    _clamp(dragY) {
      const win = this._screenSize();
      const bottomPx = (Number(this.data.bottom) || 0) * (win.windowWidth / 750);
      const barH = this._barH || 160;
      const topSafe = (win.statusBarHeight || 44) + 8;
      const maxDrag = bottomPx - 8;
      const minDrag = topSafe + barH + bottomPx - win.windowHeight;
      if (minDrag > maxDrag) return 0;
      return Math.max(minDrag, Math.min(maxDrag, dragY));
    },
    close() { this._clear(); this._t = null; this._drag = null; this._screen(false); this.setData({ visible: false, finished: false }); },
    isRunning() { return !!this._t && !this.data.finished; },
    _clear() { clearInterval(this._iv); this._iv = null; clearTimeout(this._hide); this._hide = null; },
    _screen(on) {
      try { if (typeof wx !== 'undefined' && typeof wx.setKeepScreenOn === 'function') wx.setKeepScreenOn({ keepScreenOn: !!on }); } catch (e) { /* noop */ }
    },
    noop() {},
  },
});
