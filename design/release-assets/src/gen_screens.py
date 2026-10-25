# -*- coding: utf-8 -*-
"""Rebuild 4 core pages of 组迹 as static HTML from the real WXSS (rpx -> px @375), sample data only."""
import re, os, json, math
MP = '/workspace/fitness-miniapp/miniprogram/'
OUT = '/workspace/fitness-miniapp/design/release-assets/src/'
REL = '../../../miniprogram/'   # from design/release-assets/src/ to miniprogram/

def rd(p): return open(MP + p, encoding='utf-8').read()

def conv(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'(?:constant|env)\(safe-area-inset-bottom\)', 'var(--safe-b)', css)
    css = re.sub(r'(-?\d*\.?\d+)rpx', lambda m: f'calc({m.group(1)} * var(--rpx))', css)
    return css

def scope(css, sc):
    """prefix every selector with scope (component style isolation); :host -> scope itself"""
    out, i = [], 0
    css = conv(css)
    while i < len(css):
        j = css.find('{', i)
        if j < 0: break
        sel = css[i:j].strip()
        if sel.startswith('@keyframes'):
            depth, k = 1, j + 1
            while depth and k < len(css):
                if css[k] == '{': depth += 1
                elif css[k] == '}': depth -= 1
                k += 1
            out.append(css[i:k]); i = k; continue
        k = css.find('}', j)
        body = css[j:k + 1]
        sels = []
        for s in sel.split(','):
            s = s.strip()
            if not s: continue
            if s.startswith(':host'): sels.append(sc + s[5:])
            elif re.match(r'^page\b', s): sels.append('.wx-page' + s[4:])
            else: sels.append(f'{sc} {s}')
        out.append(', '.join(sels) + ' ' + body)
        i = k + 1
    return '\n'.join(out)

APP = scope(rd('app.wxss'), '.wx-page').replace('.wx-page .wx-page', '.wx-page')
# app.wxss "page {...}" -> after scope it's ".wx-page .wx-page"? handle: page selector handled inside scope -> '.wx-page'
CMP = {n: scope(rd(f'components/{n}/{n}.wxss'), f'.c-{n}') for n in ['nav-bar', 'btn', 'card', 'empty-state', 'month-calendar', 'set-row', 'line-chart']}
def page_css(p): return scope(rd(f'pages/{p}/{p}.wxss'), '.wx-page')

