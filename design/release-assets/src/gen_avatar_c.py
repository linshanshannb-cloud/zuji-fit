# -*- coding: utf-8 -*-
"""Avatar variants C1-C3: half barbell, orange #FF5A1F bg + white shapes, 1024 viewBox, keep inside circle crop."""
import math
A = '/workspace/fitness-miniapp/design/release-assets/avatar/'
O, W = '#FF5A1F', '#FFFFFF'
def head(title): return f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">\n  <title>{title}</title>\n  <rect width="1024" height="1024" fill="{O}"/>\n'
def rect(x, y, w, h, rx, fill=W, extra=''): return f'  <rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx:.1f}" fill="{fill}"{extra}/>\n'
def knurl(x0, x1, cy, h):  # orange hairline grooves on the grip -> reads as knurled handle, not a bar
    return ''.join(rect(x, cy - h / 2 + 7, 7, h - 14, 3.5, O) for x in range(int(x0), int(x1), 22))

# ---- C1: plates vertically centered on the sleeve ----
def c1():
    cy = 512; s = head('组迹 头像方案 C1：半边杠铃，杠铃片垂直居中、由小到大')
    s += rect(176, cy - 30, 330, 60, 30)                 # sleeve (tip visible at left)
    for x, w, h in [(222, 46, 196), (284, 62, 296), (362, 82, 404)]:
        s += rect(x, cy - h / 2, w, h, min(22, w / 2 - 4))   # plates: thin->thick, short->tall, 16px gaps
    s += rect(460, cy - 62, 40, 124, 12)                 # collar
    s += rect(500, cy - 20, 352, 40, 20)                 # shaft
    s += knurl(612, 812, cy, 40)
    return s + '</svg>\n'

# ---- C2: plates bottom-aligned (节节高) on one floor line; the half-barbell is tipped up 24° like the moment it leaves
# the floor, plates stay perpendicular to the bar. (A strictly upright bottom-aligned version was tried and read as a bar chart.)
def c2():
    th = math.radians(24); phi = -th
    B = 172.0                                           # floor line in the rotated frame (pivot = local origin)
    xs = [(-178, 40), (-118, 60), (-38, 84)]            # plate left x (local), thickness; 20px gaps
    s = head('组迹 头像方案 C2：半边杠铃，杠铃片底部对齐、节节高，整根杆随之上扬')
    s += '  <g transform="rotate(%.2f)">\n' % math.degrees(phi)
    s += rect(-222, -28, 300, 56, 28)                   # sleeve
    for x, w in xs:
        xc = x + w / 2                                   # half-height solved so each plate's lowest corner touches y=B
        hh = (B - xc * math.sin(phi) - (w / 2) * abs(math.sin(phi))) / math.cos(phi)
        s += rect(x, -hh, w, 2 * hh, min(22, w / 2 - 4))
    s += rect(66, -60, 40, 120, 12)                     # collar
    s += rect(106, -19, 330, 38, 19)                    # shaft
    s += knurl(214, 404, 0, 38)
    s += '  </g>\n'
    s += rect(-206, B + 14, 270, 14, 7, W, ' opacity="0.6"')   # floor line right under the plates' lowest corners
    return s + '</svg>\n'

# ---- C3: slight perspective, round plates seen at an angle ----
def c3():
    cy = 512; s = head('组迹 头像方案 C3：半边杠铃，透视的圆形杠铃片，由小到大')
    s += rect(150, cy - 28, 380, 56, 28)                          # sleeve
    # each plate: back face ellipse + body + front face ellipse; orange rim + hub ring on the face
    for cx, ry, t in [(232, 104, 26), (322, 152, 34), (436, 206, 44)]:
        rx = ry * 0.30
        s += f'  <ellipse cx="{cx + t:.1f}" cy="{cy}" rx="{rx:.1f}" ry="{ry}" fill="{W}"/>\n'
        s += f'  <rect x="{cx:.1f}" y="{cy - ry}" width="{t}" height="{2 * ry}" fill="{W}"/>\n'
        s += f'  <ellipse cx="{cx:.1f}" cy="{cy}" rx="{rx + 7:.1f}" ry="{ry + 7}" fill="{O}"/>\n'   # separation outline = gap
        s += f'  <ellipse cx="{cx:.1f}" cy="{cy}" rx="{rx:.1f}" ry="{ry}" fill="{W}"/>\n'
        s += f'  <ellipse cx="{cx:.1f}" cy="{cy}" rx="{rx * 0.62:.1f}" ry="{ry * 0.62:.1f}" fill="none" stroke="{O}" stroke-width="7"/>\n'
        s += f'  <ellipse cx="{cx:.1f}" cy="{cy}" rx="{rx * 0.22 + 6:.1f}" ry="{ry * 0.22 + 6:.1f}" fill="{O}"/>\n'
        s += f'  <ellipse cx="{cx:.1f}" cy="{cy}" rx="{rx * 0.22:.1f}" ry="{ry * 0.22:.1f}" fill="{W}"/>\n'
    s += rect(512, cy - 60, 40, 120, 12)                          # collar
    s += rect(552, cy - 19, 318, 38, 19)                          # shaft
    s += knurl(660, 840, cy, 38)
    return s + '</svg>\n'

