# 数据模型（DATA_MODEL）· 健身小程序 v1

- 版本：schemaVersion **1**
- 日期：2026-10-17（UTC+8）
- 适用范围：微信原生小程序，纯本地存储（`wx.setStorageSync` / `wx.getStorageSync`），无云开发、无服务端
- 字段命名：全部用英文 camelCase
- 单位：重量一律 **kg**，围度一律 **cm**，体脂一律 **%**。v1 不支持 lb/in 切换；以后要支持，也只在显示层换算，存储值不变（借鉴 openGym，见第 11 节）

---

## 1. 通用约定

| 项 | 约定 |
|---|---|
| id | 字符串，格式为「前缀 + `Date.now().toString(36)` + 自增计数（base36，防止同一毫秒重复） + 随机 base36」（`utils/repo/ids.js` 的 `newId`）。前缀：`w_` Workout、`we_` WorkoutExercise、`s_` WorkoutSet、`b_` BodyMeasurement、`c_` 自定义动作。内置动作沿用动作库的 id（如 `"0025"`），不加前缀。 |
| 日期 `date` | 字符串 `YYYY-MM-DD`，按**用户本地时区**生成，不能用 `toISOString()`（那是 UTC，北京时间早上 8 点前会算成前一天）。正则：`^\d{4}-\d{2}-\d{2}$`，且必须是真实存在的日期。 |
| 时间戳 | number，毫秒（`Date.now()`）。字段名以 `At` 结尾。 |
| 可选值 | 可选字段统一存 `null`，不能存 `undefined`、空串或 0（`setStorage` 存 JSON，`undefined` 的键会丢失）。 |
| 文本 | `note`、`name` 存之前先 `trim()`；去空格后为空串的存 `""`（`note`）或按各自规则处理。 |
| 小数 | 重量、围度、体脂保留 1 位小数：`Math.round(x * 10) / 10`。 |
| 未知字段 | 读取时保留不认识的字段，不删除（方便不同 schema 版本共存）。 |
| 引用完整性 | 外键指向的记录不存在时，界面显示「未知动作」等占位，**不能报错，也不能删掉这条数据**。 |

---

## 2. 实体关系

```
Exercise (内置: data/exercises.json，只读；自定义: fit_custom_exercises)
   ▲ exerciseId (N:1)
   │
Workout 1 ──< WorkoutExercise 1 ──< WorkoutSet
 (workoutId)        (workoutExerciseId)

BodyMeasurement（独立实体，每个 date 最多一条）
```

- 一个 Workout 有 0..N 个 WorkoutExercise，按 `order` 排序。
- 一个 WorkoutExercise 有 0..N 个 WorkoutSet，按 `index` 排序。
- WorkoutExercise.exerciseId 指向内置动作或自定义动作，同一个 Workout 里可以重复引用同一个动作。
- 删除 Workout 时，级联删除它的 WorkoutExercise 和 WorkoutSet；删除 WorkoutExercise 时，级联删除它的 WorkoutSet。

---

## 3. Exercise（动作）

### 3.1 内置动作（只读）

来源：`/workspace/fitness-miniapp/data/exercises.json`（数组），构建时打包进小程序，**不写入 storage**。字段名统一用下表的英文 camelCase，与 `data/exercises.json`、`data/exercises.sample.json` 一致。

| 字段 | 类型 | 必填 | 说明 / 校验 |
|---|---|---|---|
| `id` | string | ✓ | openGym 动作编号，例如 `"0025"`，永久不变，全库唯一 |
| `nameZh` | string | ✓ | 中文名，非空 |
| `nameEn` | string | ✓ | 英文名（openGym 原名，小写） |
| `bodyPart` | enum string | ✓ | 稳定英文枚举：`chest` `back` `shoulders` `legs` `arms` `core`；中英显示名查 `data/filters.json` 的 `bodyPart` |
| `bodyPartDetail` | enum string | ✓ | 细分部位，snake_case 英文枚举（来自 openGym 原 bodyPart）：`back` `chest` `lower_arms` `lower_legs` `shoulders` `upper_arms` `upper_legs` `waist`；中英显示名查 `filters.json` 的 `bodyPartDetail`（如 `upper_arms` → 上臂）。以 filters.json 为准，代码里不要写死。 |
| `target` | enum string | ✓ | 主要目标肌群。规范 snake_case 肌群枚举（与 `secondary` 共用一套），取值和中英显示名查 `data/filters.json` 的 `muscles`，例如 `chest` `lats` `delts` `quads` `glutes`。openGym 的同义词已合并（如 pectorals→chest、latissimus_dorsi→lats、trapezius→traps、deltoids/shoulders→delts、quadriceps→quads），映射表见 data/DATA_NOTES.md。以 filters.json 为准，代码里不要写死。 |
| `secondary` | enum string[] | ✓ | 次要肌群，取值同样来自 `filters.json` 的 `muscles`；已去重，不含与 `target` 相同的值；可以是 `[]` |
| `equipment` | enum string | ✓ | 稳定 snake_case 英文枚举，目前有 `band` `barbell` `body_weight` `cable` `dumbbell` `ez_barbell` `kettlebell` `leverage_machine`（显示为「固定器械」） `sled_machine`（显示为「45°腿举机」） `smith_machine` `trap_bar` `weighted` `wheel_roller`；中英显示名查 `filters.json` 的 `equipment`。以 filters.json 为准，代码里不要写死。 |
| `category` | enum string | ✓ | `strength` / `calisthenics` / `isometric`（与 `filters.json` 的 `category` 一致） |
| `categoryZh` | string | ✓ | 力量 / 自重训练 / 等长训练 |
| `description` | string | ✓ | 简介，**目前全部是英文原文** |
| `steps` | string[] | ✓ | 步骤；没有中文的保留英文 |
| `translationPending` | boolean | ✓ | `true` 表示中文名或步骤缺翻译 |
| `untranslatedFields` | string[] | ✓ | 仍是英文的字段名，例如 `["description"]` 或 `["steps","description"]` |