BASE = '''
:root { --rpx: 0.5px; }
html, body { margin: 0; padding: 0; background: #fff; }
* { box-sizing: content-box; }
input { border: 0; outline: 0; background: transparent; font: inherit; color: inherit; padding: 0; margin: 0; width: 100%; }
.device { position: relative; width: 375px; height: 812px; overflow: hidden; background: #fff;
  font-family: -apple-system, "PingFang SC", "Noto Sans CJK SC", "Helvetica Neue", sans-serif; -webkit-font-smoothing: antialiased; }
.win { position: absolute; left: 0; right: 0; top: 0; overflow: hidden; transform: translateZ(0); }
.wx-page { --safe-b: 34px; min-height: 100%; }
.tabwin .wx-page { --safe-b: 0px; }
.statusbar { position: absolute; top: 0; left: 0; right: 0; height: 44px; z-index: 200; pointer-events: none; font: 600 15px -apple-system, "Helvetica Neue", "Noto Sans CJK SC", sans-serif; color: #111; }
.statusbar .t { position: absolute; left: 30px; top: 14px; letter-spacing: .2px; }
.statusbar .icons { position: absolute; right: 22px; top: 17px; display: flex; gap: 5px; align-items: center; }
.capsule { position: absolute; top: 48px; left: 281px; width: 87px; height: 32px; border-radius: 16px; border: 0.5px solid rgba(0,0,0,.12); background: rgba(255,255,255,.75); z-index: 200; box-sizing: border-box; display: flex; align-items: center; }
.capsule .half { flex: 1; display: flex; align-items: center; justify-content: center; height: 100%; }
.capsule .sep { width: 0.5px; height: 18px; background: rgba(0,0,0,.18); }
.tabbar { position: absolute; left: 0; right: 0; bottom: 0; height: 83px; background: #fff; z-index: 150; display: flex; border-top: 0.5px solid rgba(0,0,0,.33); box-sizing: border-box; }
.tabbar .it { flex: 1; display: flex; flex-direction: column; align-items: center; padding-top: 5px; font-size: 10px; color: #8C8C8C; font-family: -apple-system, "PingFang SC", "Noto Sans CJK SC", sans-serif; }
.tabbar .it img { width: 27px; height: 27px; margin-bottom: 1px; }
.tabbar .it.on { color: #FF5A1F; }
.home { position: absolute; left: 50%; bottom: 8px; width: 134px; height: 5px; margin-left: -67px; border-radius: 3px; background: #111; z-index: 210; }
'''
STATUS = '''<div class="statusbar"><span class="t">9:41</span><span class="icons">
<svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="#111"/><rect x="5" y="5" width="3" height="6" rx="1" fill="#111"/><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="#111"/><rect x="15" y="0" width="3" height="11" rx="1" fill="#111"/></svg>
<svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3C13.3 1.4 10.8.4 8 .4S2.7 1.4.8 3.3L2 4.6c1.6-1.5 3.7-2.4 6-2.4z M8 5.6c1.4 0 2.6.5 3.6 1.4l1.2-1.3C11.5 4.5 9.8 3.8 8 3.8s-3.5.7-4.8 1.9L4.4 7C5.4 6.1 6.6 5.6 8 5.6z M8 9l2.2-2.3C9.6 6.2 8.8 6 8 6s-1.6.3-2.2.7z" fill="#111"/></svg>
<svg width="27" height="12" viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.5" fill="none" stroke="#111" stroke-opacity=".4"/><rect x="2" y="2" width="20" height="8" rx="2" fill="#111"/><path d="M25 4v4c.8-.3 1.3-1.1 1.3-2S25.8 4.3 25 4z" fill="#111" fill-opacity=".45"/></svg>
</span></div>'''
CAPSULE = '''<div class="capsule"><div class="half"><svg width="22" height="6" viewBox="0 0 22 6"><circle cx="3" cy="3" r="2.2" fill="#111"/><circle cx="11" cy="3" r="3" fill="#111"/><circle cx="19" cy="3" r="2.2" fill="#111"/></svg></div><div class="sep"></div>
<div class="half"><svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.5" fill="none" stroke="#111" stroke-width="1.6"/><circle cx="9" cy="9" r="2.8" fill="#111"/></svg></div></div>'''
def tabbar(active):
    items = [('calendar', '日历'), ('library', '动作库'), ('body', '身体数据')]
    h = '<div class="tabbar">'
    for i, (k, t) in enumerate(items):
        ic = f'{REL}images/tabbar/{k}{"-active" if i == active else ""}.png'
        h += f'<div class="it {"on" if i == active else ""}"><img src="{ic}"/><span>{t}</span></div>'
    return h + '</div>'

# nav-bar (iPhone X metrics: statusBarHeight 44, capsule top 48 / h 32 / left 281)
SH, NH, RG = 44, 32 + (48 - 44) * 2, 375 - 281 + 8
def nav_tab(title, right=''):
    return f'''<div class="c-nav-bar"><div class="nav" style="padding-top:{SH}px"><div class="bar-in" style="height:{NH}px;padding-right:{RG}px">
<span class="tab-title">{title}</span>{right}</div></div><div style="height:{SH+NH}px"></div></div>'''
def nav_back(mode='back', center=''):
    return f'''<div class="c-nav-bar"><div class="nav" style="padding-top:{SH}px"><div class="bar-in" style="height:{NH}px;padding-right:{RG}px">
<div class="back">{'×' if mode=='close' else '‹'}</div>
<div class="center" style="left:{RG}px;right:{RG}px;height:{NH}px"><div class="center-in">{center}</div></div></div></div><div style="height:{SH+NH}px"></div></div>'''
def btn(text, typ='primary', size='bar', style=''):
    return f'<div class="c-btn" style="{style}"><div class="btn btn-{typ} btn-{size}">{text}</div></div>'