import subprocess, re as _re
from PIL import Image
def measure(svg):
    open('/tmp/m.svg', 'w').write(svg)
    open('/tmp/m.html', 'w').write('<html><body style="margin:0"><img src="/tmp/m.svg" style="display:block;width:1024px;height:1024px"></body></html>')
    subprocess.run(['./render.sh', '/tmp/m.html', '/tmp/m.png', '1024', '1024', '1'])
    im = Image.open('/tmp/m.png').convert('RGB'); px = im.load(); P = []
    for y in range(0, 1024, 2):
        for x in range(0, 1024, 2):
            r, g, b = px[x, y]
            if g > 150 and b > 150: P.append((x, y))
    x0 = min(p[0] for p in P); x1 = max(p[0] for p in P); y0 = min(p[1] for p in P); y1 = max(p[1] for p in P)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return cx, cy, max(math.hypot(x - cx, y - cy) for x, y in P)
def fit(svg, target=400):
    i = svg.index('/>', svg.index('<rect width="1024"')) + 3
    body = svg[i:svg.rindex('</svg>')]
    probe = svg[:i] + '  <g transform="translate(512 512)">\n' + body + '  </g>\n</svg>\n' if 'rotate(' in body and 'translate' not in body and body.strip().startswith('<g') else svg
    cx, cy, r = measure(probe)
    k = target / r
    inner = probe[i:probe.rindex('</svg>')]
    return svg[:i] + f'  <g transform="translate({512 - cx * k:.1f} {512 - cy * k:.1f}) scale({k:.4f})">\n' + inner + '  </g>\n</svg>\n'
for k, f in [('avatar-C1-centered', c1), ('avatar-C2-rising', c2), ('avatar-C3-perspective', c3)]:
    open(A + k + '.svg', 'w', encoding='utf-8').write(fit(f()))
    for sz in (144, 512, 1024):
        open(f'/workspace/tmp_design/release/{k}-{sz}.html', 'w').write(
            f'<!DOCTYPE html><html><head><style>html,body{{margin:0}}img{{display:block;width:{sz}px;height:{sz}px}}</style></head><body><img src="{A}{k}.svg"></body></html>')

cols = [('avatar-B-sets', 'B · 原方案（参照）'), ('avatar-C1-centered', 'C1 · 片居中对称'), ('avatar-C2-rising', 'C2 · 底部对齐 节节高'), ('avatar-C3-perspective', 'C3 · 透视圆片')]
prev = '''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>html,body{margin:0}
.s{width:960px;height:540px;background:#F7F7F7;font-family:"Noto Sans CJK SC",sans-serif;display:flex;justify-content:center;gap:44px;align-items:center}
.c{display:flex;flex-direction:column;align-items:center;gap:22px;color:#666;font-size:15px}
.big{width:190px;height:190px;border-radius:50%}
.chat{display:flex;align-items:center;gap:10px;background:#fff;border-radius:10px;padding:10px 14px;width:162px;box-shadow:0 0 0 1px #E5E5E5}
.chat b{font-size:14px;color:#111}.chat span{display:block;font-size:11px;color:#8C8C8C}
.sm{width:44px;height:44px;border-radius:50%;flex-shrink:0}
.ref{}
</style></head><body><div class="s">'''
for k, lab in cols:
    prev += f'<div class="c {"ref" if k.startswith("avatar-B") else ""}"><img class="big" src="../avatar/{k}.svg"><div class="chat"><img class="sm" src="../avatar/{k}.svg"><div><b>组迹</b><span>44px 小圆</span></div></div><div>{lab}</div></div>'
prev += '</div></body></html>'
open('/workspace/fitness-miniapp/design/release-assets/src/avatar-preview-C.html', 'w', encoding='utf-8').write(prev)
