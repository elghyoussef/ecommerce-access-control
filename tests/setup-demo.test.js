const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

for (const [name, newline] of [['LF', '\n'], ['CRLF', '\r\n']]) {
  test(`setup generates credentials from ${name} templates and preserves existing configuration`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-setup-'));
    fs.mkdirSync(path.join(root, 'scripts'));
    const script = path.join(root, 'scripts/setup-demo.js');
    fs.copyFileSync(path.join(__dirname, '../scripts/setup-demo.js'), script);
    fs.writeFileSync(path.join(root, '.env.example'),
      ['DB_PASSWORD=', 'SESSION_SECRET=', 'DEMO_PASSWORD=', 'DB_PORT=3307', ''].join(newline));
    try {
      const first = spawnSync(process.execPath, [script], { windowsHide: true, timeout: 5000 });
      assert.equal(first.status, 0);
      const initial = fs.readFileSync(path.join(root, '.env'), 'utf8');
      for (const key of ['DB_PASSWORD', 'SESSION_SECRET', 'DEMO_PASSWORD']) {
        assert.match(initial, new RegExp(`^${key}=[a-f0-9]{48}\\r?$`, 'm'));
      }
      const second = spawnSync(process.execPath, [script], { windowsHide: true, timeout: 5000 });
      assert.equal(second.status, 0);
      assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), initial);
    } finally {
      const target = fs.realpathSync(root);
      assert.equal(path.dirname(target), fs.realpathSync(os.tmpdir()));
      assert.ok(path.basename(target).startsWith('portfolio-setup-'));
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
}
