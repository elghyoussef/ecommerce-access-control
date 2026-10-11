// filepath: c:\Users\wacma\Desktop\pfe\Ecommerce_App_v0\fonctionnel\utils\logger.js
const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '..', '..', 'login_attempts.log');

/**
 * Logs a login attempt.
 * @param {object} data - The data to log.
 * @param {string} data.email - The email used for the login attempt.
 * @param {string} [data.username] - The username, if available.
 * @param {boolean} data.success - Whether the login was successful.
 * @param {string} data.reason - The reason for success or failure.
 * @param {string} [data.ip] - The IP address of the user.
 * @param {object} [data.geoInfo] - Geolocation information.
 */
function logLoginAttempt(data) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    email: data.email,
    username: data.username || 'N/A',
    success: data.success,
    reason: data.reason,
    ip: data.ip || 'N/A',
    geoInfo: data.geoInfo || {},
  };

  const logString = JSON.stringify(logEntry) + '\n';

  fs.appendFile(logFilePath, logString, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

module.exports = { logLoginAttempt };