不包含任何图片或视频字段（openGym media 不得使用，见 data/DATA_NOTES.md）。

示例（`data/exercises.json` 中的一条，`description` 原文略）：
```json
{
  "id": "0294", "nameZh": "哑铃二头弯举", "nameEn": "dumbbell biceps curl",
  "bodyPart": "arms", "bodyPartDetail": "upper_arms", "target": "biceps", "secondary": ["forearms"],
  "equipment": "dumbbell", "category": "strength", "categoryZh": "力量",
  "description": "The standard standing dumbbell biceps curl. …",
  "steps": ["站直，双手各握一个哑铃，手掌朝前，双臂完全伸展。", "…"],
  "translationPending": false, "untranslatedFields": ["description"]
}
```

### 3.2 自定义动作（可选功能，v1 可以不做）

存储 key：`fit_custom_exercises`，值是数组。字段集合与内置动作**相同**，再加以下字段：

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `id` | string | ✓ | — | `c_` 前缀，不能和内置 id 冲突 |
| `custom` | boolean | ✓ | `true` | 固定为 `true`，用来区分内置动作 |
| `nameZh` | string | ✓ | — | 1–30 字，trim 后不能为空；同名可以存，但要提示用户 |
| `nameEn` | string | | `""` | |
| `bodyPart` | enum | ✓ | — | 必须是 6 个枚举之一 |
| `equipment` | enum | | `"body_weight"` | 必须是 filters.json `equipment` 里的值 |
| `category` | enum | | `"strength"` | |
| `categoryZh` | string | | 由 category 推出 | |
| `bodyPartDetail` / `target` | string | | `""` | 非空时必须是 filters.json 里的值（`target` 查 `muscles`），否则 `INVALID_BODY_PART_DETAIL` / `INVALID_MUSCLE` |
| `secondary` / `steps` / `untranslatedFields` | string[] | | `[]` | `secondary` 的元素必须是 filters.json `muscles` 里的值，否则 `INVALID_MUSCLE` |
| `description` | string | | `""` | ≤ 500 字 |
| `translationPending` | boolean | | `false` | |
| `archived` | boolean | ✓ | `false` | 软删除标记，见下文 |
| `createdAt` / `updatedAt` | number | ✓ | 当前时间 | |

- 动作列表排序：自定义动作排在内置动作前面。
- 删除：如果有 WorkoutExercise 引用这个动作，只设置 `archived: true`（在动作库里隐藏，历史记录照常显示）；没有引用才真正删除。
- 归档的动作**不能再加入或替换进训练**（`ARCHIVED_EXERCISE`），但已有训练里照常显示。
- 其他校验错误码：`NAME_REQUIRED`、`INVALID_BODY_PART`、`INVALID_EQUIPMENT`、`INVALID_CATEGORY`；与已有动作同名时仍保存，返回 `warning: 'DUPLICATE_NAME'`。
- v1 不提供自定义动作的界面，只在数据层支持。
- 读取时修复：`fit_custom_exercises` 里缺少 `custom` 的条目自动补成 `true`，不改它的 `updatedAt`。

---

## 4. Workout（训练）

| 字段 | 类型 | 必填 | 可空 | 默认 | 校验 |
|---|---|---|---|---|---|
| `id` | string | ✓ | | `w_…` | 唯一 |
| `status` | enum | ✓ | | `"draft"` | 只能是 `draft` / `completed` |
| `date` | string | ✓ | | 今天 | `YYYY-MM-DD`；不能晚于今天（补录过去的训练可以） |
| `name` | string | ✓ | | `""` | ≤ 30 字；为空时界面显示「M月D日训练」，不写回存储 |
| `note` | string | ✓ | | `""` | ≤ 500 字 |
| `startedAt` | number | | ✓ | `null` | 开始计时的时刻 = 新建（内存）草稿的时刻，日期为今天时才有；补录过去日期时为 `null`。第一次写入存储时**沿用内存里的值**，不改成写入时刻 |
| `completedAt` | number | | ✓ | `null` | `status = completed` 时必填，否则必须为 `null` |
| `createdAt` | number | ✓ | | 新建时刻 | 草稿取新建（内存）时刻，与 `startedAt` 一致；第一次写入存储时不改 |
| `updatedAt` | number | ✓ | | 当前时间 | 每次修改 Workout 本身或它的子记录时都更新 |
| `exerciseCount` | number | ✓ | | `0` | **派生缓存**：WorkoutExercise 条数 |
| `setCount` | number | ✓ | | `0` | **派生缓存**：已完成的正式组数（`done && type === 'normal'`） |
| `volumeKg` | number | ✓ | | `0` | **派生缓存**：Σ weightKg × reps，只算已完成的正式组，保留 1 位小数 |

