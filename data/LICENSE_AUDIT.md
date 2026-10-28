# 动作文字许可核对（2026-10-19）

依据：openGym `NOTICE.md`「Exercise text」一节、`catalogue/README.md`，openGym commit e348fc1。本文只列事实，是否需要开源由 Shanshan 决定，不构成合规结论。

## NOTICE 原文要点
- `textSource: "exercisedb"` 的条目：英文名称、肌群、英文步骤（instructions）为 MIT。
- 其余全部为 openGym 自有、AGPL-3.0：新条目的全部文字、**每一条 description**、肌群图修正、**所有翻译**（含 zh.json）。

## 统计（共 284 条）
| 字段 | MIT 来源 | AGPL 来源 |
|---|---|---|
| 英文名 nameEn | 238（exercisedb 条目） | 46（openGym 新条目） |
| 部位/肌群/器械 | 238 | 46 |
| 中文名 nameZh | 0 | 284（274 条取自 zh.json，10 条是我们在 zh.json 基础上修正的） |
| 中文步骤 steps | 0 | 284（238 条取自 zh.json；46 条是从 openGym 英文步骤翻译的） |
| 简介 description | 0 | 284（238 条英文原文，其余同样来自 openGym） |

结论（事实层面）：按现在的数据，284 条每条都含 AGPL 文字。要只留 MIT 部分，需要：去掉 description（v1 详情页本来就不展示）；238 条 exercisedb 条目的中文名和中文步骤改为我们自己从 MIT 英文原文翻译；46 条 openGym 新条目整条重写或换掉（其中 6 条在示意图试点里）。

## 46 条 AGPL 来源条目
| id | 中文名 | 部位 | 试点 |
|---|---|---|---|
| 10329 | 哑铃克罗克划船 | back |  |
| 1047 | 绳索窄握前高位下拉 | back |  |
| 1204 | 绳索单臂高位下拉 | back |  |
| 1503 | 弹力带拉开 | back |  |
| 2291 | 绳索宽握高位下拉 | back | 是 |
| 3896 | 弹力带坐姿划船 | back |  |
| 6156 | 壶铃俯身划船 | back |  |
| 1162 | 杠铃站姿军事推举 | shoulders |  |
| 1200 | 借力推举 | shoulders |  |
| 2921 | 派克俯卧撑 | shoulders |  |
| 3914 | 绳索后三角肌划船 | shoulders |  |
| 5607 | 弹力带面拉 | shoulders |  |
| 5609 | 绳索站姿面拉 | shoulders | 是 |
| 0781 | 分腿蹲 | legs |  |
| 1060 | 杠铃臀推 | legs |  |
| 1206 | 绳索穿腿拉 | legs |  |
| 1543 | 杠铃直腿硬拉 | legs |  |
| 1595 | 史密斯机前蹲 | legs |  |
| 1597 | 史密斯机直腿硬拉 | legs |  |
| 2072 | 臀推 | legs |  |
| 2146 | 杠杆臀推 | legs |  |
| 2267 | 杠杆坐姿腿举 | legs |  |
| 2290 | 哑铃保加利亚分腿蹲 | legs | 是 |
| 2471 | 双腿地面臀桥 | legs |  |
| 3030 | 杠铃分腿蹲 | legs |  |
| 3322 | 壶铃硬拉 | legs |  |
| 3335 | 哑铃臀桥 | legs |  |
| 3593 | 杠铃深蹲 | legs | 是 |
| 3948 | 徒手深蹲 | legs |  |
| 4295 | 哑铃行走弓步蹲 | legs |  |
| 7589 | 绳索跪姿臀部后踢 | legs |  |
| 7746 | 北欧腘绳肌弯举 | legs |  |
| 0166 | 绳索锤式弯举 | arms |  |
| 0463 | 前平板支撑 | core | 是 |
| 0715 | 侧平板支撑 | core | 是 |
| 1163 | 仰卧抬腿 | core |  |
| 1202 | 绳索水平帕洛夫推 | core |  |
| 1241 | 鸟狗式 | core |  |
| 1246 | 空心支撑 | core |  |
| 3890 | 悬垂膝触肘 | core |  |
| 4093 | 靠墙支撑滚轮前推 | core |  |
| 5107 | 竖蹬架抬腿 | core |  |
| 6211 | 自行车卷腹 | core |  |
| 8025 | 壶铃伐木 | core |  |
| 8193 | 绳索反向伐木 | core |  |
| 9819 | 悬垂屈膝抬腿 | core |  |

