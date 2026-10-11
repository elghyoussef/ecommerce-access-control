// Error and 404 handling routes
module.exports = function(app, path) {
  // 404 page
  app.use(function (req, res) {
    res.type('text/html');
    res.status(404);
    res.sendFile(path.join(__dirname, '../../views', 'page404.html'));
  });
  // Global error middlewares
  const { error401, error403 } = require('../middlewares');
  app.use(error401);
  app.use(error403);
};
