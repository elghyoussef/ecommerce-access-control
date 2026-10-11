document.addEventListener('DOMContentLoaded', function() {
    const resetBtn = document.getElementById('resetAgeDefaults');
    const minAgeInput = document.getElementById('minAge');
    const maxAgeInput = document.getElementById('maxAge');
    const agePolicyBody = document.getElementById('agePolicyBody');
    const saveAgePolicyButton = document.getElementById('saveAgePolicy'); 

    // Load current age policy from server
    async function loadAgePolicy() {
        try {
            const response = await fetch('/api/policy/age');
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('No age policy found on server. Using defaults.');
                    if(minAgeInput) minAgeInput.value = 18; // Default min age
                    if(maxAgeInput) maxAgeInput.value = ''; // Default max age (no limit)
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const policy = await response.json();
            if (policy) {
                if(minAgeInput) minAgeInput.value = policy.min_age !== null ? policy.min_age : '';
                if(maxAgeInput) maxAgeInput.value = policy.max_age !== null ? policy.max_age : '';
            } else { // Handles case where API returns 200 but no policy (e.g. empty table)
                console.log('No age policy configured yet. Using defaults.');
                if(minAgeInput) minAgeInput.value = 18;
                if(maxAgeInput) maxAgeInput.value = '';
            }
        } catch (error) {
            console.error('Failed to load age policy:', error);
            // Fallback to default UI state on error
            if(minAgeInput) minAgeInput.value = 18;
            if(maxAgeInput) maxAgeInput.value = '';
            // Optionally, display an error message to the user in the UI
            displayPolicyMessage('agePolicyBody', 'Erreur: Impossible de charger la politique d\'âge.', 'danger');
        }
    }

    // Save age policy to server
    async function saveAgePolicy() {
        if (!minAgeInput || !maxAgeInput) {
            console.error('Age policy form elements not found.');
            displayPolicyMessage('agePolicyBody', 'Erreur: Éléments du formulaire non trouvés.', 'danger');
            return;
        }

        const minAge = minAgeInput.value ? parseInt(minAgeInput.value, 10) : null;
        const maxAge = maxAgeInput.value ? parseInt(maxAgeInput.value, 10) : null;

        if (minAge === null || isNaN(minAge) || minAge <= 0) {
            displayPolicyMessage('agePolicyBody', 'Veuillez entrer un âge minimum valide.', 'warning');
            return;
        }
        if (maxAge !== null && maxAge !== '' && (isNaN(maxAge) || maxAge < minAge)) {
            displayPolicyMessage('agePolicyBody', 'Veuillez entrer un âge maximum valide (supérieur ou égal à l\'âge minimum).', 'warning');
            return;
        }

        const policyData = {
            min_age: minAge,
            max_age: maxAge,
            is_active: true // Always active
        };

        try {
            const response = await fetch('/api/policy/age', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(policyData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Erreur inconnue lors de la sauvegarde.' }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            displayPolicyMessage('agePolicyBody', result.message || 'Politique d\'âge enregistrée avec succès !', 'success');
            loadAgePolicy(); // Reload to reflect saved state and ensure UI consistency

        } catch (error) {
            console.error('Failed to save age policy:', error);
            displayPolicyMessage('agePolicyBody', `Erreur: ${error.message}`, 'danger');
        }
    }
    
    // Helper function to display messages within a policy section
    function displayPolicyMessage(policyBodyId, message, type = 'info') {
        const policyBody = document.getElementById(policyBodyId);
        if (!policyBody) return;

        let alertContainer = policyBody.querySelector('.policy-message-container');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.className = 'policy-message-container mt-3';
            // Insert after the form elements, before any existing small.form-text
            const formText = policyBody.querySelector('small.form-text');
            if (formText) {
                policyBody.insertBefore(alertContainer, formText);
            } else {
                policyBody.appendChild(alertContainer);
            }
        }
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        alertContainer.innerHTML = ''; // Clear previous messages
        alertContainer.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 150); // Allow fade out
        }, 5000); // Message disappears after 5 seconds
    }

    if (saveAgePolicyButton) {
        saveAgePolicyButton.addEventListener('click', saveAgePolicy);
    }

    // Initial load
    loadAgePolicy();
});
