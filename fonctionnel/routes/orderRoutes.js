// Order management routes for /api/orders

module.exports = function(app, queryPromise) {
  // API: Get all orders
  app.get('/api/orders', async (req, res) => {
    try {
      const sql = 'SELECT * FROM orders ORDER BY order_date DESC';
      const orders = await queryPromise(sql);
      // Parse the JSON stored in products column
      orders.forEach(order => {
        order.products = JSON.parse(order.products);
      });
      res.json(orders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  // API: Save order to MySQL (no authentication required)
  app.post('/api/orders', async (req, res) => {
    try {
      const { customer_name, email, products, total } = req.body;

      // Validation
      if (
        !customer_name ||
        typeof customer_name !== 'string' ||
        !email ||
        typeof email !== 'string' ||
        !/^\S+@\S+\.\S+$/.test(email) ||
        !Array.isArray(products) ||
        products.length === 0 ||
        !total ||
        isNaN(Number(total))
      ) {
        return res.status(400).json({ error: 'Invalid or missing order data' });
      }

      const order_date = new Date();
      const sql = 'INSERT INTO orders (customer_name, email, products, total, order_date) VALUES (?, ?, ?, ?, ?)';
      await queryPromise(sql, [
        customer_name,
        email,
        JSON.stringify(products),
        total,
        order_date
      ]);
      res.json({ success: true });
    } catch (err) {
      console.error('Order save error:', err);
      res.status(500).json({ error: 'Failed to save order' });
    }
  });
};