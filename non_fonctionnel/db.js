// Configuration de la base de données
const mysql = require('mysql');
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  connectTimeout: 10000, // 10 seconds
  waitForConnections: true,
  queueLimit: 0
});

// Promisify for async/await use
const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (error, results) => {
      if (error) {
        console.error('Query error:', error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

module.exports = { query, pool };
