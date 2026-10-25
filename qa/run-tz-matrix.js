#!/usr/bin/env node
// 在多个时区下重跑日期/日历/图表测试。用法（在 qa/ 下）：node run-tz-matrix.js
const { spawnSync } = require('child_process');
const zones = ['Asia/Shanghai', 'UTC', 'America/Los_Angeles', 'Europe/London', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Australia/Lord_Howe'];
let bad = 0;
for (const tz of zones) {
  const r = spawnSync(process.execPath, ['--test', 'tests/dates-calendar-chart.test.js', 'tests/edit-delete.test.js', 'tests/reload.test.js'], { cwd: __dirname, env: Object.assign({}, process.env, { TZ: tz }), encoding: 'utf8' });
  const pass = (r.stdout.match(/^# pass (\d+)/m) || [])[1], fail = (r.stdout.match(/^# fail (\d+)/m) || [])[1];
  const fails = (r.stdout.match(/^not ok \d+ - .*/gm) || []).join(' ; ');
  console.log(`${tz.padEnd(22)} pass ${pass} fail ${fail}${fails ? '  ' + fails : ''}`);
  if (fail !== '2') bad++; // 预期仅 E4、P7 两项已知问题失败
}
process.exit(bad ? 1 : 0);
