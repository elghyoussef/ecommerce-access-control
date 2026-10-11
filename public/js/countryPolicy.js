document.addEventListener('DOMContentLoaded', function() {
      // Initialisation des tooltips Bootstrap
      const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
      });

      // Gestionnaire de sélection des pays
      const countrySelect = document.getElementById('countrySelect');
      const selectedCountriesList = document.getElementById('selectedCountriesList');
      const saveSelectedCountries = document.getElementById('saveSelectedCountries');
      const clearSelectedCountries = document.getElementById('clearSelectedCountries');
      let selectedCountries = new Set();

      // Fonction pour mettre à jour l'affichage des pays sélectionnés
      function updateSelectedCountriesDisplay() {
        selectedCountriesList.innerHTML = '';
        selectedCountries.forEach(countryStr => {
          const country = JSON.parse(countryStr);
          const countryDiv = document.createElement('div');
          countryDiv.className = 'selected-country';
          countryDiv.innerHTML = `
            <span>${country.text}</span>
            <i class="bi bi-x-circle" onclick="removeCountry('${country.value}', '${country.text}')"></i>
          `;
          selectedCountriesList.appendChild(countryDiv);
        });
      }      // Fonction pour charger les données sauvegardées
      async function loadSavedPolicy() {
        try {
          // First try to fetch from server API
          const response = await fetch('/security-policy');
          
          if (response.ok) {
            const policy = await response.json();
            
            if (policy) {
              console.log("Loaded policy from server:", policy);
              
              // Set active status based on is_active
              document.getElementById(policy.is_active ? 'countryActive' : 'countryInactive').checked = true;
              
              // Restore mode and security level
              if (policy.geoMode) {
                document.getElementById('geoMode').value = policy.geoMode;
              }
              
              if (policy.securityLevel !== undefined) {
                document.getElementById('securitylevel').value = policy.securityLevel.toString();
              }
              
              // Set allowLocalhost checkbox if it exists
              if (document.getElementById('allowLocalhost')) {
                document.getElementById('allowLocalhost').checked = !!policy.allowLocalhost;
              }
              
              // Restore selected countries
              if (policy.selectedCountries) {
                try {
                  const parsedCountries = JSON.parse(policy.selectedCountries);
                  
                  // Clear any previous selections
                  selectedCountries.clear();
                  Array.from(countrySelect.options).forEach(option => {
                    option.selected = false;
                  });
                  
                  // Add each country to the selection
                  parsedCountries.forEach(country => {
                    selectedCountries.add(JSON.stringify(country));
                    
                    // Select the option in the dropdown
                    Array.from(countrySelect.options).forEach(option => {
                      if (option.value === country.value) {
                        option.selected = true;
                      }
                    });
                  });
                  
                  console.log(`Loaded ${parsedCountries.length} countries from server policy`);
                  updateSelectedCountriesDisplay();
                  return;
                } catch (e) {
                  console.error("Error parsing countries from server:", e);
                }
              }
            }
          }
        } catch (err) {
          console.error("Error fetching policy from server:", err);
        }
        
        // Fallback to localStorage if server fetch fails
        const savedPolicy = localStorage.getItem('geoPolicy');
        if (savedPolicy) {
          const policy = JSON.parse(savedPolicy);
          console.log("Using policy from localStorage:", policy);
          
          // Restaurer le mode et le niveau de sécurité
          document.getElementById('geoMode').value = policy.geoMode || 'blacklist';
          document.getElementById('securitylevel').value = policy.securityLevel || '0';
          
          // Set allowLocalhost checkbox if it exists
          if (document.getElementById('allowLocalhost') && policy.allowLocalhost !== undefined) {
            document.getElementById('allowLocalhost').checked = policy.allowLocalhost;
          }
          
          // Restaurer les pays sélectionnés
          if (policy.countries && Array.isArray(policy.countries)) {
            selectedCountries = new Set(policy.countries.map(country => JSON.stringify(country)));
            
            // Mettre à jour la sélection visuelle
            Array.from(countrySelect.options).forEach(option => {
              const countryInfo = {
                value: option.value,
                text: option.text
              };
              option.selected = selectedCountries.has(JSON.stringify(countryInfo));
            });
            
            updateSelectedCountriesDisplay();
          }
        }
      }

      // Charger les données au démarrage
      loadSavedPolicy();

      // Gestionnaire de sélection de pays
      countrySelect.addEventListener('change', function(e) {
        const option = e.target.options[e.target.selectedIndex];
        const countryInfo = {
          value: option.value,
          text: option.text
        };
        
        if (option.selected) {
          selectedCountries.add(JSON.stringify(countryInfo));
        } else {
          selectedCountries.delete(JSON.stringify(countryInfo));
        }
        
        updateSelectedCountriesDisplay();
      });

      // Fonction pour retirer un pays
      window.removeCountry = function(value, text) {
        const countryInfo = {
          value: value,
          text: text
        };
        selectedCountries.delete(JSON.stringify(countryInfo));
        
        // Mettre à jour la sélection dans le select
        Array.from(countrySelect.options).forEach(option => {
          if (option.value === value) {
            option.selected = false;
          }
        });
        
        updateSelectedCountriesDisplay();
      };      // Gestionnaire de sauvegarde
      saveSelectedCountries.addEventListener('click', async function() {
        // Convert selectedCountries Set to Array of country objects
        const countriesArray = Array.from(selectedCountries).map(countryStr => {
          try {
            return JSON.parse(countryStr);
          } catch (e) {
            console.error("Error parsing country JSON:", e, countryStr);
            return null;
          }
        }).filter(country => country !== null); // Remove any null entries
        
        console.log(`Saving ${countriesArray.length} selected countries`);
        
        const selectedData = {
          is_active: document.getElementById('securitylevel').value !== '0',
          geoMode: document.getElementById('geoMode').value,
          securityLevel: document.getElementById('securitylevel').value,
          countries: countriesArray,
          allowLocalhost: document.getElementById('allowLocalhost') ? 
                          document.getElementById('allowLocalhost').checked : true
        };
        
        try {
          // Envoyer les données au serveur
          const response = await fetch('/api/policy/country', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(selectedData)
          });

          if (!response.ok) {
            // Try to parse the error response from the server
            let errorMessage = 'Erreur lors de la sauvegarde';
            try {
              const errorData = await response.json();
              errorMessage = errorData.details || errorData.error || errorMessage;
            } catch (e) {
              // Could not parse JSON, use the default error message
            }
            throw new Error(errorMessage);
          }
          
          const result = await response.json();
          
          // Sauvegarder aussi dans le localStorage pour la persistance locale
          localStorage.setItem('geoPolicy', JSON.stringify(selectedData));
            // Afficher une notification de succès
          const successAlert = document.createElement('div');
          successAlert.className = 'alert alert-success alert-dismissible fade show mt-2';
          successAlert.innerHTML = `
            <i class="bi bi-check-circle-fill"></i> 
            ${result.isUpdate ? 'Configuration géographique existante mise à jour' : 'Nouvelle configuration géographique créée'} avec succès
            (${countriesArray.length} pays ${document.getElementById('geoMode').value === 'whitelist' ? 'autorisés' : 'bloqués'})
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          `;
          document.querySelector('.selected-countries-container').after(successAlert);
          
          // Supprimer l'alerte après 3 secondes
          setTimeout(() => {
            successAlert.remove();
          }, 3000);
        } catch (error) {
          // Afficher une notification d'erreur
          const errorAlert = document.createElement('div');
          errorAlert.className = 'alert alert-danger alert-dismissible fade show mt-2';
          errorAlert.innerHTML = `
            <i class="bi bi-x-circle-fill"></i> ${error.message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          `;
          document.querySelector('.selected-countries-container').after(errorAlert);
          setTimeout(() => {
            errorAlert.remove();
          }, 3000);
        }
      });

      // Gestionnaire pour effacer la sélection
      clearSelectedCountries.addEventListener('click', function() {
        selectedCountries.clear();
        Array.from(countrySelect.options).forEach(option => {
          option.selected = false;
        });
        updateSelectedCountriesDisplay();
      });
      
      // Toggle policy activation
      function setupPolicyToggle(radioName, bodyId) {
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        const body = document.getElementById(bodyId);
        
        radios.forEach(radio => {
          radio.addEventListener('change', () => {
            if (radio.value === "inactive" && radio.checked) {
              body.classList.add('disabled-policy');
              body.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
            } else if (radio.value === "active" && radio.checked) {
              body.classList.remove('disabled-policy');
              body.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
            }
          });
          
          // Initial state
          if (radio.value === "inactive" && radio.checked) {
            body.classList.add('disabled-policy');
            body.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
          }
        });
      }
      
      // Setup all policy toggles
      setupPolicyToggle('countryPolicyStatus', 'countryPolicyBody');
      setupPolicyToggle('agePolicyStatus', 'agePolicyBody');
      setupPolicyToggle('timePolicyStatus', 'timePolicyBody');
      setupPolicyToggle('devicePolicyStatus', 'devicePolicyBody');
      setupPolicyToggle('riskPolicyStatus', 'riskPolicyBody');

      // Form submission
      document.getElementById('abacPolicyForm').addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Toutes les configurations ont été enregistrées avec succès.');
      });
    });