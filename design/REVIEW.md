# 设计走查报告（REVIEW）· miniprogram v1

- 走查人：极简设计师　日期：2026-10-17（UTC+8）
- 范围：`miniprogram/` 下全部 WXML / WXSS / 组件（8 个页面、8 个组件、`app.json` / `app.wxss`），以及 `DEV_NOTES.md`；为核对行为，也读了相关页面 JS 和 `utils/repo` 的读写部分
- 对照：`design/DESIGN.md`、`spec/PRODUCT_SPEC.md`，以及 Jarvis 的最新裁定：#15 编辑已完成训练只要求至少有 1 组打勾、不做清理；体重必填；第一次加入动作时才写入草稿；新加的组默认是普通组。这几条代码都已正确实现（`workout-edit.js:131-138`、`body-edit.js:42-48`、`workout-edit.js:10-12` 配合 `repo/workouts.js:94-121`、`workout-edit.js:88`），下文不再重复
- 方法：静态阅读，并按 rpx 换算 320px 和 375px 两种宽度。另外把 P3（录入页）的 WXSS 按 rpx 换算成 vw，在 Chrome 里粗略渲染了一张对比图：`design/review-assets/p3-render-320-vs-375.png`（左 320px 模拟 iPhone SE 的胶囊位置，右 375px；红色虚线是屏幕中线）。这只是辅助判断，不等于真机效果
- 行号都以当前文件为准。**我没有修改任何代码**；只按走查结果顺手修正了 `DESIGN.md` 里我自己写得不对或缺失的规格，见文末「附：DESIGN.md 同步修正」

**统计：必须改 8 条，建议改 22 条。**

---

## 一、必须改

### M1　二级页导航标题没有居中；320px 宽时录入页的标题会换行
- **位置**：`components/nav-bar/nav-bar.wxss:5`（`.center { flex:1; … margin-right:72rpx }`），`components/nav-bar/nav-bar.wxml:5-6`；`pages/workout-edit/workout-edit.wxml:2-5`、`pages/workout-edit/workout-edit.wxss:1`
- **问题**：
  - 标题区是「返回键右边到胶囊避让线左边」这一段，再减去 72rpx 的右外边距，所以标题按这一段的中点居中，而不是按屏幕居中。
  - 在 375px 上，这一段约为 x=52–237px，标题中心在 145px，**比屏幕中线偏左约 43px**。渲染图右侧可以看到，标题整个落在中线左边。
  - 在 320px 上（胶囊 left≈226px），这一段只有约 143px（≈335rpx）。录入页的「10月17日 周六 ▾」加上「草稿」标签约 340rpx，放不下，「▾」会折到第二行（渲染图左侧）。跨年日期「2025年12月30日 周二」更长。
- **依据**：DESIGN §3.1「二级页：标题居中 34rpx；所有可点元素都放在胶囊避让线左边」；§2.2。
- **修改建议**：
  1. `.center` 改成绝对定位、按屏幕居中：`position:absolute; left:0; right:0; text-align:center; pointer-events:none`，里面的标题 `pointer-events:auto`。
  2. 最大宽度设为 `windowWidth − 2 × rightGap`（rightGap 是 JS 里已经算好的值，传成 style），超出部分用省略号。去掉 `margin-right:72rpx`。
  3. 录入页的标题容器加 `white-space:nowrap; overflow:hidden`。宽度不够时（容器宽度 < 340rpx）隐藏「草稿 / 已完成」标签：页面里的 `status-line`（`workout-edit.wxml:8-11`）已经显示了保存状态，可以在那里补上状态文字。

### M2　步进器长按会冒泡到组行，连续加减的同时会弹出「组操作」菜单
- **位置**：`components/set-row/set-row.wxml:1`（`.sr` 绑定 `bindlongpress="onLong"`），以及 `:4`、`:6`、`:9`、`:11`（`.pm` 绑定 `bindlongpress="onStepLong"`）
- **问题**：`longpress` 是冒泡事件。长按「+」时会同时触发 `onStepLong`（开始连续加减）和父节点的 `onLong`（弹出 `showActionSheet`）。结果是重量还在增加，底部菜单已经弹出，用户松手时手指可能直接落在「删除此组」上。这是录入页最高频的操作。
- **依据**：DESIGN §4.4 步进器「长按 400ms 后开始连续加减」；PRODUCT_SPEC §3 P3「长按组行打开菜单」——两者必须互不干扰。
- **修改建议**：
  - 四个 `.pm` 改用 `catchlongpress="onStepLong"`。
  - 两个 `input` 同样加 `catchlongpress`（长按输入框是系统的选择、粘贴操作，不应该弹出组菜单）。
  - 「组菜单」的长按只留给序号列和行内空白处。