def doc(title, css, body, tab=None):
    win_h = 812 - (83 if tab is not None else 0)
    return f'''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=375">
<title>{title}</title><!-- 组迹 1.0 · 发布截图复刻：样式取自 miniprogram/ 真实 WXSS（rpx→px，375 宽），数据为示例数据 -->
<style>{BASE}\n{APP}\n{''.join(CMP.values())}\n{css}
.wx-page {{ font-family: -apple-system, "PingFang SC", "Noto Sans CJK SC", "Helvetica Neue", sans-serif; }}</style></head><body>
<div class="device">{STATUS}{CAPSULE}
<div class="win {'tabwin' if tab is not None else ''}" style="height:{win_h}px"><div class="wx-page">{body}</div></div>
{tabbar(tab) if tab is not None else ''}<div class="home"></div></div></body></html>'''

# ---------------- P1 calendar (today 2026-10-19, selected 10-16) ----------------
def month_cal(year, month, selected, today, marks, variant='dot', legend=True):
    import calendar, datetime
    first = datetime.date(year, month, 1); lead = first.weekday()  # Mon=0
    ndays = calendar.monthrange(year, month)[1]
    cells = []
    prev_last = first - datetime.timedelta(days=1)
    for i in range(lead): d = prev_last - datetime.timedelta(days=lead - 1 - i); cells.append((d, False))
    for i in range(ndays): cells.append((datetime.date(year, month, i + 1), True))
    while len(cells) % 7: d = cells[-1][0] + datetime.timedelta(days=1); cells.append((d, False))
    h = f'''<div class="c-month-calendar"><div class="head row between"><div class="row"><span class="ym">{year}年{month}月</span><div class="today-hit"><span class="today-pill">今天</span></div></div>
<div class="row"><div class="arrow">‹</div><div class="arrow">›</div></div></div>
<div class="week">{''.join(f'<div class="wd">{w}</div>' for w in '一二三四五六日')}</div><div class="grid">'''
    for d, inm in cells:
        ds = d.isoformat(); mk = marks.get(ds, '')
        cls = ['cell', 'v-' + variant]
        if not inm: cls.append('out')
        if ds > today: cls.append('future')
        if ds == today: cls.append('today')
        if ds == selected: cls.append('sel')
        inner = f'<div class="n num">{d.day}</div>'
        inner += f'<div class="dot {"on" if mk else ""}"></div>' if variant == 'dot' else f'<div class="val num">{mk if mk is not True else "•"}</div>'
        h += f'<div class="{" ".join(cls)}">{inner}</div>'
    h += '</div>'
    if legend: h += '<div class="legend row"><div class="dot on"></div><span>训练日</span><div class="lg-sel"></div><span>选中</span><div class="lg-today"></div><span>今天</span></div>'
    return h + '</div>'
# legend uses <text> in wxml; month-calendar.wxss styles ".legend text" -> map to span
CMP['month-calendar'] = CMP['month-calendar'].replace('.legend text', '.legend span')

TRAIN_DAYS = ['2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16', '2026-09-28', '2026-09-30']
def p_calendar():
    marks = {d: True for d in TRAIN_DAYS}
    top = [('杠铃卧推', '4组 · 最佳 62.5kg×6'), ('哑铃上斜卧推', '3组 · 最佳 24kg×10'), ('杠铃站姿军事推举', '3组 · 最佳 40kg×8')]
    stats = [('5', '动作'), ('17', '组'), ('5,840', '容量 kg')]
    card = f'''<div style="margin-top:calc(24 * var(--rpx))"><div class="c-card"><div class="card pad">
<div class="row between"><span class="h2">推日</span><span class="cap">68 分钟</span></div>
<div class="stats row">{''.join(f'<div class="stat"><div class="sv num">{v}</div><div class="cap">{k}</div></div>' for v, k in stats)}</div>
<div class="hairline-b"></div>
{''.join(f'<div class="row between ex-line"><span class="flex1 ell">{n}</span><span class="sub num">{t}</span></div>' for n, t in top)}
<div class="cap" style="padding-top:calc(8 * var(--rpx))">等 5 个动作</div></div></div></div>'''
    body = nav_tab('训练') + f'''<div class="page page-pad-tab">{month_cal(2026, 10, '2026-10-16', '2026-10-19', marks)}
<div class="hairline-b"></div>
<div class="section row"><span class="h2">10月16日 周五</span><span class="tag tag-gray" style="margin-left:calc(16 * var(--rpx))">已完成</span></div>
{card}</div><div class="fab">+</div>'''
    return doc('训练日历', page_css('calendar'), body, tab=0)

