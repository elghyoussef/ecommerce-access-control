const bcrypt = require('bcrypt');
const { query, pool } = require('../non_fonctionnel/db');

async function main() {
  if (!process.env.DEMO_PASSWORD) throw new Error('Set DEMO_PASSWORD in .env');
  const password = await bcrypt.hash(process.env.DEMO_PASSWORD, 10);
  for (const [username, email, isAdmin] of [
    ['Demo Admin', 'admin@example.test', 1],
    ['Demo Customer', 'customer@example.test', 0],
  ]) {
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length === 0) {
      await query('INSERT INTO users (username, email, password, isAdmin, birthday) VALUES (?, ?, ?, ?, ?)',
        [username, email, password, isAdmin, '2000-01-01']);
    }
  }
  const products = await query('SELECT id FROM products LIMIT 1');
  if (products.length === 0) {
    await query('INSERT INTO products (name, price, imgsrc) VALUES (?, ?, ?)',
      ['Synthetic demo item', 49.90, '/demo-item.png']);
  }
  console.log('Synthetic accounts: admin@example.test / customer@example.test');
  console.log('Password: the DEMO_PASSWORD value in your private .env. Existing accounts were not changed.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => pool.end());