### M3　「有未完成的训练」弹窗的取消按钮文字超过 4 个字，弹窗会调用失败
- **位置**：`pages/calendar/calendar.js:37-38`（`cancelText: '放弃并新建'`）
- **问题**：`wx.showModal` 的 `cancelText` / `confirmText` 最多 4 个汉字，超出时接口直接走 `fail`，弹窗不会出现。已有草稿时点悬浮按钮或「开始训练」**没有任何反应**，用户既不能继续草稿也不能放弃，F1 流程中断。
- **依据**：PRODUCT_SPEC §2 F1 第 2 步；微信 `wx.showModal` 参数限制。
- **修改建议**：改成 `confirmText:'继续'`、`cancelText:'放弃'`，在正文里说明「放弃后将新建训练」。顺手检查过其余弹窗的按钮文字（「返回检查」「完成训练」「仍然离开」「留在这里」都是 4 个字），只有这一处超出。

### M4　日历图例里的「今天」写死成 17
- **位置**：`components/month-calendar/month-calendar.wxml:13`（`<text class="accent lg-t">17</text>`）
- **问题**：图例永远显示「17 今天」，只有每月 17 日是对的。这个数字是我在线框图里举的例子，被原样写进了代码。
- **依据**：DESIGN §4.6 图例（训练日 / 选中 / 今天）。
- **修改建议**：用今天的日期数字（组件已经有 `today` 属性，取 `today.slice(8)` 转成数字），或者改成一个强调色小圆点加「今天」两个字，不显示具体数字。

### M5　图表气泡在右侧会超出屏幕
- **位置**：`components/line-chart/line-chart.js:53`（`left: Math.max(0, best.x - 70)`，只限制了左边界）；`components/line-chart/line-chart.wxss:1、3`
- **问题**：最新的点就在图表最右侧（x≈w−12）。气泡「10月17日 · 68.4 kg」宽约 140–160px，`left = w − 82` 时右侧会超出 70px 左右，被屏幕截断，或者把页面撑出横向滚动。用户最常点的恰好就是最新那个点。
- **依据**：DESIGN §4.7「交互：点按或拖动 → 最近的点显示气泡」。
- **修改建议**：先测出气泡宽度（`createSelectorQuery` 读 bubble 的宽度），或者按字数估算，再限制在 `[0, w − bubbleW]` 范围内；`.wrap` 加 `overflow:hidden` 兜底。点靠近顶部时，气泡改放到点的下方。

### M6　Y 轴刻度四舍五入到整数，范围小的时候会出现重复刻度
- **位置**：`components/line-chart/line-chart.js:24`（`String(Math.round(t.v))`），`utils/repo/series.js:14`（刻度是最小值到最大值四等分，不是整数）
- **问题**：比如 30 天体重在 68.2–68.8 之间，刻度值是 68.1 / 68.3 / 68.6 / 68.8，显示出来就是「68 / 68 / 69 / 69」，看起来像坐标轴错了。体脂、腰围的波动通常也不到 1，这种情况很常见。
- **依据**：DESIGN §4.7「Y 轴：自动取整（体重 1kg、体脂 1%、腰围 1cm 的整数倍），上下各留 10% 余量」。
- **修改建议**：在 `chartLayout` 里先把最小值向下取整、最大值向上取整到步长（步长按 1、0.5、0.2 依次选，保证有 3–4 个不重复的刻度），再计算点的 y 坐标；刻度文字按步长决定保留几位小数（步长 < 1 时保留 1 位）。

