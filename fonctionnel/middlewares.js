// Fichier pour les middlewares globaux ou personnalisés
// Ajoutez ici vos middlewares réutilisables (hors auth.js)

// Exemple de middleware de log
function logger(req, res, next) {
  console.log(`${req.method} ${req.url}`);
  next();
}

// Middleware Error 401
function error401(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).send('Unauthorized');
  } else {
    next();
  }
}

// Middleware Error 403
function error403(req, res, next) {
  if (!req.user || !req.user.hasPermission || !req.user.hasPermission()) {
    res.status(403).send('Forbidden');
  } else {
    next();
  }
}

// Middleware: Restriction Horaire Globale
const db = require('../non_fonctionnel/db');
// Middleware: Restriction Horaire Globale
async function timeRestrictionMiddleware(req, res, next) {
  // Allow static assets, login, logout, register, and policy config routes
  const openPaths = [
    '/login', '/logout', '/register', '/api/login', '/api/user', '/api/userinfo', 
    '/policy', '/policy/age', '/policy/country', '/policy/time',
    '/maintenance', '/subscription', '/api/vip/status'
  ];

  // Allow access to static files (e.g. css, js, images)
  if (req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/img')) {
    return next();
  }

  if (openPaths.some(path => req.path.startsWith(path))) return next();

  try {
    const policies = await db.query('SELECT * FROM time_policies WHERE is_active = 1 LIMIT 1');
    if (!policies || policies.length === 0) return next(); // No active time policy
    const policy = policies[0];

    // Check for maintenance mode first
    if (policy.mode === 'maintenance') {
      // Allow admins and VIP users to bypass maintenance mode for all paths except /maintenance itself
      const user = req.session && req.session.user ? (req.session.user.user || req.session.user) : null;
      if (user && (user.isAdmin === 1 || user.isVIP === 1) && req.path !== '/maintenance') {
        return next();
      }
      // For all other users, or if the path is /maintenance (even for admins/VIP), redirect to /maintenance
      if (req.path !== '/maintenance') {
        return res.redirect('/maintenance');
      }
      // If already on /maintenance, allow access
      return next(); 
    }

    // Get user from session if available for other time restrictions
    const user = req.session && req.session.user ? (req.session.user.user || req.session.user) : null;
    
    // VIP and Admin users bypass normal time restrictions (but not maintenance mode handled above)
    if (user && (user.isAdmin === 1 || user.isVIP === 1)) {
      return next();
    }

    // Proceed with normal time and day restrictions if not in maintenance mode
    if (policy.mode === 'normal' || policy.mode === '24/24') {
      if (policy.mode === '24/24') return next(); // If 24/24, allow access

      if (!policy.time_start || !policy.time_end) return next(); // If times are not set, allow
      
      const now = new Date();
      const day = now.getDay(); // 0=Sunday
      let daysActive = [];
      try {
        daysActive = JSON.parse(policy.days_active || '[]');
      } catch (e) {
        console.error('Error parsing days_active:', policy.days_active, e);
        daysActive = [0,1,2,3,4,5,6]; // Default to all days if parsing fails
      }

      if (!daysActive.includes(day)) {
        return res.status(403).json({
          error: 'time_restriction',
          message: 'Our shop is currently closed today. Become a VIP member for 24/7 access!',
          restrictionType: 'day',
          currentDay: day,
          allowedDays: daysActive,
          isVIP: user ? user.isVIP === 1 : false
        });
      }
      
      const nowTime = now.toTimeString().slice(0,5);
      if (policy.time_start <= policy.time_end) { // Normal time window (e.g. 08:00-20:00)
        if (nowTime < policy.time_start || nowTime > policy.time_end) {
          return res.status(403).json({
            error: 'time_restriction',
            message: `Our shop is currently closed. We're open from ${policy.time_start} to ${policy.time_end}. Become a VIP member for 24/7 access!`,
            restrictionType: 'time',
            currentTime: nowTime,
            allowedTimeStart: policy.time_start,
            allowedTimeEnd: policy.time_end,
            isVIP: user ? user.isVIP === 1 : false
          });
        }
      } else { // Overnight window (e.g. 22:00-06:00)
        if (nowTime < policy.time_start && nowTime > policy.time_end) {
          return res.status(403).json({
            error: 'time_restriction',
            message: `Our shop is currently closed. We're open from ${policy.time_start} to ${policy.time_end} (overnight). Become a VIP member for 24/7 access!`,
            restrictionType: 'time_overnight',
            currentTime: nowTime,
            allowedTimeStart: policy.time_start,
            allowedTimeEnd: policy.time_end,
            isVIP: user ? user.isVIP === 1 : false
          });
        }
      }
    }
    return next();
  } catch (err) {
    console.error('Erreur lors de la vérification de la restriction horaire:', err);
    return next(); // Fail open if error
  }
}

module.exports = {
  logger,
  error401,
  error403,
  timeRestrictionMiddleware
};
