// Static check: every require() in the mini-program (excluding tests/, scripts/, node_modules) must resolve to a FILE, not a directory.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../miniprogram'); const bad = []; let n = 0;
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
  if (fs.statSync(p).isDirectory()) { if (!['tests', 'scripts', 'node_modules'].includes(f) || d !== ROOT) walk(p); continue; }
  if (!p.endsWith('.js')) continue;
  const src = fs.readFileSync(p, 'utf8'); const re = /require\(\s*(['"])([^'"]+)\1\s*\)/g; let m;
  while ((m = re.exec(src))) { n++; const spec = m[2];
    const base = spec.startsWith('/') ? path.join(ROOT, spec) : path.resolve(path.dirname(p), spec);
    const isFile = fs.existsSync(base) && fs.statSync(base).isFile() || fs.existsSync(base + '.js');
    const isDir = fs.existsSync(base) && fs.statSync(base).isDirectory();
    if (!isFile) bad.push(`${path.relative(ROOT, p)}: require('${spec}') -> ${isDir ? 'DIRECTORY' : 'NOT FOUND'}`); } } })(ROOT);
console.log(`checked ${n} require() calls`); if (bad.length) { console.log(bad.join('\n')); process.exit(1); } console.log('OK: all resolve to files');