### M7　存储内容损坏时会被当成空数组，下一次写入会把原数据覆盖掉；读取异常没有处理
- **位置**：`utils/repo/workouts.js:15`（`headers()`）、`utils/repo/body.js:11`（`listBody()`）、`utils/repo/exercises.js:13`；`utils/storage.js:43-46`（`READ_FAILED` 直接抛出，页面查询没有捕获）
- **问题**：
  1. `fit_workouts` / `fit_body` 读出来不是数组时，会被当成 `[]`。之后用户只要新建一次训练或记一次体重，空数组加上新记录就会整体写回去，**原来的数据被彻底覆盖**。
  2. 如果 `getStorageSync` 抛异常，`onShow → refresh` 里没有 try/catch，页面直接白屏。
  - DEV_NOTES 把这条列成了「简化」，但它会造成不可逆的数据丢失，不能接受（裁定见第三节第 6 条）。
- **依据**：PRODUCT_SPEC §7.2「不覆盖、不清空原数据」；DATA_MODEL 第 1 节「未知字段 / 引用完整性：不能删掉数据」。
- **修改建议**（最小改动）：
  - 读到非数组时，**把这个 key 标记为损坏，并禁止写入它**：可以复用只读模式的开关，或者给每个 key 单独加一个损坏标记。
  - 把原始值另存一份备份 key（例如 `fit_corrupt_<key>_<时间>`）。
  - 页面显示「数据加载失败 · 重新加载」（`empty-state` 组件可以直接用）。
  - 查询函数统一包一层 `try/catch`，异常时返回带「读取失败」标记的结果。

### M8　录入行的宽度加起来超出卡片，序号列的点击区太小
- **位置**：`components/set-row/set-row.wxss:2-6、9`；`pages/workout-edit/workout-edit.wxml:38`（表头的固定宽度）；`pages/workout-edit/workout-edit.wxss:3`
- **问题**：
  1. 序号 64 + 12 + 重量 248 + 12 + 次数 232 + 勾选 88 = **656rpx**，而卡片内宽 = 750 − 2×32（页面边距）− 2×24（卡片内边距）− 2px ≈ 634rpx。现在能放下只是因为 flex 默认会收缩：两个步进器和勾选列被压窄了 2–3%，表头的列也跟着按比例收缩，对齐全靠巧合。勾选列被压到约 85rpx，在 320px 上只有约 36px。
  2. 序号列宽 64rpx（375px 上是 32px），而且热身组状态下 `.no.warm` 高度只有 48rpx：「切换热身组」的点击区只有 32×24px，小于 88rpx 的要求，又紧挨着重量的「−」按钮，很容易点错。
  - 这一条的根源是我在 DESIGN §4.4 里给的数值加起来就超宽了，规范已同步修正。
- **依据**：DESIGN 原则 3「点击区域 ≥ 88rpx」、§4.4、§4.5。
- **修改建议**：组行各列固定宽度并加 `flex-shrink:0`：序号 72rpx（点击区高 88rpx；热身组的灰底「热」放在一个内部元素上，点击区不缩小）、间距 8、重量 240、间距 8、次数 200、间距 8、勾选 88，合计 624rpx。`.pm` 保持 72rpx。表头直接复用同一组宽度（建议抽成 class，不要写内联样式）。

---

## 二、建议改

### 设计 token 一致性

**S1　白色写死成 `#fff`。** `app.wxss:34、41、44、57、61、67`，`components/btn/btn.wxss:5-8`，`components/card/card.wxss:2`，`components/nav-bar/nav-bar.wxss:1`，`components/set-row/set-row.wxss:10`，`pages/exercise-picker/exercise-picker.wxss:2`。依据 DESIGN §2.1。建议统一改成 `var(--c-white)`。

**S2　禁用色、勾选描边色、大占位字颜色写死，规范里也没有对应 token。** `app.wxss:62`、`btn.wxss:10`（`#E5E5E5`）；`set-row.wxss:10`（`#CCCCCC`）、`exercise-picker.wxss:2`（`#CCC`）；`exercise-detail.wxss:1`（`#D6D6D6`）；`line-chart.wxss:3`（`#111`）。依据 DESIGN §2.1（已新增 `--c-disabled` / `--c-check` / `--c-ph-big`）。建议改用这些变量，`#111` 改成 `var(--c-ink)`。