# ---------------- P3 workout-edit (draft, today) ----------------
def set_row(label, w, r, done, warm=False):
    lab = f'<span class="warm">热</span>' if warm else f'<span>{label}</span>'
    return f'''<div class="c-set-row"><div class="sr {'done' if done else ''}"><div class="no">{lab}</div>
<div class="stp w"><div class="pm">−</div><input class="val num" value="{w}"><div class="pm">+</div></div>
<div class="stp r"><div class="pm">−</div><input class="val num" value="{r}"><div class="pm">+</div></div>
<div class="chk"><div class="circle {'on' if done else ''}">{'✓' if done else ''}</div></div></div></div>'''
def p_edit():
    center = '<div class="row"><span class="nav-date">10月19日 周一 ▾</span><span class="tag ml-2 tag-accent">草稿</span></div>'
    sets = set_row('', '40', '10', True, True) + set_row('1', '80', '8', True) + set_row('2', '85', '6', True) + set_row('3', '85', '6', True) + set_row('4', '85', '5', False)
    card1 = f'''<div class="ex-card"><div class="ex-head row"><div class="flex1 row"><span class="ex-name">杠铃深蹲</span><span class="tag tag-line" style="margin-left:calc(12 * var(--rpx))">腿</span></div><div class="dots">⋯</div></div>
<div class="row th cap"><span class="c-no">组</span><span class="c-w">重量 kg</span><span class="c-r">次数</span><span class="c-chk">完成</span></div>
{sets}<div class="add-set">+ 加一组</div><div class="cap hint">长按组可设为热身或删除</div></div>'''
    card2 = '''<div class="ex-card"><div class="ex-head row"><div class="flex1 row"><span class="ex-name">杠铃硬拉</span><span class="tag tag-line" style="margin-left:calc(12 * var(--rpx))">腿</span><span class="cap" style="margin-left:auto">0/3 组</span></div><div class="dots">⋯</div></div></div>'''
    card3 = '''<div class="ex-card"><div class="ex-head row"><div class="flex1 row"><span class="ex-name">哑铃保加利亚分腿蹲</span><span class="tag tag-line" style="margin-left:calc(12 * var(--rpx))">腿</span><span class="cap" style="margin-left:auto">0/3 组</span></div><div class="dots">⋯</div></div></div>'''
    body = nav_back('close', center) + f'''<div class="page page-pad-bar">
<div class="row between status-line"><span class="cap">10月19日训练 · 3 个动作 · 3 组 · 1,660 kg</span><span class="cap save-st">已自动保存</span></div>
{card1}{card2}{card3}</div>
<div class="bar">{btn('+ 动作', 'secondary', style='width:calc(240 * var(--rpx))')}<div class="gap"></div>{btn('完成训练', 'primary', style='flex:1')}</div>'''
    return doc('训练录入', page_css('workout-edit'), body)

# ---------------- P7 body chart ----------------
WEIGHTS = [('2026-09-20', 72.8), ('2026-09-23', 72.6), ('2026-09-26', 72.7), ('2026-09-29', 72.3), ('2026-10-02', 72.2),
           ('2026-10-05', 72.4), ('2026-10-08', 71.9), ('2026-10-11', 71.8), ('2026-10-13', 71.6), ('2026-10-15', 71.7),
           ('2026-10-17', 71.5), ('2026-10-19', 71.2)]
