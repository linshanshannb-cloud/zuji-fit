# 动作库数据说明（v1）

更新：2026-10-17（UTC+8）。本文的条数、字段、枚举均已对照当日的 `exercises.json`、`exercises.sample.json`、`filters.json` 用脚本核对一致。

## 与 spec/DATA_MODEL.md 的关系
- 本文件说明**动作库数据本身**：来源、筛选、枚举、修改、待校对条目、许可。
- `spec/DATA_MODEL.md` 第 3 节定义 Exercise 实体的字段、类型和校验规则（内置动作只读、自定义动作的规则），以及其他实体（训练、组、身体数据）和存储方式。字段名和枚举值以本目录的数据文件为准，两份文档的字段定义保持一致；如有出入，以数据文件为准，并同时修正两份文档。
- 内置动作随小程序打包，不写入本地存储。

## 文件
| 文件 | 内容 |
|---|---|
| `exercises.json` | 动作库主文件，284 条 |
| `exercises.sample.json` | 10 条样例：是 exercises.json 中 10 条的原样副本，字段完全相同，覆盖 6 个部位（legs 3、arms 2、back 2、chest 1、shoulders 1、core 1） |
| `filters.json` | 枚举值 → 中英文显示名映射：bodyPart 6、bodyPartDetail 8、equipment 13、category 3、muscles 25，附条数；另有一个说明字段 `_note` |
| `LICENSE-openGym` | openGym 仓库 `LICENSE`（GNU AGPL v3.0）原样副本 |
| `DATA_NOTES.md` | 本说明 |

## 来源
- 仓库：openGym，https://github.com/DuarteSantos8/openGym ，commit `e348fc17c42c7e9a211c5972e573ad3698190ee2`（2026-10-13 20:31:16 +0200）
- 动作英文文本：`catalogue/exercises/*.json`
- 中文名、中文步骤：`catalogue/i18n/zh.json`
- 枚举中文显示名：openGym `frontend/src/locales/zh.js`；以下为本次修改或补充：equipment `sled_machine` 由「雪橇」改为「45°腿举机」，`leverage_machine` 由「杠杆器械」改为「固定器械」；category 和 muscles 的中文为手工整理（muscles 参考 zh.js 的肌群译名）。
- 只用了文字数据，没有用任何媒体（原因见文末）。

## 字段（exercises.json / exercises.sample.json）
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | openGym 动作 id（永久编号） |
| `nameZh` | string | 中文名（zh.json，少数按下文修正）；缺中文时填英文名并标记 translationPending（本版没有出现，284 条都有中文名） |
| `nameEn` | string | openGym 英文名（小写，原样） |
| `bodyPart` | enum | 6 大部位：`chest` / `back` / `shoulders` / `legs` / `arms` / `core` |
| `bodyPartDetail` | enum | openGym 原 bodyPart 的 snake_case 值 |
| `target` | enum | 主要目标肌群，取值见 `filters.muscles` |
| `secondary` | enum[] | 次要肌群，取值同样见 `filters.muscles`；同义词已合并、已去重，不含与 target 相同的值，可以为 `[]` |
| `equipment` | enum | 器械（openGym equipment 的 snake_case 值），见 `filters.equipment` |
| `category` | enum | 动作类别：`strength` / `calisthenics` / `isometric` |
| `categoryZh` | string | 类别中文：力量 / 自重训练 / 等长训练 |
| `description` | string | 英文简介原文（zh.json 没有简介翻译，**不自行翻译**） |
| `steps` | string[] | 中文步骤；zh.json 没有时保留英文原文（**不自行翻译**） |
| `translationPending` | boolean | `true` = nameZh 或 steps 缺中文翻译 |
| `untranslatedFields` | string[] | 仍为英文的字段名，取值为 `nameZh` / `steps` / `description`；所有条目都包含 `description` |

显示名统一到 `filters.json` 查：bodyPart / bodyPartDetail / equipment / category 各有同名列表，target 和 secondary 共用 `filters.muscles`。每项格式为 `{value, en, zh, count}`（bodyPart 多一个 `details`），`value` 对应 exercises 里的值。muscles 的 `count` 是把该肌群列为 target 或 secondary 的动作条数（同一条里只算一次）。每个列表的 `count` 都与 exercises.json 的实际统计一致，exercises.json 里出现的每个值都在 filters.json 里有对应项。

