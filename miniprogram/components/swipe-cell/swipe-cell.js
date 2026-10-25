// 左滑露出红色「删除」。横向位移占优（|dx|>|dy| 且 >10px）才接管，避免影响纵向滚动和点击。
// 同一时刻只开一个：打开时广播，其他实例收起。事件：delete
const W = 75; // 按钮宽度 px（150rpx@375）
const open = new Set();
function decide(dx, dy) { return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2; }
function settle(offset, startOffset) { // 结束时吸附：超过一半打开
  const x = Math.min(0, Math.max(-W, offset));
  if (startOffset === 0) return x < -W * 0.35 ? -W : 0;
  return x < -W * 0.65 ? -W : 0;
}
Component({
  options: { multipleSlots: true },
  properties: { disabled: Boolean, text: { type: String, value: '删除' } },
  data: { x: 0, anim: true },
  lifetimes: { attached() { open.add(this); }, detached() { open.delete(this); } },
  methods: {
    ts(e) {
      if (this.data.disabled) return;
      const t = e.touches[0]; this._s = { x: t.clientX, y: t.clientY, off: this.data.x, mode: '' };
    },
    tm(e) {
      const s = this._s; if (!s) return;
      const t = e.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (!s.mode) { if (decide(dx, dy)) { s.mode = 'h'; open.forEach(c => { if (c !== this) c.close(); }); } else if (Math.abs(dy) > 10) s.mode = 'v'; }
      if (s.mode === 'h') this.setData({ anim: false, x: Math.min(0, Math.max(-W - 20, s.off + dx)) });
    },
    te() {
      const s = this._s; this._s = null; if (!s || s.mode !== 'h') return;
      this.setData({ anim: true, x: settle(this.data.x, s.off) });
    },
    close() { if (this.data.x !== 0) this.setData({ anim: true, x: 0 }); },
    onDel() { this.setData({ anim: true, x: 0 }); this.triggerEvent('delete'); },
  },
});
module.exports = { _decide: decide, _settle: settle, _W: W };
