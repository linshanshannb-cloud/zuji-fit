// P7 身体数据: chart / calendar. Chart and list both come from repo.body.bodySeries (same source).
const D = require('../../utils/date');
const F = require('../../utils/format');
const repo = require('../../utils/repo/index');
const ui = require('../../utils/ui');
const METRICS = [{ key: 'weightKg', label: '体重', unit: 'kg', min: 1 }, { key: 'bodyFatPct', label: '体脂率', unit: '%', min: 2 }, { key: 'waistCm', label: '腰围', unit: 'cm', min: 2 }];
const RANGES = [{ v: 30, label: '30天' }, { v: 90, label: '90天' }, { v: 'all', label: '全部' }];
Page({
  data: { metrics: METRICS, ranges: RANGES, view: 'chart', field: 'weightKg', range: 30, unit: 'kg', label: '体重',
    series: null, chartMode: 'none', cur: null, rows: [], showAll: false, totalRecords: 0, empty: null,
    year: 0, month: 0, selected: '', today: '', marks: {}, selCard: null, readOnly: false },
  onLoad() { const t = D.today(), p = D.parse(t); this.setData({ view: repo.prefs.get('bodyView', 'chart'), year: p.getFullYear(), month: p.getMonth() + 1, selected: t, today: t }); },
  onShow() { this.refresh(); },
  refresh() {
    const m = METRICS.find(x => x.key === this.data.field), range = this.data.range, today = D.today();
    const st = repo.body.bodyStats(m.key, range);
    const n = st.series.points.length;
    const chartMode = n === 0 ? 'none' : n >= m.min && n >= 2 ? 'line' : n === 1 && m.key === 'weightKg' ? 'single-chart' : 'single';
    const rangeText = range === 'all' ? '全部' : '近 ' + range + ' 天';
    let empty = null;
    if (!st.totalRecords) empty = { title: '记录第一次体重，开始看趋势', action: '记录体重', act: 'add' };
    else if (!n) empty = st.fieldTotal && range !== 'all' ? { title: `${rangeText}没有${m.label}记录`, action: '切换到全部', act: 'all' } : { title: `还没有${m.label}记录`, action: '去记录', act: 'add' };
    const rows = repo.body.bodyRows(m.key, range).map(r => ({ id: r.id, date: F.md(r.date), value: F.fixed1(r.value), delta: F.signed(r.delta) }));
    // calendar
    const marks = {}; repo.body.listBody().forEach(r => { marks[r.date] = r.weightKg != null ? F.fixed1(r.weightKg) : true; });
    const sel = repo.body.getBodyByDate(this.data.selected);
    this.setData({ today, unit: m.unit, label: m.label, series: st.series, chartMode, empty, rows, totalRecords: st.totalRecords, readOnly: repo.isReadOnly(),
      cur: st.current ? { value: F.fixed1(st.current.value), date: F.md(st.current.date), delta: st.delta === null ? '' : F.signed(st.delta) } : null,
      marks, selCard: sel ? { id: sel.id, cells: [{ k: '体重', v: F.fixed1(sel.weightKg), u: 'kg' }, { k: '体脂率', v: F.fixed1(sel.bodyFatPct), u: '%' }, { k: '腰围', v: F.fixed1(sel.waistCm), u: 'cm' }], note: sel.note } : null,
      selKind: this.data.selected > today ? 'future' : this.data.selected === today ? 'today' : 'past', selLabel: F.dateLabel(this.data.selected, today) });
  },
  setView(e) { const v = e.currentTarget.dataset.v; repo.prefs.set('bodyView', v); this.setData({ view: v }); this.refresh(); },
  setField(e) { this.setData({ field: e.currentTarget.dataset.k, showAll: false }); this.refresh(); },
  setRange(e) { const v = e.currentTarget.dataset.v; this.setData({ range: v === 'all' ? 'all' : Number(v), showAll: false }); this.refresh(); },
  toggleAll() { this.setData({ showAll: !this.data.showAll }); },
  onEmpty() { if (this.data.empty.act === 'all') { this.setData({ range: 'all' }); this.refresh(); } else this.add(); },
  add() { if (ui.canWrite()) wx.navigateTo({ url: '/pages/body-edit/body-edit' }); },
  addFor() { if (ui.canWrite()) wx.navigateTo({ url: '/pages/body-edit/body-edit?date=' + this.data.selected }); },
  edit(e) { if (ui.canWrite()) wx.navigateTo({ url: '/pages/body-edit/body-edit?id=' + e.currentTarget.dataset.id }); },
  removeRow(e) {
    if (!ui.canWrite()) return;
    const id = e.currentTarget.dataset.id, r = repo.body.getBody(id);
    ui.confirmDelete({ title: `删除 ${F.md(r.date)} 的记录？`, content: '体重、体脂率、腰围将一起删除' }, () => {
      if (ui.handle(repo.body.deleteBody(id))) { wx.showToast({ title: '已删除' }); this.refresh(); }
    });
  },
  onSelect(e) { this.setData({ selected: e.detail.date }); this.refresh(); },
  onShift(e) { this.setData(D.addMonths(this.data.year, this.data.month, e.detail.delta)); this.refresh(); },
  onToday() { const t = D.today(), p = D.parse(t); this.setData({ year: p.getFullYear(), month: p.getMonth() + 1, selected: t }); this.refresh(); },
});
