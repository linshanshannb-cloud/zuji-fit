#!/usr/bin/env bash
# QA 一键复现（在任意目录运行）：bash qa/run-all.sh   结果写到 qa/results/
set -u
QA="$(cd "$(dirname "$0")" && pwd)"; MP="$QA/../miniprogram"; OUT="$QA/results"; mkdir -p "$OUT"
cd "$MP" && node --test tests/ > "$OUT/1-dev-unit.txt" 2>&1; echo "dev unit (miniprogram/tests):   $(grep -E '^# (pass|fail)' "$OUT/1-dev-unit.txt" | tr '\n' ' ')"
cd "$MP" && node scripts/smoke-pages.js > "$OUT/2-dev-smoke.txt" 2>&1; echo "dev smoke (scripts/smoke-pages): $(tail -1 "$OUT/2-dev-smoke.txt")"
cd "$QA" && node --test tests/ > "$OUT/3-qa-adversarial.txt" 2>&1; echo "qa adversarial (qa/tests):      $(grep -E '^# (pass|fail)' "$OUT/3-qa-adversarial.txt" | tr '\n' ' ')"
if [ ! -d "$QA/sim/node_modules/miniprogram-simulate" ]; then (cd "$QA/sim" && npm i --silent miniprogram-simulate@1 jsdom@22); fi
cd "$QA/sim" && node --test pages.sim.test.js > "$OUT/4-qa-pages-sim.txt" 2>&1; echo "qa pages (miniprogram-simulate): $(grep -E '^# (pass|fail)' "$OUT/4-qa-pages-sim.txt" | tr '\n' ' ')"
cd "$QA" && node run-tz-matrix.js > "$OUT/5-qa-tz-matrix.txt" 2>&1; echo "qa TZ matrix:"; cut -c1-48 "$OUT/5-qa-tz-matrix.txt"
cd "$QA" && node check-videos.js > "$OUT/6-video-static.txt" 2>&1; echo "video static (check-videos):     $(tail -1 "$OUT/6-video-static.txt")"
grep -hE '^not ok' "$OUT/3-qa-adversarial.txt" "$OUT/4-qa-pages-sim.txt" > "$OUT/failures.txt"; echo "失败用例清单: $OUT/failures.txt ($(wc -l < "$OUT/failures.txt") 条)"
