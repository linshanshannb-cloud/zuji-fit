// Usage: this.selectComponent('#undo').show('已删除第 3 组', payload). Emits 'undo' with {payload}. 5s; a newer show() replaces the older one.
Component({
  properties: { bottom: { type: Number, value: 200 } },
  data: { visible: false, text: '' },
  lifetimes: { detached() { clearTimeout(this._t); } },
  methods: {
    show(text, payload, ms = 5000) {
      clearTimeout(this._t); this._payload = payload;
      this.setData({ visible: true, text });
      this._t = setTimeout(() => this.hide(), ms);
    },
    hide() { clearTimeout(this._t); this._payload = undefined; this.setData({ visible: false }); },
    onUndo() { const p = this._payload; this.hide(); if (p !== undefined) this.triggerEvent('undo', { payload: p }); },
  },
});
