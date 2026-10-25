# -*- coding: utf-8 -*-
import os
A = '/workspace/fitness-miniapp/design/release-assets/'
CARDS = [
  ('01-calendar', '每一次训练，都留下<em>痕迹</em>', '训练日历上，哪天练过一眼就清楚'),
  ('02-workout-edit', '一组一组，<em>单手</em>就能记', '重量、次数点加减即可，自动保存'),
  ('03-body-chart', '体重变化，<em>一条线</em>看清', '体重、体脂率、腰围，按 30 天 / 90 天看趋势'),
  ('04-exercise-detail', '内置 <em>284</em> 个动作', '目标肌群、器械和动作步骤，一页看完'),
]
CSS = '''html,body{margin:0;padding:0}
.card{position:relative;width:540px;height:960px;background:#FFFFFF;overflow:hidden;font-family:-apple-system,"PingFang SC","Noto Sans CJK SC",sans-serif;color:#111}
.brand{position:absolute;left:48px;top:52px;display:flex;align-items:center;font-size:17px;font-weight:700;letter-spacing:2px}
.brand i{display:inline-block;width:10px;height:10px;border-radius:50%;background:#FF5A1F;margin-right:10px}
.no{position:absolute;right:48px;top:54px;font-size:14px;color:#8C8C8C;letter-spacing:1px}
h1{position:absolute;left:48px;right:48px;top:104px;margin:0;font-size:38px;line-height:1.3;font-weight:700;letter-spacing:1px}
h1 em{font-style:normal;color:#FF5A1F}
.sub{position:absolute;left:48px;right:48px;top:162px;font-size:17px;color:#666;line-height:1.5}
.phone{position:absolute;left:50%;top:236px;width:300px;height:650px;margin-left:-160px;padding:9px;border-radius:46px;border:1.5px solid #E5E5E5;background:#fff}
.phone img{display:block;width:300px;height:650px;border-radius:38px}
.foot{position:absolute;left:0;right:0;bottom:30px;text-align:center;font-size:12px;color:#BBBBBB;letter-spacing:1px}
'''
for i, (shot, h, sub) in enumerate(CARDS):
    html = f'''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="card">
<div class="brand"><i></i>组迹</div><div class="no">0{i+1} / 04</div>
<h1>{h}</h1><div class="sub">{sub}</div>
<div class="phone"><img src="../screens/{shot}.png"></div>
<div class="foot">界面中的数据为示例 · 数据仅保存在本机</div></div></body></html>'''
    open(f'{A}src/card-{shot}.html', 'w', encoding='utf-8').write(html)

# ---- avatars (1024 viewBox; key shapes within the circle crop, r<=430 from center) ----
AV = {
 'avatar-A-barbell': '''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <title>组迹 头像方案 A：杠铃 + 训练日圆点</title>
  <rect width="1024" height="1024" fill="#FFFFFF"/>
  <rect x="232" y="482" width="560" height="44" rx="22" fill="#111111"/>
  <rect x="262" y="372" width="64" height="264" rx="28" fill="#111111"/>
  <rect x="338" y="412" width="44" height="184" rx="22" fill="#111111"/>
  <rect x="698" y="372" width="64" height="264" rx="28" fill="#111111"/>
  <rect x="642" y="412" width="44" height="184" rx="22" fill="#111111"/>
  <circle cx="512" cy="680" r="34" fill="#FF5A1F"/>
</svg>''',
 'avatar-B-sets': '''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <title>组迹 头像方案 B：逐组升高的轨迹</title>
  <rect width="1024" height="1024" fill="#FF5A1F"/>
  <rect x="300" y="560" width="96" height="196" rx="48" fill="#FFFFFF"/>
  <rect x="464" y="448" width="96" height="308" rx="48" fill="#FFFFFF"/>
  <rect x="628" y="336" width="96" height="420" rx="48" fill="#FFFFFF"/>
  <circle cx="348" cy="456" r="34" fill="#FFFFFF"/>
  <circle cx="512" cy="344" r="34" fill="#FFFFFF"/>
</svg>''',
}
for k, svg in AV.items():
    open(f'{A}avatar/{k}.svg', 'w', encoding='utf-8').write(svg + '\n')
    for s in (144, 512, 1024):
        open(f'/workspace/tmp_design/release/{k}-{s}.html', 'w').write(
            f'<!DOCTYPE html><html><head><style>html,body{{margin:0}}img{{display:block;width:{s}px;height:{s}px}}</style></head><body><img src="{A}avatar/{k}.svg"></body></html>')
# circle-crop preview sheet
prev = '''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>html,body{margin:0}
.s{width:960px;height:540px;background:#F7F7F7;font-family:"Noto Sans CJK SC",sans-serif;display:flex;justify-content:center;gap:120px;align-items:center}
.c{display:flex;flex-direction:column;align-items:center;gap:18px;color:#666;font-size:16px}
.row{display:flex;gap:28px;align-items:flex-end}
.big{width:240px;height:240px;border-radius:50%;background:#fff;box-shadow:0 0 0 1px #E5E5E5}
.sq{width:96px;height:96px;border-radius:12px;box-shadow:0 0 0 1px #E5E5E5}
.sm{width:44px;height:44px;border-radius:50%;box-shadow:0 0 0 1px #E5E5E5}
</style></head><body><div class="s">
<div class="c"><img class="big" src="../avatar/avatar-A-barbell.svg"><div class="row"><img class="sq" src="../avatar/avatar-A-barbell.svg"><img class="sm" src="../avatar/avatar-A-barbell.svg"></div><div>方案 A · 杠铃 + 训练日圆点</div></div>
<div class="c"><img class="big" src="../avatar/avatar-B-sets.svg"><div class="row"><img class="sq" src="../avatar/avatar-B-sets.svg"><img class="sm" src="../avatar/avatar-B-sets.svg"></div><div>方案 B · 逐组升高的轨迹</div></div>
</div></body></html>'''
open(f'{A}src/avatar-preview.html', 'w', encoding='utf-8').write(prev)
