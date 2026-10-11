// Cart management routes
module.exports = function(app, isAuthenticated) {
  // API: Get cart for current user
  app.get('/api/cart', isAuthenticated, (req, res) => {
    if (!req.session.cart) req.session.cart = [];
    res.json(req.session.cart);
  });

  // API: Add item to cart
  app.post('/api/cart/add', isAuthenticated, (req, res) => {
    const { id, name, price, quantity, imgsrc } = req.body;
    if (!req.session.cart) req.session.cart = [];
    const idx = req.session.cart.findIndex(item => item.id === id);
    if (idx !== -1) {
      req.session.cart[idx].quantity += quantity;
    } else {
      req.session.cart.push({ id, name, price, quantity, imgsrc });
    }
    res.json({ success: true, cart: req.session.cart });
  });

  // API: Remove item from cart
  app.post('/api/cart/remove', isAuthenticated, (req, res) => {
    const { id } = req.body;
    if (!req.session.cart) req.session.cart = [];
    req.session.cart = req.session.cart.filter(item => item.id !== id);
    res.json({ success: true, cart: req.session.cart });
  });

  // API: Clear cart
  app.post('/api/cart/clear', isAuthenticated, (req, res) => {
    req.session.cart = [];
    res.json({ success: true });
  });
};