**S3　canvas 和 JS 里写死色值。** `components/line-chart/line-chart.js:21、37、42、44`，`utils/ui.js:23`（`confirmColor:'#E5484D'`）。canvas 读不到 CSS 变量，属于合理的例外，但不应该分散在各处。依据 DESIGN §2.1 附注。建议新建 `utils/tokens.js`，导出 `INK / LINE / TEXT3 / ACCENT / DANGER / WHITE`，这两处都从这里引用。

**S4　字号大量写死。** 依据 DESIGN §2.2（已补充 `--fs-stat 44`、`--fs-list 32`、`--fs-sm 28`、`--fs-err 24`）。涉及：
- `btn.wxss:2`（32）
- `app.wxss:55、70-74`
- `set-row.wxss:2、3、6、8、10`
- `month-calendar.wxss:2、3、4、6、9、17、19`
- `empty-state.wxss:4、5`、`undo-toast.wxss:1`、`nav-bar.wxss:4、7`
- `calendar.wxss:3、4`、`workout-detail.wxss:1、4`、`workout-edit.wxss:5、6、11、13`
- `exercise-detail.wxss:1、5、7、8`、`body.wxss:4`
- `exercise-picker.wxss:1、2、4`、`library.wxss:2、4、7`
- 内联样式：`exercise-detail.wxml:5`、`workout-edit.wxml:60、62`

建议改用变量。图标类字号（「‹」「×」「⋯」「+」）可以单独定义一个 `--fs-icon`。

**S5　间距不在 8rpx 栅格上，并且大量使用内联 style。**
- 12rpx：`set-row.wxss:4`、`app.wxss:43`（圆角），以及标签的左外边距 `workout-edit.wxml:4、30、31`、`exercise-picker.wxml:9`、`library.wxml:15`、`workout-detail.wxml:11、12`。
- 10rpx：`workout-detail.wxss:4`；4rpx：`month-calendar.wxss:3`。
- 内联边距：`calendar.wxml:6、10-12、15`，`body.wxml:9、13、17、26、34-36`，`body-edit.wxml:11`，`exercise-detail.wxml:4、8`。

依据 DESIGN §2.3「基础单位 8rpx」。建议把标签的左外边距统一改成 16rpx（或 8rpx），抽成 `.ml-2` / `.ml-3` 之类的工具类，去掉内联 style。

### 布局、胶囊和安全区

**S6　动作库的数量显示被推到了胶囊旁边。** `pages/library/library.wxml:1`、`nav-bar.wxss:3`（`.tab-title { flex:1 }`）。标题占满了剩余宽度，「共 284 个」就被挤到最右边、紧贴胶囊避让线。依据 DESIGN §5 P5「大标题 + 数量」（线框 07 里数量紧跟在标题后面）。建议 tab 模式下标题不加 `flex:1`，`slot` 内容紧跟在标题后面，基线对齐。

**S7　键盘弹起时「保存」按钮被遮住。** `pages/body-edit/body-edit.wxml:4、13`。体重输入框会自动聚焦，`adjust-position` 只会把输入框推上去，固定在底部的 `.bar` 仍然在键盘后面，用户得先收起键盘才能点保存。依据 DESIGN §5 P8「键盘弹起时操作栏顶在键盘上方」。建议输入框绑定 `bindkeyboardheightchange`，把 `.bar` 的 `bottom` 设为键盘高度（同时关掉 `adjust-position`，避免页面被推两次）；或者设置 `confirm-type="done"`，按键盘上的「完成」直接保存。

**S8　身体数据顶部挤成一行，日期和差值那行总是换行。** `pages/body/body.wxml:7-14`。左边是当前值和日期，右边是固定 320rpx 宽的分段控件。左栏只剩约 366rpx，而「10月17日 · 较上次 −0.6 kg」约 370–400rpx，在任何宽度下都会折成两行，和分段控件的底部对不齐。依据 DESIGN §4.7。建议把「30天 / 90天 / 全部」分段控件移到图表正上方，单独占一行并右对齐；当前值区域占满整行。