## 枚举
共 5 组：bodyPart 6 个、bodyPartDetail 8 个、equipment 13 个、category 3 个、muscles 25 个。

### bodyPart
- `chest` 胸（35），细分：chest
- `back` 背（45），细分：back
- `shoulders` 肩（43），细分：shoulders
- `legs` 腿（73），细分：lower_legs, upper_legs
- `arms` 手臂（46），细分：lower_arms, upper_arms
- `core` 核心（42），细分：waist

下表 `value` 列是数据里实际使用的枚举值（snake_case）；`en` 列是 filters.json 里的英文**显示名**（带空格，只用于显示，不能当枚举值用）。

| 字段 | value（枚举值） | zh | en（英文显示名） | 条数 |
|---|---|---|---|---|
| bodyPartDetail | `back` | 背部 | back | 45 |
| bodyPartDetail | `chest` | 胸部 | chest | 35 |
| bodyPartDetail | `lower_arms` | 前臂 | lower arms | 5 |
| bodyPartDetail | `lower_legs` | 小腿 | lower legs | 8 |
| bodyPartDetail | `shoulders` | 肩部 | shoulders | 43 |
| bodyPartDetail | `upper_arms` | 上臂 | upper arms | 41 |
| bodyPartDetail | `upper_legs` | 大腿 | upper legs | 65 |
| bodyPartDetail | `waist` | 腰腹 | waist | 42 |
| equipment | `band` | 弹力带 | band | 4 |
| equipment | `barbell` | 杠铃 | barbell | 45 |
| equipment | `body_weight` | 自重 | body weight | 52 |
| equipment | `cable` | 绳索 | cable | 53 |
| equipment | `dumbbell` | 哑铃 | dumbbell | 60 |
| equipment | `ez_barbell` | 曲杆杠铃 | ez barbell | 3 |
| equipment | `kettlebell` | 壶铃 | kettlebell | 9 |
| equipment | `leverage_machine` | 固定器械 | leverage machine | 36 |
| equipment | `sled_machine` | 45°腿举机 | sled machine | 1 |
| equipment | `smith_machine` | 史密斯机 | smith machine | 12 |
| equipment | `trap_bar` | 六角杠 | trap bar | 1 |
| equipment | `weighted` | 负重 | weighted | 7 |
| equipment | `wheel_roller` | 健腹轮 | wheel roller | 1 |
| category | `calisthenics` | 自重训练 | calisthenics | 45 |
| category | `isometric` | 等长训练 | isometric | 6 |
| category | `strength` | 力量 | strength | 233 |
| muscles | `chest` | 胸肌 | chest | 47 |
| muscles | `delts` | 三角肌 | delts | 111 |
| muscles | `rear_delts` | 三角肌后束 | rear delts | 11 |
| muscles | `rotator_cuff` | 肩袖 | rotator cuff | 4 |
| muscles | `lats` | 背阔肌 | lats | 28 |
| muscles | `traps` | 斜方肌 | traps | 30 |
| muscles | `upper_back` | 上背部 | upper back | 36 |
| muscles | `rhomboids` | 菱形肌 | rhomboids | 20 |
| muscles | `lower_back` | 下背部（竖脊肌） | lower back | 30 |
| muscles | `biceps` | 肱二头肌 | biceps | 71 |
| muscles | `triceps` | 肱三头肌 | triceps | 69 |
| muscles | `brachialis` | 肱肌 | brachialis | 6 |
| muscles | `forearms` | 前臂（含握力） | forearms | 64 |
| muscles | `abs` | 腹肌 | abs | 42 |
| muscles | `obliques` | 腹斜肌 | obliques | 18 |
| muscles | `core` | 核心 | core | 31 |
| muscles | `hip_flexors` | 髋屈肌 | hip flexors | 22 |
| muscles | `glutes` | 臀肌 | glutes | 70 |
| muscles | `quads` | 股四头肌 | quads | 43 |
| muscles | `hamstrings` | 腘绳肌 | hamstrings | 69 |
| muscles | `adductors` | 髋内收肌 | adductors | 6 |
| muscles | `abductors` | 髋外展肌 | abductors | 1 |
| muscles | `calves` | 小腿肌 | calves | 37 |
| muscles | `soleus` | 比目鱼肌 | soleus | 2 |
| muscles | `ankles` | 脚踝 | ankles | 3 |

