// User management routes
module.exports = function(app, connection, bcryptHash, queryPromise, isAuthenticated, isAdmin) {
  // API: Get all users
  app.get('/api/users', isAuthenticated, isAdmin, (req, res) => {
    const sql = 'SELECT id, username, email, isAdmin, isVIP FROM users';
    connection.query(sql, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
      }
      res.json(results);
    });
  });
  // API: VIP Subscription
  app.post('/api/subscribe/vip', isAuthenticated, async (req, res) => {
    try {
      // Get user ID from session
      const userId = req.session.user.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Utilisateur non authentifié'
        });
      }
      
      // Calculate expiry date (1 month from now)
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      
      // Format the date for MySQL
      const formattedExpiryDate = expiryDate.toISOString().slice(0, 19).replace('T', ' ');
      
      // Update user to VIP status with expiry date in the database
      const updateSql = "UPDATE users SET isVIP = 1, vip_expiry_date = ? WHERE id = ?";
      await queryPromise(updateSql, [formattedExpiryDate, userId]);
      
      // Update the session data to reflect the change
      req.session.user.isVIP = 1;
      req.session.user.vip_expiry_date = formattedExpiryDate;
      
      console.log(`User ID ${userId} upgraded to VIP status until ${formattedExpiryDate}`);
      
      // Return success response
      res.status(200).json({
        success: true,
        message: 'Statut VIP activé avec succès',
        expiryDate: formattedExpiryDate
      });
    } catch (error) {
      console.error('Error upgrading to VIP:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors du traitement de l\'abonnement VIP',
        details: error.message
      });
    }
  });

  // API: Create user
  app.post('/create-user', isAuthenticated, isAdmin, async (req, res) => {
    const { username, email, password, isAdmin, birthday, isVIP } = req.body;
    try {
      const hash = await bcryptHash(password.toString(), 8);
      const sql = 'INSERT INTO users (username, email, password, isAdmin, birthday, isVIP) VALUES (?, ?, ?, ?, ?, ?)';
      await queryPromise(sql, [username, email, hash, isAdmin === 'true' ? 1 : 0, birthday, isVIP === 'true' ? 1 : 0]);
      res.send('Utilisateur créé');
    } catch (err) {
      console.error(err);
      res.status(500).send('Erreur lors de la création de l\'utilisateur');
    }
  });
  // API: Edit user (username, password, isAdmin)
  app.post('/edit-user', isAuthenticated, isAdmin, async (req, res) => {
    const { id, username, password, isAdmin } = req.body;
    try {
      let sql, params;
      // Convert isAdmin to a boolean then to 0/1 for MySQL
      const isAdminValue = isAdmin ? 1 : 0;
      
      if (password && password.length > 0) {
        const hash = await bcryptHash(password.toString(), 8);
        sql = 'UPDATE users SET username = ?, password = ?, isAdmin = ? WHERE id = ?';
        params = [username, hash, isAdminValue, id];
      } else {
        sql = 'UPDATE users SET username = ?, isAdmin = ? WHERE id = ?';
        params = [username, isAdminValue, id];
      }
      await queryPromise(sql, params);
      res.json({ success: true, message: 'Utilisateur modifié' });
    } catch (err) {
      console.error(err);
      res.status(500).send('Erreur lors de la modification de l\'utilisateur');
    }
  });

  // API: Delete user
  app.post('/delete-user', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.body;
    try {
      await queryPromise('DELETE FROM users WHERE id = ?', [id]);
      res.send('Utilisateur supprimé');
    } catch (err) {
      console.error(err);
      res.status(500).send('Erreur lors de la suppression de l\'utilisateur');
    }
  });

  // API: Get current user info for navbar/admin link
  app.get('/api/user', (req, res) => {
    if (req.session && req.session.user) {
      // Avoid sending password or sensitive info
      const { user } = req.session;
      res.json({
        username: user.user?.username || user.username,
        email: user.user?.email || user.email,
        isAdmin: user.isAdmin || user.user?.isAdmin || false,
        isVIP: user.isVIP || user.user?.isVIP || false,
        vip_expiry_date: user.vip_expiry_date || user.user?.vip_expiry_date || null
      });
    } else {
      res.json({ isAdmin: false, isVIP: false, vip_expiry_date: null });
    }
  });
  
  app.get('/api/userinfo', (req, res) => {
    if (req.session && req.session.user) {
      const user = req.session.user.user || req.session.user;
      res.json({
        username: user.username,
        email: user.email,
        birthday: user.birthday,
        isAdmin: user.isAdmin || false,
        isVIP: user.isVIP || false,
        vip_expiry_date: user.vip_expiry_date || null
      });
    } else {
      res.json({});
    }
  });
  
  // API: Get orders for current user
  app.get('/api/user/orders', isAuthenticated, async (req, res) => {
    try {
      const user = req.session.user.user || req.session.user;
      const email = user.email;
      
      if (!email) {
        return res.status(400).json({ error: 'User email not found in session' });
      }
      
      const sql = 'SELECT * FROM orders WHERE email = ? ORDER BY order_date DESC';
      const orders = await queryPromise(sql, [email]);
      
      // Parse the JSON stored in products column
      orders.forEach(order => {
        if (typeof order.products === 'string') {
          try {
            order.products = JSON.parse(order.products);
          } catch (e) {
            console.error('Error parsing order products JSON:', e);
            order.products = [];
          }
        }
      });
      
      res.json(orders);
    } catch (err) {
      console.error('Error fetching user orders:', err);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });
  
  // API: Update user profile
  app.post('/api/user/update-profile', isAuthenticated, async (req, res) => {
    try {
      const { username, birthday } = req.body;
      const user = req.session.user.user || req.session.user;
      
      // Input validation
      if (!username || username.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          message: 'Username is required' 
        });
      }
      
      // Format the birthday if provided
      let birthdayFormatted = null;
      if (birthday) {
        birthdayFormatted = new Date(birthday);
        // Check if it's a valid date
        if (isNaN(birthdayFormatted)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid birthday format'
          });
        }
      }
      
      // Update the user in the database
      const updateSql = 'UPDATE users SET username = ?, birthday = ? WHERE id = ? OR email = ?';
      await queryPromise(updateSql, [
        username,
        birthdayFormatted,
        user.id || 0, // Use 0 if ID is not available
        user.email
      ]);
      
      // Update the session data
      if (req.session.user.user) {
        req.session.user.user.username = username;
        req.session.user.user.birthday = birthdayFormatted;
      } else {
        req.session.user.username = username;
        req.session.user.birthday = birthdayFormatted;
      }
      
      res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        user: {
          username,
          email: user.email,
          birthday: birthdayFormatted
        }
      });
      
    } catch (err) {
      console.error('Error updating user profile:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Server error while updating profile' 
      });
    }
  });
  
  // API: Change user password
  app.post('/api/user/change-password', isAuthenticated, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = req.session.user.user || req.session.user;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Current password and new password are required' 
        });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ 
          success: false, 
          message: 'New password must be at least 8 characters long' 
        });
      }
      
      // Get user from database to verify current password
      const userSql = 'SELECT * FROM users WHERE email = ?';
      const users = await queryPromise(userSql, [user.email]);
      
      if (!users || users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      
      const dbUser = users[0];
      
      // Verify current password
      const currentPasswordMatch = await require('bcrypt').compare(
        currentPassword.toString(), 
        dbUser.password
      );
      
      if (!currentPasswordMatch) {
        return res.status(401).json({ 
          success: false, 
          message: 'Current password is incorrect' 
        });
      }
      
      // Hash and save new password
      const hash = await bcryptHash(newPassword.toString(), 8);
      const updateSql = 'UPDATE users SET password = ? WHERE id = ?';
      await queryPromise(updateSql, [hash, dbUser.id]);
      
      res.json({ 
        success: true, 
        message: 'Password changed successfully' 
      });
      
    } catch (err) {
      console.error('Error changing password:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Server error while changing password' 
      });
    }
  });
};
