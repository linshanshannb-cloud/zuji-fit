# -*- coding: utf-8 -*-
"""Final avatar = C1 with a shorter bar, centered on the art's real bounding box. Run from /workspace/tmp_design/release."""
import importlib.util, sys
spec = importlib.util.spec_from_file_location('c', '/workspace/tmp_design/release/gen_avatar_c.py')
A = '/workspace/fitness-miniapp/design/release-assets/'
src = open('/workspace/tmp_design/release/gen_avatar_c.py', encoding='utf-8').read()
# reuse helpers only (head/rect/knurl/measure/fit), skip the C1-C3 output loop
helpers = src[:src.index("for k, f in [('avatar-C1-centered', c1)")]
ns = {}; exec(helpers, ns)
head, rect, knurl, fit = ns['head'], ns['rect'], ns['knurl'], ns['fit']
def final():
    cy = 512; s = head('组迹 小程序头像（定稿）：半边杠铃，3 片杠铃片垂直居中、由小到大')
    s += rect(176, cy - 30, 330, 60, 30)                 # sleeve, tip visible on the left
    for x, w, h in [(222, 46, 196), (284, 62, 296), (362, 82, 404)]:
        s += rect(x, cy - h / 2, w, h, min(22, w / 2 - 4))
    s += rect(460, cy - 62, 40, 124, 12)                 # collar
    s += rect(500, cy - 20, 224, 40, 20)                 # shaft, shortened 352 -> 224
    s += knurl(586, 700, cy, 40)
    return s + '</svg>\n'
svg = fit(final(), target=400)
# fit() measures on a 2px grid; nudge by the residual measured at 1px (L112/R109, T218/B215 -> -1.5px each)
import re
svg = re.sub(r'translate\(([-\d.]+) ([-\d.]+)\)', lambda m: f'translate({float(m.group(1)) - 1.5:.1f} {float(m.group(2)) - 1.5:.1f})', svg, count=1)
open(A + 'avatar/avatar-final.svg', 'w', encoding='utf-8').write(svg)
for sz in (144, 512, 1024):
    open(f'/workspace/tmp_design/release/final-{sz}.html', 'w').write(
        f'<!DOCTYPE html><html><head><style>html,body{{margin:0}}img{{display:block;width:{sz}px;height:{sz}px}}</style></head><body><img src="{A}avatar/avatar-final.svg"></body></html>')
prev = '''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>html,body{margin:0}
.s{width:960px;height:540px;background:#F7F7F7;font-family:"Noto Sans CJK SC",sans-serif;display:flex;justify-content:center;gap:72px;align-items:center}
.c{display:flex;flex-direction:column;align-items:center;gap:22px;color:#666;font-size:15px}
.big{width:260px;height:260px;border-radius:50%}
.sq{width:160px;height:160px;border-radius:0}
.chat{display:flex;align-items:center;gap:10px;background:#fff;border-radius:10px;padding:10px 14px;width:170px;box-shadow:0 0 0 1px #E5E5E5}
.chat b{font-size:14px;color:#111}.chat span{display:block;font-size:11px;color:#8C8C8C}
.sm{width:44px;height:44px;border-radius:50%;flex-shrink:0}
.box{height:280px;display:flex;align-items:center}
</style></head><body><div class="s">
<div class="c"><div class="box"><img class="big" src="../avatar/avatar-final.svg"></div><div>大圆裁切（微信内展示）</div></div>
<div class="c"><div class="box"><img class="sq" src="../avatar/avatar-final.svg"></div><div>方形原图（上传用 144×144）</div></div>
<div class="c"><div class="box"><div class="chat"><img class="sm" src="../avatar/avatar-final.svg"><div><b>组迹</b><span>44px 小圆</span></div></div></div><div>44px 小圆（列表 / 聊天）</div></div>
</div></body></html>'''
open(A + 'src/avatar-final-preview.html', 'w', encoding='utf-8').write(prev)
