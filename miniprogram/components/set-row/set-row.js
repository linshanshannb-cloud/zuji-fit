// One WorkoutSet row: [no./热] [weight stepper] [reps stepper] [done check]. Emits change/toggletype/toggledone/more.
// Values are committed via events; the page calls the repo. Long-press on ± repeats (400ms delay, 100ms interval).
const F = require('../../utils/format');
const LIM = { weightKg: { step: 2.5, max: 999.9 }, reps: { step: 1, max: 999 }, durationSec: { step: 5, max: 3600 } };
Component({
  properties: { set: Object, label: String, bodyweight: Boolean, shake: Boolean, readonly: Boolean, mode: { type: String, value: 'reps' } },
  data: { w: '', r: '', d: '', editing: '' },
  observers: {
    set(s) {
      if (!s) return;
      this.setData({
        w: F.kg(s.weightKg),
        r: s.reps === null || s.reps === undefined ? '' : String(s.reps),
        d: s.durationSec === null || s.durationSec === undefined ? '' : String(s.durationSec),
      });
    },
  },
  lifetimes: { detached() { this.stopRepeat(); } },
  methods: {
    bump(field, dir) {
      if (field === 'durationSec') {
        const cur = Number(this.data.d) || 0;
        let v = Math.round(cur + dir * LIM.durationSec.step);
        v = Math.max(0, Math.min(LIM.durationSec.max, v));
        this.setData({ d: v ? String(v) : '' });
        return v || null;
      }
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
    onStepEnd() {
      if (!this._ri) return;
      this.stopRepeat();
      const f = this._rf;
      if (f === 'durationSec') { const n = Number(this.data.d) || 0; this.triggerEvent('change', { field: f, value: n || null }); return; }
      this.triggerEvent('change', { field: f, value: Number(f === 'weightKg' ? this.data.w : this.data.r) });
    },
    stopRepeat() { clearInterval(this._ri); this._ri = null; },
    onFocus(e) { this.setData({ editing: e.currentTarget.dataset.f }); },
    onBlur(e) {
      const f = e.currentTarget.dataset.f; let raw = String(e.detail.value).trim(); this.setData({ editing: '' });
      if (raw === '') return this.triggerEvent('change', { field: f, value: null });
      let v = Number(raw);
      const revert = () => {
        const s = this.data.set || {};
        this.setData({ w: F.kg(s.weightKg), r: s.reps == null ? '' : String(s.reps), d: s.durationSec == null ? '' : String(s.durationSec) });
      };
      if (!isFinite(v)) return revert();
      if (f === 'reps' || f === 'durationSec') v = Math.trunc(v);
      if (f === 'durationSec') {
        if (v <= 0) { this.setData({ d: '' }); return this.triggerEvent('change', { field: f, value: null }); }
        if (v > LIM.durationSec.max) { v = LIM.durationSec.max; wx.showToast({ title: '时长最大 3600 秒', icon: 'none' }); }
        this.setData({ d: String(v) });
        return this.triggerEvent('change', { field: f, value: v });
      }
      const max = LIM[f].max;
      if (v > max) { v = max; wx.showToast({ title: f === 'reps' ? '次数最大 999' : '重量最大 999.9 kg', icon: 'none' }); }
      if (v < 0) v = 0;
      v = Math.round(v * 10) / 10;
      this.setData(f === 'weightKg' ? { w: F.kg(v) } : { r: String(v) });
      this.triggerEvent('change', { field: f, value: v });
    },
    onType() { if (!this.data.readonly) { try { wx.vibrateShort({ type: 'light' }); } catch (e) { /* noop */ } this.triggerEvent('toggletype'); } },
    onDone() { if (!this.data.readonly) this.triggerEvent('toggledone'); },
    onTimer() { if (!this.data.readonly) this.triggerEvent('timer'); },
    noop() {},
    onLong() { if (!this.data.readonly) this.triggerEvent('more'); },
  },
});