**S9　长动作名会折成两行，列表行高变得不统一。** `pages/library/library.wxml:15`、`pages/exercise-picker/exercise-picker.wxml:9`（`.nm` 没有设置省略）。数据里最长的名称有 12 个字（「杠铃仰卧臂屈伸（碎颅者）」），10 个字以上的有 7 条；再加上「暂无中文」或「已添加」标签，会折成两行（渲染图下半部分）。依据 DESIGN §4.2。建议 `.nm` 加 `flex:1 1 auto; min-width:0` 和省略号，标签加 `flex-shrink:0`；或者允许折行，但把行高固定为 `min-height`、第二行的英文名限制为 1 行。

**S10　rpx 写的点击区在小屏上会缩小。** 全局问题，例如 `.back`、`.arrow`、`.chk`、`.dots`、`.mv` 都是 88rpx：375px 上是 44px，320px 上只有 37.5px。依据 DESIGN 原则 3。建议对关键点击区（勾选、步进器的 ±、返回键）加 `min-width:44px; min-height:44px`（px 单位），或者在 `app.wxss` 里加一个 `.hit` 工具类统一处理。

### 单手操作

**S11　小号文字按钮的点击区不够 88rpx。**
- `month-calendar.wxss:3`「今天」小胶囊：约 22rpx 文字加上下各 4rpx 内边距，高约 40rpx。
- `calendar.wxml:6` 草稿横幅的「继续」：约 70rpx 高。
- `body.wxml:21`「全部 ›」：没有内边距。
- `body.wxml:34` 日历卡片的「编辑」：上下内边距各 8rpx。
- `library.wxml:7`「清除」、`library.wxml:27`「重置」。

依据 DESIGN §4.1「文字按钮点击区 ≥ 88rpx」。建议统一用 `btn type="text"`（已经有 `min-height:88rpx`），或者给这些元素加 `.hit`。

**S12　排序模式下的「完成」在屏幕顶部，底部操作栏消失了。** `pages/workout-edit/workout-edit.wxml:17、49`（`wx:if="{{w && !sorting}}"`）。依据 DESIGN 原则 3、§5 P3（主操作放在拇指区）。建议排序模式下底部操作栏不隐藏，改成只有一个「完成排序」主按钮；顶部的文字按钮可以保留，作为第二个入口。

**S13　动作库列表里的快捷「+」紧挨着整行点击区，容易误触，而且规格里没有这个入口。** `pages/library/library.wxml:19`、`library.wxss:7`（72×88rpx，右对齐，图标是灰色的「+」，和右侧「器械 · 类别」文字挤在一起）。这个「+」不在 PRODUCT_SPEC 里（规格只有 P6 底部的「加入当前训练」）。依据 PRODUCT_SPEC §3 P5、§2 F5。建议 v1 先去掉；如果要保留，至少做到：点击区 88rpx、和行内文字之间留 16rpx 间距、加入后用带「撤销」的 toast（可以复用 `undo-toast`），并且在只读模式下隐藏。

**S14　只读模式下步进器仍然可以操作。** `pages/workout-edit/workout-edit.wxml:39`（没有把 `readonly` 传给 `set-row`）。只读时点「+」，数字会先变，然后写入失败弹出 toast，`reload` 又把数字改回去，看起来像出了故障。依据 PRODUCT_SPEC §7.3「写入入口置灰」。建议 `set-row` 传入 `readonly="{{readOnly}}"`，底部的「+ 动作 / 完成训练」也改成 disabled（`btn` 组件已经支持）。

### 空状态、失败状态与文案

**S15　筛选面板没有「全部 / 不限」选项。** `pages/library/library.wxml:29、31`（取消选择要再点一次已选中的 chip，见 `library.js:49-50`）。依据 DESIGN §5 P5（线框 08 里每组第一项是「全部」）。这个操作不容易被发现，而且和选择器页（`exercise-picker.wxml:4-5`）的做法不一致。建议每组第一项加上「全部」。

**S16　日期没有按规格格式显示。** `pages/body-edit/body-edit.wxml:3`、`pages/workout-edit/workout-edit.wxml:61`（`{{form.date}} ›` 显示的是 `2026-10-14`）。依据 PRODUCT_SPEC §8「10月17日 周六」。建议在 JS 里加一个 `dateLabel` 字段用来显示，`picker` 的 `value` 仍然用 ISO 格式。