规则：
1. **草稿延迟写入**：新建草稿时只在内存里生成 Workout 头（id、`status: "draft"`、date、name、note、`startedAt`、`createdAt` 都已确定），**不写 storage**。**第一次加入动作**时，才把头和详情一起写入（先详情 key、后 `fit_workouts`，见第 8 节）。
   - 加入第一个动作之前改 date / name / note，只改内存里的头，随第一次写入一起落盘。
   - 加入动作之前离开页面或小程序被关闭，内存草稿直接丢弃（页面 `onUnload` 调用 `discardPending()`），存储里不留空草稿。
   - 新建时如果已经带上动作（`createDraft({ exerciseIds })`），立即写入。
   - 写入之后再删光所有动作，草稿**不会**自动删除，仍保存在存储里，要用户主动「放弃」（`discardDraft`）才删除。
   - 动作库「加入当前训练」（`addToCurrentDraft`）且没有已写入的草稿时：新建今天的草稿并立即加入动作，所以会马上写入。
2. **同一时间最多只有一个 `draft`**，指**已写入存储**的草稿（`fit_workouts` 里最多一条 `status: "draft"`）。新建时如果存储里已有草稿，返回 `DRAFT_EXISTS`，提示用户「继续 / 放弃」；内存草稿同一时间也只允许一个（由当前页面持有）。
3. 状态流转：只有 `draft → completed`（`completeWorkout`，只接受草稿，否则 `NOT_DRAFT`）。**已完成的训练编辑后仍保持 `completed`**：改日期/名称/备注（`updateWorkout`）、增删动作、调整顺序、增删改组、勾选或取消勾选，都不改变 `status` 和 `completedAt`，只更新 `updatedAt` 和派生字段。v1 不允许从 completed 退回 draft。
   - 编辑已完成训练时**不会再次执行**第 4 条的完成清理：取消勾选或删除动作后，训练可能出现没有已完成组的动作，甚至 0 个动作，仍然是 `completed`。
   - 「完成编辑」（`finalizeWorkout`）对已完成训练只检查至少还有一个已完成的组（正式组或热身组均可），不满足时返回 `NO_DONE_SETS` 阻止离开编辑；不清理、不改 `completedAt`。
4. 完成时（草稿必须已写入存储，即至少加过一个动作）：
   - 删除所有「没有任何 `done === true` 的组」的 WorkoutExercise（以及它的组）。
   - 删除之后如果一个 WorkoutExercise 都不剩，就不允许完成，提示「至少完成一组」。
   - 没打勾的组**保留**，但不计入统计。
   - 设置 `completedAt`，重新计算三个派生字段。
5. 派生字段只是为了日历/列表不用读详情，任何时候都可以从详情重新算出来，以重算结果为准。
6. 日历、历史、统计只读 `status === 'completed'` 的训练。日历打点（`completedDates`）只计**至少有一个动作**的已完成训练；0 个动作的已完成训练（例如 v0 迁移来的空训练）仍保存、仍出现在列表里，但不点亮日期。
7. 新建草稿时，如果日期是今天，`startedAt` 默认等于新建时刻；补录过去日期时默认 `null`（`createDraft({ startTimer })` 可以覆盖）。草稿写入存储时 `startedAt` 不变。

## 5. WorkoutExercise（训练中的动作）

| 字段 | 类型 | 必填 | 可空 | 默认 | 校验 |
|---|---|---|---|---|---|
| `id` | string | ✓ | | `we_…` | 唯一 |
| `workoutId` | string | ✓ | | — | 必须指向存在的 Workout |
| `exerciseId` | string | ✓ | | — | 内置或自定义动作 id。添加或替换时必须是已存在且未归档的动作（否则 `UNKNOWN_EXERCISE` / `ARCHIVED_EXERCISE`）；以后找不到时显示占位（`nameZh → nameSnapshot → 未知动作`），不能删除 |
| `order` | integer | ✓ | | 末位 | 从 0 开始，同一 Workout 内连续且不重复（增删、拖动后重排成 0..n-1） |
| `note` | string | ✓ | | `""` | ≤ 200 字，只属于这一次训练的这个动作 |
| `nameSnapshot` | string | ✓ | | 添加时的 `nameZh` | 添加（或替换）动作时记下的中文名，动作被删除或改名后历史记录仍能显示 |

