const D = require('../../utils/date');
const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const T = require('../../utils/aerobic-types');

Page({
  data: {
    id: '', date: '', dateLabel: '', today: '',
    types: T.TYPES, typeIndex: 0, isCustom: false,
    form: { activityType: 'treadmill_incline', activityName: '', durationMin: '30', estimatedKcal: '', note: '' },
    kcalSource: 'reference', refNote: T.REF_NOTE, kcalHint: '',
    errors: {}, dirty: false, saving: false, quick: [15, 30, 45, 60],
  },
  onLoad(o) {
    const today = D.today();
    this.setData({ today });
    if (o.id) {
      const a = repo.aerobic.get(o.id);
      if (!a) { wx.showToast({ title: '记录不存在', icon: 'none' }); return setTimeout(() => wx.navigateBack(), 400); }
      return this.loadRecord(a);
    }
    const date = o.date && o.date <= today ? o.date : today;
    if (o.date && o.date > today) {
      wx.showToast({ title: '不能为未来日期新建有氧', icon: 'none' });
      return setTimeout(() => wx.navigateBack(), 400);
    }
    const type = T.TYPES[0];
    const dur = 30;
    this.setData({
      id: '', date, dateLabel: F.dateLabel(date, today), typeIndex: 0, isCustom: false, dirty: false, errors: {},
      kcalSource: 'reference',
      form: { activityType: type.key, activityName: '', durationMin: String(dur), estimatedKcal: String(T.estimateKcal(type.key, dur)), note: '' },
      kcalHint: '约 ' + T.estimateKcal(type.key, dur) + ' kcal（估算）',
    });
  },
  loadRecord(a) {
    const idx = Math.max(0, T.TYPES.findIndex(t => t.key === a.activityType));
    const isCustom = a.activityType === 'custom';
    this.setData({
      id: a.id, date: a.date, dateLabel: F.dateLabel(a.date), typeIndex: idx, isCustom,
      kcalSource: a.kcalSource || 'reference', dirty: false, errors: {},
      form: {
        activityType: a.activityType, activityName: isCustom ? (a.activityName || '') : '',
        durationMin: String(a.durationMin), estimatedKcal: String(a.estimatedKcal), note: a.note || '',
      },
      kcalHint: a.kcalSource === 'user_override'
        ? a.estimatedKcal + ' kcal（已手动调整）'
        : '约 ' + a.estimatedKcal + ' kcal（估算）',
    });
  },
  onType(e) {
    const typeIndex = Number(e.detail.value);
    const t = T.TYPES[typeIndex];
    const isCustom = t.key === 'custom';
    this.setData({
      typeIndex, isCustom, dirty: true,
      'form.activityType': t.key,
      'form.activityName': isCustom ? this.data.form.activityName : '',
      errors: Object.assign({}, this.data.errors, { activityName: '' }),
    });
    if (this.data.kcalSource === 'reference') this.recalcKcal();
  },
  onName(e) { this.setData({ 'form.activityName': e.detail.value, dirty: true }); },
  onQuick(e) {
    const dur = e.currentTarget.dataset.d;
    this.setData({ 'form.durationMin': String(dur), dirty: true, 'errors.durationMin': '' });
    this.afterDurationChange(dur);
  },
  onDuration(e) {
    this.setData({ 'form.durationMin': e.detail.value, dirty: true });
  },
  onDurationBlur() {
    const raw = String(this.data.form.durationMin || '').trim();
    if (!/^\d+$/.test(raw)) {
      this.setData({ 'errors.durationMin': '时长必须是正整数分钟' });
      return;
    }
    const n = Number(raw);
    if (n < T.DUR_MIN || n > T.DUR_MAX) {
      this.setData({ 'errors.durationMin': `时长需在 ${T.DUR_MIN}–${T.DUR_MAX} 分钟` });
      return;
    }
    this.setData({ 'errors.durationMin': '' });
    this.afterDurationChange(n);
  },
  afterDurationChange(dur) {
    if (this.data.kcalSource === 'reference') return this.recalcKcal(dur);
    // override：提示是否重算
    const type = this.data.form.activityType;
    const ref = T.estimateKcal(type, dur);
    wx.showModal({
      title: '时长已变',
      content: `是否按参考重算为约 ${ref} kcal？取消则保留当前手改值。`,
      confirmText: '重算', cancelText: '保留',
      success: m => {
        if (m.confirm) {
          this.setData({ kcalSource: 'reference' });
          this.recalcKcal(dur);
        }
      },
    });
  },
  recalcKcal(dur) {
    const d = dur != null ? Number(dur) : Number(this.data.form.durationMin);
    if (!Number.isInteger(d) || d < T.DUR_MIN) return;
    const kcal = T.estimateKcal(this.data.form.activityType, d);
    this.setData({
      kcalSource: 'reference',
      'form.estimatedKcal': String(kcal),
      kcalHint: '约 ' + kcal + ' kcal（估算）',
      'errors.estimatedKcal': '',
    });
  },
  onKcal(e) { this.setData({ 'form.estimatedKcal': e.detail.value, dirty: true }); },
  onKcalBlur() {
    const raw = String(this.data.form.estimatedKcal || '').trim();
    if (!/^\d+$/.test(raw)) {
      this.setData({ 'errors.estimatedKcal': '热量必须是正整数' });
      return;
    }
    const n = Number(raw);
    if (n < T.KCAL_MIN || n > T.KCAL_MAX) {
      this.setData({ 'errors.estimatedKcal': `热量需在 ${T.KCAL_MIN}–${T.KCAL_MAX} kcal` });
      return;
    }
    const type = this.data.form.activityType;
    const dur = Number(this.data.form.durationMin);
    const ref = Number.isInteger(dur) ? T.estimateKcal(type, dur) : null;
    const override = ref == null || n !== ref;
    this.setData({
      'errors.estimatedKcal': '',
      kcalSource: override ? 'user_override' : 'reference',
      kcalHint: override ? n + ' kcal（已手动调整）' : '约 ' + n + ' kcal（估算）',
    });
  },
  onNote(e) { this.setData({ 'form.note': e.detail.value, dirty: true }); },
  validateAll() {
    const f = this.data.form, errors = {};
    if (f.activityType === 'custom' && !String(f.activityName || '').trim()) errors.activityName = '请填写自定义名称';
    else if (f.activityType === 'custom' && String(f.activityName).trim().length > T.NAME_MAX) errors.activityName = `不能超过 ${T.NAME_MAX} 字`;
    const durRaw = String(f.durationMin || '').trim();
    if (!/^\d+$/.test(durRaw)) errors.durationMin = '时长必须是正整数分钟';
    else {
      const d = Number(durRaw);
      if (d < T.DUR_MIN || d > T.DUR_MAX) errors.durationMin = `时长需在 ${T.DUR_MIN}–${T.DUR_MAX} 分钟`;
    }
    const kcalRaw = String(f.estimatedKcal || '').trim();
    if (!/^\d+$/.test(kcalRaw)) errors.estimatedKcal = '热量必须是正整数';
    else {
      const k = Number(kcalRaw);
      if (k < T.KCAL_MIN || k > T.KCAL_MAX) errors.estimatedKcal = `热量需在 ${T.KCAL_MIN}–${T.KCAL_MAX} kcal`;
    }
    this.setData({ errors });
    return !Object.keys(errors).length;
  },
  save() {
    if (this.data.saving || !ui.canWrite()) return;
    if (!this.validateAll()) return;
    this.setData({ saving: true });
    const f = this.data.form;
    const payload = {
      date: this.data.date || D.today(),
      activityType: f.activityType,
      activityName: f.activityName,
      durationMin: Number(f.durationMin),
      estimatedKcal: Number(f.estimatedKcal),
      kcalSource: this.data.kcalSource,
      note: f.note,
    };
    const r = this.data.id ? repo.aerobic.update(this.data.id, payload) : repo.aerobic.create(payload);
    this.setData({ saving: false });
    if (!ui.handle(r, { silent: ['NAME_REQUIRED', 'INVALID_DURATION', 'INVALID_KCAL', 'NAME_TOO_LONG', 'INVALID_TYPE'].includes(r.code) })) {
      const map = { NAME_REQUIRED: 'activityName', NAME_TOO_LONG: 'activityName', INVALID_DURATION: 'durationMin', INVALID_KCAL: 'estimatedKcal' };
      if (map[r.code]) this.setData({ ['errors.' + map[r.code]]: r.message });
      return;
    }
    this.setData({ dirty: false });
    wx.showToast({ title: '已保存' });
    setTimeout(() => wx.navigateBack(), 300);
  },
  onBack() {
    if (this.data.dirty) return wx.showModal({ title: '放弃修改？', confirmText: '放弃', success: m => { if (m.confirm) wx.navigateBack(); } });
    wx.navigateBack();
  },
});
