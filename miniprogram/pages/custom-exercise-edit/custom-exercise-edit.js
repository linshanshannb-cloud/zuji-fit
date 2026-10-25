// 新建 / 编辑自定义动作：必填名称 + 部位；器械可选（默认 body_weight）。
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const P = require('../../utils/custom-part');

Page({
  data: {
    id: '', parts: P.PARTS, partKey: 'chest', equipments: [],
    form: { nameZh: '', equipment: 'body_weight' },
    errors: {}, dirty: false, saving: false, focus: true,
  },
  onLoad(o) {
    this.setData({ equipments: repo.exercises.equipments });
    if (!o.id) return;
    const ex = repo.exercises.get(decodeURIComponent(o.id));
    if (!ex || !ex.custom || ex.archived) {
      wx.showToast({ title: '动作不存在', icon: 'none' });
      return setTimeout(() => wx.navigateBack(), 400);
    }
    this.setData({
      id: ex.id, partKey: P.partKeyOf(ex), focus: false, dirty: false, errors: {},
      form: { nameZh: ex.nameZh || '', equipment: ex.equipment || 'body_weight' },
    });
  },
  onName(e) { this.setData({ 'form.nameZh': e.detail.value, dirty: true, 'errors.nameZh': '' }); },
  onPart(e) { this.setData({ partKey: e.currentTarget.dataset.k, dirty: true, 'errors.bodyPart': '' }); },
  onEquip(e) { this.setData({ 'form.equipment': e.currentTarget.dataset.v, dirty: true }); },
  onBack() {
    if (!this.data.dirty) return wx.navigateBack();
    wx.showModal({
      title: '放弃修改？', content: '尚未保存的内容将丢失', confirmText: '放弃', cancelText: '继续编辑',
      success: m => { if (m.confirm) wx.navigateBack(); },
    });
  },
  save() {
    if (this.data.saving || !ui.canWrite()) return;
    const nameZh = String(this.data.form.nameZh || '').trim();
    const errors = {};
    if (!nameZh) errors.nameZh = '请输入动作名称';
    const part = P.payloadOf(this.data.partKey);
    if (!part || !part.bodyPart) errors.bodyPart = '请选择部位';
    this.setData({ errors });
    if (errors.nameZh || errors.bodyPart) return;
    const input = {
      nameZh,
      bodyPart: part.bodyPart,
      target: part.target || '',
      equipment: this.data.form.equipment || 'body_weight',
      category: 'strength',
    };
    this.setData({ saving: true });
    const r = this.data.id
      ? repo.exercises.updateCustom(this.data.id, input)
      : repo.exercises.addCustom(input);
    this.setData({ saving: false });
    if (!ui.handle(r)) return;
    if (r.warning === 'DUPLICATE_NAME') wx.showToast({ title: '名称与已有动作重复，已保存', icon: 'none' });
    else wx.showToast({ title: '已保存', icon: 'success' });
    this.setData({ dirty: false });
    setTimeout(() => wx.navigateBack(), 350);
  },
  onDelete() {
    if (!this.data.id || !ui.canWrite()) return;
    ui.confirmDelete({
      title: '删除自定义动作？',
      content: '若已有训练记录引用，将归档保留历史；否则永久删除。',
      confirmText: '删除',
    }, () => {
      const r = repo.deleteCustomExercise(this.data.id);
      if (!ui.handle(r)) return;
      wx.showToast({ title: r.data && r.data.archived ? '已归档（历史仍可见）' : '已删除', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 350);
    });
  },
});
