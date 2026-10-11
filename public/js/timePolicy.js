// Handles the save logic for the time/horaire policy only

document.addEventListener('DOMContentLoaded', function() {
  const saveTimePolicyBtn = document.getElementById('saveTimePolicy');
  if (!saveTimePolicyBtn) return;

  // Set up mode toggle handlers
  setupTimePolicyModeToggle();
  
  // Load the time policy when the page loads
  loadTimePolicy();

  saveTimePolicyBtn.addEventListener('click', async function() {
    // Get time policy values from the form
    const startTimeEl = document.getElementById('startTime');
    const endTimeEl = document.getElementById('endTime');
    
    if (!startTimeEl || !endTimeEl) {
      console.error("Time input elements not found");
      return showTimePolicyMessage("Erreur: Champs d'heure introuvables", 'danger');
    }
      // Get and format times to ensure HH:MM format
    const startTime = formatTimeHHMM(startTimeEl.value);
    const endTime = formatTimeHHMM(endTimeEl.value);
    
    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return showTimePolicyMessage("Format d'heure invalide. Utilisez HH:MM", 'danger');
    }    // Get the selected mode
    const isActive = document.getElementById('timeActive').checked;
    const is24Mode = document.getElementById('time24').checked;
    const isMaintenance = document.getElementById('timeMaintenance').checked;
    const mode = is24Mode ? '24/24' : (isMaintenance ? 'maintenance' : 'normal');
    
    // Days
    const days = [
      { id: 'dayMonday', name: 'monday' },
      { id: 'dayTuesday', name: 'tuesday' },
      { id: 'dayWednesday', name: 'wednesday' },
      { id: 'dayThursday', name: 'thursday' },
      { id: 'dayFriday', name: 'friday' },
      { id: 'daySaturday', name: 'saturday' },
      { id: 'daySunday', name: 'sunday' }
    ];
    const selectedDays = days.filter(day => document.getElementById(day.id).checked).map(day => day.name);

    // Build payload - use "00:00" and "23:59" for 24/24 mode
    // and all days of the week
    const payload = {
      start_time: is24Mode ? '00:00' : startTime,
      end_time: is24Mode ? '23:59' : endTime,
      days: is24Mode ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] : selectedDays,
      is_active: isActive || is24Mode || isMaintenance,
      mode: mode
    };

    try {
      const response = await fetch('/api/policy/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        showTimePolicyMessage('Politique horaire enregistrée avec succès.', 'success');
      } else {
        showTimePolicyMessage("Erreur lors de l'enregistrement de la politique horaire.", 'danger');
      }
    } catch (err) {
      showTimePolicyMessage("Erreur réseau lors de l'enregistrement de la politique horaire.", 'danger');
    }
  });
});

// Load time policy from the server
async function loadTimePolicy() {
  try {
    const response = await fetch('/api/policy/time');
    if (response.ok) {
      const policy = await response.json();
      console.log('Loaded time policy:', policy);      // Update UI with policy values
      const startTimeEl = document.getElementById('startTime');
      const endTimeEl = document.getElementById('endTime');      
      if (startTimeEl) {
        // Format time as HH:MM without seconds
        let formattedStartTime = policy.start_time ? formatTimeHHMM(policy.start_time) : '08:00';
        startTimeEl.value = formattedStartTime;
        // Update the clockpicker display if it's initialized
        if ($.fn.clockpicker && $(startTimeEl).closest('.clockpicker').length) {
          $(startTimeEl).closest('.clockpicker').clockpicker('updateValue', formattedStartTime);
        }
      }
      
      if (endTimeEl) {
        // Format time as HH:MM without seconds
        let formattedEndTime = policy.end_time ? formatTimeHHMM(policy.end_time) : '20:00';
        endTimeEl.value = formattedEndTime;
        // Update the clockpicker display if it's initialized
        if ($.fn.clockpicker && $(endTimeEl).closest('.clockpicker').length) {
          $(endTimeEl).closest('.clockpicker').clockpicker('updateValue', formattedEndTime);
        }
      }      // Set radio buttons based on policy mode
      const timeActive = document.getElementById('timeActive');
      const time24 = document.getElementById('time24');
      const timeMaintenance = document.getElementById('timeMaintenance');
      
      // First uncheck all radio buttons
      if (timeActive) timeActive.checked = false;
      if (time24) time24.checked = false;
      if (timeMaintenance) timeMaintenance.checked = false;
      
      if (!policy.is_active) {
        // Default to custom mode if not active
        if (timeActive) timeActive.checked = true;
      } else {
        // Check which mode the policy is in
        if (policy.mode === '24/24' && time24) {
          time24.checked = true;
        } else if (policy.mode === 'maintenance' && timeMaintenance) {
          timeMaintenance.checked = true;
        } else if (timeActive) {
          // Default to custom mode
          timeActive.checked = true;
        }
      }
      
      // Update UI based on selected mode by calling setupTimePolicyModeToggle
      // which will properly show/hide elements based on the selected mode
      setupTimePolicyModeToggle();
      
      console.log(`Time policy mode set to: ${policy.mode || 'normal'}`);
      console.log(`Active radio button: ${timeActive?.checked ? 'Custom' : (time24?.checked ? '24/24' : 'Maintenance')}`);
      
      
      // Reset all day checkboxes first
      const allDayCheckboxes = ['dayMonday', 'dayTuesday', 'dayWednesday', 'dayThursday', 
                               'dayFriday', 'daySaturday', 'daySunday'];
      allDayCheckboxes.forEach(id => {
        document.getElementById(id).checked = false;
      });
        // Check the days that are in the policy
      if (policy.days && Array.isArray(policy.days)) {
        policy.days.forEach(day => {
          // Create a map from day numbers to day names
          const dayMap = {
            0: 'sunday',
            1: 'monday',
            2: 'tuesday',
            3: 'wednesday',
            4: 'thursday',
            5: 'friday',
            6: 'saturday'
          };
          
          let normalizedName = '';
          
          // Handle both string day names and numeric day indexes
          if (typeof day === 'string') {
            normalizedName = day.trim().toLowerCase();
          } else if (typeof day === 'number' || !isNaN(day)) {
            // If it's a number (or numeric string), convert to day name
            const dayIndex = parseInt(day, 10);
            normalizedName = dayMap[dayIndex] || '';
          }
          
          if (normalizedName) {
            const capitalizedName = normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1);
            const dayId = 'day' + capitalizedName;
            
            console.log(`Setting checkbox for day: ${day} -> ${normalizedName} -> ${dayId}`);
            const checkbox = document.getElementById(dayId);
            if (checkbox) {
              checkbox.checked = true;
            } else {
              console.warn(`Checkbox not found for day: ${day} (ID: ${dayId})`);
            }
          }
        });
      }
    } else {
      console.error('Failed to load time policy');
    }
  } catch (err) {
    console.error('Error fetching time policy:', err);
  }
}

