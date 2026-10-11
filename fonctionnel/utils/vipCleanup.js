/**
 * VIP Status Cleanup Utility
 * This script checks for expired VIP subscriptions and resets them in the database
 * It can be run as a scheduled task (cron job) or called on server start
 */

const db = require('../../non_fonctionnel/db');
const { promisify } = require('util');

// Convert database query to promise-based
const queryPromise = promisify(db.query).bind(db);

/**
 * Finds and resets all expired VIP subscriptions in the database
 * @returns {Promise<{success: boolean, count: number, error: Error|null}>}
 */
async function cleanupExpiredVipSubscriptions() {
  try {
    console.log('[VIP Cleanup] Starting cleanup of expired VIP subscriptions');
    
    // Find all users with expired VIP status
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const findExpiredSql = `
      SELECT id, username, email, vip_expiry_date
      FROM users
      WHERE isVIP = 1
      AND vip_expiry_date < ?
    `;
    
    const expiredUsers = await queryPromise(findExpiredSql, [today]);
    console.log(`[VIP Cleanup] Found ${expiredUsers.length} expired VIP subscriptions`);
    
    if (expiredUsers.length === 0) {
      return { success: true, count: 0, error: null };
    }
      // Reset VIP status for expired users
    const resetSql = `
      UPDATE users
      SET isVIP = 0, vip_expiry_date = NULL
      WHERE vip_expiry_date < ?
    `;
    
    const result = await queryPromise(resetSql, [today]);
    console.log(`[VIP Cleanup] Reset ${result.affectedRows} expired VIP subscriptions`);
    
    // Log the details of expired subscriptions
    expiredUsers.forEach(user => {
      console.log(`[VIP Cleanup] Expired VIP for user: ${user.username || user.email} (ID: ${user.id}), expired on: ${user.vip_expiry_date}`);
    });
    
    return { 
      success: true, 
      count: result.affectedRows,
      error: null
    };
    
  } catch (error) {
    console.error('[VIP Cleanup] Error during VIP cleanup:', error);
    return { 
      success: false, 
      count: 0,
      error: error
    };
  }
}

// Export for use in other files
module.exports = {
  cleanupExpiredVipSubscriptions
};

// If this script is run directly (not imported), execute the cleanup
if (require.main === module) {
  cleanupExpiredVipSubscriptions()
    .then(result => {
      if (result.success) {
        console.log(`[VIP Cleanup] Successfully cleaned up ${result.count} expired VIP subscriptions`);
        process.exit(0);
      } else {
        console.error('[VIP Cleanup] Failed to clean up expired VIP subscriptions');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('[VIP Cleanup] Unhandled error during execution:', err);
      process.exit(1);
    });
}
