/**
 * Fonction pour retourner à la page précédente
 */
function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = 'index.html';
  }
}

/* ============================================
   GESTION DU MENU BURGER
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  const menuBurger = document.getElementById('menu-burger');
  const navigationMenu = document.querySelector('.navigation-menu');

  if (menuBurger && navigationMenu) {
    menuBurger.addEventListener('click', () => {
      navigationMenu.classList.toggle('active');
    });

    // Fermer le menu quand un lien est cliqué
    navigationMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navigationMenu.classList.remove('active');
      });
    });
  }
});

/* ============================================
   GESTION DU FORMULAIRE DE CONTACT
   ============================================ */

/**
 * Valide une adresse email
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Affiche un message d'erreur ou de succès
 */
const showMessage = (message, type = 'error') => {
  const messageDiv = document.createElement('div');
  messageDiv.className = `form-message form-message-${type}`;
  messageDiv.textContent = message;
  messageDiv.style.cssText = `
    padding: 12px 16px;
    margin: 12px 0;
    border-radius: 8px;
    font-weight: 500;
    background: ${type === 'error' ? '#ffe6e6' : '#e6ffe6'};
    color: ${type === 'error' ? '#e63946' : '#248154'};
    border-left: 4px solid ${type === 'error' ? '#e63946' : '#248154'};
    animation: slideIn 0.3s ease;
  `;
  
  if (!document.getElementById('slideInStyle')) {
    const style = document.createElement('style');
    style.id = 'slideInStyle';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateY(-10px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  return messageDiv;
};

/**
 * Marque un champ comme ayant une erreur
 */
const markFieldError = (field, errorText) => {
  field.classList.add('input-error');
  const errorElement = document.createElement('small');
  errorElement.className = 'form-error';
  errorElement.textContent = errorText;
  field.parentElement.appendChild(errorElement);
};

/**
 * Nettoie les erreurs du formulaire
 */
const clearFormErrors = (form) => {
  form.querySelectorAll('.input-error').forEach(field => {
    field.classList.remove('input-error');
  });
  form.querySelectorAll('.form-error').forEach(error => {
    error.remove();
  });
  form.querySelectorAll('.form-message').forEach(msg => {
    msg.remove();
  });
};

// ========== INITIALISATION FORMULAIRE CONTACT ==========
document.addEventListener('DOMContentLoaded', () => {
  const formContact = document.getElementById('formcont');
  
  if (formContact) {
    const nomField = formContact.querySelector('#nom');
    const sujetField = formContact.querySelector('#sujet');
    const emailField = formContact.querySelector('#email');
    const messageField = formContact.querySelector('#message');
    const submitBtn = formContact.querySelector('.btn-envoyer');

    // Validation en temps réel au blur pour l'email
    emailField?.addEventListener('blur', () => {
      if (emailField.value.trim() && !validateEmail(emailField.value.trim())) {
        emailField.classList.add('input-error');
      } else {
        emailField.classList.remove('input-error');
      }
    });

    // Gestion de la soumission du formulaire
    formContact.addEventListener('submit', (e) => {
      e.preventDefault();
      clearFormErrors(formContact);

      let isValid = true;
      const nom = nomField?.value.trim() || '';
      const sujet = sujetField?.value.trim() || '';
      const email = emailField?.value.trim() || '';
      const message = messageField?.value.trim() || '';

      // Validation Nom
      if (!nom) {
        markFieldError(nomField, 'Nom requis.');
        isValid = false;
      } else if (nom.length < 2) {
        markFieldError(nomField, 'Le nom doit contenir au moins 2 caractères.');
        isValid = false;
      }

      // Validation Sujet
      if (!sujet) {
        markFieldError(sujetField, 'Sujet requis.');
        isValid = false;
      } else if (sujet.length < 3) {
        markFieldError(sujetField, 'Le sujet doit contenir au moins 3 caractères.');
        isValid = false;
      }

      // Validation Email
      if (!email) {
        markFieldError(emailField, 'Email requis.');
        isValid = false;
      } else if (!validateEmail(email)) {
        markFieldError(emailField, 'Format email invalide (ex: user@example.com).');
        isValid = false;
      }

      // Validation Message
      if (!message) {
        markFieldError(messageField, 'Message requis.');
        isValid = false;
      } else if (message.length < 10) {
        markFieldError(messageField, 'Le message doit contenir au moins 10 caractères.');
        isValid = false;
      }

      if (!isValid) {
        return;
      }

      // Créer le payload
      const payload = {
        nom: nom,
        sujet: sujet,
        email: email,
        message: message,
        timestamp: new Date().toISOString()
      };

      console.log('Données Contact:', payload);

      // Sauvegarder dans localStorage
      const contacts = JSON.parse(localStorage.getItem('contacts') || '[]');
      contacts.push(payload);
      localStorage.setItem('contacts', JSON.stringify(contacts));

      // Désactiver le bouton et afficher le chargement
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours...';
      submitBtn.style.opacity = '0.7';

      // Simuler un appel API (remplacer par fetch réel)
      setTimeout(() => {
        // Succès simulé
        const messageSuccess = showMessage('✓ Votre message a été reçu ! Nous vous répondrons bientôt.', 'success');
        formContact.insertBefore(messageSuccess, formContact.firstChild);

        // Réinitialiser le formulaire
        formContact.reset();
        clearFormErrors(formContact);

        // Réinitialiser le bouton
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer';
        submitBtn.style.opacity = '1';

        // Optionnel: redirection après 2s
        setTimeout(() => {
          // window.location.href = 'index.html';
          console.log('Message envoyé et sauvegardé.');
        }, 2000);
      }, 800);
    });
  }

  
});