// Helper function to format time as HH:MM
function formatTimeHHMM(timeStr) {
  if (!timeStr) return '';
  
  // Check if the time already has the correct format
  if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
    // Ensure hours and minutes are padded with leading zeros
    const parts = timeStr.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  
  try {
    // Handle cases where we have seconds or other parts
    const timeParts = timeStr.split(':');
    
    // If we have hours and minutes parts
    if (timeParts.length >= 2) {
      const hours = timeParts[0].padStart(2, '0');
      const minutes = timeParts[1].padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    
    // If we have something else, try a fallback
    const timeDate = new Date(`2023-01-01T${timeStr}`);
    if (!isNaN(timeDate.getTime())) {
      const hours = timeDate.getHours().toString().padStart(2, '0');
      const minutes = timeDate.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    
    // Return the original if all else fails
    return timeStr;
  } catch (error) {
    console.error('Error formatting time:', error);
    return timeStr;
  }
}

function setupTimePolicyModeToggle() {
  const timeActive = document.getElementById('timeActive');
  const time24 = document.getElementById('time24');
  const timeMaintenance = document.getElementById('timeMaintenance');
    const timeSettingsContainer = document.getElementById('timeSettingsContainer');
  const customInfo = document.getElementById('customInfo');
  const mode24Info = document.getElementById('mode24Info');
  const maintenanceInfo = document.getElementById('maintenanceInfo');
  
  if (!timeActive || !time24 || !timeMaintenance || !timeSettingsContainer) return;
  
  // Function to update UI based on selected mode
  function updateTimePolicyUI() {
    // First, reset all info displays
    customInfo.style.display = 'none';
    mode24Info.style.display = 'none';
    maintenanceInfo.style.display = 'none';
    
    if (time24.checked) {
      // 24/24 mode - hide time settings but keep save button
      const daySelector = document.querySelector('.day-selector');
      const timeInputs = document.querySelector('.row.mb-3');
      const timeLabels = document.querySelectorAll('.form-label');
      
      if (daySelector) daySelector.style.display = 'none';
      if (timeInputs) timeInputs.style.display = 'none';
      if (timeLabels) {
        timeLabels.forEach(label => {
          if (label.textContent.includes('Heure') || label.textContent.includes('Jours')) {
            label.style.display = 'none';
          }
        });
      }
      
      mode24Info.style.display = 'block';
    } else if (timeMaintenance.checked) {
      // Maintenance mode - hide time settings but keep save button
      const daySelector = document.querySelector('.day-selector');
      const timeInputs = document.querySelector('.row.mb-3');
      const timeLabels = document.querySelectorAll('.form-label');
      
      if (daySelector) daySelector.style.display = 'none';
      if (timeInputs) timeInputs.style.display = 'none';
      if (timeLabels) {
        timeLabels.forEach(label => {
          if (label.textContent.includes('Heure') || label.textContent.includes('Jours')) {
            label.style.display = 'none';
          }
        });
      }
      
      maintenanceInfo.style.display = 'block';    } else {
      // Custom mode (timeActive checked) - show all settings
      const daySelector = document.querySelector('.day-selector');
      const timeInputs = document.querySelector('.row.mb-3');
      const timeLabels = document.querySelectorAll('.form-label');
      
      if (daySelector) daySelector.style.display = 'flex';
      if (timeInputs) timeInputs.style.display = 'flex';
      if (timeLabels) {
        timeLabels.forEach(label => {
          label.style.display = 'block';
        });
      }
      
      // Show the custom info alert
      customInfo.style.display = 'block';
    }
  }
  
  // Add event listeners to radio buttons
  timeActive.addEventListener('change', updateTimePolicyUI);
  time24.addEventListener('change', updateTimePolicyUI);
  timeMaintenance.addEventListener('change', updateTimePolicyUI);
  
  // Initialize UI based on current state
  updateTimePolicyUI();
}

function showTimePolicyMessage(message, type) {
  let msgDiv = document.getElementById('timePolicyMsg');
  if (!msgDiv) {
    msgDiv = document.createElement('div');
    msgDiv.id = 'timePolicyMsg';
    msgDiv.className = 'alert mt-2';
    document.getElementById('timePolicyBody').appendChild(msgDiv);
  }
  msgDiv.className = 'alert mt-2 alert-' + type;
  msgDiv.textContent = message;
  setTimeout(() => { msgDiv.remove(); }, 3500);
}