**S17　草稿还没写入时显示「未保存」，容易让人以为出错了。** `pages/workout-edit/workout-edit.wxml:10`。按 Jarvis 的裁定，第一次加入动作之前本来就不应该写入，所以这是正常状态。依据 DESIGN §4.9「克制的反馈」。建议这时不显示保存状态，或者改成「加入动作后自动保存」（灰色）。

**S18　选中日的总时长和摘要卡里的时长重复显示。** `pages/calendar/calendar.wxml:12` 和 `:17`。只有 1 次训练时，同一个「62 分钟」在相邻两行出现两次。依据 DESIGN §5 P1。建议只有当天有 2 次以上训练时才在区块标题上显示总时长；否则只在卡片里显示。

**S19　「训练已完成」toast 在 `redirectTo` 之后才调用，可能显示不出来。** `pages/workout-edit/workout-edit.js:126`。依据 PRODUCT_SPEC §2 F1 第 6 步。建议给 P2 带一个 `?done=1` 参数，在 P2 的 `onLoad` 里再弹 toast；或者先弹 toast，延迟 300ms 再跳转。

**S20　空状态副文案颜色太浅。** `components/empty-state/empty-state.wxss:5`（`--c-placeholder` #BBB 对白底对比度只有 1.9:1）。依据 DESIGN §2.1（`--c-placeholder` 只用于占位文字和未来日期）。建议改成 `--c-text-3`。

**S21　搜索图标用了「⌕」字符。** `pages/library/library.wxml:3`、`pages/exercise-picker/exercise-picker.wxml:3`。U+2315 在部分安卓机的系统字体里没有，会显示成方框。依据 DESIGN §4.4「搜索框左侧放大镜图标」。建议换成 SVG（`image` 加 base64 编码的 svg）或者用 CSS 画一个放大镜；清除按钮的「✕」也一起换掉。

**S22　DEV_NOTES 开头的说明已经过时。** `miniprogram/DEV_NOTES.md:4-11`。里面还写着 `fit_workouts_v1` / `fit_body_v1`、「10 条占位数据」「未找到 design/DESIGN.md」「11 项测试通过」，和后面 Phase 3 / Phase 4 的内容矛盾，接手的人会被误导。建议删掉，或者标注为「历史记录（已过时）」。

---

## 三、DEV_NOTES 偏差裁定

对应 `miniprogram/DEV_NOTES.md:41-48`「Deviations from the spec」。

