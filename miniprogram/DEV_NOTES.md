# DEV_NOTES — 健身小程序 v1（微信原生，本地存储，无云开发）

Current as of Phase 5 (2026-10-17). Older phase notes were removed; this file describes the code as it is now.

## Open / run
- 微信开发者工具 → 导入项目 → 目录选 `fitness-miniapp/miniprogram/`，AppID `touristappid`（或测试号）。基础库 ≥ 2.9（canvas 2d）。
- `node --test tests/` — unit tests (repo, migration, validation, format, components, chart scale).
- `node scripts/smoke-pages.js` — page flows on a fake wx runtime (not a renderer) + static WXML-handler check + showModal button-length check.
- `bash ../qa/run-all.sh` — dev unit + smoke + QA adversarial + QA miniprogram-simulate pages + TZ matrix.
- `node scripts/build-data.js` regenerates `data/exercises.js` from `../data/exercises.json` (fallbacks: `exercises.sample.json`, then a marked 10-item placeholder).

## Structure
- `utils/storage.js` — the only module touching `wx.*Storage`; injectable backend; read-only switch; corrupt/unreadable key tracking.
- `utils/repo/*` — all data access and business rules (spec/API.md). Pages are thin.
- `utils/format.js` display formatting, `utils/ui.js` result toasts / modal / guards, `utils/tokens.js` colours for canvas & modals.
- Components: nav-bar (centered title, capsule gap, read-only / data-error banner with 重新加载), btn, card, empty-state, undo-toast, month-calendar, line-chart (canvas 2d), set-row.
- Pages: calendar (P1), workout-detail (P2), workout-edit (P3), exercise-picker (P4), library (P5), exercise-detail (P6), body (P7), body-edit (P8), about (关于 / 数据来源).
- Storage keys: `fit_meta`, `fit_workouts`, `fit_workout_<id>`, `fit_body`, `fit_custom_exercises`, `fit_ui_prefs`; legacy `fit_workouts_v1` / `fit_body_v1` migrated once and kept.

## Data safety (Phase 5)
- **Corrupt or unreadable storage is never treated as empty and overwritten.** A key with the wrong shape (or whose read throws) is shown as empty, its raw value stays untouched, a copy goes to `fit_corrupt_<key>_<ts>`, and every write to that key fails with `DATA_CORRUPT`. Other keys keep working. Launch mode becomes `corrupt`; the nav-bar shows 「部分数据读取异常… · 重新加载」, which re-runs init. Orphan cleanup is skipped while `fit_workouts` is untrustworthy.
- Garbage / unreadable `fit_meta` → read-only session (we can't tell the data format). Newer schemaVersion → read-only.
- Brand-new user whose first `fit_meta` write fails → mode `error` but **not** read-only (nothing to protect); meta retried next launch.
- Queries never throw (read errors return empty values + health flag).
- Two-step workout writes (detail then header): a failed header write rolls the detail back, so failed operations leave storage unchanged. Launch recomputes stale header summaries from details.
- Save failure keeps user input: P3 no longer reloads after a storage failure; the entered set value stays on screen, the status line shows 「保存失败 · 重试」 and tapping it resends the last failed write. P8 keeps the form on failure.
- Migration: `done = reps >= 1` (reps 0/null → not done).
- Numbers: only JS numbers or plain decimal strings are accepted (no booleans/arrays/hex/exponent/full-width).
- Summaries only count sets belonging to an existing exercise (matches what is displayed).

## Decisions on PRODUCT_SPEC §9 and doc conflicts
1. Body weight required for new records (`WEIGHT_REQUIRED`). v0 records without weight keep null, are excluded from the weight chart, and can be edited (e.g. only the note) without adding a weight (DATA_MODEL §9.2 wins over the P8 required-field rule for that case; QA Q12).
2. P8 new mode → `saveBody` (merge per date); explicit edit → `updateBody`. A record auto-loaded in new mode re-targets on date change instead of moving.
3. <20 / >300 kg soft warning is UI only.
4. Warm-up sets show 热; normal sets numbered from 1; stored `index` unchanged.
5. Drafts stay in memory until the first exercise is added; leaving before that discards; deleting every exercise later keeps the draft (only 放弃 deletes it).
6. Backfilled workouts: new sets default done when reps ≥ 1, `doneAt` = now (exclude backfills, `startedAt == null`, from any future duration stats).
7. Editing never changes `completedAt`.
8. UI prefs in `fit_ui_prefs`; library search/filter kept in module memory.
9. Editing a completed workout: stays completed, **no cleanup**; 完成编辑 requires ≥1 done set; × offers 仍然离开 (edits already saved).
10. `addSet` copies weight/reps only; type normal.
11. `description` not shown. 12. No custom-exercise UI. 13. Library grouped by bodyPart, id order. 14. No 放弃修改 for completed edits.
15. A completed workout with 0 exercises keeps its summary card but no calendar dot (DATA_MODEL §4 rule 6; QA Q14 — product to confirm).

## Deviations from the spec (accepted in design review §三)
- No swipe-left delete: set long-press menu → 删除此组 (undo); hint 「长按组可设为热身或删除」 under the first exercise. Body rows: long-press → confirm. Workout delete in P2.
- No drag reorder: ⋯ → 调整顺序 with ↑/↓; 「完成排序」 is the bottom bar button in sort mode (top 完成 kept).
- Autosave per edit (sync storage), no 500 ms debounce.
- P6 「已加入当前训练」 is a modal (去查看 / 留在这里) — wx.showToast has no buttons. P5 list quick「+」 (lead Phase-4 requirement) shows a toast; hidden in read-only.
- 7.1 「[重试]」: implemented on P3's status line (toasts can't hold buttons), not inside the toast.
- No skeleton screen; lists render 30 at a time with 加载更多 / bottom auto-load.
- The generic data-failure UI is the nav-bar banner + 重新加载, not a separate full page; list pages still show their normal empty states underneath.

