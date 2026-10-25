#!/usr/bin/env python3
"""Generate 20 minimalist geometric stick-figure exercise illustrations."""
from PIL import Image, ImageDraw
import os
import math

OUT = "/workspace/fitness-miniapp/miniprogram/assets/exercises"
SIZE = 750
MARGIN = int(SIZE * 0.10)  # 10% > 8%
LINE = 4  # stroke visual weight
COLOR = (0x11, 0x11, 0x11)
WHITE = (255, 255, 255)
os.makedirs(OUT, exist_ok=True)

def new_canvas():
    img = Image.new("RGB", (SIZE, SIZE), WHITE)
    draw = ImageDraw.Draw(img)
    return img, draw

def line(d, a, b, w=LINE):
    d.line([a, b], fill=COLOR, width=w)

def circle(d, c, r, w=LINE, fill=None):
    x, y = c
    d.ellipse([x-r, y-r, x+r, y+r], outline=COLOR, width=w, fill=fill)

def rect(d, xy, w=LINE):
    d.rectangle(xy, outline=COLOR, width=w)

def poly(d, pts, w=LINE):
    d.line(pts + [pts[0]], fill=COLOR, width=w)

def dashed_line(d, a, b, dash=10, gap=8, w=LINE):
    x1, y1 = a; x2, y2 = b
    dx, dy = x2-x1, y2-y1
    length = math.hypot(dx, dy) or 1
    ux, uy = dx/length, dy/length
    t = 0
    while t < length:
        t2 = min(t + dash, length)
        line(d, (x1+ux*t, y1+uy*t), (x1+ux*t2, y1+uy*t2), w)
        t = t2 + gap

def barbell(d, cx, cy, half=90, plate_r=22, w=LINE):
    line(d, (cx-half, cy), (cx+half, cy), w)
    for sx in (-1, 1):
        px = cx + sx * (half - 8)
        circle(d, (px, cy), plate_r, w)
        circle(d, (px, cy), plate_r-8, w)

def dumbbell(d, cx, cy, half=18, plate_r=12, w=LINE):
    line(d, (cx-half, cy), (cx+half, cy), w)
    circle(d, (cx-half, cy), plate_r, w)
    circle(d, (cx+half, cy), plate_r, w)

def stick_joint(d, p, r=5):
    circle(d, p, r, 2, fill=WHITE)

def save(img, eid):
    path = os.path.join(OUT, f"{eid}.png")
    # palette for small size
    img_p = img.convert("P", palette=Image.ADAPTIVE, colors=4)
    img_p.save(path, format="PNG", optimize=True, compress_level=9)
    sz = os.path.getsize(path)
    if sz > 40*1024:
        img_p = img.convert("P", palette=Image.ADAPTIVE, colors=2)
        img_p.save(path, format="PNG", optimize=True, compress_level=9)
        sz = os.path.getsize(path)
    return path, sz

# ---------- exercises ----------

def draw_0025():
    """Barbell bench press - 3/4 side"""
    img, d = new_canvas()
    # bench
    bx, by = 200, 420
    rect(d, [bx, by, 560, by+40])
    line(d, (bx+40, by+40), (bx+20, 560))
    line(d, (bx+20, 560), (bx+60, 560))
    line(d, (520, by+40), (540, 560))
    line(d, (540, 560), (500, 560))
    # body supine
    head = (480, 380)
    shoulder = (420, 400)
    hip = (280, 410)
    knee = (250, 500)
    ankle = (220, 560)
    circle(d, head, 28)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    # arms up holding bar
    elbow_l, elbow_r = (360, 300), (480, 300)
    hand_l, hand_r = (340, 220), (500, 220)
    line(d, shoulder, elbow_l); line(d, elbow_l, hand_l)
    line(d, (shoulder[0]+30, shoulder[1]), elbow_r); line(d, elbow_r, hand_r)
    barbell(d, 420, 210, half=100, plate_r=24)
    stick_joint(d, hand_l); stick_joint(d, hand_r)
    return save(img, "0025")

def draw_0289():
    """Dumbbell bench press"""
    img, d = new_canvas()
    bx, by = 200, 420
    rect(d, [bx, by, 560, by+40])
    line(d, (bx+40, by+40), (bx+20, 560))
    line(d, (bx+20, 560), (bx+60, 560))
    line(d, (520, by+40), (540, 560))
    line(d, (540, 560), (500, 560))
    head = (480, 380)
    shoulder = (420, 400)
    hip = (280, 410)
    knee = (250, 500)
    ankle = (220, 560)
    circle(d, head, 28)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    hand_l, hand_r = (340, 220), (500, 220)
    elbow_l, elbow_r = (360, 310), (480, 310)
    line(d, shoulder, elbow_l); line(d, elbow_l, hand_l)
    line(d, (shoulder[0]+30, shoulder[1]), elbow_r); line(d, elbow_r, hand_r)
    dumbbell(d, 340, 210)
    dumbbell(d, 500, 210)
    return save(img, "0289")

