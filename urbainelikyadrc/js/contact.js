/* CONTACT.JS - Formulaire de contact (backend + fallback local) */

// On teste plusieurs chemins selon le contexte d'ouverture de la page.
const CONTACT_ENDPOINTS = [
  "/backend/api/messages/contact.php",
  "../backend/api/messages/contact.php",
  "backend/api/messages/contact.php",
];

const CONTACT_TEXT = {
  requiredFields: "Veuillez remplir tous les champs",
  savedLocal: "Message enregistré en local (backend indisponible).",
  sentSuccess: "Message envoyé avec succès !",
};

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();

  const formContact = document.getElementById("formcont");
  if (formContact) {
    formContact.addEventListener("submit", handleContactSubmit);
  }
});

async function handleContactSubmit(e) {
  e.preventDefault();

  const nom = document.getElementById("nom").value.trim();
  const email = document.getElementById("email").value.trim();
  const sujet = document.getElementById("sujet").value.trim();
  const message = document.getElementById("message").value.trim();

  if (!nom || !email || !sujet || !message) {
    alert(CONTACT_TEXT.requiredFields);
    return;
  }

  const payload = { nom, email, sujet, message };
  const sent = await sendContactToBackend(payload);

  if (!sent) {
    // Fallback: garder une trace locale quand le backend est indisponible.
    saveContactLocally(payload);
    alert(CONTACT_TEXT.savedLocal);
  } else {
    alert(CONTACT_TEXT.sentSuccess);
  }

  e.target.reset();
}

async function sendContactToBackend(payload) {
  for (const endpoint of CONTACT_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        return true;
      }
    } catch (e) {
      // On essaie le prochain endpoint.
    }
  }

  return false;
}

function saveContactLocally(payload) {
  const list = JSON.parse(
    localStorage.getItem("contact_messages_local") || "[]",
  );
  list.unshift({
    ...payload,
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem("contact_messages_local", JSON.stringify(list));
}