## 238 条 exercisedb（MIT）条目 id
0025, 0033, 0047, 0122, 0151, 0158, 0169, 0171, 0179, 0188, 0227, 0251, 0279, 0289, 0301, 0302, 0308, 0314, 0319, 0324, 0375, 0433, 0493, 0576, 0596, 0662, 0748, 0753, 0757, 0856, 1270, 1299, 1300, 1311, 2144, 0017, 0027, 0095, 0150, 0180, 0198, 0218, 0220, 0238, 0245, 0292, 0293, 0327, 0406, 0489, 0499, 0541, 0572, 0573, 0579, 0581, 0604, 0627, 0652, 0673, 0674, 0818, 0841, 0861, 1313, 1326, 1327, 1350, 1351, 1429, 2285, 3017, 3541, 0041, 0076, 0091, 0120, 0154, 0162, 0178, 0192, 0215, 0219, 0235, 0246, 0310, 0334, 0377, 0378, 0380, 0383, 0392, 0396, 0405, 0426, 0437, 0523, 0550, 0584, 0587, 0602, 0603, 0766, 0774, 0775, 1017, 1700, 2137, 3237, 3542, 0032, 0042, 0043, 0044, 0046, 0054, 0074, 0078, 0085, 0088, 0114, 0117, 0157, 0168, 0228, 0284, 0300, 0336, 0381, 0410, 0413, 0417, 0431, 0432, 0459, 0534, 0549, 0582, 0585, 0586, 0593, 0594, 0597, 0598, 0599, 0605, 0739, 0755, 0760, 0770, 0811, 1372, 1379, 1409, 1410, 1459, 1460, 1476, 1489, 1760, 2133, 2289, 3193, 3281, 0030, 0031, 0038, 0060, 0061, 0070, 0080, 0082, 0092, 0109, 0126, 0195, 0201, 0206, 0207, 0247, 0259, 0283, 0285, 0294, 0297, 0313, 0318, 0333, 0351, 0364, 0372, 0385, 0391, 0420, 0430, 0439, 0446, 0447, 0451, 0575, 0592, 0607, 0814, 0860, 0868, 1399, 1636, 1755, 2188, 0084, 0175, 0212, 0222, 0226, 0243, 0274, 0276, 0277, 0282, 0407, 0472, 0475, 0554, 0600, 0635, 0687, 0689, 0832, 0846, 0871, 0872, 0873, 1452, 2135, 2963, 3419, 3670, 3679


# 动作示意图/动画来源：workout-guide（2026-10-27）

来源：https://github.com/bryllim/workout-guide （克隆 main 最新提交），资产位于 `packages/workout-guide/assets/<slug>/frame-{1,2,3}.png`。