def draw_0662():
    """Push-up side view mid"""
    img, d = new_canvas()
    # ground hint light - skip per no scene; just pose
    head = (180, 320)
    shoulder = (250, 340)
    hip = (430, 350)
    ankle = (580, 360)
    elbow = (230, 420)
    hand = (250, 500)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, ankle)
    line(d, shoulder, elbow)
    line(d, elbow, hand)
    # other arm hint
    line(d, (shoulder[0]+15, shoulder[1]+5), (245, 500), 3)
    circle(d, hand, 8)
    circle(d, ankle, 8)
    return save(img, "0662")

def draw_0308():
    """Dumbbell fly open bottom"""
    img, d = new_canvas()
    bx, by = 220, 400
    rect(d, [bx, by, 540, by+36])
    line(d, (bx+30, by+36), (bx+10, 540))
    line(d, (bx+10, 540), (bx+50, 540))
    line(d, (510, by+36), (530, 540))
    line(d, (530, 540), (490, 540))
    head = (460, 360)
    shoulder = (400, 385)
    hip = (280, 395)
    knee = (250, 490)
    ankle = (230, 550)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    # arms open wide
    hand_l, hand_r = (220, 320), (580, 320)
    elbow_l, elbow_r = (280, 360), (520, 360)
    line(d, shoulder, elbow_l); line(d, elbow_l, hand_l)
    line(d, (shoulder[0]+40, shoulder[1]), elbow_r); line(d, elbow_r, hand_r)
    dumbbell(d, 210, 310)
    dumbbell(d, 590, 310)
    return save(img, "0308")

def draw_0652():
    """Pull-up mid"""
    img, d = new_canvas()
    # bar
    line(d, (150, 160), (600, 160), 5)
    line(d, (150, 160), (150, 200), 3)
    line(d, (600, 160), (600, 200), 3)
    hand_l, hand_r = (250, 160), (500, 160)
    elbow_l, elbow_r = (270, 250), (480, 250)
    shoulder = (375, 280)
    hip = (375, 420)
    knee = (400, 500)
    ankle = (380, 560)
    head = (375, 220)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    line(d, hand_l, elbow_l); line(d, elbow_l, shoulder)
    line(d, hand_r, elbow_r); line(d, elbow_r, shoulder)
    circle(d, hand_l, 7); circle(d, hand_r, 7)
    return save(img, "0652")

def draw_0027():
    """Barbell bent-over row side"""
    img, d = new_canvas()
    head = (480, 220)
    shoulder = (420, 280)
    hip = (380, 420)
    knee = (400, 520)
    ankle = (360, 580)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    # other leg
    line(d, hip, (340, 520)); line(d, (340, 520), (300, 580))
    elbow = (340, 340)
    hand = (300, 380)
    line(d, shoulder, elbow); line(d, elbow, hand)
    line(d, (shoulder[0]-10, shoulder[1]+10), (290, 390), 3)
    barbell(d, 300, 400, half=80, plate_r=20)
    return save(img, "0027")

def draw_2291():
    """Wide grip lat pulldown front 3/4"""
    img, d = new_canvas()
    # machine frame
    line(d, (375, 80), (375, 200), 4)
    line(d, (280, 100), (470, 100), 3)
    circle(d, (375, 100), 10)
    # seat
    rect(d, [300, 480, 450, 510])
    line(d, (320, 510), (310, 580))
    line(d, (430, 510), (440, 580))
    # figure seated
    head = (375, 280)
    shoulder = (375, 340)
    hip = (375, 480)
    knee_l, knee_r = (320, 540), (430, 540)
    ankle_l, ankle_r = (300, 580), (450, 580)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee_l); line(d, knee_l, ankle_l)
    line(d, hip, knee_r); line(d, knee_r, ankle_r)
    # wide bar at chest
    bar_y = 320
    line(d, (200, bar_y), (550, bar_y), 4)
    hand_l, hand_r = (230, bar_y), (520, bar_y)
    elbow_l, elbow_r = (260, 380), (490, 380)
    line(d, hand_l, elbow_l); line(d, elbow_l, (shoulder[0]-30, shoulder[1]))
    line(d, hand_r, elbow_r); line(d, elbow_r, (shoulder[0]+30, shoulder[1]))
    dashed_line(d, (230, bar_y), (375, 110))
    dashed_line(d, (520, bar_y), (375, 110))
    return save(img, "2291")