## 肌群枚举合并（target / secondary 共用 `filters.muscles`）
openGym 的 target 和 secondaryMuscles 是两套词，里面有同义词。本库把它们合并成一套规范值（共 25 个）：
- 合并后，同一条的 secondary 里重复的值只保留一个；与 target 相同的值从 secondary 里去掉（共影响 6 条：10329、1163、1246、4093、5107、9819）。
- 下表「次数」是本库 exercises.json 中该原值出现的次数（target 和 secondary 合计）。

| openGym 原值 | 规范值 | 次数 |
|---|---|---|
| `lower_abs` | `abs` | 6 |
| `ankle_stabilizers` | `ankles` | 2 |
| `pectorals` | `chest` | 35 |
| `upper_chest` | `chest` | 5 |
| `shoulders` | `delts` | 60 |
| `deltoids` | `delts` | 8 |
| `grip_muscles` | `forearms` | 7 |
| `latissimus_dorsi` | `lats` | 2 |
| `spine` | `lower_back` | 3 |
| `quadriceps` | `quads` | 30 |
| `rear_deltoids` | `rear_delts` | 11 |
| `trapezius` | `traps` | 12 |

其余原值不改名，只转成 snake_case（如 `abs`、`biceps`、`glutes`、`hip_flexors`、`upper_back`）。
保留未合并的：`rear_delts`（三角肌后束，是 `delts` 的子集，保留以便后束训练筛选）、`soleus`（比目鱼肌，没并入 `calves`）、`core`（openGym 原文就是这个泛称）、`upper_back` / `rhomboids` / `traps` 各自独立。

## 条数与分布
总计 **284** 条，id 唯一。

| bodyPart | 条数 |
|---|---|
| chest（胸） | 35 |
| back（背） | 45 |
| shoulders（肩） | 43 |
| legs（腿） | 73 |
| arms（手臂） | 46 |
| core（核心） | 42 |

文本来源：ExerciseDB 原始条目（`textSource: "exercisedb"`）238 条，openGym 自写条目（`textSource: "opengym"`）46 条。
翻译：nameZh 全部有中文；`translationPending: true` 共 **46** 条（中文步骤缺失，steps 为英文）；description 全部为英文原文。

## 筛选规则
1. 排除只是女性形象版本的条目（带 `variantOf`，没有自己的文字）。
2. 只保留 openGym bodyPart 为以下值的条目（这里写成本库的 `bodyPartDetail` 枚举）：`chest`、`back`、`shoulders`、`upper_legs`、`lower_legs`、`upper_arms`、`lower_arms`、`waist`。
3. 人工整理一份常用力量训练动作英文名清单（卧推、飞鸟、划船、引体/下拉、耸肩、推举、平举、面拉、深蹲、硬拉、弓步、腿举/腿屈伸/腿弯举、臀推/臀桥、提踵、弯举、臂屈伸/下压、腕弯举、卷腹、举腿、平板支撑、转体、伐木等，以及它们在杠铃、哑铃、绳索、器械、史密斯机、自重、壶铃上的常见版本），按名字精确匹配。
4. 不选：带括号的拍摄角度或变体名、"v. 2" 重复条目、平衡球/波速球/悬挂带等小众器械版本、体操类高难动作、拉伸/灵活性/增强式/有氧类。
5. 同名多条只取 id 最小的一条；中文名重复的只保留一条（去掉 split squats，保留 split squat）。
6. 优先收中文名和中文步骤都有的条目；少数常用但缺中文步骤的动作也收了，标 translationPending。
7. 部位按 openGym 原 bodyPart 归类，比如杠铃硬拉属于 `upper_legs`，所以归到 `legs`。

