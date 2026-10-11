const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const router = require('../fonctionnel/routes/securityRoutes');
const { pool } = require('../non_fonctionnel/db');

test.after(() => pool.end());

test('the policy router leaves login reachable', async () => {
  const app = express();
  app.use((req, res, next) => { req.session = {}; next(); });
  app.use('/api', router);
  app.post('/api/login', (req, res) => res.json({ reachable: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/login`, {
      method: 'POST', signal: AbortSignal.timeout(2000),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reachable: true });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

for (const [name, user, expected] of [
  ['anonymous visitor', undefined, 401],
  ['ordinary customer', { isAdmin: 0 }, 403],
]) {
  test(`policy writes reject ${name}`, async () => {
    // Given: the real policy router and a non-administrative session.
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.session = { user }; next(); });
    app.use('/api', router);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      // When: a client attempts to change a policy.
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/policy/age`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: '{}', signal: AbortSignal.timeout(3000),
      });
      // Then: authorization fails before any database operation.
      assert.equal(response.status, expected);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
}