def draw_0861():
    """Seated cable row side"""
    img, d = new_canvas()
    # cable stack simplified
    rect(d, [520, 120, 600, 400])
    for y in range(150, 380, 25):
        line(d, (525, y), (595, y), 2)
    circle(d, (560, 120), 12)
    # bench
    rect(d, [180, 420, 380, 450])
    line(d, (200, 450), (190, 560))
    line(d, (360, 450), (370, 560))
    # figure
    head = (280, 250)
    shoulder = (300, 310)
    hip = (280, 420)
    knee = (380, 480)
    ankle = (450, 520)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    elbow = (380, 340)
    hand = (420, 360)
    line(d, shoulder, elbow); line(d, elbow, hand)
    # handle
    rect(d, [410, 350, 450, 375])
    dashed_line(d, (450, 360), (560, 130))
    return save(img, "0861")

def draw_0405():
    """Seated DB shoulder press"""
    img, d = new_canvas()
    # bench with back
    rect(d, [280, 480, 470, 510])
    line(d, (300, 510), (290, 580))
    line(d, (450, 510), (460, 580))
    line(d, (300, 300), (300, 480), 4)  # backrest
    line(d, (300, 300), (320, 300), 3)
    head = (375, 220)
    shoulder = (375, 300)
    hip = (375, 480)
    knee_l, knee_r = (320, 540), (430, 540)
    ankle_l, ankle_r = (310, 580), (440, 580)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee_l); line(d, knee_l, ankle_l)
    line(d, hip, knee_r); line(d, knee_r, ankle_r)
    hand_l, hand_r = (280, 160), (470, 160)
    elbow_l, elbow_r = (260, 250), (490, 250)
    line(d, (shoulder[0]-25, shoulder[1]), elbow_l); line(d, elbow_l, hand_l)
    line(d, (shoulder[0]+25, shoulder[1]), elbow_r); line(d, elbow_r, hand_r)
    dumbbell(d, 280, 145)
    dumbbell(d, 470, 145)
    return save(img, "0405")

def draw_0334():
    """DB lateral raise front"""
    img, d = new_canvas()
    head = (375, 160)
    shoulder = (375, 230)
    hip = (375, 400)
    knee_l, knee_r = (340, 500), (410, 500)
    ankle_l, ankle_r = (330, 580), (420, 580)
    circle(d, head, 28)
    line(d, head, shoulder)
    # torso as simple line/box
    line(d, (shoulder[0]-20, shoulder[1]), (hip[0]-20, hip[1]))
    line(d, (shoulder[0]+20, shoulder[1]), (hip[0]+20, hip[1]))
    line(d, (shoulder[0]-20, shoulder[1]), (shoulder[0]+20, shoulder[1]))
    line(d, (hip[0]-20, hip[1]), (hip[0]+20, hip[1]))
    line(d, hip, knee_l); line(d, knee_l, ankle_l)
    line(d, hip, knee_r); line(d, knee_r, ankle_r)
    hand_l, hand_r = (180, 240), (570, 240)
    line(d, (shoulder[0]-20, shoulder[1]), hand_l)
    line(d, (shoulder[0]+20, shoulder[1]), hand_r)
    dumbbell(d, 160, 240)
    dumbbell(d, 590, 240)
    return save(img, "0334")

def draw_5609():
    """Standing cable face pull 3/4"""
    img, d = new_canvas()
    # pulley post left
    line(d, (120, 100), (120, 560), 4)
    circle(d, (120, 200), 12)
    head = (400, 180)
    shoulder = (400, 250)
    hip = (400, 420)
    knee = (400, 510)
    ankle = (400, 580)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    line(d, hip, (370, 510)); line(d, (370, 510), (360, 580))
    # elbows high, hands by face
    elbow_l, elbow_r = (320, 220), (480, 220)
    hand_l, hand_r = (350, 190), (450, 190)
    line(d, (shoulder[0]-20, shoulder[1]), elbow_l); line(d, elbow_l, hand_l)
    line(d, (shoulder[0]+20, shoulder[1]), elbow_r); line(d, elbow_r, hand_r)
    # rope V
    line(d, hand_l, (300, 230)); line(d, hand_r, (300, 230))
    dashed_line(d, (300, 230), (120, 200))
    return save(img, "5609")

