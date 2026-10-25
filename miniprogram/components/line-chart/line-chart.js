// series: { from, to, points:[{date,value}] } (from repo.body.bodySeries). Canvas 2d, no libs. Tap/drag shows bubble.
const { chartLayout, bubblePos } = require('../../utils/repo/series');
const F = require('../../utils/format');
const T = require('../../utils/tokens');
// Bubble width estimate (22rpx text + 16rpx padding each side): CJK ≈ 11px, other ≈ 6.5px.
const bubbleW = (text, rpx) => [...text].reduce((t, c) => t + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 11 : 6.5), 0) * rpx * 2 + 16 * rpx * 2;
const rpxPx = () => { try { return ((wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowWidth || 375) / 750; } catch (e) { return 0.5; } };
Component({
  properties: { series: { type: Object, value: null }, unit: String, height: { type: Number, value: 360 } },
  data: { bubble: null },
  observers: { series() { this.draw(); } },
  lifetimes: { ready() { this.draw(); }, detached() { clearTimeout(this._bt); } },
  methods: {
    draw() {
      const series = this.data.series;
      if (!series || !series.points || !series.points.length) return;
      this.createSelectorQuery().select('#c').fields({ node: true, size: true }).exec(res => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node, w = res[0].width, h = res[0].height;
        const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2;
        canvas.width = w * dpr; canvas.height = h * dpr;
        const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
        const L = chartLayout(series, w, h, { l: 32, r: 12, t: 16, b: 22 });
        this._L = L;
        ctx.lineWidth = 0.5; ctx.strokeStyle = T.LINE; ctx.fillStyle = T.TEXT3; ctx.font = '10px sans-serif';
        L.ticks.forEach((t, i) => {
          ctx.setLineDash(i === 0 ? [] : [3, 3]); ctx.beginPath(); ctx.moveTo(L.pad.l, t.y); ctx.lineTo(w - L.pad.r, t.y); ctx.stroke();
          ctx.fillText(t.label, 0, t.y + 3);
        });
        ctx.setLineDash([]);
        // x labels: up to 5, evenly across from..to
        const n = Math.min(5, series.from === series.to ? 1 : 5);
        const d0 = new Date(series.from.replace(/-/g, '/')).getTime(), d1 = new Date(series.to.replace(/-/g, '/')).getTime();
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? d0 : d0 + ((d1 - d0) * i) / (n - 1), d = new Date(t);
          const x = L.pad.l + (n === 1 ? (w - L.pad.l - L.pad.r) / 2 : ((w - L.pad.l - L.pad.r) * i) / (n - 1));
          const label = (d.getMonth() + 1) + '/' + d.getDate();
          ctx.fillText(label, Math.min(Math.max(x - 10, L.pad.l), w - 28), h - 4);
        }
        const P = L.points, last = P[P.length - 1];
        ctx.strokeStyle = T.ACCENT; ctx.lineWidth = 2;
        if (P.length > 1) { ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); }
        ctx.setLineDash([3, 3]); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(last.x, L.pad.t); ctx.lineTo(last.x, h - L.pad.b); ctx.stroke(); ctx.setLineDash([]);
        P.forEach((p, i) => {
          ctx.beginPath(); ctx.arc(p.x, p.y, i === P.length - 1 ? 5 : 2.5, 0, Math.PI * 2);
          ctx.fillStyle = i === P.length - 1 ? T.ACCENT : T.WHITE; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.ACCENT; ctx.stroke();
        });
        if (P.length === 1) { ctx.fillStyle = T.INK; ctx.font = '12px sans-serif'; ctx.fillText(String(last.value), last.x + 8, last.y - 8); }
      });
    },
    onTouch(e) {
      if (!this._L || !this._L.points.length) return;
      const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]); if (!t) return;
      const x = t.x !== undefined ? t.x : t.clientX;
      let best = this._L.points[0]; this._L.points.forEach(p => { if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p; });
      clearTimeout(this._bt);
      const text = F.md(best.date) + ' · ' + F.fixed1(best.value) + ' ' + this.data.unit;
      this.setData({ bubble: bubblePos(best, this._L.w, this._L.h, bubbleW(text, rpxPx()), text) });
    },
    onEnd() { clearTimeout(this._bt); this._bt = setTimeout(() => this.setData({ bubble: null }), 2000); },
  },
});
