if (!process.env.SESSION_SECRET) throw new Error('Set SESSION_SECRET before starting');
// Import des modules séparés
const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const app = express();
const port = Number(process.env.PORT || 3030);

// Import des modules personnalisés
const mysql = require('mysql');
const connection = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});

const db = require('./non_fonctionnel/db');
const { bcryptHash, queryPromise, setConnection, cleanupExpiredVipSubscriptions } = require('./fonctionnel/utils');
const { isAuthenticated, isAdmin } = require('./fonctionnel/auth');
const { logger, timeRestrictionMiddleware } = require('./fonctionnel/middlewares');
const sessionStore = require('./non_fonctionnel/sessionStore');
const securityRoutes = require('./fonctionnel/routes/securityRoutes'); // Import security routes

// Set connection for queryPromise function
setConnection(connection);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { secure: false }
}));
app.use(logger);
app.use(timeRestrictionMiddleware); // Enforce global time restriction

app.use('/api', securityRoutes); // Mount security routes

// Serve uploads folder statically for product images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import modular route files
require('./fonctionnel/routes/pageRoutes')(app, path, isAuthenticated);
require('./fonctionnel/routes/authRoutes')(app, connection, bcryptHash, queryPromise, isAuthenticated, isAdmin, path);
require('./fonctionnel/routes/productRoutes')(app, queryPromise, isAuthenticated, isAdmin, multer, path);
require('./fonctionnel/routes/userRoutes')(app, connection, bcryptHash, queryPromise, isAuthenticated, isAdmin);
require('./fonctionnel/routes/cartRoutes')(app, isAuthenticated);
require('./fonctionnel/routes/orderRoutes')(app, queryPromise);
require('./fonctionnel/routes/vipRoutes')(app, connection, isAuthenticated); // Add VIP routes

// Error routes must be last
require('./fonctionnel/routes/errorRoutes')(app, path);

// Commencez le serveur
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Serveur démarré sur le port http://localhost:${server.address().port}`);
  
  // Run VIP cleanup at server startup
  console.log('Running VIP subscription cleanup at startup...');
  cleanupExpiredVipSubscriptions()
    .then(result => {
      if (result.success) {
        console.log(`VIP Cleanup: Successfully reset ${result.count} expired VIP subscriptions`);
      } else {
        console.error('VIP Cleanup: Error during VIP subscription cleanup', result.error);
      }
    })
    .catch(err => {
      console.error('VIP Cleanup: Unhandled error during execution:', err);
    });
});