def draw_3593():
    """Barbell squat side bottom"""
    img, d = new_canvas()
    head = (420, 200)
    shoulder = (400, 270)
    hip = (380, 400)
    knee = (450, 480)
    ankle = (400, 560)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    # other leg
    line(d, hip, (340, 480)); line(d, (340, 480), (320, 560))
    # arms holding bar on back
    line(d, shoulder, (360, 300)); line(d, (360, 300), (340, 290))
    barbell(d, 400, 260, half=95, plate_r=22)
    return save(img, "3593")

def draw_2290():
    """Bulgarian split squat - front leg RIGHT"""
    img, d = new_canvas()
    # rear bench LEFT
    rect(d, [100, 380, 220, 410])
    line(d, (120, 410), (110, 500))
    line(d, (200, 410), (210, 500))
    # figure facing right, front leg on right
    head = (380, 180)
    shoulder = (380, 250)
    hip = (370, 380)
    # rear foot on bench (left)
    rear_knee = (250, 360)
    rear_ankle = (180, 390)
    # front leg right
    front_knee = (480, 450)
    front_ankle = (500, 560)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, rear_knee); line(d, rear_knee, rear_ankle)
    line(d, hip, front_knee); line(d, front_knee, front_ankle)
    # dumbbells at sides
    hand_l, hand_r = (340, 400), (420, 400)
    line(d, (shoulder[0]-20, shoulder[1]), hand_l)
    line(d, (shoulder[0]+20, shoulder[1]), hand_r)
    dumbbell(d, 340, 420)
    dumbbell(d, 420, 420)
    return save(img, "2290")

def draw_0085():
    """RDL side"""
    img, d = new_canvas()
    head = (480, 200)
    shoulder = (440, 270)
    hip = (400, 400)
    knee = (410, 500)
    ankle = (400, 580)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    line(d, hip, (360, 500)); line(d, (360, 500), (350, 580))
    hand = (380, 480)
    line(d, shoulder, hand)
    line(d, (shoulder[0]-15, shoulder[1]+10), (370, 485), 3)
    barbell(d, 380, 500, half=85, plate_r=20)
    return save(img, "0085")

def draw_0739():
    """45 deg leg press side"""
    img, d = new_canvas()
    # machine frame angled
    # base
    line(d, (120, 560), (600, 560), 4)
    # angled rails ~45
    line(d, (180, 520), (480, 220), 4)
    line(d, (220, 560), (520, 260), 4)
    # seat/backrest
    line(d, (200, 400), (320, 480), 5)
    line(d, (200, 400), (160, 460), 4)
    # footplate
    line(d, (450, 240), (520, 310), 5)
    line(d, (450, 240), (480, 210), 3)
    # figure reclined
    head = (180, 380)
    shoulder = (220, 420)
    hip = (300, 470)
    knee = (400, 400)
    ankle = (470, 280)
    circle(d, head, 24)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    # arms holding handles
    line(d, shoulder, (250, 460))
    return save(img, "0739")

def draw_0031():
    """Barbell curl side mid"""
    img, d = new_canvas()
    head = (400, 140)
    shoulder = (400, 210)
    hip = (400, 400)
    knee = (400, 500)
    ankle = (400, 580)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    line(d, hip, (370, 500)); line(d, (370, 500), (360, 580))
    elbow = (380, 300)
    hand = (320, 280)
    line(d, shoulder, elbow); line(d, elbow, hand)
    line(d, (shoulder[0]-10, shoulder[1]+5), (310, 290), 3)
    barbell(d, 310, 270, half=75, plate_r=18)
    return save(img, "0031")

def draw_0201():
    """Cable pushdown side"""
    img, d = new_canvas()
    line(d, (200, 100), (550, 100), 3)
    circle(d, (375, 100), 12)
    head = (420, 200)
    shoulder = (400, 270)
    hip = (400, 420)
    knee = (400, 510)
    ankle = (400, 580)
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    elbow = (360, 320)
    hand = (340, 400)
    line(d, shoulder, elbow); line(d, elbow, hand)
    # straight bar
    line(d, (300, 400), (380, 400), 4)
    dashed_line(d, (340, 400), (375, 112))
    return save(img, "0201")

