// info (F06): { 'YYYY-MM-DD': { tags:[{text,kind}], more } | { rest: true } }
// marks: { 'YYYY-MM-DD': true | 'label' } ; variant 'dot' (training) | 'value' (body weight label)
// view (v0.5): 'month' 6x7 | 'week' 1x7 row containing `selected`; collapsible shows 展开/收起 (event toggle).
const D = require('../../utils/date');
const DM = require('../../utils/daymark');
// 力量部位照旧，「有氧」不缩成「跑」，也不加 +1。
function briefMark(ln) {
  if (!ln) return '';
  if (!ln.train && ln.rest) return '休';
  if (!ln.train) return '';
  const bits = [];
  if (ln.part) bits.push(ln.part);
  if (ln.aero) bits.push('有氧');
  return bits.join('·');
}
Component({
  options: { styleIsolation: 'apply-shared' },
  properties: { year: Number, month: Number, selected: String, today: String, marks: { type: Object, value: {} }, variant: { type: String, value: 'dot' }, legend: Boolean, info: { type: Object, value: {} }, cals: { type: Object, value: {} }, rich: Boolean,
    view: { type: String, value: 'month' }, collapsible: Boolean },
  data: { cells: [], rows: [], hasKcal: false, hasMarks: false, weekdays: ['一', '二', '三', '四', '五', '六', '日'] },
  observers: { 'year, month, selected, today, marks, info, view, cals': function () { this.build(); } },
  methods: {
    build() {
      if (!this.data.year) return;
      const { selected, today, marks } = this.data, info = this.data.info || {};
      const week = this.data.view === 'week' && D.isValid(selected || '');
      const grid = week ? D.weekGrid(selected) : D.monthGrid(this.data.year, this.data.month);
      const cells = grid.map(c => {
        // 力量部位合并「胸·背」，有氧只写「有氧」；有标签时禁止再画圆点
        const ln = DM.cellLines(info[c.date]);
        const cal = (this.data.cals || {})[c.date];
        return {
          date: c.date, day: c.day, inMonth: c.inMonth, sel: c.date === selected, isToday: c.date === today, future: c.date > today,
          mark: marks[c.date] === undefined ? '' : marks[c.date] === true ? '•' : String(marks[c.date]),
          part: ln.part, aero: ln.aero, train: ln.train, rest: ln.rest,
          brief: briefMark(ln),
          showDot: !ln.train && !ln.rest && !!(marks[c.date]),
          kcal: cal ? String(cal) : '',
          dot: ln.train && cal ? 'both' : ln.train ? 'train' : cal ? 'diet' : ln.rest ? 'rest' : '',
        };
      });
      // 当前行没有任何标签或热量时收起第二行；图例只在真有训练标记时出现。
      const shown = c => (week || c.inMonth) && !!(c.brief || c.showDot || c.kcal);
      const rows = [];
      for (let i = 0; i < cells.length; i += 7) {
        const slice = cells.slice(i, i + 7);
        rows.push({ key: slice[0].date, open: slice.some(shown), cells: slice });
      }
      this.setData({
        cells, rows,
        hasKcal: cells.some(x => x.inMonth && x.kcal),
        hasMarks: cells.some(c => (week || c.inMonth) && !!(c.brief || c.showDot)),
      });
    },
    onPick(e) { this.triggerEvent('select', { date: e.currentTarget.dataset.date }); },
    prev() { this.triggerEvent('shift', { delta: -1 }); },
    next() { this.triggerEvent('shift', { delta: 1 }); },
    goToday() { this.triggerEvent('today'); },
    onToggle() { this.triggerEvent('toggle', { view: this.data.view === 'week' ? 'month' : 'week' }); },
    onTouchStart(e) { this._x = e.touches[0].clientX; },
    onTouchEnd(e) { const dx = e.changedTouches[0].clientX - (this._x || 0); if (Math.abs(dx) > 60) this.triggerEvent('shift', { delta: dx < 0 ? 1 : -1 }); },
  },
});