def p_body():
    pts = json.dumps([{'date': d, 'value': v} for d, v in WEIGHTS])
    rows = [('10月19日', '71.2', '−0.3'), ('10月17日', '71.5', '−0.2'), ('10月15日', '71.7', '+0.1')]
    body = nav_tab('身体数据') + f'''<div class="page page-pad-tab">
<div class="seg"><div class="seg-item on">图表</div><div class="seg-item">日历</div></div>
<div class="chips"><span class="chip on">体重</span><span class="chip">体脂率</span><span class="chip">腰围</span></div>
<div class="row between" style="align-items:flex-end"><div><div class="row" style="align-items:baseline"><span class="display num">71.2</span><span class="sub" style="margin-left:calc(8 * var(--rpx))">kg</span></div>
<div class="cap">10月19日<span> · 较上次 −0.3 kg</span></div></div></div>
<div class="row range-row"><div class="seg range-seg"><div class="seg-item on">30天</div><div class="seg-item">90天</div><div class="seg-item">全部</div></div></div>
<div class="chart-box"><div class="c-line-chart"><div class="wrap" style="height:calc(360 * var(--rpx))"><canvas id="c" class="c" style="height:calc(360 * var(--rpx))"></canvas></div></div></div>
<div class="row between section"><span class="h2">记录</span><span class="sub hit" style="padding-left:calc(24 * var(--rpx))">全部 ›</span></div>
{''.join(f'<div class="li hairline-b"><span class="flex1">{d}</span><span class="num" style="font-weight:600">{v} kg</span><span class="cap num delta">{dl}</span><span class="chev">›</span></div>' for d, v, dl in rows)}
<div class="cap" style="padding-top:calc(12 * var(--rpx))">长按记录可删除</div></div><div class="fab">+</div>
<script>
// chartLayout / niceScale / draw: ported 1:1 from utils/repo/series.js and components/line-chart/line-chart.js
const T = {{ LINE:'#E5E5E5', TEXT3:'#8C8C8C', ACCENT:'#FF5A1F', WHITE:'#FFFFFF', INK:'#111111' }};
const parse = s => {{ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }};
const dayIndex = s => Math.round(parse(s).getTime() / 86400000);
const STEPS = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
function niceScale(min, max) {{
  const nonNeg = min >= 0; if (min === max) {{ min -= 0.5; max += 0.5; }}
  const span = max - min; min -= span * 0.1; max += span * 0.1;
  let step = STEPS[STEPS.length - 1];
  for (const s of STEPS) {{ if (Math.ceil(max / s - 1e-9) - Math.floor(min / s + 1e-9) <= 4) {{ step = s; break; }} }}
  let lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step;
  if (nonNeg && lo < 0) lo = 0; if (Math.round((hi - lo) / step) < 2) hi = lo + 2 * step;
  lo = Math.round(lo * 10) / 10; hi = Math.round(hi * 10) / 10;
  return {{ lo, hi, step, decimals: step < 1 ? 1 : 0 }};
}}
function chartLayout(series, w, h, pad) {{
  const pts = series.points, vals = pts.map(p => p.value);
  const raw = niceScale(Math.min.apply(null, vals), Math.max.apply(null, vals)); const min = raw.lo, max = raw.hi;
  const x0 = dayIndex(series.from), x1 = dayIndex(series.to), iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const points = pts.map(p => ({{ date: p.date, value: p.value, x: pad.l + (iw * (dayIndex(p.date) - x0)) / (x1 - x0), y: pad.t + ih * (1 - (p.value - min) / (max - min)) }}));
  const n = Math.round((max - min) / raw.step), ticks = [];
  for (let k = 0; k <= n; k++) {{ const v = Math.round((min + raw.step * k) * 10) / 10; ticks.push({{ v, label: v.toFixed(raw.decimals), y: pad.t + ih * (1 - k / n) }}); }}
  return {{ points, ticks, pad, w, h }};
}}
const series = {{ from: '2026-09-20', to: '2026-10-19', points: {pts} }};
const canvas = document.getElementById('c'), w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
canvas.width = w * dpr; canvas.height = h * dpr; const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
const L = chartLayout(series, w, h, {{ l: 32, r: 12, t: 16, b: 22 }});
ctx.lineWidth = 0.5; ctx.strokeStyle = T.LINE; ctx.fillStyle = T.TEXT3; ctx.font = '10px -apple-system, "Noto Sans CJK SC", sans-serif';
L.ticks.forEach((t, i) => {{ ctx.setLineDash(i === 0 ? [] : [3, 3]); ctx.beginPath(); ctx.moveTo(L.pad.l, t.y); ctx.lineTo(w - L.pad.r, t.y); ctx.stroke(); ctx.fillText(t.label, 0, t.y + 3); }});
ctx.setLineDash([]);
const d0 = parse(series.from).getTime(), d1 = parse(series.to).getTime();
for (let i = 0; i < 5; i++) {{ const d = new Date(d0 + ((d1 - d0) * i) / 4); const x = L.pad.l + ((w - L.pad.l - L.pad.r) * i) / 4;
  ctx.fillText((d.getMonth() + 1) + '/' + d.getDate(), Math.min(Math.max(x - 10, L.pad.l), w - 28), h - 4); }}
const P = L.points, last = P[P.length - 1];
ctx.strokeStyle = T.ACCENT; ctx.lineWidth = 2; ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
ctx.setLineDash([3, 3]); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(last.x, L.pad.t); ctx.lineTo(last.x, h - L.pad.b); ctx.stroke(); ctx.setLineDash([]);
P.forEach((p, i) => {{ ctx.beginPath(); ctx.arc(p.x, p.y, i === P.length - 1 ? 5 : 2.5, 0, Math.PI * 2); ctx.fillStyle = i === P.length - 1 ? T.ACCENT : T.WHITE; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.ACCENT; ctx.stroke(); }});
</script>'''
    return doc('身体数据', page_css('body'), body, tab=2)

