// 组间歇倒计时浮层。start(secs, title) 开始；按 endAt 时间戳计算剩余，切后台回来自动校准。
// 事件：skip / done / settings
const R = require('../../utils/rest');
Component({
  properties: { bottom: { type: Number, value: 200 } },
  data: { visible: false, left: 0, label: '0:00', title: '', pct: 100, finished: false },
  lifetimes: { detached() { this._clear(); } },
  pageLifetimes: { show() { if (this._t) this._tick(); } },
  methods: {
    start(secs, title) {
      this._clear();
      this._t = R.start(secs, Date.now());
      this._buzzed = false;
      this.setData({ visible: true, finished: false, title: title || '组间休息' });
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
      try { wx.vibrateLong(); } catch (e) { /* noop */ }
      this.setData({ finished: true, label: '0:00', pct: 0 });
      this.triggerEvent('done');
      this._hide = setTimeout(() => this.close(), 2500);
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
    close() { this._clear(); this._t = null; this.setData({ visible: false, finished: false }); },
    isRunning() { return !!this._t && !this.data.finished; },
    _clear() { clearInterval(this._iv); this._iv = null; clearTimeout(this._hide); this._hide = null; },
    noop() {},
  },
});