加入动作时自动带 **1 个空组**（`weightKg` / `reps` 为 `null`，`type: "normal"`，`done: false`）。替换动作（`replaceExercise`）保留原有的组，只更新 `exerciseId` 和 `nameSnapshot`。

## 6. WorkoutSet（组）

| 字段 | 类型 | 必填 | 可空 | 默认 | 校验 |
|---|---|---|---|---|---|
| `id` | string | ✓ | | `s_…` | 唯一 |
| `workoutExerciseId` | string | ✓ | | — | 必须指向存在的 WorkoutExercise |
| `index` | integer | ✓ | | 末位 | 从 1 开始，同一个 WorkoutExercise 内连续（删除后重排） |
| `weightKg` | number | ✓ | ✓ | 上一组的值，没有就是 `null` | `null` 或 0–999.9，保留 1 位小数，否则 `INVALID_WEIGHT`；自重动作可以是 `null` 或 0 |
| `reps` | integer | ✓ | ✓ | 上一组的值，没有就是 `null` | `null` 或 0–999 的整数，否则 `INVALID_REPS` |
| `type` | enum | ✓ | | `"normal"` | 只能是 `normal` / `warmup`（否则 `INVALID_TYPE`）；新增组不复制上一组的类型，除非显式传入，一律 `normal`；「复制一组」保留原类型 |
| `done` | boolean | ✓ | | `false`（补录训练见下） | 打勾时 `reps` 必须 ≥ 1，否则不让勾；已勾选的组修改后也必须保持 `reps` ≥ 1（`REPS_REQUIRED`）。补录训练（`startedAt == null`）里新增或复制的组，`reps` ≥ 1 时默认 `done: true` |
| `doneAt` | number | | ✓ | `null` | 打勾时写入当前时间，取消勾选时改回 `null` |

统计口径：
- 容量（volume）= Σ (weightKg ?? 0) × reps，只算 `done === true && type === 'normal'` 的组。
- 热身组（warmup）不计入容量、组数和个人最佳（PR）。
- 等长动作（`category = isometric`，例如平板支撑）v1 仍然用 reps 记录（可以理解为秒数或次数），不另加计时字段。

## 7. BodyMeasurement（身体数据）

| 字段 | 类型 | 必填 | 可空 | 默认 | 校验 |
|---|---|---|---|---|---|
| `id` | string | ✓ | | `b_…` | 唯一 |
| `date` | string | ✓ | | 今天 | `YYYY-MM-DD`，不能晚于今天；**每个 date 最多一条** |
| `weightKg` | number | ✓ | ✗（见例外） | — | **必填**，0 < x ≤ 700，1 位小数。唯一例外：从 v0 迁移来的、原本没有有效体重的记录可以是 `null`（见 9.2，已确认）；新写入的记录不允许 `null` |
| `bodyFatPct` | number | ✓ | ✓ | `null` | **选填**：`null` 或 0 < x ≤ 100，1 位小数 |
| `waistCm` | number | ✓ | ✓ | `null` | **选填**：`null` 或 0 < x ≤ 300，1 位小数 |
| `note` | string | ✓ | | `""` | ≤ 200 字 |
| `extra` | object \| null | ✓ | ✓ | `null` | 从 v0 迁移时保留 v1 没有的围度字段，例如 `{ "chestCm": 98 }`；v1 界面不展示，`saveBody` / `updateBody` 不修改它 |
| `createdAt` / `updatedAt` | number | ✓ | | 当前时间 | |

规则：
1. 数值字段只能是范围内的数（1 位小数）或 `null`（`weightKg` 只有 v0 迁移记录可以是 `null`）。**体重必填，体脂、腰围选填。**
   - **非法输入一律报错，不会当作留空**：非空但不是数字、≤ 0 或超出范围时，返回 `INVALID_BODY_WEIGHT`（0 < x ≤ 700）/ `INVALID_BODY_FAT`（0 < x ≤ 100）/ `INVALID_WAIST`（0 < x ≤ 300），整次保存不写入，已存的值不变。
   - 缺少体重或试图清空体重：`WEIGHT_REQUIRED`（「请填写体重」）。
2. 两种写入方式，语义不同：

| | **按日期保存 `saveBody`**（记录页「保存」） | **编辑记录 `updateBody(id, patch)`**（历史里点开某条修改） |
|---|---|---|
| 定位 | 按 `date`（默认今天）；当天没有记录就新建，有就**合并** | 按 `id` |
| 留空 | 视为「没填」，**保留原值**，不会清空 | patch 里**出现**的 `bodyFatPct` / `waistCm` 留空即**清空为 `null`**；`weightKg` 留空返回 `WEIGHT_REQUIRED`，**不能清空** |
| 非法值（非空） | 报错（`INVALID_BODY_WEIGHT` / `INVALID_BODY_FAT` / `INVALID_WAIST`），不写入 | 同左 |
| 没出现在输入里的字段 | 保留原值 | 保留原值 |
| `note` | 非空才覆盖；留空保留原 note | patch 里有 `note` 就替换（可以改成 `""`） |
| 日期 | 不可改 | 可以改，目标日期已有其他记录时返回 `DATE_CONFLICT` |
| 体重 | 新建记录必须填有效 `weightKg`。当天已有记录时可以不填体重（保留原值），所以「只改体脂 / 腰围 / 备注」也能保存；但合并后的记录 `weightKg` 必须不为 `null`，否则 `WEIGHT_REQUIRED`（当天是没有体重的 v0 迁移记录时，必须这次补填体重） | patch 不含 `weightKg` 时保留原值，所以 v0 迁移来的无体重记录可以只改备注等字段；patch 含 `weightKg` 时必须有效 |
| 仅备注 | 只有当天已有**带体重**的记录时才允许只填备注保存 | 允许（patch 只含 `note`） |
| 返回 | 合并时附带 `merged: true` | — |
| 不变的字段 | `id`、`createdAt`、`extra` | `id`、`createdAt`、`extra` |

