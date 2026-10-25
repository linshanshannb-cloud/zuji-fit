# 动作示意图试点名单（20）

用途：组迹小程序动作示意图试点。仅列出下列 20 条；示意图 bot 不得使用 openGym media。

| # | id | nameZh | nameEn | bodyPart | equipment |
|---|-----|--------|--------|----------|-----------|
| 1 | `0025` | 杠铃卧推 | barbell bench press | chest | barbell |
| 2 | `0289` | 哑铃卧推 | dumbbell bench press | chest | dumbbell |
| 3 | `0662` | 俯卧撑 | push-up | chest | body_weight |
| 4 | `0308` | 哑铃飞鸟 | dumbbell fly | chest | dumbbell |
| 5 | `0652` | 引体向上 | pull-up | back | body_weight |
| 6 | `0027` | 杠铃俯身划船 | barbell bent over row | back | barbell |
| 7 | `2291` | 绳索宽握高位下拉 | cable wide grip lat pulldown | back | cable |
| 8 | `0861` | 绳索坐姿划船 | cable seated row | back | cable |
| 9 | `0405` | 哑铃坐姿肩部推举 | dumbbell seated shoulder press | shoulders | dumbbell |
| 10 | `0334` | 哑铃侧平举 | dumbbell lateral raise | shoulders | dumbbell |
| 11 | `5609` | 绳索站姿面拉 | cable standing face pull | shoulders | cable |
| 12 | `3593` | 杠铃深蹲 | barbell squat | legs | barbell |
| 13 | `2290` | 哑铃保加利亚分腿蹲 | dumbbell bulgarian split squat | legs | dumbbell |
| 14 | `0085` | 杠铃罗马尼亚硬拉 | barbell romanian deadlift | legs | barbell |
| 15 | `0739` | 45°腿举机腿举 | sled 45° leg press | legs | sled_machine |
| 16 | `0031` | 杠铃弯举 | barbell curl | arms | barbell |
| 17 | `0201` | 绳索下压 | cable pushdown | arms | cable |
| 18 | `0274` | 地面卷腹 | crunch floor | core | body_weight |
| 19 | `0463` | 前平板支撑 | front plank | core | body_weight |
| 20 | `0715` | 侧平板支撑 | side plank | core | body_weight |

## 部位覆盖

- chest: 4
- back: 4
- shoulders: 3
- legs: 4
- arms: 2
- core: 3

## 说明

- 挑选标准：健身房最常见、初中级友好、器械主流。
- 挂图前保持纯文字；挂图后由动作库管家写入图片字段（方案待 Jarvis / 设计师定）。
- 未入选的 264 条继续无图，详情页用现有文字占位。

## 图片字段方案草案（未写入 exercises.json）

待 Jarvis / 设计师确认后再改正式数据与 DATA_MODEL。

### 字段
| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `illustration` | string \| null | 否 | `null` | 示意图相对路径；无图为 `null`（不要用空字符串） |

### 路径约定
- 文件放在小程序侧建议：`miniprogramassets/exercises/{id}.png`（或 `.webp`，由设计师定格式与尺寸）
- `exercises.json` 里存相对路径，例如：`assets/exercises/0025.png`
- 命名必须用动作 `id`，与本名单 id 一一对应，避免挂错

### 行为
- 284 条里未试点的保持 `illustration: null`（或暂不写该字段，接入时统一补 `null`）
- 详情页：有路径则显示图；`null` / 加载失败走设计师定的缺图占位
- **禁止**任何 openGym `catalogue/media` 路径或热链接

### 包体
- 试点 20 张可进主包或 illustrations 分包；全量 284 需分包/CDN（由 Jarvis 定）

### 下一步（管家）
1. 等 `design/` 示意图规范定尺寸与格式
2. 示意图 bot 交付 20 张并通过抽检
3. 再写入 `exercises.json` / sample / DATA_NOTES / DATA_MODEL，并同步本机与共享目录
