/**
 * Script to run the VIP subscription cleanup utility
 * This can be scheduled to run daily via cron job or Windows Task Scheduler
 */

const vipCleanup = require('../fonctionnel/utils/vipCleanup');

console.log(`[${new Date().toISOString()}] Starting scheduled VIP subscription cleanup...`);

vipCleanup.cleanupExpiredVipSubscriptions()
  .then(result => {
    if (result.success) {
      console.log(`[${new Date().toISOString()}] Successfully cleaned up ${result.count} expired VIP subscriptions`);
      process.exit(0);
    } else {
      console.error(`[${new Date().toISOString()}] Failed to clean up expired VIP subscriptions`);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error(`[${new Date().toISOString()}] Unhandled error during VIP cleanup:`, err);
    process.exit(1);
  });
