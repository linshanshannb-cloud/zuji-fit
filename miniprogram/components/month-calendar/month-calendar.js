// info (F06): { 'YYYY-MM-DD': { tags:[{text,kind}], more } | { rest: true } }
// marks: { 'YYYY-MM-DD': true | 'label' } ; variant 'dot' (training) | 'value' (body weight label)
// view (v0.5): 'month' 6x7 | 'week' 1x7 row containing `selected`; collapsible shows 展开/收起 (event toggle).
const D = require('../../utils/date');
const DM = require('../../utils/daymark');
// 力量 + 有氧挤成一行「胸·跑」，把格子底部留给热量。有氧单独出现时仍写全称。
function briefMark(ln) {
  if (!ln) return '';
  if (!ln.train && ln.rest) return '休';
  if (!ln.train) return '';
  if (ln.part && ln.aero) {
    const plus = (String(ln.aero).match(/\+\d+$/) || [''])[0];
    const name = String(ln.aero).replace(/\+\d+$/, '');
    return ln.part + '·' + (name ? name.slice(0, 1) : '') + plus;
  }
  return ln.part || ln.aero || '';
}
Component({
  options: { styleIsolation: 'apply-shared' },
  properties: { year: Number, month: Number, selected: String, today: String, marks: { type: Object, value: {} }, variant: { type: String, value: 'dot' }, legend: Boolean, info: { type: Object, value: {} }, cals: { type: Object, value: {} }, rich: Boolean,
    view: { type: String, value: 'month' }, collapsible: Boolean },
  data: { cells: [], weekdays: ['一', '二', '三', '四', '五', '六', '日'] },
  observers: { 'year, month, selected, today, marks, info, view, cals': function () { this.build(); } },
  methods: {
    build() {
      if (!this.data.year) return;
      const { selected, today, marks } = this.data, info = this.data.info || {};
      const week = this.data.view === 'week' && D.isValid(selected || '');
      const grid = week ? D.weekGrid(selected) : D.monthGrid(this.data.year, this.data.month);
      const cells = grid.map(c => {
        // 格子最多两行：力量部位合并「胸·背」+ 有氧「跑步」/「跑步+1」；有标签时禁止再画圆点
        const ln = DM.cellLines(info[c.date]);
        const cal = (this.data.cals || {})[c.date];
        return {
          date: c.date, day: c.day, inMonth: c.inMonth, sel: c.date === selected, isToday: c.date === today, future: c.date > today,
          mark: marks[c.date] === undefined ? '' : marks[c.date] === true ? '•' : String(marks[c.date]),
          part: ln.part, aero: ln.aero, train: ln.train, rest: ln.rest,
          brief: briefMark(ln),
          showDot: !ln.train && !ln.rest && !!(marks[c.date]),
          kcal: cal ? String(cal) : '',
        };
      });
      this.setData({ cells });
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