3. 界面可以在输入时用 `validateBodyWeight`（留空即 `WEIGHT_REQUIRED`）/ `validateBodyWeightOptional` / `validateBodyFat` / `validateWaist` 提前提示，错误码与写入函数相同。
4. 删除整条记录用 `deleteBody`。
5. 列表按 `date` 升序存储。画图时每个指标只取不为 `null` 的点，不补点（v0 迁移来的无体重记录不出现在体重曲线里）。

---

## 8. 存储 key 与存储结构

小程序本地存储的限制：单个 key 最多 1MB，总共最多 10MB。如果所有组都放在一个 key 里，大约一两年就会超过 1MB。所以按「训练头列表 + 每次训练一个详情 key」拆分；详情里仍然是**扁平数组 + 外键**，不嵌套。

| key | 值 | 说明 |
|---|---|---|
| `fit_meta` | `{ schemaVersion: 1, createdAt, migratedAt, migratedFrom }` | 版本号。**最后写入**，作为迁移成功的标记 |
| `fit_workouts` | `Workout[]` | 所有训练头（包括已写入存储的那条 draft；还没加动作的内存草稿不在这里），按 `date` 升序，同一天再按 `createdAt` 升序 |
| `fit_workout_<workoutId>` | `{ workoutId, exercises: WorkoutExercise[], sets: WorkoutSet[] }` | 一次训练的详情，例如 `fit_workout_w_lx3k9a1b2c` |
| `fit_body` | `BodyMeasurement[]` | 按 `date` 升序 |
| `fit_custom_exercises` | `Exercise[]`（自定义） | 可选功能；不做时这个 key 不存在 |

要求：
- 页面只通过 `utils/repo`（接口见 `spec/API.md`）读写数据；只有 `utils/storage.js` 直接调用 `wx.*Storage`。存储后端可以注入，方便测试。
- 写入顺序：先写详情 key，再写 `fit_workouts`（头和派生字段）。删除训练时：先从 `fit_workouts` 里移除，再 `removeStorageSync('fit_workout_<id>')`。启动时如果发现孤立的详情 key（`getStorageInfoSync().keys` 里有、`fit_workouts` 里没有），直接清理。
- 写入时 catch 异常，空间不足时提示用户。
- 新 key 不带版本后缀，版本统一由 `fit_meta.schemaVersion` 管理。

---

## 9. schema 版本与迁移

当前版本：**`SCHEMA_VERSION = 1`**。

### 9.1 启动流程（`app.js onLaunch` 时同步执行）
1. 读取 `fit_meta`。
2. 如果没有 `fit_meta`：
   - 存在 v0 key `fit_workouts_v1` 或 `fit_body_v1`（第一版原型的嵌套格式，下文称为 **v0**）→ 执行 `migrate_0_to_1`。
   - 都不存在 → 新用户，直接写 `fit_meta = { schemaVersion: 1, createdAt: now, migratedAt: null, migratedFrom: null }`。
3. 如果 `schemaVersion < SCHEMA_VERSION`：依次执行 `migrate_v_to_v+1`，每一步都是纯函数（输入旧数据，输出新数据），可以单独测试。
4. 如果 `schemaVersion > SCHEMA_VERSION`（数据由更新版本的小程序写入，当前代码版本较低）：进入**只读模式**，不写任何 key，并提示用户更新小程序。
5. 迁移完成的标志是最后一步写 `fit_meta`。如果中途失败，`fit_meta` 不会更新，下次启动会重新完整迁移一遍，所以迁移必须幂等（新 key 直接整体覆盖写入）。失败的这次启动 `repo.init()` 返回 `mode: 'error'`，本次会话禁止一切写入（写操作返回 `READ_ONLY`），避免新旧格式混写。
6. v0 key **保留一个版本不删**，作为备份；到 schemaVersion 2 的迁移里再删除。
7. 启动时顺带：清理孤立的 `fit_workout_*` 详情 key；修复自定义动作缺失的 `custom` 标记。

### 9.2 `migrate_0_to_1`（v0 → v1 字段映射）

v0 格式：
- `fit_workouts_v1`：`[{ id, date, note, exercises: [{ exerciseId, name, sets: [{ reps, weight }] }] }]`
- `fit_body_v1`：`[{ id, date, weight, bodyFat, waist, chest, hip, arm }]`，空值为 `null`