## 授权原文
- README「Licensing」：“Code and documentation are available under the MIT License. Visual assets are licensed under CC BY-SA 4.0.”
- LICENSE-ASSETS：“Workout Guide visual assets are licensed under the Creative Commons Attribution-ShareAlike 4.0 International license (CC BY-SA 4.0). Copyright (c) 2026 Bryl Lim, except where ATTRIBUTION.md identifies an upstream source.”
- ATTRIBUTION.md：“The original pose artwork used by Workout Guide comes from Everkinetic (https://github.com/everkinetic/data), licensed under CC BY-SA 4.0.” manifest.json 每帧记录了 Everkinetic 原始 SVG URL 与修改说明。
- 仓库及 manifest 中未出现 gymvisual / ExerciseDB / 其他商业图库来源（已全文检索）。

## 兼容性说明（事实层面）
- CC BY-SA 4.0 被 Creative Commons 正式列为可单向兼容 GPLv3；AGPL-3.0 不在 CC 官方兼容列表中。因此这些图片/视频**不改授权**，作为独立素材文件以 CC BY-SA 4.0 随组迹分发（聚合），代码仍为 AGPL-3.0。
- 义务：署名（Bryl Lim / Everkinetic）、注明 CC BY-SA 4.0 及链接、注明修改；对这些素材的改编版也须以 CC BY-SA 4.0 发布。许可证全文副本：`data/LICENSE-workout-guide-assets.txt`。
- 待办：关于页增加一行署名 “部分动作示意图来自 Workout Guide（Bryl Lim，基于 Everkinetic），CC BY-SA 4.0”。

## 本次引入
- 修改方式：frame-1 合成白底、缩放到 750×750、二值化为黑白 PNG → `miniprogram/assets/exercises/<id>.png`（仅原本无图的条目）；三帧合成 MP4 → `pending-upload/anim/<id>.mp4`（未上传）。
- 未覆盖任何已有图片/视频（含用户 AI 生成的视频与封面）。

| id | 中文名 | nameEn | workout-guide slug | WG 名称/器械 | 本次补充 | 原有图 |
|---|---|---|---|---|---|---|
| `0033` | 杠铃下斜卧推 | barbell decline bench press | `decline-bench-press` | Decline Bench Press / Barbell | 图+视频 | 无 |
| `0279` | 下斜俯卧撑 | decline push-up | `decline-push-up` | Decline Push-up / Bodyweight | 图+视频 | 无 |
| `0301` | 哑铃下斜卧推 | dumbbell decline bench press | `decline-dumbbell-press` | Decline Dumbbell Press / Dumbbell | 图+视频 | 无 |
| `0662` | 俯卧撑 | push-up | `push-up` | Push-up / Bodyweight | 视频 | 有 |
| `1311` | 宽距俯卧撑 | wide hand push up | `wide-push-up` | Wide Push-up / Bodyweight | 图+视频 | 无 |
| `0027` | 杠铃俯身划船 | barbell bent over row | `barbell-row` | Barbell Row / Barbell | 视频 | 有 |
| `0095` | 杠铃耸肩 | barbell shrug | `shrug` | Barbell Shrug / Barbell | 图+视频 | 无 |
| `0499` | 反向划船 | inverted row | `inverted-row` | Inverted Row / Bodyweight | 图+视频 | 无 |
| `0572` | 杠杆辅助反手引体向上 | lever assisted chin-up | `assisted-chin-up` | Assisted Chin-up / Machine | 图+视频 | 无 |
| `0652` | 引体向上 | pull-up | `pull-up` | Pull-up / Bodyweight | 视频 | 有 |
| `0674` | 反手引体向上 | reverse grip pull-up | `chin-up` | Chin-up / Bodyweight | 图+视频 | 无 |
| `0841` | 负重引体向上 | weighted pull-up | `weighted-pull-up` | Weighted Pull-up / Bodyweight | 图+视频 | 无 |
| `1503` | 弹力带拉开 | band pull apart | `band-pull-apart` | Band Pull-Apart / Resistance Band | 图+视频 | 无 |
| `2291` | 绳索宽握高位下拉 | cable wide grip lat pulldown | `wide-grip-lat-pulldown` | Wide-Grip Lat Pulldown / Cable | 视频 | 有 |
| `3017` | 杠铃潘德勒划船 | barbell pendlay row | `pendlay-row` | Pendlay Row / Barbell | 图+视频 | 无 |
| `3896` | 弹力带坐姿划船 | band seated row | `banded-row` | Banded Row / Resistance Band | 图+视频 | 无 |
| `0120` | 杠铃直立划船 | barbell upright row | `upright-row` | Upright Row / Barbell | 图+视频 | 无 |
| `0162` | 绳索前平举 | cable front raise | `cable-front-raise` | Cable Front Raise / Cable | 图+视频 | 无 |
| `0178` | 绳索侧平举 | cable lateral raise | `cable-lateral-raise` | Cable Lateral Raise / Cable | 图+视频 | 无 |
| `0310` | 哑铃前平举 | dumbbell front raise | `front-raise` | Front Raise / Dumbbell | 图+视频 | 无 |
| `0380` | 哑铃后侧平举 | dumbbell rear lateral raise | `bent-over-rear-delt-raise` | Bent-Over Rear Delt Raise / Dumbbell | 图+视频 | 无 |
| `0383` | 哑铃反向飞鸟 | dumbbell reverse fly | `rear-delt-fly` | Rear Delt Fly / Dumbbell | 图+视频 | 无 |
| `0584` | 杠杆侧平举 | lever lateral raise | `machine-lateral-raise` | Machine Lateral Raise / Machine | 图+视频 | 无 |
| `0587` | 杠杆军事推举 | lever military press | `machine-shoulder-press` | Machine Shoulder Press / Machine | 图+视频 | 无 |
| `1162` | 杠铃站姿军事推举 | barbell standing military press | `overhead-press` | Overhead Press / Barbell | 图+视频 | 无 |
| `1200` | 借力推举 | push press | `push-press` | Push Press / Barbell | 图+视频 | 无 |
| `2921` | 派克俯卧撑 | pike push up | `pike-push-up` | Pike Push-up / Bodyweight | 图+视频 | 无 |
| `5607` | 弹力带面拉 | band face pull | `banded-face-pull` | Banded Face Pull / Resistance Band | 图+视频 | 无 |
| `5609` | 绳索站姿面拉 | cable standing face pull | `face-pull` | Face Pull / Cable | 视频 | 有 |
| `0042` | 杠铃前蹲 | barbell front squat | `front-squat` | Front Squat / Barbell | 图+视频 | 无 |
| `0044` | 杠铃早安式体前屈 | barbell good morning | `good-morning` | Good Morning / Barbell | 图+视频 | 无 |
| `0074` | 杠铃架上拉 | barbell rack pull | `rack-pull` | Rack Pull / Barbell | 图+视频 | 无 |
| `0117` | 杠铃相扑硬拉 | barbell sumo deadlift | `sumo-deadlift` | Sumo Deadlift / Barbell | 图+视频 | 无 |
| `0284` | 驴式提踵 | donkey calf raise | `donkey-calf-raise` | Donkey Calf Raise / Machine | 图+视频 | 无 |
| `0381` | 哑铃后撤弓步蹲 | dumbbell rear lunge | `reverse-lunge` | Reverse Lunge / Dumbbell | 图+视频 | 无 |
| `0410` | 哑铃单腿分腿蹲 | dumbbell single leg split squat | `split-squat` | Split Squat / Dumbbell | 图+视频 | 无 |
| `0459` | 交替打水腿 | flutter kicks | `flutter-kick` | Flutter Kick / Bodyweight | 图+视频 | 无 |
| `0549` | 壶铃摆荡 | kettlebell swing | `kettlebell-swing` | Kettlebell Swing / Kettlebell | 图+视频 | 无 |
| `0593` | 杠杆反向挺身 | lever reverse hyperextension | `reverse-hyperextension` | Reverse Hyperextension / Machine | 图+视频 | 无 |
| `0594` | 杠杆坐姿提踵 | lever seated calf raise | `seated-calf-raise` | Seated Calf Raise / Machine | 图+视频 | 无 |
| `0598` | 杠杆坐姿髋内收 | lever seated hip adduction | `hip-adduction-machine` | Hip Adduction Machine / Machine | 图+视频 | 无 |
| `0605` | 杠杆站姿提踵 | lever standing calf raise | `standing-calf-raise` | Standing Calf Raise / Machine | 图+视频 | 无 |
| `0770` | 史密斯机深蹲 | smith squat | `smith-machine-squat` | Smith Machine Squat / Machine | 图+视频 | 无 |
| `0811` | 六角杠硬拉 | trap bar deadlift | `trap-bar-deadlift` | Trap Bar Deadlift / Barbell | 图+视频 | 无 |
| `1206` | 绳索穿腿拉 | cable pull through | `cable-pull-through` | Cable Pull-Through / Cable | 图+视频 | 无 |
| `1489` | 西斯深蹲 | sissy squat | `sissy-squat` | Sissy Squat / Bodyweight | 图+视频 | 无 |
| `2133` | 农夫行走 | farmers walk | `farmer-carry` | Farmer Carry / Dumbbell | 图+视频 | 无 |
| `2267` | 杠杆坐姿腿举 | lever seated leg press | `leg-press` | Leg Press / Machine | 图+视频 | 无 |
| `2290` | 哑铃保加利亚分腿蹲 | dumbbell bulgarian split squat | `bulgarian-split-squat` | Bulgarian Split Squat / Dumbbell | 视频 | 有 |
| `3335` | 哑铃臀桥 | dumbbell glute bridge | `dumbbell-glute-bridge` | Dumbbell Glute Bridge / Dumbbell | 图+视频 | 无 |
| `4295` | 哑铃行走弓步蹲 | dumbbell walking lunge | `walking-lunge` | Walking Lunge / Dumbbell | 图+视频 | 无 |
| `7589` | 绳索跪姿臀部后踢 | cable kneeling glute kickback | `cable-kickback` | Cable Kickback / Cable | 图+视频 | 无 |
| `7746` | 北欧腘绳肌弯举 | nordic hamstring curl | `nordic-hamstring-curl` | Nordic Hamstring Curl / Bodyweight | 图+视频 | 无 |
| `0030` | 杠铃窄握卧推 | barbell close-grip bench press | `close-grip-bench-press` | Close-Grip Bench Press / Barbell | 图+视频 | 无 |
| `0038` | 杠铃拖曳弯举 | barbell drag curl | `drag-curl` | Drag Curl / Barbell | 图+视频 | 无 |
| `0060` | 杠铃仰卧臂屈伸（碎颅者） | barbell lying triceps extension skull crusher | `skull-crusher` | Skull Crusher / Barbell | 图+视频 | 无 |
| `0080` | 杠铃反握弯举 | barbell reverse curl | `reverse-curl` | Reverse Curl / Barbell | 图+视频 | 无 |
| `0126` | 杠铃腕弯举 | barbell wrist curl | `wrist-curl` | Wrist Curl / Barbell | 图+视频 | 无 |
| `0166` | 绳索锤式弯举 | cable hammer curl | `rope-hammer-curl` | Rope Hammer Curl / Cable | 图+视频 | 无 |
| `0201` | 绳索下压 | cable pushdown | `tricep-pushdown` | Tricep Pushdown / Cable | 视频 | 有 |
| `0283` | 钻石俯卧撑 | diamond push-up | `diamond-push-up` | Diamond Push-up / Bodyweight | 图+视频 | 无 |
| `0297` | 哑铃集中弯举 | dumbbell concentration curl | `concentration-curl` | Concentration Curl / Dumbbell | 图+视频 | 无 |
| `0318` | 哑铃上斜弯举 | dumbbell incline curl | `incline-dumbbell-curl` | Incline Dumbbell Curl / Dumbbell | 图+视频 | 无 |
| `0333` | 哑铃俯身臂屈伸 | dumbbell kickback | `tricep-kickback` | Tricep Kickback / Dumbbell | 图+视频 | 无 |
| `0385` | 哑铃反握腕弯举 | dumbbell reverse wrist curl | `wrist-extension` | Wrist Extension / Dumbbell | 图+视频 | 无 |
| `0592` | 杠杆牧师凳弯举 | lever preacher curl | `preacher-curl` | Preacher Curl / Machine | 图+视频 | 无 |
| `0868` | 绳索弯举 | cable curl | `cable-curl` | Cable Curl / Cable | 图+视频 | 无 |
| `1399` | 地面凳上臂屈伸 | bench dip on floor | `bench-dip` | Bench Dip / Bodyweight | 图+视频 | 无 |
| `1755` | 负重三头肌臂屈伸 | weighted tricep dips | `weighted-dip` | Weighted Dip / Bodyweight | 图+视频 | 无 |
| `0175` | 绳索跪姿卷腹 | cable kneeling crunch | `cable-crunch` | Cable Crunch / Cable | 图+视频 | 无 |
| `0274` | 地面卷腹 | crunch floor | `crunch` | Crunch / Bodyweight | 视频 | 有 |
| `0282` | 下斜仰卧起坐 | decline sit-up | `decline-sit-up` | Decline Sit-Up / Bench | 图+视频 | 无 |
| `0407` | 哑铃侧弯 | dumbbell side bend | `dumbbell-side-bend` | Dumbbell Side Bend / Dumbbell | 图+视频 | 无 |
| `0463` | 前平板支撑 | front plank | `plank` | Plank / Bodyweight | 视频 | 有 |
| `0472` | 悬垂抬腿 | hanging leg raise | `hanging-leg-raise` | Hanging Leg Raise / Bodyweight | 图+视频 | 无 |
| `0715` | 侧平板支撑 | side plank | `side-plank` | Side Plank / Bodyweight | 视频 | 有 |
| `0832` | 负重卷腹 | weighted crunch | `weighted-crunch` | Weighted Crunch / Plate | 图+视频 | 无 |
| `0846` | 负重俄罗斯转体 | weighted russian twist | `weighted-russian-twist` | Weighted Russian Twist / Dumbbell | 图+视频 | 无 |
| `0872` | 反向卷腹 | reverse crunch | `reverse-crunch` | Reverse Crunch / Bodyweight | 图+视频 | 无 |
| `1202` | 绳索水平帕洛夫推 | cable horizontal pallof press | `pallof-press` | Pallof Press / Cable | 图+视频 | 无 |
| `1241` | 鸟狗式 | bird dog | `bird-dog` | Bird Dog / Bodyweight | 图+视频 | 无 |
| `1246` | 空心支撑 | hollow hold | `hollow-body-hold` | Hollow Body Hold / Bodyweight | 图+视频 | 无 |
| `3419` | 地面L型支撑 | l-sit on floor | `l-sit-hold` | L-Sit Hold / Bodyweight | 图+视频 | 无 |

## 待人工确认（未引入）
| id | 中文名 | 候选 slug | 原因 |
|---|---|---|---|
| `0043` | 杠铃全蹲 | `squat` | WG Squat 未区分全蹲/普通深蹲；且 3593 杠铃深蹲已有视频 |
| `0046` | 杠铃哈克深蹲 | `hack-squat` | WG 为器械哈克深蹲，组迹为杠铃版 |
| `0573` | 杠杆背部伸展 | `back-extension` | WG 为自重/罗马椅版本，组迹为杠杆器械 |
| `0534` | 壶铃高脚杯深蹲 | `goblet-squat` | WG 为哑铃高脚杯深蹲 |
| `0781` | 分腿蹲 | `split-squat` | WG 为哑铃版 |
| `1460` | 行走弓步蹲 | `walking-lunge` | WG 为哑铃版（已给 4295 哑铃行走弓步蹲） |
| `1476` | 单腿深蹲 | `pistol-squat` | 单腿深蹲≈手枪蹲，但未必同一动作 |
| `2072` | 臀推 | `glute-bridge / hip-thrust` | WG hip-thrust 为杠铃；自重臀推近似臀桥 |
| `1327` | 窄握反握引体向上 | `chin-up` | 握距不同 |
| `0082` | 杠铃反握腕弯举 | `wrist-extension` | WG 为哑铃版 |
| `0061` | 杠铃仰卧三头肌伸展 | `skull-crusher` | 与 0060 碎颅者几乎同一动作，已给 0060 |
| `0446` | EZ杠铃窄握弯举 | `ez-bar-curl` | 握距未注明 |
| `0031` | 杠铃弯举 | `ez-bar-curl / bicep-curl` | WG bicep-curl 为哑铃；仅缺视频 |
| `0523` | 壶铃阿诺德推举 | `arnold-press` | WG 为哑铃 |
| `0084` | 杠铃滚轮前推 | `ab-wheel` | 器械不同（杠铃 vs 健腹轮） |
| `4093` | 靠墙支撑滚轮前推 | `ab-wheel` | 靠墙辅助变式 |
| `3890` | 悬垂膝触肘 | `hanging-knee-raise` | 幅度不同 |
| `5107` | 竖蹬架抬腿 | `captains-chair-knee-raise` | 抬腿 vs 抬膝 |
| `2963` | 竖蹬架直腿抬腿 | `captains-chair-knee-raise` | 直腿 vs 屈膝 |
| `8025` | 壶铃伐木 | `cable-woodchop` | 器械不同 |
| `8193` | 绳索反向伐木 | `cable-woodchop` | 方向相反 |


### 追加批次（2026-10-28）
以下 7 个动作同样采用 workout-guide 素材（CC BY-SA 4.0，改作：二值化/缩放/交叉淡化成 5s 循环视频），视频在 anim-upload/，示意图在 miniprogram/assets/exercises/：

- 0171 绳索上斜飞鸟 → incline-cable-fly
- 1047 绳索窄握前高位下拉 → close-grip-lat-pulldown
- 0150 绳索杠高位下拉 → lat-pulldown
- 1350 杠杆坐姿划船 → machine-row
- 0168 绳索髋内收 → cable-standing-hip-adduction
- 0351 哑铃仰卧三头肌伸展 → dumbbell-skull-crusher
- 0431 哑铃踏阶 → step-up


### 近似素材批次（2026-10-28，62 个）
以下动作采用 workout-guide 中形态相近（器械/握法/姿势略有不同）的素材，CC BY-SA 4.0，改作：二值化/缩放/三帧交叉淡化成 5s 循环视频。均为近似素材，视频在 anim-upload/，示意图（400px）在 miniprogram/assets/exercises/（已有图的动作未改图）：

- 0122 杠铃宽握卧推 → bench-press (新增图)
- 0188 绳索中位飞鸟 → cable-fly (新增图)
- 0541 壶铃单臂划船 → one-arm-dumbbell-row (新增图)
- 6156 壶铃俯身划船 → dumbbell-bent-over-row (新增图)
- 10329 哑铃克罗克划船 → one-arm-dumbbell-row (新增图)
- 0573 杠杆背部伸展 → back-extension (新增图)
- 0627 混合握引体向上 → pull-up (新增图)
- 1327 窄握反握引体向上 → chin-up (新增图)
- 1429 宽握引体向上 → pull-up (新增图)
- 0041 杠铃前平举 → front-raise (新增图)
- 0392 哑铃坐姿前平举 → front-raise (新增图)
- 0091 杠铃坐姿过头推举 → overhead-press (新增图)
- 0154 绳索交叉反向飞鸟 → cable-rear-delt-fly (新增图)
- 0215 绳索坐姿后侧平举 → cable-rear-delt-fly (新增图)
- 0192 绳索单臂侧平举 → cable-lateral-raise (新增图)
- 0396 哑铃坐姿侧平举 → lateral-raise (新增图)
- 0377 哑铃后三角肌划船 → bent-over-rear-delt-raise (新增图)
- 1700 哑铃借力推举 → push-press (新增图)
- 0523 壶铃阿诺德推举 → arnold-press (新增图)
- 0043 杠铃全蹲 → squat (新增图)
- 0046 杠铃哈克深蹲 → hack-squat (新增图)
- 0054 杠铃弓步蹲 → forward-lunge (新增图)
- 0078 杠铃后撤弓步蹲 → reverse-lunge (新增图)
- 0114 杠铃踏阶 → step-up (新增图)
- 0432 哑铃直腿硬拉 → dumbbell-romanian-deadlift (新增图)
- 1543 杠铃直腿硬拉 → romanian-deadlift (新增图)
- 0534 壶铃高脚杯深蹲 → goblet-squat (新增图)
- 0781 分腿蹲 → split-squat (新增图)
- 1460 行走弓步蹲 → walking-lunge (新增图)
- 1476 单腿深蹲 → pistol-squat (新增图)
- 2072 臀推 → hip-thrust (新增图)
- 3030 杠铃分腿蹲 → split-squat (新增图)
- 0417 哑铃站姿提踵 → calf-raise (新增图)
- 1372 杠铃站姿提踵 → standing-calf-raise (新增图)
- 1379 哑铃坐姿提踵 → seated-calf-raise (新增图)
- 0088 杠铃坐姿提踵 → seated-calf-raise (新增图)
- 1410 杠铃侧弓步蹲 → lateral-lunge (新增图)
- 0031 杠铃弯举 → ez-bar-curl (已有图)
- 0061 杠铃仰卧三头肌伸展 → skull-crusher (新增图)
- 0082 杠铃反握腕弯举 → wrist-extension (新增图)
- 0446 EZ杠铃窄握弯举 → ez-bar-curl (新增图)
- 0451 EZ杠铃反握弯举 → reverse-curl (新增图)
- 0195 绳索牧师凳弯举 → preacher-curl (新增图)
- 0372 哑铃牧师凳弯举 → preacher-curl (新增图)
- 0206 绳索反握弯举 → reverse-curl (新增图)
- 0391 哑铃坐姿弯举 → bicep-curl (新增图)
- 0364 哑铃单臂腕弯举 → wrist-curl (新增图)
- 0092 杠铃坐姿过头三头肌伸展 → overhead-tricep-extension (新增图)
- 0109 杠铃站姿过头三头肌伸展 → overhead-tricep-extension (新增图)
- 0420 哑铃站姿俯身臂屈伸 → tricep-kickback (新增图)
- 0084 杠铃滚轮前推 → ab-wheel (新增图)
- 4093 靠墙支撑滚轮前推 → ab-wheel (新增图)
- 0212 绳索坐姿卷腹 → cable-crunch (新增图)
- 0226 绳索站姿卷腹 → cable-crunch (新增图)
- 0475 悬垂直腿抬腿 → hanging-leg-raise (新增图)
- 3890 悬垂膝触肘 → hanging-knee-raise (新增图)
- 2135 负重前平板支撑 → plank (新增图)
- 2963 竖蹬架直腿抬腿 → captains-chair-knee-raise (新增图)
- 5107 竖蹬架抬腿 → captains-chair-knee-raise (新增图)
- 3670 负重下斜仰卧起坐 → decline-sit-up (新增图)
- 8025 壶铃伐木 → cable-woodchop (新增图)
- 8193 绳索反向伐木 → cable-woodchop (新增图)


### 替换设计师火柴人线稿（2026-10-28）
用户反馈试点 20 张「极简设计师」自绘几何火柴人线稿（来源脚本 assets/illustrations-work/draw_pilot20.py，规范 design/ILLUSTRATION.md，名单 data/illustration-pilot-20.md）不好看，已全部替换：
- 11 个换成 workout-guide 线稿（CC BY-SA 4.0，改作：二值化/缩放至 400px）：0662 俯卧撑→push-up，0652 引体向上→pull-up，0027 杠铃俯身划船→barbell-row，2291 绳索宽握高位下拉→wide-grip-lat-pulldown，5609 绳索站姿面拉→face-pull，2290 哑铃保加利亚分腿蹲→bulgarian-split-squat，0031 杠铃弯举→ez-bar-curl（近似），0201 绳索下压→tricep-pushdown，0274 地面卷腹→crunch，0463 前平板支撑→plank，0715 侧平板支撑→side-plank。
- 9 个已有用户 AI 真人封面（poster），删除火柴人 illustration 字段和 PNG，直接用 AI 图：0025、0289、0308、0861、0405、0334、3593、0085、0739。
- 旧火柴人 PNG 备份在 /workspace/stickfigure-backup/png/（不入包）。
