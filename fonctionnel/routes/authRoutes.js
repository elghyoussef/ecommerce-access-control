// Authentication routes
module.exports = function(app, connection, bcryptHash, queryPromise, isAuthenticated, isAdmin, path) {
  const { logLoginAttempt } = require('../utils/logger'); // Import the logger
  // Logout
  app.get('/logout', isAuthenticated, (req, res) => {
    req.session.destroy(err => {
      res.clearCookie('connect.sid');
      res.status(200).sendFile(path.join(__dirname, '../../views', 'logout.html'));
    });
  });

  // Login
  app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";
    connection.query(sql, [email], (err, results) => {
      if (err) {
        console.error('Erreur lors de la requête SQL:', err);
        logLoginAttempt({ email, success: false, reason: 'Database query error', ip: req.ip });
        return res.status(500).send("<script>alert('Erreur lors de la connexion'); window.location.href = '/login';</script>");
      }
      if (results.length === 0) {
        console.log('Utilisateur non trouvé pour l\'email:', email);
        logLoginAttempt({ email, success: false, reason: 'Email not found', ip: req.ip });
        return res.status(400).send("<script>alert('Email ou mot de passe incorrect'); window.location.href = '/login';</script>");
      }
      const user = results[0];
      const ps = password.toString();
      require('bcrypt').compare(ps, user.password, (err, isMatch) => {
        if (err) {
          console.error(err);
          logLoginAttempt({ email, username: user.username, success: false, reason: 'Bcrypt compare error', ip: req.ip });
          return res.status(500).send("<script>alert('Erreur lors de la connexion'); window.location.href = '/login';</script>");
        }
        if (!isMatch) {
          logLoginAttempt({ email, username: user.username, success: false, reason: 'Incorrect password', ip: req.ip });
          return res.status(400).send("<script>alert('Email ou mot de passe incorrect'); window.location.href = '/login';</script>");
        }
          // Check if VIP subscription has expired
        let isVIP = user.isVIP;
        let vip_expiry_date = user.vip_expiry_date;
        
        if (isVIP && vip_expiry_date) {
          const today = new Date();
          const expiryDate = new Date(vip_expiry_date);
          
          // If VIP has expired, update user record
          if (today > expiryDate) {
            console.log(`VIP has expired for user ${user.id}. Expiry date: ${vip_expiry_date}`);
            isVIP = 0;
            vip_expiry_date = null;
            
            // Update the database with null expiry date
            const updateSql = "UPDATE users SET isVIP = 0, vip_expiry_date = NULL WHERE id = ?";
            connection.query(updateSql, [user.id], (updateErr, updateResult) => {
              if (updateErr) {
                console.error('Error updating expired VIP status:', updateErr);
              } else {
                console.log(`Reset expired VIP status for user ${user.id}`);
              }
            });
          }
        }
        
        // Set session with correct VIP status
        req.session.user = { 
          user, 
          isAdmin: user.isAdmin,
          isVIP: isVIP,
          vip_expiry_date: vip_expiry_date 
        }
        
        logLoginAttempt({ email, username: user.username, success: true, reason: 'Login successful', ip: req.ip });
        res.send("<script>alert('Connexion réussie'); window.location.href = '/home';</script>");
      });
    });
  });

  // API Login route
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); // For making HTTP requests in verifyGeolocation
  const db = require('../../non_fonctionnel/db'); // Assuming db.js exports a promise-based query function or similar
  const ct = require('country-timezone'); // Changed from ctt and require('country-to-timezone')
  const geoip = require('geoip-lite'); // Added for IP to country lookup

  async function getSecurityPolicy() {
    try {
      const policies = await db.query('SELECT * FROM country_policies WHERE policy_type = "geographic" LIMIT 1');     
      
      // Return the first policy, or default if none found
      if (policies && policies.length > 0) {
        // Convert numeric values to boolean if needed
        const policy = policies[0];
        policy.is_active = policy.is_active === 1 || policy.is_active === true;
        policy.allowLocalhost = policy.allowLocalhost === 1 || policy.allowLocalhost === true;
        console.log("Policy allowLocalhost value:", policy.allowLocalhost);
        return policy;
      }
      
      return { is_active: false, geoMode: null, securityLevel: 0, selectedCountries: '[]', allowedIPs: '[]', blockedIPs: '[]', allowedTimezones: '[]', blockedTimezones: '[]', allowLocalhost: false };
    } catch (error) {
      console.error('Error fetching security policy directly:', error);
      // Fallback to a default non-restrictive policy in case of DB error
      return { is_active: false, geoMode: null, securityLevel: 0, selectedCountries: '[]', allowedIPs: '[]', blockedIPs: '[]', allowedTimezones: '[]', blockedTimezones: '[]', allowLocalhost: false };
    }
  }

  // Helper function to calculate age from birthday string (YYYY-MM-DD)
  function calculateAge(birthdayString) {
    if (!birthdayString) return null;
    const birthday = new Date(birthdayString);
    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    const m = today.getMonth() - birthday.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthday.getDate())) {
        age--;
    }
    return age;
  }

  async function getAgePolicy() {
    try {
      const policies = await db.query('SELECT * FROM age_policies ORDER BY id DESC LIMIT 1');
      if (policies && policies.length > 0) {
        const policy = policies[0];
        // Ensure is_active is boolean
        policy.is_active = policy.is_active === 1 || policy.is_active === true;
        return policy;
      }
      // Default to inactive if no policy found
      return { is_active: false, min_age: null, max_age: null };
    } catch (error) {
      console.error('Error fetching age policy:', error);
      // Fallback to a default non-restrictive policy in case of DB error
      return { is_active: false, min_age: null, max_age: null };
    }
  }

  async function verifyIP(ip, isLocalhost, policy) {
    if (policy.allowLocalhost && isLocalhost) {
      return { passed: true, country: 'localhost', ip };
    }

    if (!ip) return { passed: false, country: null, ip };

    const geo = geoip.lookup(ip);
    const ipCountry = geo ? geo.country : null;

    if (!ipCountry) {
      console.warn(`Could not determine country for IP: ${ip}`);
      // If geoMode is whitelist, and we can't determine country, it should fail.
      // If geoMode is blacklist, and we can\'t determine country, it could be seen as not being on the blacklist.
      // For simplicity, let's fail if country cannot be determined and a country-based policy is active.
      if (policy.geoMode === 'whitelist' || policy.geoMode === 'blacklist') {
        return { passed: false, country: null, ip };
      }
      return { passed: true, country: null, ip }; // Pass if no specific country policy mode
    }    const selectedCountriesArray = JSON.parse(policy.selectedCountries || '[]');
    let policyCheckPassed = false;
    
    // If no countries are selected, the policy doesn't restrict by country
    if (selectedCountriesArray.length === 0) {
      policyCheckPassed = true;
    } else if (policy.geoMode === 'whitelist') {
      // In whitelist mode, the country must be IN the list of selected countries
      policyCheckPassed = selectedCountriesArray.some(c => c.value === ipCountry);
      console.log(`IP whitelist check: Country ${ipCountry} is ${policyCheckPassed ? 'in' : 'NOT in'} the whitelist of ${selectedCountriesArray.length} countries`);
    } else if (policy.geoMode === 'blacklist') {
      // In blacklist mode, the country must NOT be in the list of selected countries
      policyCheckPassed = !selectedCountriesArray.some(c => c.value === ipCountry);
      console.log(`IP blacklist check: Country ${ipCountry} is ${policyCheckPassed ? 'NOT in' : 'in'} the blacklist of ${selectedCountriesArray.length} countries`);
    } else {
      // If geoMode is not whitelist or blacklist (e.g. null), the IP's country is not restricted.
      policyCheckPassed = true;
    }

    if (policyCheckPassed) {
      console.log(`IP country check passed: IP ${ip} (Country: ${ipCountry}) is allowed by policy.`);
      return { passed: true, country: ipCountry, ip };
    } else {
      console.log(`IP country check failed: IP ${ip} (Country: ${ipCountry}) did not pass '${policy.geoMode}' policy with selected countries: ${JSON.stringify(selectedCountriesArray)}`);
      return { passed: false, country: ipCountry, ip };
    }
  }

  // New verifyTimezone function using country-timezone
  async function verifyTimezone(userTimezone, countryCode) {
    if (!userTimezone || !countryCode) {
      console.warn('User timezone or country code is missing for timezone verification.');
      return false;
    }
    try {
      // Ensure countryCode is uppercase as expected by some libraries or for consistency
      const upperCountryCode = countryCode.toUpperCase();
      // Corrected to use the method from 'country-timezone'
      const timezonesForCountry = ct.getTimezonesWithCountryCode(upperCountryCode); 
      
      if (timezonesForCountry && timezonesForCountry.length > 0) {
        if (timezonesForCountry.includes(userTimezone)) {
          console.log(`Timezone check passed: User timezone '${userTimezone}' is valid for country '${upperCountryCode}'.`);
          return true;
        } else {
          console.log(`Timezone check failed: User timezone '${userTimezone}' is NOT valid for country '${upperCountryCode}'. Valid timezones: ${timezonesForCountry.join(', ')}`);
          return false;
        }
      } else {
        console.warn(`No timezones found for country code '${upperCountryCode}' by country-timezone library.`);
        // Depending on policy, this could be a pass or fail.
        // For now, if ct returns no timezones, we can't validate, so consider it a fail.
        return false;
      }
    } catch (error) {
      // Check if the error is because the country code is not found, which country-timezone might throw
      if (error.message && error.message.toLowerCase().includes('country code not found')) {
        console.warn(`Country code '${countryCode.toUpperCase()}' not found by country-timezone library.`);
      } else {
        console.error(`Error in verifyTimezone for country ${countryCode} (used as ${countryCode.toUpperCase()}): ${error.message}.`);
      }
      return false; 
    }
  }

  // Changed to use latitude and longitude for country resolution via Nominatim
  // Now returns country code on success, or false on failure/policy violation
  async function verifyGeolocation(latitude, longitude, policy) { 
    if (latitude === undefined || longitude === undefined) {
        console.warn("Latitude or longitude is not available for geolocation verification.");
        return false;
    }

    try {
      // Using Nominatim (OpenStreetMap) for reverse geocoding (lat/lon to country)
      // IMPORTANT: Update User-Agent with your application details and contact email for production.
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=en`;
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'EcommerceApp/1.0 (Node.js; contact@example.com)' // TODO: Replace with your app info for production
        }
      });

      if (!response.ok) {
        console.error(`Nominatim API error: ${response.statusText}`, await response.text());
        return false; // Indicate failure
      }
      const data = await response.json();

      const country = data.address?.country_code?.toUpperCase(); 
      if (!country) {
        console.warn("Country code could not be determined from latitude/longitude using Nominatim.", data);
        return false; // Indicate failure
      }      // Policy check for country
      const selectedCountriesArray = JSON.parse(policy.selectedCountries || '[]');
      let policyCheckPassed = false;
      
      // If no countries are selected, the policy doesn't restrict by country
      if (selectedCountriesArray.length === 0) {
        policyCheckPassed = true;
        console.log(`Geolocation check: No countries in ${policy.geoMode} list, so check passes by default.`);
      } else if (policy.geoMode === 'whitelist') {
        // In whitelist mode, the country must be IN the list of selected countries
        policyCheckPassed = selectedCountriesArray.some(c => c.value === country);
        console.log(`Geolocation whitelist check: Country ${country} is ${policyCheckPassed ? 'in' : 'NOT in'} the whitelist of ${selectedCountriesArray.length} countries`);
      } else if (policy.geoMode === 'blacklist') {
        // In blacklist mode, the country must NOT be in the list of selected countries
        policyCheckPassed = !selectedCountriesArray.some(c => c.value === country);
        console.log(`Geolocation blacklist check: Country ${country} is ${policyCheckPassed ? 'NOT in' : 'in'} the blacklist of ${selectedCountriesArray.length} countries`);
      } else {
        // If geoMode is not whitelist or blacklist (e.g. null), the country itself is not restricted by this policy part.
        policyCheckPassed = true; 
      }

      if (policyCheckPassed) {
        console.log(`Geolocation check passed: Country ${country} is allowed by policy.`);
        return country; // Return country code on successful policy check
      } else {
        console.log(`Geolocation check failed: Country ${country} did not pass '${policy.geoMode}' policy with selected countries: ${JSON.stringify(selectedCountriesArray)}`);
        return false; // Indicate failure due to policy
      }
    } catch (error) {
      console.error('Error during server-side lat/lon geolocation verification:', error);
      return false; // Indicate failure
    }
  }

  // Updated verifySecurityLevel to use the new verifyTimezone and geolocation logic
  async function verifySecurityLevel(geoInfo, policy) {
    if (!policy.is_active || !policy.geoMode) {
      console.log("Security policy is inactive or geoMode not set. Bypassing checks.");
      return true; 
    }
    
    // Check if it's a localhost connection and if localhost is allowed in policy
    if (geoInfo && geoInfo.isLocalhost === true) {
      if (policy.allowLocalhost) {
        console.log('Request is from localhost and allowLocalhost is enabled. Bypassing security checks.');
        return true;
      } else {
        console.log('Request is from localhost but allowLocalhost is NOT enabled. Continuing with security checks.');
      }
    }
      // If we get here and there's no geoInfo or it has errors, fail the check
    if (!geoInfo) {
      console.log('GeoInfo is missing. Security check considered failed.');
      return false;
    }
    
    if (geoInfo.error) {
      console.log(`GeoInfo contains error: ${geoInfo.error}. Security check considered failed.`);
      return false; 
    }
    
    // Log the security check policy for debugging
    const selectedCountriesArray = JSON.parse(policy.selectedCountries || '[]');
    console.log(`Security check starting with mode: ${policy.geoMode}, security level: ${policy.securityLevel}`);
    console.log(`Selected countries (${selectedCountriesArray.length}):`, 
                selectedCountriesArray.map(c => `${c.value} (${c.text})`).join(', '));

    let passedChecksCount = 0;
    const checkDetails = {
        ip: { passed: false, country: null, info: geoInfo.ip || 'N/A' },
        geolocation: { passed: false, country: null, info: `lat: ${geoInfo.latitude}, lon: ${geoInfo.longitude}` },
        timezone: { passed: false, userTimezone: geoInfo.timezone || 'N/A', countryForCheck: null }
    };

    // 1. IP Check (now includes country verification based on IP)
    const ipCheckResult = await verifyIP(geoInfo.ip, geoInfo.isLocalhost, policy);
    checkDetails.ip.info = ipCheckResult.ip; // Store the IP used for the check
    checkDetails.ip.country = ipCheckResult.country; // Store the country determined from IP

    if (ipCheckResult.passed) {
        passedChecksCount++;
        checkDetails.ip.passed = true;
    }

    // 2. Geolocation Check (country policy based on lat/lon)
    // This returns country code (string) on success, or false on failure.
    const geolocationValidationResult = await verifyGeolocation(geoInfo.latitude, geoInfo.longitude, policy);
    
    let countryCodeForTimezoneCheck = null;
    if (typeof geolocationValidationResult === 'string') { // Successfully got a country code
        passedChecksCount++;
        checkDetails.geolocation.passed = true;
        checkDetails.geolocation.country = geolocationValidationResult;
        countryCodeForTimezoneCheck = geolocationValidationResult;
    } else {
        // Geolocation check failed or did not pass policy
        checkDetails.geolocation.passed = false;
    }

    // 3. Timezone Consistency Check (conditional on successful geolocation providing a country code)
    checkDetails.timezone.countryForCheck = countryCodeForTimezoneCheck;
    if (countryCodeForTimezoneCheck) {
        const timezoneCheckResult = await verifyTimezone(geoInfo.timezone, countryCodeForTimezoneCheck);
        if (timezoneCheckResult) {
            passedChecksCount++;
            checkDetails.timezone.passed = true;
        }
    } else {
        console.log("Timezone check skipped/failed because geolocation check did not yield a valid country code.");
        // Timezone check is considered failed if dependent geolocation check failed
        checkDetails.timezone.passed = false;
    }
    
    // console.log("Security checks detailed results:", checkDetails);
    console.log("IP Check:", checkDetails.ip.passed, ", Geo-Localisation:", checkDetails.geolocation.passed, ", Timezone:", checkDetails.timezone.passed);
    console.log("Total passed checks:", passedChecksCount, "Required for level (", policy.securityLevel, " ):");

    if (policy.securityLevel === 1) return passedChecksCount >= 1;
    if (policy.securityLevel === 2) return passedChecksCount >= 2;
    if (policy.securityLevel === 3) return passedChecksCount === 3; // All 3 must pass
    
    // If securityLevel is 0 or not 1, 2, 3, default to true (policy effectively less restrictive or misconfigured)
    console.log(`Security level ${policy.securityLevel} is not 1, 2, or 3. Defaulting to security check passed.`);
    return true; 
  }
  app.post('/api/login', async (req, res) => {
    const { email, password, geoInfo } = req.body;
    const ip = req.ip;

    if (!email || !password) {
      logLoginAttempt({ email: email || 'N/A', success: false, reason: 'Missing email or password', ip, geoInfo });
      return res.status(400).json({ success: false, message: "Email et mot de passe sont requis." });
    }

    try {      // Step 1: Perform security checks
      const securityPolicy = await getSecurityPolicy();
      console.log("Security policy retrieved:", JSON.stringify(securityPolicy));

    // Special handling for localhost connections
      const isLocalRequest = geoInfo && geoInfo.isLocalhost === true;
      
      // DEVELOPMENT MODE - Set to true to enforce security checks even on localhost
      const DEV_TEST_SECURITY = true;
      
      if (isLocalRequest && securityPolicy.allowLocalhost && !DEV_TEST_SECURITY) {
        console.log("Request is from localhost and allowLocalhost is enabled in policy. Bypassing security checks.");
      } 
      else if (securityPolicy.is_active && securityPolicy.geoMode) {
          console.log("Performing security checks with policy:", JSON.stringify(securityPolicy), "and geoInfo:", JSON.stringify(geoInfo || {}));
          const securityCheckPassed = await verifySecurityLevel(geoInfo, securityPolicy);
          if (!securityCheckPassed) {
              console.log("Security check failed for user:", email);
              logLoginAttempt({ email, success: false, reason: 'Security policy violation', ip, geoInfo });
              return res.status(403).json({ success: false, message: "Accès refusé en raison des restrictions géographiques." });
          }
          console.log("Security check passed for user:", email);
      } else {
          console.log("Security policy is not active or geoMode is not set:", securityPolicy.is_active, securityPolicy.geoMode);
          console.log("Skipping security checks.");
      }// Step 2: Proceed with user authentication if security checks passed or were not applicable
      const result = await db.query("SELECT * FROM users WHERE email = ?", [email]);
      
      // Handle both array and direct result formats
      const userRows = Array.isArray(result[0]) ? result[0] : result;
      
      if (!userRows || userRows.length === 0) {
        logLoginAttempt({ email, success: false, reason: 'Email not found', ip, geoInfo });
        return res.status(401).json({ success: false, message: "Email ou mot de passe incorrect." });
      }
      
      const user = userRows[0];
      
      if (!user || !user.password) {
        console.error('User or password is undefined:', user);
        logLoginAttempt({ email, success: false, reason: 'Invalid user data in DB', ip, geoInfo });
        return res.status(401).json({ success: false, message: "Données d\\\'utilisateur invalides." });
      }
      
      const ps = password.toString(); // Ensure password is a string
      const isMatch = await require('bcrypt').compare(ps, user.password); // Await bcrypt.compare
      if (!isMatch) {
        logLoginAttempt({ email, username: user.username, success: false, reason: 'Incorrect password', ip, geoInfo });
        return res.status(401).json({ success: false, message: "Email ou mot de passe incorrect." });
      }
        // Check if VIP subscription has expired
      let isVIP = user.isVIP;
      let vip_expiry_date = user.vip_expiry_date;
      
      if (isVIP && vip_expiry_date) {
        const today = new Date();
        const expiryDate = new Date(vip_expiry_date);
        
        // If VIP has expired, update user record
        if (today > expiryDate) {
          console.log(`VIP has expired for user ${user.id}. Expiry date: ${vip_expiry_date}`);
          isVIP = 0;
          vip_expiry_date = null;
          
          // Update the database with NULL for the expiry date
          await db.query("UPDATE users SET isVIP = 0, vip_expiry_date = NULL WHERE id = ?", [user.id]);
          console.log(`Reset expired VIP status for user ${user.id}`);
          
          // Update the user object to reflect the change
          user.isVIP = 0;
          user.vip_expiry_date = null;
        }
      }

      // Step 3: Perform Age Policy Check
      const agePolicy = await getAgePolicy();
      if (agePolicy.is_active) {
        if (!user.birthday) {
          console.log(`Age policy active, but user ${email} has no birthday set. Access denied.`);
          logLoginAttempt({ email, username: user.username, success: false, reason: 'Age policy: Missing birthday', ip, geoInfo });
          return res.status(403).json({ success: false, message: "Votre date de naissance est requise pour la connexion. Veuillez contacter l\\'assistance." });
        }
        const userAge = calculateAge(user.birthday);
        if (userAge === null) { // Should not happen if user.birthday is present
            console.log(`Age policy active, but could not calculate age for user ${email}. Access denied.`);
            logLoginAttempt({ email, username: user.username, success: false, reason: 'Age policy: Could not calculate age', ip, geoInfo });
            return res.status(403).json({ success: false, message: "Impossible de vérifier votre âge. Veuillez contacter l\\'assistance." });
        }

        let ageCheckPassed = true;
        let ageRestrictionMessage = "Accès refusé en raison des restrictions d\\'âge."

        if (agePolicy.min_age !== null && userAge < agePolicy.min_age) {
          ageCheckPassed = false;
          ageRestrictionMessage = `Vous devez avoir au moins ${agePolicy.min_age} ans pour accéder.`;
          console.log(`User ${email} (age ${userAge}) failed age check: younger than min_age ${agePolicy.min_age}.`);
        }
        if (agePolicy.max_age !== null && userAge > agePolicy.max_age) {
          ageCheckPassed = false;
          // This message might be less common, but included for completeness
          ageRestrictionMessage = `Vous devez avoir au plus ${agePolicy.max_age} ans pour accéder.`; 
          console.log(`User ${email} (age ${userAge}) failed age check: older than max_age ${agePolicy.max_age}.`);
        }

        if (!ageCheckPassed) {
          logLoginAttempt({ email, username: user.username, success: false, reason: `Age policy: ${ageRestrictionMessage}`, ip, geoInfo });
          return res.status(403).json({ success: false, message: ageRestrictionMessage });
        }
        console.log(`User ${email} (age ${userAge}) passed age policy check (min: ${agePolicy.min_age}, max: ${agePolicy.max_age}).`);
      } else {
        console.log("Age policy is not active. Skipping age check.");
      }
        // Time restriction check (last verification)
      // Only block if not isAdmin or isVIP
      if (!(user.isAdmin === 1 || user.isVIP === 1)) {
        // Convert callback to Promise pattern to better handle async flow
        const timePolicy = await new Promise((resolve, reject) => {
          db.query('SELECT * FROM time_policies WHERE is_active = 1 LIMIT 1', (err, policies) => {
            if (err) {
              reject(err);
            } else {
              resolve(policies && policies.length > 0 ? policies[0] : null);
            }
          });
        });
        
        // Check time restrictions if policy exists
        if (timePolicy && timePolicy.time_start && timePolicy.time_end) {
          const now = new Date();
          const day = now.getDay();
          const daysActive = (timePolicy.days_active || '0,1,2,3,4,5,6').split(',').map(Number);
          
          // Check if current day is allowed
          if (!daysActive.includes(day)) {
            logLoginAttempt({ email, username: user.username, success: false, reason: 'Time policy: Day not allowed', ip, geoInfo });
            return res.status(403).json({ success: false, message: "Accès refusé : restriction horaire (jour non autorisé)" });
          }
          
          // Check if current time is within allowed window
          const nowTime = now.toTimeString().slice(0,5);
          if (timePolicy.time_start <= timePolicy.time_end) {
            // Normal time window (e.g. 08:00-20:00)
            if (nowTime < timePolicy.time_start || nowTime > timePolicy.time_end) {
              logLoginAttempt({ email, username: user.username, success: false, reason: 'Time policy: Time not allowed (normal window)', ip, geoInfo });
              return res.status(403).json({ success: false, message: "Accès refusé : restriction horaire" });
            }
          } else {
            // Overnight time window (e.g. 22:00-06:00)
            if (nowTime < timePolicy.time_start && nowTime > timePolicy.time_end) {
              logLoginAttempt({ email, username: user.username, success: false, reason: 'Time policy: Time not allowed (overnight window)', ip, geoInfo });
              return res.status(403).json({ success: false, message: "Accès refusé : restriction horaire" });
            }
          }
        }
      }
      
      // If we reached this point, the user is allowed to log in
      req.session.user = { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        birthday: user.birthday, 
        isAdmin: user.isAdmin, 
        isVIP: user.isVIP, 
        vip_expiry_date: user.vip_expiry_date 
      };
      logLoginAttempt({ email, username: user.username, success: true, reason: 'Login successful', ip, geoInfo });
      return res.json({ success: true, message: "Authentification réussie.", redirectUrl: '/home' });
    } catch (err) {
      console.error('Erreur lors de la connexion API:', err);
      logLoginAttempt({ email: email || 'N/A', success: false, reason: `API login error: ${err.message}`.substring(0, 255), ip, geoInfo });
      return res.status(500).json({ success: false, message: "Erreur interne du serveur lors de la tentative de connexion." });
    }
  });  // Register
  app.post('/register', async (req, res) => {
    const { username, email, password, birthday } = req.body;
    try {
      const hash = await bcryptHash(password.toString(), 8);
      // Explicitly set isVIP to 0 and vip_expiry_date to NULL for new users
      const sql = "INSERT INTO users (username, email, password, birthday, isVIP, vip_expiry_date) VALUES (?, ?, ?, ?, ?, ?)";
      await queryPromise(sql, [username, email, hash, birthday, 0, null]);
      // Initialize session with non-VIP status
      req.session.user = { username, email, birthday, isAdmin: false, isVIP: false, vip_expiry_date: null };
      res.send("<script>alert('Inscription réussie'); window.location.href = '/login';</script>");
    } catch (err) {
      console.error('Erreur lors de l\'inscription:', err);
      res.status(500).send("<script>alert('Erreur lors de l'inscription'); window.location.href = '/register';</script>");
    }
  });
};