| v0 | v1 |
|---|---|
| workout `id` / `date` / `note` | Workout 同名字段（没有 id 时新生成 `w_` id；note 去首尾空格）；`status = "completed"`，`name = ""`，`startedAt = null`，`completedAt = updatedAt = 迁移时刻`，`createdAt = 迁移时刻 + 原数组下标`（v0 没有时间戳，加下标是为了保持同一天内的原顺序） |
| `exercises[i]` | WorkoutExercise：新 `we_` id，`order = i`，`exerciseId` 不变，`nameSnapshot = name`，`note = ""` |
| `sets[j]` | WorkoutSet：新 `s_` id，`index = j + 1`，`weightKg = weight`，`reps = reps`，`type = "normal"`，`doneAt = null`；`weightKg` / `reps` 不合法或超出范围（重量不在 0–999.9、次数不是 0–999 的整数，例如 1200 次）时迁成 `null`；**`done = reps >= 1`：`reps` 为 `null` 或 `0` 的组 `done = false`（未完成），`reps ≥ 1` 的组 `done = true`**（与 `setSetDone` 的「done 须 reps ≥ 1」一致） |
| — | 重新计算 `exerciseCount` / `setCount` / `volumeKg` |
| body `weight` / `bodyFat` / `waist` | `weightKg` / `bodyFatPct` / `waistCm`；非数字、≤ 0 或超出第 7 节范围的值迁成 `null`（包括 `weightKg`，见下面的取舍规则） |
| body `chest` / `hip` / `arm` | 有效值（0 < x ≤ 300，1 位小数）放进 `extra`：`{ chestCm, hipCm, armCm }`；超出范围的丢弃；全部为空时 `extra = null` |
| — | `note = ""`，`createdAt = updatedAt = 迁移时刻` |

取舍规则：
- **空训练保留**：没有动作或没有组的 v0 训练照样迁成一条 `completed` 训练（`exerciseCount = 0`），不丢弃。
- 只有 `date` 缺失或不合法的训练 / 身体记录无法放进日历，才会跳过。
- **没有有效体重的 v0 身体记录**（已确认）：只要 `bodyFatPct`、`waistCm`、`extra` 里还有任何有效数据，就保留这条记录，`weightKg = null`，作为第 7 节「体重必填」的唯一例外（不丢用户历史）；三项指标都是 `null` 且 `extra` 也为空时跳过。这类记录：日历照常标记（体重显示「•」），不进体重曲线；用户用 `updateBody` 只改其他字段可以保存，用 `saveBody` 保存当天数据时必须补填体重。
  - 另一个可选方案是直接丢弃没有有效体重的记录（规则更简单，但会丢体脂 / 腰围历史），不推荐。
- v0 本来就每天一条身体记录；万一同一天有多条，保留数组里最后一条。

迁移后：`fit_meta = { schemaVersion: 1, createdAt: now, migratedAt: now, migratedFrom: 0 }`。

### 9.3 以后的版本
- 只增加字段、带默认值 → 也要升 schemaVersion，迁移函数负责补默认值，读取时不靠「字段缺失就当默认值」的隐式规则。
- 改名或改结构 → 升 schemaVersion，必须写迁移函数和单元测试（输入 v(n) 样例，断言输出 v(n+1)）。

---

## 10. 示例 JSON

`fit_meta`
```json
{ "schemaVersion": 1, "createdAt": 1792200000000, "migratedAt": null, "migratedFrom": null }
```

`fit_workouts`
```json
[
  {
    "id": "w_mgu1k2ab3f",
    "status": "completed",
    "date": "2026-10-16",
    "name": "推日",
    "note": "状态不错",
    "startedAt": 1792141200000,
    "completedAt": 1792145100000,
    "createdAt": 1792141200000,
    "updatedAt": 1792145100000,
    "exerciseCount": 1,
    "setCount": 2,
    "volumeKg": 960
  },
  {
    "id": "w_mgv7p0cd9k",
    "status": "draft",
    "date": "2026-10-17",
    "name": "",
    "note": "",
    "startedAt": 1792207800000,
    "completedAt": null,
    "createdAt": 1792207800000,
    "updatedAt": 1792207860000,
    "exerciseCount": 1,
    "setCount": 0,
    "volumeKg": 0
  }
]
```

