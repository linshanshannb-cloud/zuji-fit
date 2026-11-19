// 饮食份量与营养缩放。程序负责最终计算；这里没有营养数据库。
// 大小系数只是相对粗估（小 0.75 / 中 1 / 大 1.25），不是称重，也不把 ml 换成 g。
// 基准营养保持不动，每次从基准乘当前份量，避免半份、翻倍来回改时越乘越漂。
const Fml = require('./diet-formula');

const CALC = 1;
const SIZE_FACTOR = { '小': 0.75, '中': 1, '大': 1.25 };
const COUNT_UNITS = ['个', '根', '碗', '串', '罐', '瓶', '杯', '包', '片', '只', '颗', '块', '勺', '袋', '盒', '听', '份'];
const UNITS = COUNT_UNITS.concat(['g', 'ml']);
const NUTRIENT_KEYS = ['kcal', 'carbsG', 'proteinG', 'fatG', 'fiberG', 'sugarG', 'saltMg'];
const REQUIRED_KEYS = ['kcal', 'carbsG', 'proteinG', 'fatG'];
const CAPS = { kcal: 8000, carbsG: 1500, proteinG: 800, fatG: 500, fiberG: 200, sugarG: 500, saltMg: 20000 };
const LABELS = { kcal: '热量', carbsG: '碳水', proteinG: '蛋白质', fatG: '脂肪', fiberG: '纤维', sugarG: '糖', saltMg: '盐' };
const SHAPES = [
  { id: 'banana', test: n => n.indexOf('香蕉') >= 0 && n.length <= 4, unit: '根', qty: 1, size: '中', amountUnit: '' },
  { id: 'beer', test: n => n.indexOf('啤酒') >= 0 && n.length <= 6, unit: '罐', qty: 1, size: '', amountUnit: 'ml' },
  { id: 'chips', test: n => n.indexOf('薯片') >= 0 && n.length <= 6, unit: '包', qty: 1, size: '', amountUnit: 'g' },
  { id: 'noodle', test: n => (n.indexOf('米粉') >= 0 || n.indexOf('米线') >= 0) && n.length <= 6 && !/[炒拌汤]/.test(n), unit: '碗', qty: 1, size: '中', amountUnit: '' },
];
const CN = { 半: 0.5, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function finite(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/,/g, '');
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}
function round1(n) { return Math.round(n * 10) / 10; }
function fmt(n) {
  if (n == null || !isFinite(n)) return '';
  const r = round1(n);
  return Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : String(r);
}
function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function normUnit(unit) {
  const u = String(unit || '').trim().toLowerCase();
  if (u === '克' || u === 'g') return 'g';
  if (u === '毫升' || u === 'ml') return 'ml';
  const raw = String(unit || '').trim();
  return COUNT_UNITS.indexOf(raw) >= 0 ? raw : '';
}
function sizeFactor(size) { return SIZE_FACTOR[size] || 1; }
function shapeFor(name) {
  const n = String(name || '').replace(/\s/g, '');
  for (let i = 0; i < SHAPES.length; i++) if (SHAPES[i].test(n)) return SHAPES[i];
  return null;
}
function blankDetail(sourceText) {
  return {
    qty: null, unit: '', size: '', amount: null, amountUnit: '', ratio: null,
    explicit: false, pending: false, vague: false, sizeAssumed: false, cooked: null,
    sourceText: sourceText || '', shapeApplied: false, touched: false,
  };
}
function cnNumber(token) {
  if (token == null) return null;
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);
  if (CN[token] != null && token.length === 1) return CN[token];
  if (token === '十') return 10;
  if (/^十[一二三四五六七八九]$/.test(token)) return 10 + CN[token[1]];
  if (/^[一二两三四五六七八九]十$/.test(token)) return CN[token[0]] * 10;
  if (/^[一二两三四五六七八九]十[一二三四五六七八九]$/.test(token)) return CN[token[0]] * 10 + CN[token[2]];
  return null;
}
function badDup(text) {
  return /份\s*份|(?:ml|ML|mL)\s*(?:ml|ML|mL)|克\s*克/.test(text);
}
function parseText(text) {
  const sourceText = String(text || '').trim().slice(0, 40);
  const detail = blankDetail(sourceText);
  if (!sourceText) {
    detail.qty = 1; detail.unit = '份'; detail.vague = true; detail.pending = true; detail.ratio = 1;
    return detail;
  }
  const hasRaw = /生/.test(sourceText);
  const hasCooked = /熟/.test(sourceText);
  if (hasRaw !== hasCooked) detail.cooked = hasCooked ? 'cooked' : 'raw';
  let s = sourceText.replace(/毫升/g, 'ml').replace(/克/g, 'g');
  const sizeM = s.match(/(小|中|大)(?=等|号|碗|份|根|个|杯|罐|包|g|ml|$)/);
  if (sizeM && !/小食|中餐|大餐/.test(s)) detail.size = sizeM[1];
  if (/四分之一/.test(s)) detail.ratio = 0.25;
  const halfUnit = s.match(/半(个|根|碗|串|罐|瓶|杯|包|片|只|颗|块|勺|袋|盒|听|份)/);
  if (/吃了一半|一半/.test(s) || (/吃了半/.test(s) && !halfUnit)) detail.ratio = detail.ratio == null ? 0.5 : detail.ratio;
  const re = /(\d+(?:\.\d+)?|[一二两三四五六七八九]十[一二三四五六七八九]?|十[一二三四五六七八九]?|[一二两三四五六七八九]|半)(g|ml|个|根|碗|串|罐|瓶|杯|包|片|只|颗|块|勺|袋|盒|听|份)/g;
  const pairs = [];
  let m;
  while ((m = re.exec(s))) {
    const qty = cnNumber(m[1]);
    if (qty == null) continue;
    pairs.push({ qty, unit: normUnit(m[2]) });
  }
  if (!pairs.length && /整(包|袋|盒|罐|瓶)/.test(s)) {
    const u = s.match(/整(包|袋|盒|罐|瓶)/);
    pairs.push({ qty: 1, unit: u[1] });
    if (detail.ratio == null) detail.ratio = 1;
  }
  if (pairs.length) {
    detail.qty = pairs[0].qty;
    detail.unit = pairs[0].unit;
    detail.explicit = true;
    const extra = pairs.slice(1).find(p => (p.unit === 'g' || p.unit === 'ml') && p.unit !== pairs[0].unit);
    if (extra) { detail.amount = extra.qty; detail.amountUnit = extra.unit; }
    else if (pairs[0].unit === 'g' || pairs[0].unit === 'ml') {
      detail.amount = null; detail.amountUnit = '';
    }
  }
  if (detail.qty == null && detail.unit === '') {
    const compact = sourceText.replace(/\s/g, '');
    if (/^(一份|1份|份)$/.test(compact)) {
      detail.qty = 1; detail.unit = '份'; detail.vague = true; detail.pending = true;
    } else detail.pending = true;
  } else if (detail.unit === '份' && detail.qty === 1 && !detail.size && detail.amount == null && (detail.ratio == null || detail.ratio === 1)) {
    detail.vague = true; detail.pending = true; detail.explicit = false;
  } else if (detail.explicit) detail.pending = false;
  if (detail.ratio == null) detail.ratio = 1;
  return detail;
}
function isGeneric(detail) {
  if (!detail) return true;
  if (detail.amount != null) return false;
  if (detail.unit && detail.unit !== '份') return false;
  return true;
}
function applyShape(detail, shape) {
  detail.qty = shape.qty;
  detail.unit = shape.unit;
  detail.size = shape.size || '';
  detail.sizeAssumed = !!shape.size;
  detail.amount = null;
  detail.amountUnit = shape.amountUnit || '';
  detail.vague = false;
  detail.pending = true;
  detail.explicit = false;
  detail.shapeApplied = true;
  detail.touched = false;
}
function knownFlag(v) {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return null;
}
function resolveDetail(raw) {
  raw = raw || {};
  const detail = parseText(raw.portion != null ? raw.portion : (raw.portionText || ''));
  const qty = finite(raw.qty);
  if (qty != null && qty >= 0 && qty <= 5000) { detail.qty = qty; detail.explicit = true; detail.vague = false; }
  const unit = normUnit(raw.unit);
  if (unit) { detail.unit = unit; if (unit !== '份') detail.vague = false; }
  if (raw.size === '小' || raw.size === '中' || raw.size === '大') { detail.size = raw.size; detail.sizeAssumed = false; }
  const amount = finite(raw.amount);
  const amountUnit = raw.amountUnit === 'g' || raw.amountUnit === 'ml' ? raw.amountUnit : '';
  if (amount != null && amount > 0 && amount <= 5000 && amountUnit) { detail.amount = amount; detail.amountUnit = amountUnit; }
  const ratio = finite(raw.ratio);
  if (ratio != null && ratio >= 0 && ratio <= 1) detail.ratio = ratio;
  if (raw.cooked === 'raw' || raw.cooked === 'cooked') detail.cooked = raw.cooked;
  if (isGeneric(detail)) {
    const shape = shapeFor(raw.name);
    if (shape) applyShape(detail, shape);
    else if (!detail.unit) { detail.qty = detail.qty == null ? 1 : detail.qty; detail.unit = '份'; detail.vague = true; detail.pending = true; }
  }
  const known = knownFlag(raw.portionKnown);
  if (known === false) { detail.pending = true; detail.explicit = false; if (detail.size) detail.sizeAssumed = true; }
  if (known === true) { detail.pending = false; detail.explicit = true; detail.vague = false; detail.sizeAssumed = false; }
  if (detail.qty == null) detail.qty = 1;
  if (!detail.unit) detail.unit = '份';
  if (detail.ratio == null) detail.ratio = 1;
  return detail;
}
function display(detail) {
  if (!detail) return '';
  if (!detail.touched && !detail.shapeApplied && detail.sourceText && !badDup(detail.sourceText)) return detail.sourceText;
  const bits = [];
  if (detail.qty != null && detail.unit) {
    if (detail.unit === '份' && detail.qty === 1 && !detail.size && detail.amount == null && (detail.ratio == null || detail.ratio === 1) && detail.vague) bits.push('一份');
    else bits.push(fmt(detail.qty) + detail.unit);
  }
  if (detail.size) bits.push(detail.size);
  if (detail.amount != null && detail.amountUnit && !(detail.unit === detail.amountUnit && detail.qty === detail.amount)) {
    const head = detail.unit && detail.unit !== 'g' && detail.unit !== 'ml' ? ('每' + detail.unit) : '';
    bits.push(head + fmt(detail.amount) + detail.amountUnit);
  }
  const ratio = detail.ratio == null ? 1 : detail.ratio;
  if (ratio > 0 && ratio < 0.999) {
    if (Math.abs(ratio - 0.5) < 1e-6) bits.push('一半');
    else if (Math.abs(ratio - 0.25) < 1e-6) bits.push('四分之一');
    else bits.push('吃了' + fmt(ratio));
  }
  return bits.join(' · ');
}
function refOf(detail) {
  const ref = { qty: detail.qty == null ? 1 : detail.qty, unit: detail.unit || '份', ratio: detail.ratio == null ? 1 : detail.ratio };
  if (detail.size) ref.size = detail.size;
  if (detail.amount != null && detail.amountUnit) { ref.amount = detail.amount; ref.amountUnit = detail.amountUnit; }
  return ref;
}
function metaOf(detail) {
  const o = {};
  if (!detail) return o;
  if (detail.qty != null) o.qty = detail.qty;
  if (detail.unit) o.unit = detail.unit;
  if (detail.size) o.size = detail.size;
  if (detail.amount != null) o.amount = detail.amount;
  if (detail.amountUnit) o.amountUnit = detail.amountUnit;
  if (detail.ratio != null && detail.ratio !== 1) o.ratio = detail.ratio;
  if (detail.explicit) o.explicit = true;
  if (detail.pending) o.pending = true;
  if (detail.vague) o.vague = true;
  if (detail.sizeAssumed) o.sizeAssumed = true;
  if (detail.cooked) o.cooked = detail.cooked;
  if (detail.sourceText) o.sourceText = String(detail.sourceText).slice(0, 40);
  if (detail.shapeApplied) o.shapeApplied = true;
  if (detail.touched) o.touched = true;
  return o;
}
function readDetail(meta, fallbackText) {
  if (meta && typeof meta === 'object') {
    const ratio = finite(meta.ratio);
    return {
      qty: finite(meta.qty),
      unit: normUnit(meta.unit) || '',
      size: meta.size === '小' || meta.size === '中' || meta.size === '大' ? meta.size : '',
      amount: finite(meta.amount) > 0 ? finite(meta.amount) : null,
      amountUnit: meta.amountUnit === 'g' || meta.amountUnit === 'ml' ? meta.amountUnit : '',
      ratio: ratio == null ? 1 : ratio,
      explicit: !!meta.explicit,
      pending: !!meta.pending,
      vague: !!meta.vague,
      sizeAssumed: !!meta.sizeAssumed,
      cooked: meta.cooked === 'raw' || meta.cooked === 'cooked' ? meta.cooked : null,
      sourceText: meta.sourceText ? String(meta.sourceText).slice(0, 40) : '',
      shapeApplied: !!meta.shapeApplied,
      touched: !!meta.touched,
      legacy: !!meta.legacy,
    };
  }
  return resolveDetail({ portion: fallbackText || '' });
}
function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = finite(v);
  if (n == null || n < 0 || n > 1000000) return undefined;
  return n;
}
function readBaseline(nutri) {
  if (!nutri || typeof nutri !== 'object' || !nutri.ref) return null;
  const mode = nutri.mode === 'per100g' || nutri.mode === 'perPack' ? nutri.mode : 'portion';
  const out = {
    mode,
    ref: {
      qty: finite(nutri.ref.qty) == null ? 1 : nutri.ref.qty,
      unit: normUnit(nutri.ref.unit) || '份',
      size: nutri.ref.size === '小' || nutri.ref.size === '中' || nutri.ref.size === '大' ? nutri.ref.size : '',
      amount: finite(nutri.ref.amount),
      amountUnit: nutri.ref.amountUnit === 'g' || nutri.ref.amountUnit === 'ml' ? nutri.ref.amountUnit : '',
      ratio: finite(nutri.ref.ratio) == null ? 1 : nutri.ref.ratio,
    },
    source: nutri.source === 'label' || nutri.source === 'user' ? nutri.source : 'ai',
    reason: String(nutri.reason || '').slice(0, 80),
    weightSource: nutri.weightSource ? String(nutri.weightSource).slice(0, 40) : '',
    cooked: nutri.cooked === 'raw' || nutri.cooked === 'cooked' ? nutri.cooked : null,
    override: nutri.override === 'nutrient' ? 'nutrient' : '',
    calc: finite(nutri.calc) == null ? CALC : nutri.calc,
  };
  if (!(out.ref.qty > 0) || !(out.ref.ratio > 0)) return null;
  for (let i = 0; i < NUTRIENT_KEYS.length; i++) {
    const k = NUTRIENT_KEYS[i];
    const n = numOrNull(nutri[k]);
    if (n === undefined) return null;
    if (REQUIRED_KEYS.indexOf(k) >= 0 && n == null) return null;
    out[k] = n;
  }
  return out;
}
function nutriOf(baseline) {
  const o = {
    mode: baseline.mode || 'portion',
    ref: clone(baseline.ref),
    source: baseline.source || 'ai',
    reason: baseline.reason || '',
    calc: baseline.calc || CALC,
  };
  NUTRIENT_KEYS.forEach(k => { if (baseline[k] != null) o[k] = baseline[k]; });
  if (baseline.weightSource) o.weightSource = baseline.weightSource;
  if (baseline.cooked) o.cooked = baseline.cooked;
  if (baseline.override) o.override = baseline.override;
  return o;
}
function gramsOf(detail) {
  if (!detail) return null;
  const ratio = detail.ratio == null ? 1 : detail.ratio;
  if (!(ratio >= 0)) return null;
  if (detail.unit === 'g' && detail.qty != null) return detail.qty * ratio;
  if (detail.amountUnit === 'g' && detail.amount != null) {
    const qty = detail.qty == null ? 1 : detail.qty;
    return detail.amount * qty * ratio;
  }
  return null;
}
function portionFactor(ref, detail) {
  if (!ref || !detail || detail.qty == null) return null;
  if (normUnit(ref.unit) !== normUnit(detail.unit)) return null;
  if (!(ref.qty > 0) || detail.qty < 0) return null;
  const rr = ref.ratio == null ? 1 : ref.ratio;
  const dr = detail.ratio == null ? 1 : detail.ratio;
  if (!(rr > 0) || dr < 0) return null;
  let f = (detail.qty / ref.qty) * (sizeFactor(detail.size) / sizeFactor(ref.size)) * (dr / rr);
  const refHas = ref.amount != null && ref.amountUnit;
  const nextHas = detail.amount != null && detail.amountUnit;
  if (refHas && nextHas) {
    if (ref.amountUnit !== detail.amountUnit || !(ref.amount > 0) || detail.amount < 0) return null;
    f *= detail.amount / ref.amount;
  } else if (refHas !== nextHas) return null;
  return isFinite(f) && f >= 0 ? f : null;
}
function factorOf(baseline, detail) {
  if (!baseline) return null;
  if (baseline.mode === 'per100g') {
    const g = gramsOf(detail);
    if (g == null || g < 0) return null;
    return g / 100;
  }
  if (baseline.mode === 'perPack') return portionFactor(Object.assign({}, baseline.ref, { amount: null, amountUnit: '' }), Object.assign({}, detail, { amount: null, amountUnit: '' }));
  return portionFactor(baseline.ref, detail);
}
function project(baseline, detail) {
  const f = factorOf(baseline, detail);
  if (f == null) return null;
  const out = {};
  for (let i = 0; i < NUTRIENT_KEYS.length; i++) {
    const k = NUTRIENT_KEYS[i];
    if (baseline[k] == null) { out[k] = null; continue; }
    const v = baseline[k] * f;
    if (!isFinite(v) || v < 0) return null;
    const rounded = k === 'kcal' || k === 'saltMg' ? Math.round(v) : round1(v);
    if (rounded > CAPS[k]) return null;
    out[k] = rounded;
  }
  return out;
}
function reasonFor(detail) {
  if (detail && detail.pending) return '没有可靠营养库。份量没说清，营养按模型对这个规格的估算。';
  return '没有可靠营养库，营养按模型对这个份量的估算。';
}
function shownFrom(nutrients) {
  const out = {};
  NUTRIENT_KEYS.forEach(k => {
    const n = numOrNull(nutrients[k], CAPS[k]);
    out[k] = n == null || n === undefined ? null : (k === 'kcal' || k === 'saltMg' ? Math.round(n) : round1(n));
  });
  return out;
}
function packMeta(input, nutrients) {
  if (input && input.nutri && input.portionMeta) {
    const baseline = readBaseline(input.nutri);
    const detail = readDetail(input.portionMeta, input.portion);
    if (baseline && detail.unit) {
      return { portion: display(detail).slice(0, 40), portionMeta: metaOf(detail), nutri: nutriOf(baseline) };
    }
  }
  const built = attach(input || {}, nutrients || {});
  return { portion: built.portion, portionMeta: built.portionMeta, nutri: built.nutri };
}
function attach(raw, nutrients) {
  const detail = resolveDetail(raw);
  const shown0 = shownFrom(nutrients || {});
  const baseline = {
    mode: 'portion',
    ref: refOf(detail),
    source: 'ai',
    reason: reasonFor(detail),
    weightSource: '',
    cooked: detail.cooked,
    override: '',
    calc: CALC,
  };
  NUTRIENT_KEYS.forEach(k => { baseline[k] = shown0[k]; });
  const shown = project(baseline, detail) || shown0;
  return { portion: display(detail).slice(0, 40), portionMeta: metaOf(detail), nutri: nutriOf(baseline), shown };
}
function baseState(row, detail, baseline, shown) {
  return {
    name: (row && row.name) || '',
    note: (row && row.note) || '',
    tips: (row && row.tips) || '',
    detail, baseline, shown,
    clarifyDismissed: false,
    qtyOpen: '',
    labelOpen: false,
    holdNote: '',
  };
}
function fromAssessed(row) {
  row = row || {};
  if (row.nutri && row.portionMeta) {
    const baseline = readBaseline(row.nutri);
    const detail = readDetail(row.portionMeta, row.portion);
    if (baseline) {
      const shown = project(baseline, detail) || shownFrom(row);
      return baseState(row, detail, baseline, shown);
    }
  }
  const built = attach(row, row);
  return baseState(row, readDetail(built.portionMeta, built.portion), readBaseline(built.nutri), built.shown);
}
function fromSaved(entry) {
  if (!entry || !entry.nutri) return null;
  const baseline = readBaseline(entry.nutri);
  if (!baseline) return null;
  const detail = readDetail(entry.portionMeta, entry.portion);
  const shown = project(baseline, detail) || shownFrom(entry);
  return baseState(entry, detail, baseline, shown);
}
function macroDerived(kcal, shown) {
  if (kcal == null || !shown) return false;
  const c = Fml.kcalOf(Number(shown.carbsG) || 0, Number(shown.proteinG) || 0, Number(shown.fatG) || 0);
  return Math.abs(kcal - c) <= Math.max(40, c * 0.08);
}
function energyLine(state) {
  if (!state || !state.shown || state.shown.kcal == null) return '';
  const c = Fml.kcalOf(Number(state.shown.carbsG) || 0, Number(state.shown.proteinG) || 0, Number(state.shown.fatG) || 0);
  if (Math.abs(state.shown.kcal - c) <= Math.max(15, c * 0.12)) return '';
  return '热量和碳蛋脂对不上，可能含酒精或其他能量，没有改写热量。';
}
function statusLine(state) {
  if (!state) return '';
  if (state.holdNote) return state.holdNote;
  const b = state.baseline || {};
  if (b.source === 'label') return b.override === 'nutrient' ? '按包装，你改过数字' : '按你填的包装营养';
  if (b.source === 'user' || b.override === 'nutrient') return '营养已按你改的数字，改份量会从这里缩放';
  const d = state.detail || {};
  if (d.pending) return '估计 · 份量待确认';
  if (d.sizeAssumed || (d.size && b.ref && d.size !== (b.ref.size || ''))) return 'AI 估算 · 大小是相对粗估，不是称重';
  if (d.amountUnit === 'ml' && d.amount != null) return 'AI 估算 · 按容量比例，ml 不是克';
  if (b.source === 'ai') return 'AI 估算 · 不是称重';
  return '';
}
function sameNum(a, b) {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(Number(a) - Number(b)) < 1e-6;
}
function chips(state) {
  const d = state.detail || {};
  const unit = d.unit || '份';
  const out = [];
  const push = (id, label, on) => out.push({ id, label, on: !!on });
  if (unit === 'g' || unit === 'ml') {
    const presets = unit === 'ml' ? [250, 330, 500] : [50, 100, 150, 200];
    presets.forEach(n => push('q:' + n, n + unit, sameNum(d.qty, n)));
  } else {
    [1, 2, 3].forEach(n => push('q:' + n, fmt(n) + unit, sameNum(d.qty, n)));
  }
  if (d.size || unit === '根' || unit === '碗' || shapeFor(state.name)) {
    if (unit === '根' || unit === '碗' || d.size) ['小', '中', '大'].forEach(s => push('z:' + s, s, d.size === s));
  }
  if ('包袋盒罐瓶杯碗份'.indexOf(unit) >= 0) {
    push('r:1', '全吃完', d.ratio == null || sameNum(d.ratio, 1));
    push('r:0.5', '一半', sameNum(d.ratio, 0.5));
  }
  if (unit === '罐' || unit === '瓶' || unit === '杯') [330, 500].forEach(n => push('m:' + n, n + 'ml', sameNum(d.amount, n) && d.amountUnit === 'ml'));
  if (unit === '包' || unit === '袋' || unit === '盒') push('open:net', d.amount != null && d.amountUnit === 'g' ? ('净含量' + fmt(d.amount) + 'g') : '净含量', state.qtyOpen === 'net');
  push('open:qty', '改数字', state.qtyOpen === 'qty');
  return out;
}
function unitChoices(state) {
  const d = state.detail || {};
  const list = [];
  const add = u => { const n = normUnit(u); if (n && list.indexOf(n) < 0) list.push(n); };
  add(d.unit);
  const shape = shapeFor(state.name);
  if (shape) add(shape.unit);
  add('g'); add('ml');
  return list.slice(0, 4).map(u => ({ id: 'u:' + u, label: u, on: d.unit === u }));
}
function anchor(state, detail, note) {
  const baseline = clone(state.baseline);
  baseline.mode = 'portion';
  baseline.ref = refOf(detail);
  NUTRIENT_KEYS.forEach(k => { baseline[k] = state.shown[k]; });
  baseline.reason = note;
  return Object.assign({}, state, { detail, baseline, shown: clone(state.shown), holdNote: note });
}
function commitDetail(state, detail) {
  const ref = state.baseline.ref || {};
  if (state.baseline.mode === 'portion' && detail.amount != null && detail.amountUnit && (ref.amount == null || ref.amountUnit !== detail.amountUnit)) {
    const baseline = clone(state.baseline);
    baseline.ref = clone(ref);
    baseline.ref.amount = detail.amount;
    baseline.ref.amountUnit = detail.amountUnit;
    const shown = project(baseline, detail);
    if (!shown) return { error: '这个份量算出的营养超出了可记录范围' };
    const note = detail.amountUnit === 'ml'
      ? '容量已记下。营养仍按原来的估算，之后改容量会按比例缩放，ml 不会当成克。'
      : '净含量已记下。营养仍按原来的估算，之后改净含量会按比例缩放。';
    return { state: Object.assign({}, state, { detail, baseline, shown, holdNote: note }) };
  }
  const shown = project(state.baseline, detail);
  if (!shown) {
    if (normUnit(ref.unit) !== normUnit(detail.unit)) return { state: anchor(state, detail, '换成这个单位后没有可靠换算，营养保持刚才的数字。ml 不会当成克。') };
    return { error: '这个份量算出的营养超出了可记录范围' };
  }
  return { state: Object.assign({}, state, { detail, shown, holdNote: '' }) };
}
function setQty(state, qty) {
  const detail = clone(state.detail);
  const unitChanged = normUnit(state.baseline.ref.unit) !== normUnit(detail.unit) || state.detail.qty == null;
  detail.qty = qty;
  detail.touched = true;
  detail.vague = false;
  if (unitChanged) {
    if (!(qty > 0)) return { error: '先填大于 0 的数量' };
    detail.explicit = true;
    detail.pending = false;
    return { state: anchor(state, detail, '已按你填的数量记下。没有可靠换算，营养仍是刚才的数字；再改数量会按比例缩放。') };
  }
  detail.explicit = true;
  if (qty > 0) detail.pending = false;
  return commitDetail(state, detail);
}
function setRatio(state, ratio) {
  const detail = clone(state.detail);
  detail.ratio = ratio;
  detail.touched = true;
  detail.explicit = true;
  detail.vague = false;
  if (ratio > 0) detail.pending = false;
  return commitDetail(state, detail);
}
function setSize(state, size) {
  const detail = clone(state.detail);
  detail.size = size;
  detail.sizeAssumed = false;
  detail.touched = true;
  detail.pending = false;
  return commitDetail(state, detail);
}
function setAmount(state, amount, unit) {
  if (state.detail.qty == null) return { error: '先填数量，再填净含量或容量' };
  const detail = clone(state.detail);
  detail.amount = amount;
  detail.amountUnit = unit;
  detail.touched = true;
  detail.explicit = true;
  detail.vague = false;
  detail.pending = false;
  return commitDetail(state, detail);
}
function setUnit(state, unit) {
  unit = normUnit(unit);
  if (!unit || unit === normUnit(state.detail.unit)) return { state };
  const detail = clone(state.detail);
  detail.unit = unit;
  detail.touched = true;
  detail.qty = null;
  detail.pending = true;
  detail.explicit = false;
  if (unit === 'g' || unit === 'ml') { detail.amount = null; detail.amountUnit = ''; detail.size = ''; }
  return { state: Object.assign({}, state, { detail, qtyOpen: 'qty', holdNote: '单位已换成' + unit + '。先填数量，填好之前营养数字不变，也不会把原来的数量当成克或毫升。' }) };
}
function parseLoose(raw, cap) {
  const s = String(raw == null ? '' : raw).trim().replace(/,/g, '');
  if (s === '' || s === '.') return { empty: true };
  if (!/^\d+(\.\d+)?$/.test(s)) return { error: '要填非负数字' };
  const n = Number(s);
  if (!isFinite(n) || n < 0) return { error: '要填非负数字' };
  if (n > cap) return { error: '这个数超出了可记录范围' };
  return { value: n };
}
function setQtyRaw(state, raw) {
  const parsed = parseLoose(raw, 5000);
  if (parsed.empty) return { state: Object.assign({}, state, { qtyOpen: 'qty' }) };
  if (parsed.error) return { error: '数量要是非负数字' };
  const next = setQty(state, parsed.value);
  if (next.state) next.state.qtyOpen = 'qty';
  return next;
}
function setAmountRaw(state, raw) {
  const parsed = parseLoose(raw, 5000);
  if (parsed.empty) return { state: Object.assign({}, state, { qtyOpen: 'net' }) };
  if (parsed.error || !(parsed.value > 0)) return { error: '净含量要是大于 0 的数' };
  const unit = state.detail.amountUnit === 'ml' ? 'ml' : 'g';
  const next = setAmount(state, parsed.value, unit);
  if (next.state) next.state.qtyOpen = 'net';
  return next;
}
function applyChip(state, id) {
  if (!state) return { error: '还没有这份食物' };
  const key = String(id || '');
  if (key === 'skip') return { state: Object.assign({}, state, { clarifyDismissed: true }) };
  if (key === 'label') return { state: Object.assign({}, state, { labelOpen: !state.labelOpen }) };
  if (key === 'open:qty') return { state: Object.assign({}, state, { qtyOpen: state.qtyOpen === 'qty' ? '' : 'qty' }) };
  if (key === 'open:net') return { state: Object.assign({}, state, { qtyOpen: state.qtyOpen === 'net' ? '' : 'net' }) };
  if (key === 'step:-1' || key === 'step:1') {
    const dir = key === 'step:1' ? 1 : -1;
    const unit = state.detail.unit;
    const cur = state.detail.qty == null ? 0 : state.detail.qty;
    const delta = unit === 'g' || unit === 'ml' ? 10 * dir : dir;
    let next = round1(cur + delta);
    if (next < 0) next = 0;
    return setQty(state, next);
  }
  if (key.indexOf('q:') === 0) return setQty(state, Number(key.slice(2)));
  if (key.indexOf('z:') === 0) return setSize(state, key.slice(2));
  if (key.indexOf('r:') === 0) return setRatio(state, Number(key.slice(2)));
  if (key.indexOf('m:') === 0) return setAmount(state, Number(key.slice(2)), 'ml');
  if (key.indexOf('u:') === 0) return setUnit(state, key.slice(2));
  return { state };
}
function parseNutrient(key, raw) {
  const cap = CAPS[key];
  const parsed = parseLoose(raw, cap);
  if (parsed.error) return { error: LABELS[key] + '要是 0–' + cap + ' 的数字' };
  if (parsed.empty) return { empty: true };
  const value = key === 'kcal' || key === 'saltMg' ? Math.round(parsed.value) : round1(parsed.value);
  if (value > cap) return { error: LABELS[key] + '要是 0–' + cap + ' 的数字' };
  return { value };
}
function rebase(state, shown, reason) {
  const f = factorOf(state.baseline, state.detail);
  if (f == null || !(f > 0)) return { error: '现在的份量还不能换算营养基准' };
  const baseline = clone(state.baseline);
  NUTRIENT_KEYS.forEach(k => { baseline[k] = shown[k] == null ? null : shown[k] / f; });
  if (baseline.source === 'ai') baseline.source = 'user';
  baseline.override = 'nutrient';
  baseline.reason = reason || (baseline.source === 'label' ? '包装营养里有一项按你改的数字' : '按你改的数字，之后改份量从这里缩放');
  const check = project(baseline, state.detail);
  if (!check) return { error: '这个数字超出了可记录范围' };
  return { state: Object.assign({}, state, { baseline, shown: check, holdNote: '' }) };
}
function editNutrient(state, key, raw) {
  if (NUTRIENT_KEYS.indexOf(key) < 0) return { error: '没有这项营养' };
  const parsed = parseNutrient(key, raw);
  if (parsed.error) return parsed;
  if (parsed.empty && REQUIRED_KEYS.indexOf(key) >= 0) return { error: '请填写' + LABELS[key] };
  const shown = clone(state.shown);
  shown[key] = parsed.empty ? null : parsed.value;
  let same = true;
  NUTRIENT_KEYS.forEach(k => { if (!sameNum(shown[k], state.shown[k])) same = false; });
  if (same) return { state };
  return rebase(state, shown);
}
function applyLabel(state, form) {
  form = form || {};
  const mode = form.mode === '100g' ? '100g' : 'pack';
  const nums = {};
  for (let i = 0; i < REQUIRED_KEYS.length; i++) {
    const k = REQUIRED_KEYS[i];
    const parsed = parseNutrient(k, form[k]);
    if (parsed.error || parsed.empty) return { error: '包装营养要填热量、碳水、蛋白质和脂肪' };
    nums[k] = parsed.value;
  }
  ['fiberG', 'sugarG', 'saltMg'].forEach(k => {
    if (form[k] == null || String(form[k]).trim() === '') { nums[k] = null; return; }
    const parsed = parseNutrient(k, form[k]);
    if (parsed.error || parsed.empty) nums[k] = null;
    else nums[k] = parsed.value;
  });
  let baseline;
  if (mode === '100g') {
    const g = gramsOf(state.detail);
    if (g == null) return { error: '要按每100g算，需要这份的克数。毫升不能当成克，可以改填这一份的营养。' };
    if (!(g > 0)) return { error: '克数要大于 0，才能按每100g算' };
    baseline = {
      mode: 'per100g', ref: { qty: 100, unit: 'g', size: '', amount: null, amountUnit: '', ratio: 1 },
      source: 'label', reason: '按你填的每100g包装营养', weightSource: 'user', cooked: state.detail.cooked, override: '', calc: CALC,
    };
  } else {
    const unit = state.detail.unit || '份';
    baseline = {
      mode: 'perPack',
      ref: { qty: 1, unit, size: state.detail.size || '', amount: null, amountUnit: '', ratio: 1 },
      source: 'label', reason: '按你填的每1' + unit + '营养', weightSource: '', cooked: state.detail.cooked, override: '', calc: CALC,
    };
  }
  NUTRIENT_KEYS.forEach(k => { baseline[k] = nums[k]; });
  const shown = project(baseline, state.detail);
  if (!shown) return { error: '按这个包装算出来的营养超出了可记录范围' };
  return { state: Object.assign({}, state, { baseline, shown, labelOpen: false, holdNote: '' }) };
}
function toInput(state, extra) {
  const shown = state.shown || {};
  return Object.assign({
    name: state.name,
    portion: display(state.detail).slice(0, 40),
    note: state.note || '',
    tips: state.tips || '',
    kcal: shown.kcal,
    carbsG: shown.carbsG,
    proteinG: shown.proteinG,
    fatG: shown.fatG,
    fiberG: shown.fiberG,
    sugarG: shown.sugarG,
    saltMg: shown.saltMg,
    portionMeta: metaOf(state.detail),
    nutri: nutriOf(state.baseline),
  }, extra || {});
}
function view(state) {
  const s = (state && state.shown) || {};
  const d = (state && state.detail) || {};
  const unit = d.unit || '份';
  return {
    portionText: display(d),
    portionStatus: statusLine(state),
    energyNote: energyLine(state),
    chips: chips(state),
    units: unitChoices(state),
    qtyOpen: state ? state.qtyOpen : '',
    qtyValue: d.qty == null ? '' : fmt(d.qty),
    amountValue: d.amount == null ? '' : fmt(d.amount),
    amountUnit: d.amountUnit || (unit === 'ml' ? 'ml' : 'g'),
    clarify: !!(state && d.pending && !state.clarifyDismissed),
    labelOpen: !!(state && state.labelOpen),
    labelPack: '填 1' + unit + ' 的营养',
    kcal: s.kcal == null ? '' : String(s.kcal),
    carbsG: s.carbsG == null ? '' : fmt(s.carbsG),
    proteinG: s.proteinG == null ? '' : fmt(s.proteinG),
    fatG: s.fatG == null ? '' : fmt(s.fatG),
    fiberG: s.fiberG == null ? '' : fmt(s.fiberG),
    sugarG: s.sugarG == null ? '' : fmt(s.sugarG),
    saltMg: s.saltMg == null ? '' : String(s.saltMg),
  };
}
function isVaguePortion(text) {
  const compact = String(text || '').replace(/\s/g, '');
  return !compact || /^(一份|1份|份)$/.test(compact);
}
function noteFor(entry) {
  if (!entry) return '';
  if (entry.portionMeta && entry.portionMeta.legacy) return '原记录没有营养基准，改份量不会重算热量';
  if (entry.nutri && entry.nutri.source === 'label') return entry.nutri.override === 'nutrient' ? '按包装，你改过数字' : '按包装营养';
  if (entry.nutri && (entry.nutri.source === 'user' || entry.nutri.override === 'nutrient')) return '已按你改的数字';
  if (entry.portionMeta && entry.portionMeta.pending) return '估计 · 份量待确认';
  if (entry.portionMeta && entry.portionMeta.sizeAssumed) return '估计 · 大小未确认';
  if (!entry.nutri && entry.source === 'ai-text' && isVaguePortion(entry.portion)) return '原记录份量未细化';
  if (entry.source === 'ai-text') return '估算';
  return '';
}
function isEstimateEntry(entry) {
  if (!entry || entry.source !== 'ai-text') return false;
  if (entry.nutri && entry.nutri.source === 'label') return false;
  return true;
}
function dayEstimateMark(entries) {
  const list = (entries || []).filter(Boolean);
  if (!list.length) return '';
  const n = list.filter(isEstimateEntry).length;
  if (!n) return '';
  return n === list.length ? '估算' : '含估算';
}
function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const detail = readDetail(meta, '');
  if (!detail.unit && detail.qty == null) return null;
  const out = metaOf(detail);
  if (meta.legacy) out.legacy = true;
  return out;
}
function applySavedPatch(entry, patch) {
  const state0 = fromSaved(entry);
  if (!state0) return { ok: false, message: '这条记录没有可缩放的基准' };
  let state = state0;
  patch = patch || {};
  if (patch.nutri && typeof patch.nutri === 'object') {
    const baseline = readBaseline(patch.nutri);
    if (!baseline) return { ok: false, message: '包装营养的数字还不行' };
    const detail = patch.portionMeta ? readDetail(patch.portionMeta, '') : state.detail;
    const shown = project(baseline, detail);
    if (!shown) return { ok: false, message: '按这个营养算出来的结果超出了可记录范围' };
    state = Object.assign({}, state, { baseline, detail, shown, holdNote: '' });
  } else if (patch.portionMeta && typeof patch.portionMeta === 'object') {
    const detail = readDetail(patch.portionMeta, '');
    const r = commitDetail(state, detail);
    if (r.error) return { ok: false, message: r.error };
    state = r.state;
  }
  const keys = NUTRIENT_KEYS.filter(k => k in patch && patch[k] != null && patch[k] !== '');
  if (keys.length && !(patch.nutri && typeof patch.nutri === 'object')) {
    const shown = clone(state.shown);
    const before = clone(state.shown);
    for (let i = 0; i < keys.length; i++) {
      const parsed = parseNutrient(keys[i], patch[keys[i]]);
      if (parsed.error || parsed.empty) return { ok: false, message: parsed.error || '请填写营养数字' };
      shown[keys[i]] = parsed.value;
    }
    const macros = ['carbsG', 'proteinG', 'fatG'].some(k => keys.indexOf(k) >= 0);
    if (macros && keys.indexOf('kcal') < 0 && macroDerived(before.kcal, before)) {
      shown.kcal = Math.round(Fml.kcalOf(shown.carbsG, shown.proteinG, shown.fatG));
    }
    const reb = rebase(state, shown);
    if (reb.error) return { ok: false, message: reb.error };
    state = reb.state;
  }
  const payload = toInput(state);
  const next = Object.assign({}, entry, {
    portion: payload.portion,
    portionMeta: payload.portionMeta,
    nutri: payload.nutri,
    kcal: payload.kcal,
    carbsG: payload.carbsG,
    proteinG: payload.proteinG,
    fatG: payload.fatG,
    fiberG: payload.fiberG,
    sugarG: payload.sugarG,
    saltMg: payload.saltMg,
    snap: { carbsG: payload.carbsG, proteinG: payload.proteinG, fatG: payload.fatG },
  });
  return { ok: true, entry: next };
}

module.exports = {
  CALC, CAPS, attach, packMeta, fromAssessed, fromSaved, applyChip, setQtyRaw, setAmountRaw, editNutrient, applyLabel,
  toInput, display, view, noteFor, isEstimateEntry, dayEstimateMark, applySavedPatch, resolveDetail, readDetail,
  sanitizeMeta, project, parseText,
};
