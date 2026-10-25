// One WorkoutSet row: [no./热] [weight stepper] [reps stepper] [done check]. Emits change/toggletype/toggledone/more.
// Values are committed via events; the page calls the repo. Long-press on ± repeats (400ms delay, 100ms interval).
const F = require('../../utils/format');
const LIM = { weightKg: { step: 2.5, max: 999.9 }, reps: { step: 1, max: 999 } };
Component({
  properties: { set: Object, label: String, bodyweight: Boolean, shake: Boolean, readonly: Boolean },
  data: { w: '', r: '', editing: '' },
  observers: { set(s) { if (s) this.setData({ w: F.kg(s.weightKg), r: s.reps === null || s.reps === undefined ? '' : String(s.reps) }); } },
  lifetimes: { detached() { this.stopRepeat(); } },
  methods: {
    bump(field, dir) {
      const cur = Number(field === 'weightKg' ? this.data.w : this.data.r) || 0;
      let v = Math.round((cur + dir * LIM[field].step) * 10) / 10;
      v = Math.max(0, Math.min(LIM[field].max, v));
      this.setData(field === 'weightKg' ? { w: F.kg(v) } : { r: String(v) });
      return v;
    },
    onStep(e) { if (this.data.readonly) return; const { f, d } = e.currentTarget.dataset; const v = this.bump(f, +d); this.triggerEvent('change', { field: f, value: v }); },
    onStepLong(e) {
      if (this.data.readonly) return;
      const { f, d } = e.currentTarget.dataset; this._rf = f;
      this._ri = setInterval(() => this.bump(f, +d), 100);
    },
    onStepEnd() { if (this._ri) { this.stopRepeat(); const f = this._rf; this.triggerEvent('change', { field: f, value: Number(f === 'weightKg' ? this.data.w : this.data.r) }); } },
    stopRepeat() { clearInterval(this._ri); this._ri = null; },
    onFocus(e) { this.setData({ editing: e.currentTarget.dataset.f }); },
    onBlur(e) {
      const f = e.currentTarget.dataset.f; let raw = String(e.detail.value).trim(); this.setData({ editing: '' });
      if (raw === '') return this.triggerEvent('change', { field: f, value: null });
      let v = Number(raw);
      if (!isFinite(v)) { const s = this.data.set; return this.setData({ w: F.kg(s.weightKg), r: s.reps == null ? '' : String(s.reps) }); }
      if (f === 'reps') v = Math.trunc(v); // R-A: truncate decimals
      const max = LIM[f].max;
      if (v > max) { v = max; wx.showToast({ title: f === 'reps' ? '次数最大 999' : '重量最大 999.9 kg', icon: 'none' }); }
      if (v < 0) v = 0;
      v = Math.round(v * 10) / 10;
      this.setData(f === 'weightKg' ? { w: F.kg(v) } : { r: String(v) });
      this.triggerEvent('change', { field: f, value: v });
    },
    onType() { if (!this.data.readonly) { try { wx.vibrateShort({ type: 'light' }); } catch (e) { /* noop */ } this.triggerEvent('toggletype'); } },
    onDone() { if (!this.data.readonly) this.triggerEvent('toggledone'); },
    noop() {},
    onLong() { if (!this.data.readonly) this.triggerEvent('more'); },
  },
});