`fit_workout_w_mgu1k2ab3f`
```json
{
  "workoutId": "w_mgu1k2ab3f",
  "exercises": [
    { "id": "we_mgu1k5x1a", "workoutId": "w_mgu1k2ab3f", "exerciseId": "0025", "order": 0, "note": "握距再窄一点", "nameSnapshot": "杠铃卧推" }
  ],
  "sets": [
    { "id": "s_mgu1k6aa1", "workoutExerciseId": "we_mgu1k5x1a", "index": 1, "weightKg": 40, "reps": 10, "type": "warmup", "done": true, "doneAt": 1792141500000 },
    { "id": "s_mgu1k6aa2", "workoutExerciseId": "we_mgu1k5x1a", "index": 2, "weightKg": 60, "reps": 8, "type": "normal", "done": true, "doneAt": 1792141800000 },
    { "id": "s_mgu1k6aa3", "workoutExerciseId": "we_mgu1k5x1a", "index": 3, "weightKg": 60, "reps": 8, "type": "normal", "done": true, "doneAt": 1792142100000 },
    { "id": "s_mgu1k6aa4", "workoutExerciseId": "we_mgu1k5x1a", "index": 4, "weightKg": 60, "reps": null, "type": "normal", "done": false, "doneAt": null }
  ]
}
```
（容量 = 60×8 + 60×8 = 960；热身组和没打勾的组不计入。）

草稿 `w_mgv7p0cd9k` 在 1792207800000 新建（内存），60 秒后加入第一个动作时才写入存储，所以 `exerciseCount = 1`，`createdAt` / `startedAt` 仍是新建时刻，`updatedAt` 是写入时刻。存储里不会出现 `exerciseCount = 0` 的新草稿（写入后用户删光动作的情况除外）。

`fit_body`
```json
[
  { "id": "b_mgr2a1x0p", "date": "2026-10-15", "weightKg": 72.4, "bodyFatPct": null, "waistCm": 81.5, "note": "", "extra": null, "createdAt": 1792022400000, "updatedAt": 1792022400000 },
  { "id": "b_mgu0z9q1r", "date": "2026-10-16", "weightKg": 72.1, "bodyFatPct": 18.2, "waistCm": null, "note": "早起空腹", "extra": null, "createdAt": 1792108800000, "updatedAt": 1792108800000 }
]
```
v0 迁移来的无体重记录（例外情况，已确认）：
```json
{ "id": "b_lx9k2m0aa", "date": "2026-09-30", "weightKg": null, "bodyFatPct": null, "waistCm": 82, "note": "", "extra": { "chestCm": 98 }, "createdAt": 1792200000000, "updatedAt": 1792200000000 }
```

`fit_custom_exercises`（可选）
```json
[
  {
    "id": "c_mgt9w2e1k", "custom": true, "nameZh": "家用弹力带划船", "nameEn": "",
    "bodyPart": "back", "bodyPartDetail": "back", "target": "lats", "secondary": ["biceps"],
    "equipment": "band", "category": "strength", "categoryZh": "力量",
    "description": "", "steps": [], "translationPending": false, "untranslatedFields": [],
    "archived": false, "createdAt": 1792050000000, "updatedAt": 1792050000000
  }
]
```

---

## 11. 借鉴了 openGym 的哪些设计（源文件路径均在 `/workspace/openGym/` 下）

只读了源码和 API 文档，没有使用任何 media。下表每条都可以在对应文件里核实。

