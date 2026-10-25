# Repository API（miniprogram/utils/repo）· schemaVersion 1

Updated 2026-10-17 (UTC+8) to match DATA_MODEL.md and the lead's rulings. Pages only `require('../../utils/repo')`. Only `utils/storage.js` touches `wx.*Storage`.

## Conventions
- **Mutations** return `{ ok: true, data, ...extra }` or `{ ok: false, code, message }`. `message` is Chinese and ready to show (`utils/ui.handle(r)` toasts it). Mutations never throw on validation or storage errors.
- **Queries** return plain values (`null` when not found) and never throw (unknown body field names are the exception). A failed `getStorageSync` or a key with the wrong shape yields the empty value for display **and** marks that key unreadable/corrupt (see Storage safety); check `repo.health()`.
- **Workout writes are two-step** (detail key, then `fit_workouts`). If the header write fails, the detail is written back to its previous value (or removed if it was new), so a failed mutation leaves storage unchanged. Launch also recomputes stale header summaries from details (`healHeaders`).

### Storage safety (PRODUCT_SPEC §7.2)
- `fit_workouts` / `fit_body` / `fit_custom_exercises` must be arrays, `fit_workout_<id>` an object with `exercises[]`/`sets[]`, `fit_meta` an object with numeric `schemaVersion`, `fit_ui_prefs` an object.
- A key with the wrong shape is marked **corrupt**: its raw value is left untouched, copied once to `fit_corrupt_<key>_<ts>` (best effort), shown as empty, and every write to it fails with `DATA_CORRUPT`. Other keys stay writable. Orphan cleanup is skipped while `fit_workouts` is not trustworthy.
- A key whose read throws is marked **unreadable**, same write block.
- `repo.health()` → `{ok, corruptKeys, unreadableKeys}`; `repo.reload()` clears the flags and re-runs `init()` (the nav-bar 「重新加载」 banner).
- Dates are local `YYYY-MM-DD`. "Today" comes from the injectable clock.