| # | 偏差 | 裁定 | 理由 | 条件 / 替代方案 |
|---|---|---|---|---|
| 1 | 没有做左滑删除：组改为长按菜单「删除此组」（可撤销）；身体记录改为长按后确认删除；训练只能在 P2 删除 | **有条件接受** | 原生小程序做左滑要自己写 `movable-area` 和手势，容易和步进器、页面纵向滚动冲突，v1 改用长按菜单是合理的。删除组有撤销、删除记录有确认，安全性没有降低 | ① 必须先修好 M2（长按冒泡），否则长按菜单会被步进器误触发。② 长按不容易被发现：录入页在第一个动作卡底部加一行灰色提示「长按组可设为热身或删除」（第一次完成训练后不再显示）；身体数据已有「长按记录可删除」提示（`body.wxml:26`），可以接受。③ 身体记录在 P8 也有「删除这条记录」按钮，入口足够。④ v2 再考虑做左滑 |
| 2 | 没有做拖拽排序：「⋯ → 调整顺序」进入一个用 ↑ / ↓ 按钮排序的模式 | **接受** | Jarvis 已经同意；↑ / ↓ 的点击区是 88rpx，单手可以操作；一次训练通常只有 3–8 个动作，逐个移动的成本不高；也不会有拖拽和滚动的冲突 | 按 S12 把「完成」放回底部操作栏；排序行里的动作名加省略号（`workout-edit.wxml:19` 的 `.h2` 在 `flex1` 里没有设置省略，长名字会折行撑高 112rpx 的行） |
| 3 | 自动保存每次改动都立即写入，没有 500ms 防抖，页面隐藏时也不额外写入 | **接受** | 本地存储是同步的，每次写一个详情 key 加上训练头，数据量很小；步进器长按时只在松手后写一次（`set-row.js:24`），输入框只在失焦时写，不会频繁写入；逐次写入反而保证页面被杀掉时不会丢数据，比规格更稳 | 保留现状；PRODUCT_SPEC §3 P3「500ms 防抖」视为被这个实现取代，不需要改代码 |
| 4 | P6「已加入当前训练 · 去查看」改成了弹窗（去查看 / 留在这里），因为 `wx.showToast` 不能放按钮；从 P5 列表加入时只弹普通 toast | **P6 接受；P5 见 S13** | 原生 toast 确实不能放按钮，用弹窗是可行的降级方案；弹窗会打断操作，但「加入训练」本来就不是连续高频操作 | 更好的替代方案：把 `undo-toast` 改成支持自定义按钮文字的通用组件（例如 `action-toast`），P6 用「已加入当前训练 · 去查看」，5 秒后自动消失，不打断操作。v1 可以先保留弹窗。P5 的快捷「+」是规格外新增的，按 S13 处理 |
| 5 | 没有 300ms 骨架屏：列表每批渲染 30 条，用「加载更多」或滚动到底部加载；动作库加载失败的状态没做（数据打包在代码里） | **接受** | 284 条数据是同步读取的，首屏只渲染 30 条，基本不会出现超过 300ms 的白屏，骨架屏的收益很低；动作库是随代码打包的，不存在网络加载失败 | 「加载更多」作为兜底可以保留，但应该以滚动到底部自动加载为主（`library.js:35` 已经实现）。如果以后动作库改成从服务端下发，必须补上加载失败状态 |
| 6 | 读取失败界面（§7.2）：详情 key 缺失时显示「训练详情丢失」并允许删除（已做）；通用的「数据加载失败 / 重新加载」界面没做；损坏的 key 被当成空数据读取 | **不接受（损坏的 key 被当成空数据这一部分）**；其余接受 | 当成空数据读取后，下一次写入会把原数据整体覆盖，造成**不可逆的数据丢失**，违反 PRODUCT_SPEC §7.2 和 DATA_MODEL 第 1 节。「训练详情丢失」这部分做得符合规格 | 按 M7 修改：检测到损坏 → 备份原始值 → 禁止写这个 key（或者整体进入只读）→ 页面显示「数据加载失败 · 重新加载」。通用的失败界面可以直接复用 `empty-state` 组件，工作量很小 |
| 7 | 选择器的搜索做了 300ms 防抖，每次打开都重置 | **符合规格，不算偏差** | PRODUCT_SPEC §3 P4 本来就规定「离开 P4 时不保留搜索和筛选条件」，搜索防抖 300ms 也和规格一致 | 无 |

此外，DEV_NOTES 的「Decisions on PRODUCT_SPEC §9」第 1–15 条都和 Jarvis 的裁定、我在规格里的建议一致，没有异议。第 6 条（补录时次数 ≥ 1 的组默认打勾，`doneAt` = 当前时间）可以接受；以后如果要按 `doneAt` 统计训练时长，补录的训练要排除掉（补录训练的 `startedAt` 为 null，可以据此判断）。

---

## 附：DESIGN.md 同步修正（本次走查发现的规范缺口）

只改了 `design/DESIGN.md`，都标注了「走查补充 / 走查修正」：
1. §2.1 新增颜色 token：`--c-disabled #E5E5E5`、`--c-check #CCCCCC`、`--c-ph-big #D6D6D6`，并说明 canvas 和弹窗颜色要放在 `utils/tokens.js` 里统一管理。
2. §2.2 新增字号 token：`--fs-stat 44`、`--fs-list 32`、`--fs-sm 28`、`--fs-err 24`（这些字号规范里本来就在用，但之前没有定义成 token）。
3. §4.4 修正录入行宽度：各列固定宽度、不收缩，合计 624rpx，能放进卡片内宽 638rpx；序号列点击区 72×88rpx。
4. §4.5 注明训练动作卡左右内边距为 24rpx。
