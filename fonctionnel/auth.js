// Middlewares d'authentification
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect('/login');
  }
}

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.isAdmin) {
    return next();
  } else {
    res.status(403).send("<script>alert('Accès refusé'); window.location.href = '/home';</script>");
  }
}

module.exports = { isAuthenticated, isAdmin };
