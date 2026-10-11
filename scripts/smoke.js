const assert = require('node:assert/strict');
const base = `http://127.0.0.1:${process.env.PORT || 3030}`;
async function main() {
  const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(15000) });
  assert.equal(health.status, 200, 'Server and database must be running');
  assert.equal((await health.json()).database, 'connected');
  const forbidden = await fetch(`${base}/api/policy/age`, { method: 'POST', signal: AbortSignal.timeout(5000) });
  assert.equal(forbidden.status, 401);
  const login = await fetch(`${base}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.test', password: process.env.DEMO_PASSWORD,
      geoInfo: { isLocalhost: true, timezone: 'Africa/Casablanca' } }),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).success, true);
  const cookie = login.headers.get('set-cookie');
  assert.ok(cookie, 'Seeded admin login must establish a session');
  const policy = await fetch(`${base}/api/policy/age`, {
    headers: { Cookie: cookie.split(';')[0] }, signal: AbortSignal.timeout(5000),
  });
  assert.equal(policy.status, 200);
  const update = await fetch(`${base}/api/policy/age`, {
    method: 'POST', headers: { Cookie: cookie.split(';')[0], 'Content-Type': 'application/json' },
    body: JSON.stringify({ min_age: 18, max_age: 90, is_active: false }),
    signal: AbortSignal.timeout(5000),
  });
  assert.ok([200, 201].includes(update.status));
  const saved = await fetch(`${base}/api/policy/age`, {
    headers: { Cookie: cookie.split(';')[0] }, signal: AbortSignal.timeout(5000),
  });
  assert.equal((await saved.json()).min_age, 18);
  const customer = await fetch(`${base}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@example.test', password: process.env.DEMO_PASSWORD,
      geoInfo: { isLocalhost: true, timezone: 'Africa/Casablanca' } }),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(customer.status, 200);
  const customerCookie = customer.headers.get('set-cookie');
  assert.ok(customerCookie);
  const denied = await fetch(`${base}/api/policy/age`, {
    headers: { Cookie: customerCookie.split(';')[0] }, signal: AbortSignal.timeout(5000),
  });
  assert.equal(denied.status, 403);
  console.log('PASS: database health, anonymous rejection, admin login/read/write, customer rejection.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
