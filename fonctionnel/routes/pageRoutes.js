const { isAdmin } = require("../auth");

// Static and public page routes
module.exports = function(app, path, isAuthenticated) {
  app.get('/', (req, res) => {
    res.redirect('/home');
  });
  app.get('/shop', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'shop.html'));
  });
  app.get('/subscription', isAuthenticated, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'subscription.html'));
  });
  app.get('/login', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'login.html'));
  });
  app.get('/register', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'register.html'));
  });
  app.get('/home', (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'index.html'));
  });
  app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'addproduct.html'));
  });
  app.get('/checkout', isAuthenticated, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'checkout.html'));
  });
  app.use('/maintenance', (req, res, next) => {
    // Send the maintenance page with 503 Service Unavailable status
    // Note: We're using 200 status instead of 503 to prevent caching issues in some browsers
    res.status(200).sendFile(path.join(__dirname, '../../views', 'maintenance.html'));
  });
  app.use('/cart', isAuthenticated, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'cart.html'));
  });
  app.use('/thankyou', isAuthenticated, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'thankyou.html'));
  });
  app.use('/orders',isAuthenticated, isAdmin, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'orders.html'));
  });
  app.get('/policy', isAuthenticated, isAdmin, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'policy.html'));
  });
  app.get('/profile', isAuthenticated, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, '../../views', 'profile.html'));
  });
};