| 本文档的设计 | openGym 源文件 | openGym 的做法 |
|---|---|---|
| 训练有草稿和已完成两种状态，同一时间最多一个草稿 | `frontend/src/store/useStore.js`（`DEF` 中 `workouts: []` 与 `active: null` 分开）；`frontend/src/sheets.jsx`（`beginWorkout`、`repeatWorkout` 中 `s.active = {...}`，已有进行中训练时提示 "Finish the current workout first."） | 进行中的训练单独放在 `active`，完成后才进入 `workouts` 数组。我们改成用 `status` 字段区分 |
| 完成时删掉没有已完成组的动作；没打勾的组保留但不计入统计 | `frontend/src/lib/finish-workout.js`（`buildCompletedWorkout` 末尾 `.filter(entry => entry.sets.some(hasCompletedWork))`）；`frontend/src/lib/workout-model.js`（`hasCompletedWork`、`completedVolumeOf` 只算 `done` 的组） | 同左 |
| Workout 有 date、name、note、开始/结束时间；字段 `startedAt` / `completedAt` | `frontend/src/lib/finish-workout.js`（返回 `{ id, d, start, end, name, entries, note }`，session note 只在非空时写入）；`api/openapi.yaml`（`components.schemas.Workout`：`d`、`start`、`end`、`name`） | openGym 用缩写 `d/start/end`，我们改成 camelCase 全称 |
| Workout 上存派生的 `volumeKg` | `api/openapi.yaml`（`Workout.vol`："Total volume (Σ weight × reps)"）；`finish-workout.js`（每个 entry 的 `topW`） | openGym 在训练记录上存汇总值；我们规定以重新计算的结果为准 |
| 动作级备注 `WorkoutExercise.note` | `frontend/src/lib/finish-workout.js`（entry 的 `note` trim 后非空才写入）；`useStore.js` 注释区分 `exNotes`（长期的动作备注）、routine note 和 session note | 我们 v1 只做「本次训练的动作备注」 |
| 组的 `weightKg` / `reps` / `done` | `api/openapi.yaml`（`Workout.entries[].sets[]`：`w`、`r`、`done`） | 改成语义化的字段名 |
| 组类型 `type: normal / warmup`，热身组不计入 | `frontend/src/lib/workout-model.js`（`phaseForSet` / `isWarmupRow`：`phase: 'warmup' \| 'work'`，兼容旧的 `warmup: true`；`isFailureSet` 规定热身组永远不算力竭组） | openGym 用 `phase` 字段，另有 `type` 表示 dropset/restpause；我们 v1 合并成一个 `type`，只有两个值 |
| `doneAt` 打勾时间 | `frontend/src/lib/finish-workout.js`（注释："Sets are stamped with `at` when ticked"，`sessionEnd` 用它推算结束时间） | 同左，改名为 `doneAt` |
| 身体数据每个日期一条；同一天合并，后填的字段覆盖，空字段保留原值 | `frontend/src/lib/measurements.js`（`normalizeMeasurementsState` 按 `d` 去重，`mergeMeasurementEntries` 用 `b[key] ?? a[key]`）；`frontend/src/sheets.jsx`（`BwSheet.save`：同一天的体重直接覆盖） | 同左 |
| 可选数值留空存 `null`；≤0 或非数字存 `null`；体脂 > 100 存 `null`；保留 1 位小数 | `frontend/src/lib/measurements.js`（`valid = v => Number.isFinite(+v) && +v > 0 ? round(+v) : null`；`if (entry.bodyFat > 100) entry.bodyFat = null`；`round` 到 0.1） | v0 迁移时同左；用户输入的非法值改为直接报错，不静默存 `null` |
| 围度固定存 cm，单位只在显示层换算 | `frontend/src/lib/measurements.js` 文件开头注释与 `toMeasurementDisplay`；`frontend/src/lib/units.js`（kg/lb 切换时转换全部重量） | 我们 v1 只存 kg/cm |
| 体重上限 700 kg | `frontend/src/sheets.jsx`（`bwMax = unit => unit === 'lb' ? 1500 : 700`，`bwTooHeavy`） | 同左 |
| 体重记录 `{ d, w, t }` | `api/openapi.yaml`（`BodyweightEntry`）；`frontend/src/lib/bodyweight.js`（`weeklyWeights` 跳过没有日期或体重 ≤ 0 的记录，不按 0 计入平均） | 对应我们的 `date / weightKg / updatedAt`；画图时跳过 `null` 也是同一思路 |
| 迁移时保留 v0 多出来的字段（`extra`） | `frontend/src/lib/measurements.js`（`normalizeMeasurementEntry` 注释："a backup must not lose history merely because its custom-field definition is absent"） | 同左 |
| 本地日期 `YYYY-MM-DD` | `frontend/src/lib/format.js`（`todayISO` 用 `getFullYear/getMonth/getDate` 拼接本地日期） | 同左 |
| id = 时间 base36 + 随机串 | `frontend/src/lib/format.js`（`uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)`） | 同左，再加类型前缀 |
| 自定义动作：`custom: true`，排在内置动作前面，缺标记时修复但不改时间戳 | `frontend/src/lib/exercises.js`（`healCustomEx`、`isCustomEx`、`allExercises = st => [...customEx, ...CATALOGUE]`）；`api/openapi.yaml`（`CustomExercise`） | 同左；软删除 `archived` 是我们自己加的 |
| 找不到的动作 id 显示占位，不删除也不改写 | `frontend/src/unknown-exercise-ids.test.jsx`（文件开头注释："Every view has to draw such an entry … instead of throwing, and nothing may drop or rewrite it"） | 同左；我们另外加了 `nameSnapshot` |
| 读取时用默认值补齐、保留未知字段 | `frontend/src/store/useStore.js`（`loadState`：`Object.assign(clone(DEF), saved)`）；`api/openapi.yaml`（各 schema 都是 `additionalProperties: true`） | 同左 |
| 存储 key 命名与版本 | `frontend/src/store/useStore.js`（`const KEY = 'gym_state_v1'`，以及 `gym_sync`、`gym_dirty` 等前缀 key） | openGym 把版本写进 key 名、整个状态放一个 key；我们改用 `fit_` 前缀 + 独立的 `fit_meta.schemaVersion`，并按训练拆分 key（因为小程序单 key 有 1MB 上限） |
| 升级数据时宁可保留也不丢 | `frontend/src/lib/sync-legacy.js`（处理 v1.3.9 旧数据：无法判断时 "keeps the device's copy aside instead, so nothing the old app held is lost"） | 对应我们「旧 key 保留一个版本」「迁移幂等、`fit_meta` 最后写」 |

**没有借鉴的部分**：openGym 的多设备同步（`_ts`、`_rev`、`deleted` 删除记录、`lib/sync-merge.js` 的合并逻辑）、计划/循环训练（routines、queue）、超级组、dropset/restpause、RIR/RPE、媒体附件。v1 只用本地存储，以上都不需要。

**我们自己定的部分（openGym 没有对应依据）**：组重量上限 999.9 kg、次数上限 999、腰围上限 300 cm、各文本长度上限、`order` 从 0 开始 / `index` 从 1 开始、Workout 的 `exerciseCount` / `setCount` 缓存、按训练拆分存储 key、只读模式、v0→v1 迁移映射。