# ---------------- P6 exercise detail (0025 with line art) ----------------
def p_detail():
    ex = {x['id']: x for x in json.load(open('/workspace/fitness-miniapp/data/exercises.json', encoding='utf-8'))}['0025']
    f = json.load(open('/workspace/fitness-miniapp/data/filters.json', encoding='utf-8'))
    zh = {k: {e['value']: e['zh'] for e in f[k]} for k in ['bodyPart', 'bodyPartDetail', 'equipment', 'muscles']}
    sec = ''.join(f'<span class="tag tag-line" style="margin-bottom:calc(8 * var(--rpx))">{zh["muscles"][m]}</span>' for m in ex['secondary'])
    info = [('部位', zh['bodyPart'][ex['bodyPart']] + ' · ' + zh['bodyPartDetail'][ex['bodyPartDetail']]), ('器械', zh['equipment'][ex['equipment']]), ('类别', ex['categoryZh']), ('我的最佳', '62.5kg × 6')]
    steps = ''.join(f'<div class="row step"><span class="sno">{i+1:02d}</span><span class="stx">{s}</span></div>' for i, s in enumerate(ex['steps']))
    name_en = ex['nameEn'][0].upper() + ex['nameEn'][1:]
    body = nav_back('back') + f'''<div class="page page-pad-bar" style="margin-top:-76px">
<img class="ill" src="{REL}{ex['illustration']}">
<div class="row" style="margin-top:calc(32 * var(--rpx));flex-wrap:wrap"><span class="title">{ex['nameZh']}</span></div>
<div class="sub" style="font-size:calc(28 * var(--rpx))">{name_en}</div>
<div class="tags"><div class="row tg"><span class="cap lab">目标肌群</span><span class="tag tag-solid">{zh['muscles'][ex['target']]}</span></div>
<div class="row tg" style="flex-wrap:wrap"><span class="cap lab">次要肌群</span>{sec}</div></div>
<div class="grid hairline-t hairline-b">{''.join(f'<div class="cell"><div class="cap">{k}</div><div class="cv num">{v}</div></div>' for k, v in info)}</div>
<div class="h2 section section-title">动作步骤</div>{steps}<div class="bar-spacer"></div></div>
<div class="bar">{btn('加入当前训练', 'primary', style='flex:1')}</div>'''
    return doc('动作详情', page_css('exercise-detail'), body)

os.makedirs(OUT, exist_ok=True)
for name, fn in [('01-calendar', p_calendar), ('02-workout-edit', p_edit), ('03-body-chart', p_body), ('04-exercise-detail', p_detail)]:
    open(OUT + name + '.html', 'w', encoding='utf-8').write(fn())
print('ok')
