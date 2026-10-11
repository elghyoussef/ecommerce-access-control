const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const target = path.join(__dirname, '..', '.env');
if (fs.existsSync(target)) {
  console.log('.env already exists; preserved.');
} else {
  const template = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
  const configured = template.replace(/^(DB_PASSWORD|SESSION_SECRET|DEMO_PASSWORD)=$/gm,
    (_, key) => `${key}=${randomBytes(24).toString('hex')}`);
  fs.writeFileSync(target, configured, { flag: 'wx', mode: 0o600 });
  console.log('Local .env created with random lab credentials.');
}