### Error codes
| code | when |
|---|---|
| `READ_ONLY` | schemaVersion newer than code, garbage `fit_meta`, unreadable `fit_meta`, or launch migration failed (writes blocked for the session). Not used when a brand-new user's first `fit_meta` write fails: that session stays writable and meta is retried next launch |
| `DATA_CORRUPT` | write to a key that is corrupt or could not be read; original data is kept (message: 数据读取异常，已暂停保存以保护原数据) |
| `QUOTA_EXCEEDED` / `WRITE_FAILED` | `setStorageSync` threw (out of space / other) |
| `NOT_FOUND` | id does not exist |
| `DRAFT_EXISTS` | a persisted draft already exists (`data` = that draft's header) |
| `NOT_DRAFT` | `completeWorkout` on a non-draft |
| `NO_DONE_SETS` | finishing with no `done` set (draft: completion rule; completed: UI gate in `finalizeWorkout`) |
| `EMPTY_SELECTION` | `addExercises` with an empty list on an in-memory draft |
| `UNKNOWN_EXERCISE` | exercise id not in the built-in or custom library |
| `ARCHIVED_EXERCISE` | adding/replacing with an archived custom exercise (it still displays in old workouts) |
| `ALREADY_RESTORED` | undo payload restored twice |
| `INVALID_ORDER` | reorder ids are not a permutation |
| `INVALID_DATE` / `FUTURE_DATE` | bad date / later than today |
| `TEXT_TOO_LONG` | name > 30, workout note > 500, exercise/body note > 200, custom description > 500 |
| `INVALID_WEIGHT` / `INVALID_REPS` / `INVALID_TYPE` / `REPS_REQUIRED` | set validation; a done set needs reps ≥ 1. Numbers must be a JS number or a plain decimal string (`"62.5"`, `" .5 "`); booleans, arrays, hex, exponent and full-width digits are rejected (same for body inputs) |
| `WEIGHT_REQUIRED` | body record would end up without weight: new record without weight, a merge onto a weightless (v0) record, or `updateBody` clearing weight. Message: 请填写体重 |
| `INVALID_BODY_WEIGHT` / `INVALID_BODY_FAT` / `INVALID_WAIST` | non-blank body input that is not a number or is out of range (0<x≤700 / ≤100 / ≤300). Always an error; it never silently nulls the stored value |
| `DATE_CONFLICT` | `updateBody` moving to a date that already has a record |
| `NAME_REQUIRED` / `INVALID_BODY_PART` / `INVALID_BODY_PART_DETAIL` / `INVALID_EQUIPMENT` / `INVALID_CATEGORY` / `INVALID_MUSCLE` | custom exercise validation against filters.json |

## Lifecycle
| fn | notes |
|---|---|
| `repo.init()` | Call in `App.onLaunch`. Returns `{mode:'normal'|'corrupt'|'readonly'|'error', schemaVersion, migrated, migratedFrom?, error?, message?, readOnly?, health}`. `corrupt` = launched normally but some keys are damaged (writes to those keys blocked). New user: writes meta. v0 data: runs `migrate_0_to_1`, writing details, then headers, then body, then meta last (legacy keys kept). Also cleans orphaned `fit_workout_*` keys and heals custom exercises. Newer schema: read-only, writes nothing. Failure: `mode:'error'`, writes blocked, retried on next launch. |
| `repo.status()` / `repo.isReadOnly()` / `repo.health()` / `repo.reload()` | see Storage safety |

## repo.workouts
**Draft lifecycle (DATA_MODEL §4.1).**
- `createDraft({date, name, note, startTimer, exerciseIds})` fixes `id`, `createdAt` and `startedAt` (now when the date is today, otherwise null).
- Without `exerciseIds` the draft is held **in memory** (`data.persisted === false`) and nothing is written.
- The first `addExercise(s)` persists it: the detail key first, then `fit_workouts`. `createdAt`/`startedAt` keep their in-memory values.
- With `exerciseIds` the draft is persisted immediately.
- `discardPending()` drops the in-memory draft (call it in the page's `onUnload`).
- A persisted draft whose exercises are all removed stays stored; only `discardDraft()` deletes it.
- `DRAFT_EXISTS` refers to a persisted draft.

| fn | returns / notes |
|---|---|
| `getPending()` / `discardPending()` | in-memory draft header \| null |
| `getDraft()` | persisted draft header \| null |
| `getHeader(id)` / `getWorkout(id)` | header or full view (in-memory draft included, flagged `persisted:false`). The view has a recomputed summary, `displayName`, and `exercises[]` sorted by order. Each exercise has `displayName` (nameZh → nameSnapshot → 未知动作), `exercise` (`{unknown:true}` if missing), and `sets[]` sorted by index. |
| `listWorkouts({status='completed', from, to})` / `workoutsOn(date)` | headers + `displayName` |
| `completedDates(from?, to?)` | `{date: count}` of completed workouts **with ≥1 exercise** (migrated empty workouts stay stored and listed but don't mark the day) |
| `daySummaries(date)` | calendar cards: header + `durationMin` (null for backfill) + `top` (≤3 exercises with done-normal set count and best set) + `more` + `detailMissing` |
| `personalBest(exerciseId)` | `{weightKg, reps, date, workoutId}` \| null. Heaviest done normal set (tie → more reps) across completed workouts. |
| `referencedExerciseIds()` | `{exerciseId:true}` |
| `createDraft(opts)` | see above |
| `updateWorkout(id, {date?, name?, note?})` | Works on the in-memory draft too. Never changes `status` or `completedAt`. |
| `healHeaders()` | Launch self-heal: recompute header summaries from details. Summaries only count sets that belong to an existing WorkoutExercise. |
| `addExercises(id, exerciseIds)` / `addExercise(id, exerciseId)` | Appends WorkoutExercise(s) at the end, in the given order, each with **1 empty set** (weight/reps null, not done). All ids are validated before anything is written. |
| `addToCurrentDraft(exerciseId)` | Appends to the persisted draft, or creates today's draft with that exercise → `{workoutId, created}` |
| `replaceExercise(id, weId, exerciseId)` | Keeps sets; updates `exerciseId` + `nameSnapshot`. |
| `removeExercise(id, weId)` → `data: {exercise, sets}` | Cascades to its sets and renumbers order. Pass `data` to `restoreExercise(id, data)` for undo (original order). |
| `reorderExercises(id, orderedIds)` / `moveExercise(id, weId, toIndex)` | |
| `updateExerciseNote(id, weId, note)` | ≤200 |
| `addSet(id, weId, {weightKg?, reps?, type?, done?})` | Copies **only** weight/reps from the previous set. `type` is `'normal'` unless given. Backfilled workouts (`startedAt == null`) default `done=true` when reps ≥ 1. |
| `duplicateSet(id, setId)` | Inserts a copy below (same type, not done unless backfill). |
| `updateSet(id, setId, {weightKg?, reps?, type?})` | A done set must keep reps ≥ 1. |
| `setSetDone(id, setId, bool)` | Needs reps ≥ 1; sets or clears `doneAt`. |
| `deleteSet(id, setId)` → `data: removedSet` | Renumbers index. Pass `data` to `restoreSet(id, set)` for undo (original index). |
| `completionCheck(id)` | `{status, canFinish, doneSets, willRemove[], exercisesWithoutDone[], undoneSets}` for the R-C dialog. `willRemove` is always empty for completed workouts. |
| `completeWorkout(id)` | Draft only. Removes exercises with no done set, keeps unticked sets, needs ≥1 done set, sets `completedAt`. |
| `finalizeWorkout(id)` | 完成训练 / 完成编辑. Draft → `completeWorkout`. Completed → **no cleanup is re-run** (DATA_MODEL §4.3); it only checks ≥1 done set (normal or warmup) as a UI gate (`NO_DONE_SETS`). Edits are already saved and the workout stays `completed` either way; `completedAt` is never changed. |
| `deleteWorkout(id)` / `discardDraft()` | Removes the header first, then the detail key. `discardDraft` also drops an in-memory draft. |

Every persisted mutation writes the detail key, then the headers (recomputed `exerciseCount/setCount/volumeKg`, `updatedAt`). Volume and set count include only `done && type==='normal'`; null weight counts as 0.

## repo.body
| fn | notes |
|---|---|
| `listBody()` / `getBody(id)` / `getBodyByDate(date)` / `bodyDates(from?, to?)` | |
| `saveBody({date?, weightKg?, bodyFatPct?, waistCm?, note?})` | **New record:** valid `weightKg` required. **Same day:** merges, so a blank field keeps the old value (including weight) and a non-blank invalid value is an error. The merged record must have a weight (`WEIGHT_REQUIRED`). `id`, `createdAt` and `extra` are unchanged. Response has `merged:true` when it merged. |
| `updateBody(id, patch)` | `bodyFatPct`/`waistCm` present in the patch replace the stored value (blank → null). `weightKg` present must be valid (blank → `WEIGHT_REQUIRED`; it can't be cleared); absent → kept, so v0 records without weight can still be edited. The date can move (`DATE_CONFLICT`). |
| `deleteBody(id)` | |
| `bodySeries(field, 30|90|'all')` | `{field, range, from, to, points:[{date,value}]}`. Only non-null values, no interpolation (v0 records with null weight are excluded from the weight chart). |
| `bodyStats(field, range)` | `{series, current, previous, delta, totalRecords, fieldTotal}`. `previous` is the prior non-null record and may be outside the range. |
| `bodyRows(field, range)` | list rows from the same series as the chart, newest first: `{id, date, value, delta}` |

## repo.exercises
`all()` (custom non-archived first, then built-in) · `get(id)` (archived/unknown safe) · `filter({q, bodyPart, equipment, target, includeSecondary})` · `display(ex)` (`bodyPartZh, equipmentZh, targetZh, secondaryZh[]` via filters.json `muscles`) · `zhOf(kind, value)` · `bodyParts / equipments / targets` · `listCustom`, `addCustom` (`warning:'DUPLICATE_NAME'`), `updateCustom` · `repo.deleteCustomExercise(id)` (archive if referenced). Custom exercises have no UI in v1.

## repo.prefs (UI preferences, not schema)
`get(key, default)` / `set(key, value)` on `fit_ui_prefs`. Best-effort: it doesn't write in read-only mode and ignores failures. Used for `bodyView`.

## repo.series
`chartLayout(series, w, h, pad?)` → `{points:[{x,y,date,value}], ticks:[{v,label,y}], pad}`. x is proportional to the date. Y bounds come from `niceScale(min,max)`: 10% margin, snapped to a step of 0.2/0.5/1/2/5/10…, 2–4 intervals, never below 0 for non-negative data; labels have 1 decimal only when step < 1, so they are always distinct. `bubblePos(point, w, h, bubbleW)` clamps the tooltip inside the canvas and flips it below the point near the top.

## Validators (`repo.validate`)
`validateSetWeight`, `validateReps`, `validateBodyWeight` (required → `WEIGHT_REQUIRED`), `validateBodyWeightOptional`, `validateBodyFat`, `validateWaist`, `normalizeBody*`, `validateDate`, `validateText`, `round1`, `LIMITS`.

## Migration (`utils/repo/migrate.js`)
`migrate_0_to_1(v0, now)` (pure):
- Set reps that aren't an integer in 0–999 → null; weight outside 0–999.9 → null.
- `done = reps >= 1` (DATA_MODEL §9.2): sets with reps 0 or null are migrated as not done.
- `extra` chest/hip/arm are range-checked (0–300) and rounded to 1 decimal.
- Body records without a valid weight are kept with `weightKg=null` if any other data exists.
- Empty v0 workouts are kept as completed.