## 中文名修正（共 10 条，直接改在 nameZh）
| id | nameEn | openGym 原中文 | 修正后 | 理由 |
|---|---|---|---|---|
| 0739 | sled 45° leg press | 滑车45度腿举 | 45°腿举机腿举 | sled 指 45° 腿举机，「滑车」不准确 |
| 5107 | captains chair leg raise | 罗马椅抬腿 | 竖蹬架抬腿 | captains chair 是竖蹬架/举腿架，不是罗马椅 |
| 2963 | captains chair straight leg raise | 罗马椅直腿抬腿 | 竖蹬架直腿抬腿 | 同上 |
| 0060 | barbell lying triceps extension skull crusher | 杠铃仰卧三头肌伸展(颅骨粉碎者) | 杠铃仰卧臂屈伸（碎颅者） | skull crusher 通行译名为「碎颅者」 |
| 1489 | sissy squat | 西西里深蹲 | 西斯深蹲 | sissy squat 与西西里无关，通行译名「西斯深蹲」 |
| 3193 | glute-ham raise | 臀腿抬升 | 臀腿起身（GHR） | glute-ham raise 通行译名「臀腿起身」 |
| 0550 | kettlebell thruster | 壶铃推进深蹲 | 壶铃深蹲推举 | thruster 是深蹲接推举，「推进」不达意 |
| 0860 | cable kickback | 绳索后踢 | 绳索俯身臂屈伸 | 该动作练肱三头肌，「后踢」易与臀部后踢混淆 |
| 3914 | cable rear delt row | 龙门架后三角肌划船 | 绳索后三角肌划船 | 统一 cable 译为「绳索」 |
| 0377 | dumbbell rear delt row_shoulder | 哑铃后三角肌划船(肩部) | 哑铃后三角肌划船 | 英文名中的 _shoulder 为原数据残留，去掉括号 |

器械显示名修正：`sled_machine` 由「雪橇」改为「45°腿举机」（本库只有 0739 sled 45° leg press 一条用到它）；`leverage_machine` 由「杠杆器械」改为「固定器械」（36 条）。只改了 filters.json 的显示名，枚举值不变。

## 修改清单（2026-10-17，相对 openGym commit e348fc1 的原始数据）
1. 从 openGym 目录中筛选出 284 条（规则见「筛选规则」）。
2. 字段重命名为英文 camelCase（`nameZh`、`nameEn`、`bodyPartDetail`、`secondary`、`steps`、`untranslatedFields` 等），新增 `bodyPart`（6 大部位）、`categoryZh`、`translationPending`、`untranslatedFields`。
3. 枚举值（bodyPartDetail、equipment、肌群）统一转成 snake_case。
4. 肌群同义词合并为 25 个规范值，secondary 去重并去掉与 target 相同的值（6 条受影响）。
5. 修正 10 个中文名（见上表），直接改在 nameZh。
6. 修改两个器械显示名（`sled_machine`、`leverage_machine`），手工整理 category 和 muscles 的中文显示名。
7. 中文名、中文步骤来自 zh.json；description 和缺失的中文步骤保留英文原文，没有自行翻译。
8. 没有使用任何 media。

## 待人工校对
### A. 中文名存疑（未改）
| id | nameEn | 当前 nameZh | 备注 |
|---|---|---|---|
| 1206 | cable pull through | 绳索穿腿拉 | pull through 译「穿腿拉」较生硬，可考虑「绳索胯下后拉」 |
| 1503 | band pull apart | 弹力带拉开 | band pull apart 译「弹力带拉开」，可考虑「弹力带水平拉开」 |
| 0579 | lever front pulldown | 杠杆前向下拉 | lever front pulldown 译「杠杆前向下拉」，实为器械高位下拉 |
| 2289 | lever calf press | 杠杆小腿推举 | lever calf press 译「杠杆小腿推举」，实为腿举机上的提踵 |
| 0044 | barbell good morning | 杠铃早安式体前屈 | good morning 译「早安式体前屈」，通行说法「早安式」 |
| 1246 | hollow hold | 空心支撑 | hollow hold 译「空心支撑」，也常作「空心体支撑」 |
| 0154 | cable cross-over revers fly | 绳索交叉反向飞鸟 | 英文原名 revers 为原数据拼写错误（reverse），未改英文名 |
| 0198 | cable pulldown | 绳索下拉 | cable pulldown 译「绳索下拉」，与高位下拉条目区分不明显 |

### B. 全局译法
- equipment `leverage_machine` 的显示名已改为「固定器械」；但 nameZh 里的 lever 仍沿用 openGym 的「杠杆」（如「杠杆坐姿划船」），要不要把动作名也统一改成「器械」等人工决定。
- 上面修正的中文名也建议再看一遍。