## Phase 5 design-review changes
- M1 nav title absolutely centered on screen, width = window − 2×capsule gap, ellipsis; P3 drops weekday + status tag when the area is < 170px (320pt), status then shown in the status line.
- M2 `catchlongpress` on ± and both inputs; row long-press only on number column / blank space.
- M3 「有未完成的训练」 → 继续 / 放弃 (body explains). All showModal buttons ≤ 4 chars (smoke harness now throws otherwise).
- M4 legend uses an accent dot for 今天. M5 tooltip clamped inside the canvas, flips below near the top, `.wrap overflow:hidden`. M6 nice Y scale, distinct labels.
- M7 see Data safety. M8 fixed set-row columns 72/240/200/88 + 8 gaps = 624rpx, no shrink; header shares widths; warm-up 热 is an inner chip so the tap area stays 72×88.
- Suggestions applied: S1/S2 colour tokens (+ `--c-disabled/--c-check/--c-ph-big`), S3 `utils/tokens.js`, S6 count beside the tab title, S8 range control on its own row, S9 name ellipsis, S11 `.hit` 88rpx on 继续 / 全部 / 编辑 / 清除 / 重置 / 今天, S12, S14 read-only disables set-row and bottom buttons, S15 「全部 / 不限」 chips, S16 dates as 「10月17日 周六」, S17 「加入动作后自动保存」, S18 total minutes only with ≥2 workouts, S19 toast shown by P2 (`?done=1`), S20, S21 CSS magnifier/clear icons, S22 this file; P8 weight key 「完成」 saves (part of S7).
- Deferred: S4/S5 full font-size/spacing token sweep and removing all inline styles (partial: new tokens + utilities added); S7 lifting the bar above the keyboard via `bindkeyboardheightchange`; S10 px minimum hit sizes (conflicts with QA T7 "px only for 1px lines"); generic `action-toast` for P6; S13 removing the list quick-add (kept per lead requirement, made safer).

## Attribution (QA Q9)
- Library footer 「关于 / 数据来源」 → `pages/about`: text from openGym (github.com/DuarteSantos8/openGym, commit e348fc1), AGPL-3.0 (+ MIT notice for ExerciseDB-derived entries), copyright lines, modifications (selected/translated/renamed fields), no openGym media used. Full licence viewable in-app (`data/license-openGym.js`) and shipped as `LICENSE-openGym.txt`.
- Risk: the WeChat uploader may drop `.txt` files from the package (file-type whitelist); the in-app copy covers that. Whether this satisfies AGPL obligations (e.g. source offer) is a lead/legal decision, not settled here.

## Known issues / untested
- No WeChat devtools or device run in this environment: real rendering, canvas drawing and touch bubble, keyboard behaviour, 320pt layout and the actual showModal failure are verified only statically / in simulators.
- After a failed save, the next *successful* edit reloads from storage, so an earlier unsaved value is replaced by the stored one unless 重试 was tapped first.
- List pages under a corrupt key show normal empty states beneath the banner.
- Library filtering is a linear scan (fine for 284 items).
