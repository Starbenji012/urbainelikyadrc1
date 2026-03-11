/**
 * Fonction pour retourner à la page précédente
 */
function goBack() {
  window.history.back();
}

/* ============================================
   GESTION DU MENU BURGER
   ============================================ */
function initMenuBurger() {
  const menuBurger = document.getElementById("menu-burger");
  const navigationMenu = document.querySelector(".navigation-menu");

  if (menuBurger && navigationMenu) {
    menuBurger.addEventListener("click", () => {
      navigationMenu.classList.toggle("active");
    });

    // Fermer le menu quand un lien est cliqué
    navigationMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigationMenu.classList.remove("active");
      });
    });
  }
}

/* ============================================
   GESTION DES FORMULAIRES CONNEXION
   ============================================ */

/**
 * Utilitaire pour valider une adresse email
 * @param {string} email - Email à valider
 * @returns {boolean} True si email valide
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Crée et affiche un message d'erreur ou de succès
 * @param {string} message - Le message à afficher
 * @param {string} type - 'error' ou 'success'
 */
const showMessage = (message, type = "error") => {
  const messageDiv = document.createElement("div");
  messageDiv.className = `form-message form-message-${type}`;
  messageDiv.textContent = message;
  messageDiv.style.cssText = `
    padding: 12px 16px;
    margin: 12px 0;
    border-radius: 8px;
    font-weight: 500;
    background: ${type === "error" ? "#ffe6e6" : "#e6ffe6"};
    color: ${type === "error" ? "#e63946" : "#248154"};
    border-left: 4px solid ${type === "error" ? "#e63946" : "#248154"};
    animation: slideIn 0.3s ease;
  `;

  // Ajouter animation CSS en haut du document
  if (!document.getElementById("slideInStyle")) {
    const style = document.createElement("style");
    style.id = "slideInStyle";
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
 * Ajoute une classe d'erreur sur un champ
 * @param {HTMLElement} field - Le champ à marquer
 * @param {string} errorText - Le texte d'erreur
 */
const markFieldError = (field, errorText) => {
  field.classList.add("input-error");
  const errorElement = document.createElement("small");
  errorElement.className = "form-error";
  errorElement.textContent = errorText;
  field.parentElement.appendChild(errorElement);
};

/**
 * Nettoie les erreurs du formulaire
 * @param {HTMLElement} form - Le formulaire à nettoyer
 */
const clearFormErrors = (form) => {
  form.querySelectorAll(".input-error").forEach((field) => {
    field.classList.remove("input-error");
  });
  form.querySelectorAll(".form-error").forEach((error) => {
    error.remove();
  });
  form.querySelectorAll(".form-message").forEach((msg) => {
    msg.remove();
  });
};

// ========== INITIALISATION FORMULAIRE CONNEXION ==========
document.addEventListener("DOMContentLoaded", () => {
  // Initialiser le menu burger
  initMenuBurger();

  const formConnexion = document.getElementById("formCon");

  if (formConnexion) {
    const nomField = formConnexion.querySelector("#nom");
    const prenomField = formConnexion.querySelector("#prenom");
    const emailField = formConnexion.querySelector("#email");
    const passwordField = formConnexion.querySelector("#password");
    const submitBtn = formConnexion.querySelector(".btn-envoyer");

    // Validation en temps réel au blur
    emailField?.addEventListener("blur", () => {
      if (emailField.value.trim() && !validateEmail(emailField.value.trim())) {
        emailField.classList.add("input-error");
      } else {
        emailField.classList.remove("input-error");
      }
    });

    // Gestion de la soumission du formulaire
    formConnexion.addEventListener("submit", (e) => {
      e.preventDefault();
      clearFormErrors(formConnexion);

      let isValid = true;
      const nom = nomField?.value.trim() || "";
      const prenom = prenomField?.value.trim() || "";
      const email = emailField?.value.trim() || "";
      const password = passwordField?.value || "";

      // Validation Nom
      if (!nom) {
        markFieldError(nomField, "Nom requis.");
        isValid = false;
      } else if (nom.length < 2) {
        markFieldError(nomField, "Le nom doit contenir au moins 2 caractères.");
        isValid = false;
      }

      // Validation Prénom
      if (!prenom) {
        markFieldError(prenomField, "Prénom requis.");
        isValid = false;
      } else if (prenom.length < 2) {
        markFieldError(
          prenomField,
          "Le prénom doit contenir au moins 2 caractères.",
        );
        isValid = false;
      }

      // Validation Email
      if (!email) {
        markFieldError(emailField, "Email requis.");
        isValid = false;
      } else if (!validateEmail(email)) {
        markFieldError(
          emailField,
          "Format email invalide (ex: user@example.com).",
        );
        isValid = false;
      }

      // Validation Mot de passe
      if (!password) {
        markFieldError(passwordField, "Mot de passe requis.");
        isValid = false;
      }

      if (!isValid) {
        return;
      }

      // Créer payload
      const payload = {
        action: "login",
        email: email,
        password: password,
      };

      console.log("Données Connexion:", payload);

      // Désactiver le bouton et afficher le chargement
      submitBtn.disabled = true;
      submitBtn.textContent = "Connexion en cours...";
      submitBtn.style.opacity = "0.7";

      // Appel API réel
      fetch("/backend/api/auth.php", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Erreur HTTP " + response.status);
          }
          return response.json();
        })
        .then((data) => {
          if (data.success) {
            const messageSuccess = showMessage(
              "✓ Connexion réussie ! Redirection...",
              "success",
            );
            formConnexion.insertBefore(
              messageSuccess,
              formConnexion.firstChild,
            );

            // Redirection après 1.5s
            setTimeout(() => {
              window.location.href = "index.html";
            }, 1500);
          } else {
            throw new Error(data.error || "Identifiants incorrects");
          }
        })
        .catch((error) => {
          console.error("Erreur:", error);
          const messageError = showMessage(
            "Erreur de connexion: " + error.message,
            "error",
          );
          formConnexion.insertBefore(messageError, formConnexion.firstChild);
        })
        .finally(() => {
          // Réinitialiser le bouton
          submitBtn.disabled = false;
          submitBtn.textContent = "Connexion";
          submitBtn.style.opacity = "1";
        });
    });
  }

  // ========== CHANGEMENT DE FORM (Connexion <-> Inscription) ==========
  const switchButtons = document.querySelectorAll(".Switch");
  const forms = document.querySelectorAll(".form");

  switchButtons.forEach((switchBtn) => {
    switchBtn.addEventListener("click", () => {
      forms.forEach((form) => {
        form.classList.toggle("active");
      });
      clearFormErrors(document.querySelector(".formulaire"));
      // Animation de transition
      forms.forEach((form) => {
        form.style.transition = "opacity 0.3s ease";
      });
    });
  });
});
