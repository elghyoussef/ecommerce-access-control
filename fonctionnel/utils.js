// bcryptHash et queryPromise
const bcrypt = require('bcrypt');
let connection;

const bcryptHash = (password, saltRounds) => {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (err) reject(err);
      else resolve(hash);
    });
  });
};

// Use the connection directly
const queryPromise = (query, params) => {
  return new Promise((resolve, reject) => {
    if (!connection) {
      return reject(new Error('Database connection not set. Call setConnection first.'));
    }
    connection.query(query, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

// Import the VIP cleanup functionality
const { cleanupExpiredVipSubscriptions } = require('./utils/vipCleanup');

module.exports = {
  bcryptHash,
  queryPromise,
  // Keep this for backward compatibility
  setConnection: (conn) => {
    connection = conn; 
  },
  // Export VIP cleanup function
  cleanupExpiredVipSubscriptions
};