def draw_0274():
    """Floor crunch - large clear side profile, scapula off floor."""
    img, d = new_canvas()
    GRAY = (0xCC, 0xCC, 0xCC)
    floor_y = 580
    d.line([(50, floor_y), (700, floor_y)], fill=GRAY, width=2)
    hip = (360, floor_y - 8)
    knee = (520, 320)
    ankle = (620, floor_y - 8)
    shoulder = (200, 300)
    head = (110, 210)
    elbow = (170, 240)
    hand = (120, 200)
    line(d, (ankle[0]-28, floor_y), (ankle[0]+35, floor_y), LINE+1)
    knee2, ankle2 = (500, 340), (600, floor_y - 8)
    circle(d, head, 36)
    line(d, (head[0]+34, head[1]+12), shoulder)
    line(d, shoulder, hip)
    line(d, hip, knee)
    line(d, knee, ankle)
    line(d, hip, knee2, 4)
    line(d, knee2, ankle2, 4)
    line(d, (ankle2[0]-20, floor_y), (ankle2[0]+20, floor_y), 4)
    line(d, shoulder, elbow)
    line(d, elbow, hand)
    circle(d, hand, 8)
    elbow_b, hand_b = (230, 230), (160, 195)
    line(d, shoulder, elbow_b, 4)
    line(d, elbow_b, hand_b, 4)
    circle(d, hand_b, 7)
    for pt, r in ((shoulder, 8), (hip, 8), (knee, 8), (ankle, 6)):
        stick_joint(d, pt, r)
    return save(img, "0274")

def draw_0463():
    """Front forearm plank side"""
    img, d = new_canvas()
    head = (160, 300)
    shoulder = (230, 320)
    hip = (430, 330)
    ankle = (580, 340)
    elbow = (230, 400)
    hand = (280, 400)  # forearm flat
    circle(d, head, 26)
    line(d, head, shoulder)
    line(d, shoulder, hip)
    line(d, hip, ankle)
    line(d, shoulder, elbow)
    line(d, elbow, hand)  # forearm on floor
    circle(d, ankle, 8)
    # other forearm hint
    line(d, (shoulder[0]+10, shoulder[1]+5), (240, 400), 3)
    line(d, (240, 400), (290, 400), 3)
    return save(img, "0463")

def draw_0715():
    """Side plank - chest toward viewer, hip high, free arm UP, one forearm support."""
    img, d = new_canvas()
    GRAY = (0xCC, 0xCC, 0xCC)
    d.line([(60, 620), (690, 620)], fill=GRAY, width=2)
    circle(d, (120, 618), 14)
    circle(d, (120, 575), 14)
    line(d, (120, 618), (120, 575), 4)
    hip, shoulder = (320, 340), (500, 340)
    head = (600, 300)
    beam_h = 70
    bot_l = (hip[0]-30, hip[1]+beam_h//2)
    bot_r = (shoulder[0]+10, shoulder[1]+beam_h//2)
    top_l = (hip[0]-30, hip[1]-beam_h//2)
    top_r = (shoulder[0]+10, shoulder[1]-beam_h//2)
    line(d, bot_l, bot_r); line(d, top_l, top_r)
    line(d, bot_l, top_l); line(d, bot_r, top_r)
    line(d, ((bot_l[0]+top_l[0])//2, (bot_l[1]+top_l[1])//2),
         ((bot_r[0]+top_r[0])//2, (bot_r[1]+top_r[1])//2), 2)
    ankle_j = (160, 520)
    line(d, bot_l, ankle_j)
    line(d, ankle_j, (120, 575))
    line(d, top_l, (180, 500), 3)
    line(d, top_r, (head[0]-30, head[1]+5))
    circle(d, head, 32)
    elbow, hand = (510, 618), (595, 618)
    line(d, bot_r, elbow)
    line(d, elbow, hand, LINE+2)
    stick_joint(d, elbow, 8)
    circle(d, hand, 10)
    up = (505, 120)
    line(d, top_r, up, LINE+2)
    circle(d, up, 10)
    stick_joint(d, hip, 7)
    stick_joint(d, shoulder, 7)
    return save(img, "0715")

FUNCS = [
    draw_0025, draw_0289, draw_0662, draw_0308, draw_0652,
    draw_0027, draw_2291, draw_0861, draw_0405, draw_0334,
    draw_5609, draw_3593, draw_2290, draw_0085, draw_0739,
    draw_0031, draw_0201, draw_0274, draw_0463, draw_0715,
]

if __name__ == "__main__":
    results = []
    for f in FUNCS:
        path, sz = f()
        results.append((os.path.basename(path), sz))
    for name, sz in results:
        print(f"{name}\t{sz}\t{'OK' if sz<=40960 else 'TOO BIG'}")
    print("count", len(results))
    print("all_ok", all(s<=40960 for _,s in results))