### C. 缺中文步骤（translationPending: true，46 条，steps 为英文原文）
- 10329 哑铃克罗克划船（dumbbell kroc row）
- 1047 绳索窄握前高位下拉（cable close grip front lat pulldown）
- 1204 绳索单臂高位下拉（cable one arm lat pulldown）
- 1503 弹力带拉开（band pull apart）
- 2291 绳索宽握高位下拉（cable wide grip lat pulldown）
- 3896 弹力带坐姿划船（band seated row）
- 6156 壶铃俯身划船（kettlebell bent over row）
- 1162 杠铃站姿军事推举（barbell standing military press）
- 1200 借力推举（push press）
- 2921 派克俯卧撑（pike push up）
- 3914 绳索后三角肌划船（cable rear delt row）
- 5607 弹力带面拉（band face pull）
- 5609 绳索站姿面拉（cable standing face pull）
- 0781 分腿蹲（split squat）
- 1060 杠铃臀推（barbell hip thrust）
- 1206 绳索穿腿拉（cable pull through）
- 1543 杠铃直腿硬拉（barbell stiff legged deadlift）
- 1595 史密斯机前蹲（smith front squat）
- 1597 史密斯机直腿硬拉（smith stiff legged deadlift）
- 2072 臀推（hip thrusts）
- 2146 杠杆臀推（lever hip thrust）
- 2267 杠杆坐姿腿举（lever seated leg press）
- 2290 哑铃保加利亚分腿蹲（dumbbell bulgarian split squat）
- 2471 双腿地面臀桥（glute bridge two legs on floor）
- 3030 杠铃分腿蹲（barbell split squat）
- 3322 壶铃硬拉（kettlebell deadlift）
- 3335 哑铃臀桥（dumbbell glute bridge）
- 3593 杠铃深蹲（barbell squat）
- 3948 徒手深蹲（air squat）
- 4295 哑铃行走弓步蹲（dumbbell walking lunge）
- 7589 绳索跪姿臀部后踢（cable kneeling glute kickback）
- 7746 北欧腘绳肌弯举（nordic hamstring curl）
- 0166 绳索锤式弯举（cable hammer curl）
- 0463 前平板支撑（front plank）
- 0715 侧平板支撑（side plank）
- 1163 仰卧抬腿（lying leg raise）
- 1202 绳索水平帕洛夫推（cable horizontal pallof press）
- 1241 鸟狗式（bird dog）
- 1246 空心支撑（hollow hold）
- 3890 悬垂膝触肘（hanging knees to elbows）
- 4093 靠墙支撑滚轮前推（wheel rollout with wall support）
- 5107 竖蹬架抬腿（captains chair leg raise）
- 6211 自行车卷腹（bicycle crunch）
- 8025 壶铃伐木（kettlebell wood chop）
- 8193 绳索反向伐木（cable reverse woodchop）
- 9819 悬垂屈膝抬腿（hanging knee raise）

### D. description
全部 284 条都是英文原文，按要求不自行翻译。

## 动作示意图（试点）

- **来源**：组迹项目自研极简线稿示意图，与 openGym / Gym visual 的 `catalogue/media` **无关**，未使用、未引用任何 openGym 图片或视频。
- **覆盖**：首期 20 个常见动作，名单见 `data/illustration-pilot-20.md`。
- **字段**：仅这 20 条在 `exercises.json` 写入 `illustration`（相对路径 `assets/exercises/{id}.png`）；其余动作**不写**该字段。
- **资源文件**：`miniprogram/assets/exercises/{id}.png`。
- **缺图**：无 `illustration` 字段或加载失败时，由详情页占位兜底（见 design 规范）。

## 许可（以条款原文为准；是否合规由使用方自行判断）
### 来源许可的事实
- 仓库 `LICENSE`：GNU Affero General Public License v3.0，副本见 `LICENSE-openGym`。
- 仓库 `NOTICE.md` 原文要点：
  - "Entries marked `"textSource": "exercisedb"` ... keep names, muscles and instructions that originate from ExerciseDB v1 by AscendAPI ... under the MIT licence"（MIT 版权行：Copyright (c) 2026 Hasan Emir Yıldırım，全文见 openGym `NOTICE.md`）。
  - "Everything else in the catalogue (the newer exercises, every description, the muscle-map corrections and all translations) was written for openGym and is covered by openGym's AGPL."
  - 版权声明："openGym — Copyright (C) 2026 Duarte Santos."
