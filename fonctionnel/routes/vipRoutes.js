// filepath: c:\Users\wacma\Desktop\pfe\Ecommerce_App_v0\fonctionnel\routes\vipRoutes.js
/**
 * VIP subscription routes
 */
module.exports = function(app, connection, isAuthenticated) {
  // Subscribe to VIP
  app.post('/api/subscribe/vip', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    
    // Calculate expiry date (1 month from now)
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setMonth(now.getMonth() + 1);
    const expiryDateFormatted = expiryDate.toISOString().slice(0, 10); // YYYY-MM-DD format

    // Update user to VIP status
    const updateQuery = "UPDATE users SET isVIP = 1, vip_expiry_date = ? WHERE id = ?";
    connection.query(updateQuery, [expiryDateFormatted, userId], (err, result) => {
      if (err) {
        console.error('Error upgrading user to VIP:', err);
        return res.status(500).json({
          success: false,
          error: 'Une erreur est survenue lors de la mise à niveau vers VIP'
        });
      }
      
      // Update session
      req.session.user.isVIP = 1;
      req.session.user.vip_expiry_date = expiryDateFormatted;
      
      // Log VIP subscription
      console.log(`User ${userId} upgraded to VIP status until ${expiryDateFormatted}`);
      
      return res.json({
        success: true,
        message: 'Upgrade to VIP successful',
        expiryDate: expiryDateFormatted
      });
    });
  });

// Get VIP status
app.get('/api/vip/status', isAuthenticated, (req, res) => {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Return VIP status
  const isVIP = user.isVIP === 1;
  let expiryDate = null;
  let daysRemaining = 0;
  
  if (isVIP && user.vip_expiry_date) {
    expiryDate = new Date(user.vip_expiry_date);
    const now = new Date();
    
    // Calculate days remaining
    const diffTime = expiryDate - now;
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  return res.json({
    isVIP,
    expiryDate: user.vip_expiry_date,
    daysRemaining: Math.max(0, daysRemaining)
  });
});}