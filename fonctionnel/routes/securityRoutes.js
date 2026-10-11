const express = require('express');
const router = express.Router();
const db = require('../../non_fonctionnel/db');

// Route pour obtenir la configuration de sécurité actuelle
router.get('/policy/country', async (req, res) => {
    try {
        const policies = await db.query('SELECT * FROM country_policies WHERE policy_type = "geographic" LIMIT 1');
        res.json(policies[0] || { is_active: false });
    } catch (error) {
        console.error('Error fetching security policy:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Updated POST route to handle both creation and updates
router.post('/policy/country', async (req, res) => {
  try {
    const { is_active, geoMode, securityLevel, countries, allowLocalhost } = req.body;
    
    // Convert to expected format
    const policyData = {
      policy_type: 'geographic',
      is_active: is_active ? 1 : 0,
      geoMode,
      securityLevel: parseInt(securityLevel, 10),
      selectedCountries: JSON.stringify(countries),
      allowLocalhost: allowLocalhost ? 1 : 0, // Fix: 1 if checked, 0 if not
      updated_at: new Date()
    };
      // First check if a policy of this type already exists
    const existingPolicySql = "SELECT id FROM country_policies WHERE policy_type = 'geographic' LIMIT 1";
    const existingPolicies = await db.query(existingPolicySql);
    
    let result;
    if (existingPolicies && existingPolicies.length > 0) {
      // Policy exists, update it
      const updateSql = "UPDATE country_policies SET is_active = ?, geoMode = ?, securityLevel = ?, selectedCountries = ?, allowLocalhost = ?, updated_at = ? WHERE id = ?";
      result = await db.query(updateSql, [
        policyData.is_active,
        policyData.geoMode,
        policyData.securityLevel,
        policyData.selectedCountries,
        policyData.allowLocalhost, 
        policyData.updated_at,
        existingPolicies[0].id
      ]);
      console.log(`Updated existing geographic policy with ID ${existingPolicies[0].id}`);
    } else {
      // No policy exists, create a new one
      const insertSql = "INSERT INTO country_policies (policy_type, is_active, geoMode, securityLevel, selectedCountries, allowLocalhost, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
      policyData.created_at = new Date();
      result = await db.query(insertSql, [
        policyData.policy_type,
        policyData.is_active,
        policyData.geoMode,
        policyData.securityLevel,
        policyData.selectedCountries,
        policyData.allowLocalhost,
        policyData.created_at,
        policyData.updated_at
      ]);
      console.log('Created new geographic policy');
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Policy saved successfully',
      isUpdate: existingPolicies && existingPolicies.length > 0
    });
  } catch (err) {
    console.error('Error saving security policy:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save security policy', 
      details: err.message 
    });
  }
});

// Age Policy Routes
// Route pour obtenir la configuration de la politique d'âge
router.get('/policy/age', async (req, res) => {
    try {
        const policies = await db.query('SELECT * FROM age_policies ORDER BY id DESC LIMIT 1'); // Get the latest or the only one
        if (policies.length > 0) {
            res.json(policies[0]);
        } else {
            // Send a 200 with default values if no policy is found, as per frontend expectation
            res.status(200).json({ is_active: true, min_age: 18, max_age: null, message: 'No age policy found, returning defaults.' });
        }
    } catch (error) {
        console.error('Error fetching age policy:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error', details: error.message });
    }
});

// Route pour mettre à jour ou créer la politique d'âge
router.post('/policy/age', async (req, res) => {
    const { min_age, max_age, is_active } = req.body;

    // Validate input
    if (is_active && (min_age === null || min_age === undefined || parseInt(min_age, 10) <= 0)) {
        return res.status(400).json({ success: false, error: 'Minimum age must be a positive number when policy is active.' });
    }
    if (is_active && max_age !== null && max_age !== undefined && parseInt(max_age, 10) < parseInt(min_age, 10)) {
        return res.status(400).json({ success: false, error: 'Maximum age cannot be less than minimum age.' });
    }

    const finalMinAge = min_age !== null && min_age !== '' ? parseInt(min_age, 10) : null;
    const finalMaxAge = max_age !== null && max_age !== '' ? parseInt(max_age, 10) : null;
    const finalIsActive = is_active ? 1 : 0;

    try {
        const existingPolicies = await db.query('SELECT id FROM age_policies');

        if (existingPolicies.length > 0) {
            // Mettre à jour la politique existante (assuming one policy row)
            const policyId = existingPolicies[0].id;
            await db.query(
                'UPDATE age_policies SET min_age = ?, max_age = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
                [finalMinAge, finalMaxAge, finalIsActive, policyId]
            );
            res.status(200).json({ success: true, message: 'Age policy updated successfully.' });
        } else {
            // Créer une nouvelle politique
            await db.query(
                'INSERT INTO age_policies (min_age, max_age, is_active, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
                [finalMinAge, finalMaxAge, finalIsActive]
            );
            res.status(201).json({ success: true, message: 'Age policy created successfully.' });
        }
    } catch (error) {
        console.error('Error saving age policy:', error);
        res.status(500).json({ success: false, error: 'Failed to save age policy', details: error.message });
    }
});

// Add these routes to your securityRoutes.js file

// Route to get current time policy configuration
router.get('/policy/time', async (req, res) => {
    try {
        const policies = await db.query('SELECT * FROM time_policies ORDER BY id DESC LIMIT 1');        if (policies.length > 0) {
            // Parse the days_active JSON string if it exists
            const policy = policies[0];
            let daysActive = [];
            
            if (policy.days_active) {
                try {
                    // Make sure we're parsing valid JSON by cleaning it first
                    const jsonString = policy.days_active.trim();
                    
                    // Handle potential malformed JSON formats
                    let cleanJson = jsonString;
                    
                    // If it starts with a quote and isn't valid JSON, try to fix common issues
                    if (jsonString.startsWith('"')) {
                        // This might be a double-encoded JSON string, try unescaping it
                        cleanJson = jsonString.replace(/\\"/g, '"').replace(/^"/, '').replace(/"$/, '');
                    }
                    
                    try {
                        daysActive = JSON.parse(cleanJson);
                    } catch (innerError) {
                        // If it still fails, check if it's already a JS array encoded as a string
                        if (jsonString.startsWith('[') && jsonString.endsWith(']')) {
                            // Convert to proper JSON by ensuring all strings have quotes
                            const fixedJson = jsonString.replace(/'/g, '"')
                                                         .replace(/([a-zA-Z0-9_]+):/g, '"$1":');
                            daysActive = JSON.parse(fixedJson);
                        } else {
                            // Last resort: try it as a comma-separated string
                            daysActive = jsonString.split(',').map(day => day.trim());
                        }
                    }
                } catch (parseError) {
                    console.error('Error parsing days_active JSON:', parseError);
                    // Fallback for invalid JSON - assume it's a comma-separated string
                    if (typeof policy.days_active === 'string') {
                        daysActive = policy.days_active.split(',').map(day => day.trim());
                    }
                }
            }
            
            // Ensure daysActive is always an array
            if (!Array.isArray(daysActive)) {
                daysActive = [];
            }              // Extract HH:MM from MySQL time format (HH:MM:SS) for display purposes
            const formatTimeForDisplay = (timeStr) => {
                if (!timeStr) return '';
                
                try {
                    // Split by colon to handle various formats
                    const parts = timeStr.split(':');
                    
                    // Take only hours and minutes regardless of seconds
                    if (parts.length >= 2) {
                        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
                    }
                    
                    return timeStr;
                } catch (error) {
                    console.error('Error formatting time for display:', error);
                    return timeStr;
                }
            };
              const formattedStartTime = formatTimeForDisplay(policy.time_start);
            const formattedEndTime = formatTimeForDisplay(policy.time_end);
            
            console.log(`Formatted times - Start: ${policy.time_start} -> ${formattedStartTime}, End: ${policy.time_end} -> ${formattedEndTime}`);              // Check if mode field exists, if not it's probably an older record
              const policyMode = policy.mode !== undefined ? policy.mode : 'normal';
              
              res.json({
                is_active: policy.is_active === 1,
                start_time: formattedStartTime,
                end_time: formattedEndTime,
                days: daysActive,
                mode: policyMode,
                message: 'Time policy found'
            });
        } else {            // Return default values if no policy exists
            res.status(200).json({
                is_active: false,
                start_time: '08:00',
                end_time: '20:00',
                days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                mode: 'normal', // Default mode
                message: 'No time policy found, returning defaults'
            });
        }
    } catch (error) {
        console.error('Error fetching time policy:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal Server Error', 
            details: error.message 
        });
    }
});

// Route to create or update time policy
router.post('/policy/time', async (req, res) => {    try {
        const { start_time, end_time, days, is_active, mode } = req.body;
        
        // Validate required fields
        if (!start_time || !end_time || !days) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: start_time, end_time, or days'
            });
        }
        
        // Validate time format (simple check)
        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(start_time) || 
            !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(end_time)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid time format. Use HH:MM'
            });
        }
          // Convert day names to day numbers (0=Sunday, 1=Monday, etc.)
        const dayMap = {
            'sunday': 0,
            'monday': 1,
            'tuesday': 2,
            'wednesday': 3,
            'thursday': 4,
            'friday': 5,
            'saturday': 6
        };
        
        // Map day names to numbers - store numeric values for consistency in middleware
        const dayNumbers = days.map(dayName => {
            if (typeof dayName === 'string') {
                return dayMap[dayName.toLowerCase()]; 
            }
            return dayName;
        }).filter(num => num !== undefined);// Format times as HH:MM:SS for MySQL
        const formatTimeMySQLFormat = (timeStr) => {
            if (!timeStr) return '';
            
            try {
                // Split the time string by colon
                const timeParts = timeStr.split(':');
                
                // Handle HH:MM format - add seconds
                if (timeParts.length === 2) {
                    return `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`;
                }
                
                // Handle HH:MM:SS format
                if (timeParts.length >= 3) {
                    return `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:${timeParts[2].padStart(2, '0')}`;
                }
                
                // If we have just one part or it's invalid, handle the fallback
                return timeStr.padStart(2, '0') + ':00:00';            } catch (err) {
                console.error('Error formatting time for MySQL:', err);
                return timeStr;
            }
        };        
        // The mode variable is already declared in the function parameters
        // Prepare policy data with formatted times for MySQL (HH:MM:SS format)
        const policyData = {
            is_active: is_active ? 1 : 0,
            time_start: formatTimeMySQLFormat(start_time),
            time_end: formatTimeMySQLFormat(end_time),
            // Store the day numbers for consistent comparison in the middleware
            days_active: JSON.stringify(dayNumbers),
            mode: mode, // Add mode field
            updated_at: new Date()
        };
        
        // Check if a policy already exists
        const existingPolicies = await db.query('SELECT id FROM time_policies LIMIT 1');
        
        let result;
        if (existingPolicies && existingPolicies.length > 0) {            // Update existing policy
            try {
                // First try with mode column
                const updateSql = `
                    UPDATE time_policies 
                    SET is_active = ?, time_start = ?, time_end = ?, days_active = ?, mode = ?, updated_at = ? 
                    WHERE id = ?
                `;
                result = await db.query(updateSql, [
                    policyData.is_active,
                    policyData.time_start,
                    policyData.time_end,
                    policyData.days_active,
                    policyData.mode,
                    policyData.updated_at,
                    existingPolicies[0].id
                ]);
                console.log(`Updated time policy with ID ${existingPolicies[0].id}`);
            } catch (err) {
                // If error is about missing column, try to add it
                if (err.code === 'ER_BAD_FIELD_ERROR' && err.sqlMessage && err.sqlMessage.includes("Unknown column 'mode'")) {
                    console.log('Mode column missing, attempting to add it...');
                    try {
                        // Add mode column
                        await db.query('ALTER TABLE time_policies ADD COLUMN mode VARCHAR(50) DEFAULT "normal" AFTER days_active');
                        console.log('Added mode column to time_policies table');
                        
                        // Now try the update again
                        const updateSql = `
                            UPDATE time_policies 
                            SET is_active = ?, time_start = ?, time_end = ?, days_active = ?, mode = ?, updated_at = ? 
                            WHERE id = ?
                        `;
                        result = await db.query(updateSql, [
                            policyData.is_active,
                            policyData.time_start,
                            policyData.time_end,
                            policyData.days_active,
                            policyData.mode,
                            policyData.updated_at,
                            existingPolicies[0].id
                        ]);
                        console.log(`Updated time policy with ID ${existingPolicies[0].id} after adding mode column`);
                    } catch (alterErr) {
                        console.error('Failed to add mode column:', alterErr);
                        throw alterErr;
                    }
                } else {
                    throw err;
                }
            }
        } else {            // Create new policy
            try {
                // First try with mode column
                const insertSql = `
                    INSERT INTO time_policies 
                    (is_active, time_start, time_end, days_active, mode, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                policyData.created_at = new Date();
                result = await db.query(insertSql, [
                    policyData.is_active,
                    policyData.time_start,
                    policyData.time_end,
                    policyData.days_active,
                    policyData.mode,
                    policyData.created_at,
                    policyData.updated_at
                ]);
            } catch (err) {
                // If error is about missing column, try without mode column
                if (err.code === 'ER_BAD_FIELD_ERROR' && err.sqlMessage && err.sqlMessage.includes("Unknown column 'mode'")) {
                    console.log('Mode column missing, attempting to add it...');
                    try {
                        // Add mode column
                        await db.query('ALTER TABLE time_policies ADD COLUMN mode VARCHAR(50) DEFAULT "normal" AFTER days_active');
                        console.log('Added mode column to time_policies table');
                        
                        // Now try the insert again
                        const insertSql = `
                            INSERT INTO time_policies 
                            (is_active, time_start, time_end, days_active, mode, created_at, updated_at) 
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `;
                        result = await db.query(insertSql, [
                            policyData.is_active,
                            policyData.time_start,
                            policyData.time_end,
                            policyData.days_active,
                            policyData.mode,
                            policyData.created_at,
                            policyData.updated_at
                        ]);
                    } catch (alterErr) {
                        console.error('Failed to add mode column:', alterErr);
                        throw alterErr;
                    }
                } else {
                    throw err;
                }
            }
            console.log('Created new time policy');
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Time policy saved successfully',
            isUpdate: existingPolicies && existingPolicies.length > 0
        });
    } catch (error) {
        console.error('Error saving time policy:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save time policy', 
            details: error.message 
        });
    }
});



module.exports = router;