- 对本库的含义：description、全部中文（nameZh、中文 steps）、以及 46 条 opengym 条目属于 AGPL 部分；exercisedb 条目的英文名、肌群、英文步骤另有 MIT 来源。
- NOTICE.md 里的 "App store exception" 原文只针对 "the openGym mobile application"。

### AGPL-3.0 条款原文摘录与对应义务
1. **署名 / 保留版权声明、附带许可证**（第 4 条）："conspicuously and appropriately publish on each copy an appropriate copyright notice; keep intact all notices stating that this License ... apply to the code; keep intact all notices of the absence of any warranty; and give all recipients a copy of this License along with the Program."
   - 对应：保留 openGym 版权声明（和 exercisedb 部分的 MIT 声明），随数据附 `LICENSE-openGym`。
2. **标注修改**（第 5 条 a、b）："The work must carry prominent notices stating that you modified it, and giving a relevant date." / "...stating that it is released under this License..."
   - 本库相对原始数据做的修改：字段重命名为英文 camelCase、枚举值转为 snake_case、筛选出 284 条、修正 10 个中文名、修改或补充部分枚举中文名、合并肌群同义词（映射见上文）、secondary 去重。修改日期 2026-10-17。
3. **整体按 AGPL 授权**（第 5 条 c）："You must license the entire work, as a whole, under this License to anyone who comes into possession of a copy."
4. **分发时提供源码**（第 6 条）：以非源码形式分发时，须按 6a–6e 其中一种方式同时提供 "Corresponding Source"（例如 6d：在同一地点提供同等的源码获取途径）。
5. **网络交互**（第 13 条）："if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network ... an opportunity to receive the Corresponding Source of your version by providing access to the Corresponding Source from a network server at no charge"。

### 待使用方判断的问题（本文件不作结论）
- 把这份 AGPL 数据内置到小程序或由后端下发，算「聚合」（第 5 条末段 "aggregate"）还是「基于本作品的作品」，会不会让小程序或后端也要按 AGPL 提供源码。
- 第 13 条和第 6 条的义务在小程序这种分发形态下具体怎么履行。
- 是否需要法律意见。

## 为什么不使用 media
openGym `NOTICE.md` 写明：`catalogue/media/` 的图片和动画 "are licensed to openGym by Gym visual. They are not covered by openGym's AGPL and not by any licence of the exercise text"；"Third parties have no rights to reuse, extract, or integrate these media assets into independent apps, websites, or commercial products"；不得热链接或从仓库复制；"may not be used to train, prompt or feed any AI system"。`catalogue/README.md` 也要求不要把 media 复制到别处或输入 AI 工具。
因此本库没有读取、复制或引用任何媒体文件，也没有任何媒体路径字段。配图需要另外解决（自制或向 gymvisual.com 单独购买授权）。

## 文字许可逐条核对（2026-10-19）
详见 `LICENSE_AUDIT.md`：284 条里 238 条是 exercisedb（MIT）条目，46 条是 openGym 新条目（AGPL）。但按 NOTICE，所有翻译（含中文名、中文步骤）和每一条 description 都属于 AGPL，所以现有数据每条都含 AGPL 文字。是否开源由 Shanshan 决定。

2026-10-19 更新：Shanshan 决定 1.0 按 AGPL 公开源码（仓库 `zuji-miniapp`）。版权与 MIT 声明见 `NOTICE-openGym.md`，AGPL 全文见 `LICENSE-openGym`。


## 动作示意视频（试点 24，2026-10-19）

- 名单与映射：`VIDEO_PILOT_24.md`、`../assets/videos/VIDEO_NAME_MAP.json`（以 24 条为准；与原先 `illustration-pilot-20.md` 不完全重合）。
- 字段：仅这 24 条有 `video`（分包路径，如 `packageVideoA/videos/{id}.mp4`）和 `poster`（**主包** `assets/video-posters/{id}.jpg`，约 0.7MB，避免分包未就绪时真机封面空白）；其余条目无这两字段。
- 素材：用户 libtv 会员生成、形象自生成；**未使用** openGym / Gym visual 的 media。接入报告见 `../qa/VIDEO_INTEGRATION_REPORT.md`。
- `exercises.sample.json` 未同步视频字段（示例集可后续再补）。
