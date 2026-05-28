const ADMIN_API_CANDIDATES = (function () {
  const list = [];
  try {
    if (window.location && window.location.origin) {
      list.push(window.location.origin + "/backend/api/admin/dashboard.php");
    }
  } catch (e) {}
  list.push("/backend/api/admin/dashboard.php");
  list.push("backend/api/admin/dashboard.php");
  return Array.from(new Set(list));
})();

const ADMIN_LOGIN_ENDPOINTS =
  typeof buildApiEndpoints === "function"
    ? buildApiEndpoints("auth/login.php")
    : ["/backend/api/auth/login.php", "backend/api/auth/login.php"];

const ADMIN_ACTION_ENDPOINTS =
  typeof buildApiEndpoints === "function"
    ? buildApiEndpoints("admin/action.php")
    : ["/backend/api/admin/action.php", "backend/api/admin/action.php"];

let dashboardData = null;
let adminMap = null;
let adminMarkers = [];
let adminMapFilter = null;
let dashboardViewMode = "connexion";

document.addEventListener("DOMContentLoaded", function () {
  try {
    initMenuBurger();
  } catch (e) {}
  bindControls();
  bindDashboardActions();
  bindConnexionLogin();
  initTabUI();
});

function hasAdminSession() {
  return Boolean(getDashboardAuthToken());
}

function initTabUI() {
  const btnAccueil = document.getElementById("tab-accueil-btn");
  const btnConnexion = document.getElementById("tab-connexion-btn");

  if (hasAdminSession()) showManagementView();
  else showTab("connexion");

  if (btnAccueil) {
    btnAccueil.addEventListener("click", function (event) {
      event.preventDefault();
      showTab("accueil");
    });
  }

  if (btnConnexion) {
    btnConnexion.addEventListener("click", function (event) {
      event.preventDefault();
      showTab("connexion");
    });
  }
}

function showTab(name) {
  dashboardViewMode = name;
  setManagementMode(false);

  const panels = document.querySelectorAll(".tab-panel");
  panels.forEach(function (panel) {
    try {
      panel.hidden = panel.getAttribute("data-tab") !== name;
    } catch (e) {}
  });

  const btns = document.querySelectorAll(".dashboard-nav-link");
  btns.forEach(function (btn) {
    const controls = btn.getAttribute("aria-controls") || "";
    btn.classList.toggle("active", controls.indexOf(name) !== -1);
  });

  if (name === "accueil") {
    if (!dashboardData || Object.keys(dashboardData).length === 0) {
      loadDashboardData();
    } else {
      renderHomeSummary();
    }
  }
}

function showManagementView() {
  dashboardViewMode = "gestion";
  const accueilPanel = document.getElementById("tab-accueil");
  const connexionPanel = document.getElementById("tab-connexion");
  if (accueilPanel) accueilPanel.hidden = false;
  if (connexionPanel) connexionPanel.hidden = true;
  setActiveDashboardNav(null);
  setManagementMode(true);

  if (!dashboardData || Object.keys(dashboardData).length === 0) {
    loadDashboardData();
  } else {
    renderManagementWorkspace();
  }
}

function setActiveDashboardNav(name) {
  const btns = document.querySelectorAll(".dashboard-nav-link");
  btns.forEach(function (btn) {
    const controls = btn.getAttribute("aria-controls") || "";
    btn.classList.toggle(
      "active",
      name ? controls.indexOf(name) !== -1 : false,
    );
  });
}

function setManagementMode(isVisible) {
  const welcomePanel = document.querySelector(
    "#tab-accueil > section.panel:not(.dashboard-management-panel)",
  );
  const summaryGrid = document.querySelector("#tab-accueil .stats-grid");
  const managementPanels = document.querySelectorAll(
    ".dashboard-management-panel",
  );

  if (welcomePanel) welcomePanel.hidden = isVisible;
  if (summaryGrid) summaryGrid.hidden = isVisible;
  managementPanels.forEach(function (panel) {
    panel.hidden = !isVisible;
  });
}

function bindControls() {
  const refresh = document.getElementById("btn-refresh-dashboard");
  if (refresh)
    refresh.addEventListener("click", function () {
      loadDashboardData(true);
    });
  const fit = document.getElementById("btn-map-fit");
  if (fit)
    fit.addEventListener("click", function () {
      clearAdminMapFilter();
      fitMapToPoints();
    });
  bindLegendFilters();
  const statsToggle = document.getElementById("btn-stats-toggle");
  if (statsToggle)
    statsToggle.addEventListener("click", function () {
      toggleStatsVisibility();
    });
  const historyToggle = document.getElementById("btn-history-toggle");
  if (historyToggle)
    historyToggle.addEventListener("click", function () {
      toggleHistoryVisibility();
    });
}

function bindDashboardActions() {
  const container = document.getElementById("dashboard-section");
  if (!container) return;

  container.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-admin-action]");
    if (!button) return;
    event.preventDefault();
    if (button.disabled) return;

    const resource = button.getAttribute("data-resource") || "";
    const action = button.getAttribute("data-admin-action") || "";
    const id = button.getAttribute("data-id") || "";
    if (!resource || !action || !id) return;

    if (resource === "signalement" && action === "view-map") {
      focusAdminSignalementOnMap(id);
      return;
    }

    handleDashboardAction(button, resource, action, id);
  });
}

function bindConnexionLogin() {
  const form = document.getElementById("dashboard-admin-login-form");
  const passwordInput = document.getElementById("dashboard-admin-password");

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      handleInlineAdminLogin();
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleInlineAdminLogin();
    });
  }
}

async function handleInlineAdminLogin() {
  const emailInput = document.getElementById("dashboard-admin-email");
  const passwordInput = document.getElementById("dashboard-admin-password");
  const status = document.getElementById("dashboard-login-status");

  const email = String((emailInput && emailInput.value) || "").trim();
  const password = String((passwordInput && passwordInput.value) || "");

  if (!email || !password) {
    if (status)
      status.textContent = "Veuillez renseigner email et mot de passe.";
    return;
  }

  if (status) status.textContent = "Connexion en cours...";

  const response = await loginAdminToBackendInline({
    email: email,
    password: password,
  });
  if (!response.ok) {
    if (status)
      status.textContent = response.message || "Identifiants invalides.";
    return;
  }

  const user = response.user || {};
  const role = String(user.role || "").toLowerCase();
  if (role !== "admin" && role !== "super_admin") {
    if (status)
      status.textContent = "Ce compte n'a pas le rôle administrateur.";
    return;
  }

  const displayName =
    [user.prenom, user.nom, user.surnom].filter(Boolean).join(" ").trim() ||
    email;
  localStorage.setItem("admin_auth_token", String(user.auth_token || ""));
  localStorage.setItem("admin_auth_connected", "1");
  localStorage.setItem("admin_user_role", role);
  localStorage.setItem("admin_user_email", String(user.email || email));
  localStorage.setItem("admin_user_name", displayName);
  localStorage.setItem(
    "admin_user_id",
    String(user.id || user.id_utilisateur || ""),
  );

  if (status)
    status.textContent = "Connexion réussie. Bienvenue sur le dashboard.";
  showManagementView();
}

async function loginAdminToBackendInline(payload) {
  for (const endpoint of ADMIN_LOGIN_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await resp.json().catch(function () {
        return {};
      });
      if (!resp.ok) {
        if (resp.status >= 500) continue;
        return {
          ok: false,
          message: (json && json.message) || "Identifiants invalides.",
        };
      }

      return { ok: true, user: (json && json.data) || null };
    } catch (error) {
      continue;
    }
  }

  return { ok: false, message: "Backend indisponible." };
}

async function handleDashboardAction(button, resource, action, id) {
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Traitement...";

  try {
    const payload = { resource: resource, action: action, id: id };
    const status = button.getAttribute("data-status") || "";

    if (resource === "signalement" && action === "status" && status) {
      payload.status = status;
      if (status === "resolu") {
        const evidence = await pickActionImageDataUrl(
          "Choisissez l'image de preuve pour la résolution du signalement.",
        );
        if (!evidence) {
          window.alert("Une image de preuve est obligatoire pour résoudre.");
          return;
        }
        payload.evidence = evidence;
      }
    }

    if (resource === "idee" && action === "status" && status) {
      payload.status = status;
    }

    if (action === "cancel") {
      const reason = window.prompt(
        resource === "signalement"
          ? "Pourquoi annuler ce signalement ?"
          : "Pourquoi annuler cette idée ?",
        "",
      );
      if (!reason || !reason.trim()) {
        window.alert("Un motif est obligatoire pour annuler.");
        return;
      }
      payload.reason = reason.trim();
    }

    if (resource === "user" && action === "warn") {
      const note = window.prompt("Motif de l'avertissement ?", "");
      if (note === null) return;
      payload.note = note.trim();
    }

    if (resource === "user" && (action === "block" || action === "delay")) {
      const daysText = window.prompt(
        "Durée en jours ?",
        action === "block" ? "7" : "3",
      );
      if (daysText === null) return;
      const days = parseInt(daysText, 10);
      if (isNaN(days) || days <= 0) {
        window.alert("Veuillez saisir un nombre de jours valide.");
        return;
      }

      const hoursText = window.prompt("Durée en heures ?", "0");
      if (hoursText === null) return;
      const hours = parseInt(hoursText, 10);
      if (isNaN(hours) || hours < 0) {
        window.alert("Veuillez saisir un nombre d'heures valide.");
        return;
      }

      payload.days = days;
      payload.hours = hours;
      payload.reason =
        window.prompt(
          "Motif du blocage ?",
          "Compte bloque par un administrateur.",
        ) || "Compte bloque par un administrateur.";
    }

    const response = await callAdminAction(payload);
    if (!response.ok) {
      window.alert(response.message || "Action impossible.");
      return;
    }

    await loadDashboardData(false);
    if (dashboardViewMode === "gestion") renderManagementWorkspace();
    else renderHomeSummary();
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function pickActionImageDataUrl(message) {
  return new Promise(function (resolve) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);

    const cleanup = function () {
      try {
        input.remove();
      } catch (e) {}
    };

    input.addEventListener("change", function () {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = function () {
        cleanup();
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        cleanup();
        resolve(null);
      };
      reader.readAsDataURL(file);
    });

    if (message)
      window.setTimeout(function () {
        input.click();
      }, 0);
    else input.click();
  });
}

async function callAdminAction(payload) {
  for (const endpoint of ADMIN_ACTION_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: Object.assign(
          { "Content-Type": "application/json", Accept: "application/json" },
          buildDashboardAuthHeaders(),
        ),
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await resp.json().catch(function () {
        return {};
      });
      if (!resp.ok) {
        if (resp.status >= 500) continue;
        return {
          ok: false,
          message: (json && json.message) || "Action refusée.",
        };
      }

      return { ok: true, data: (json && json.data) || null };
    } catch (error) {
      continue;
    }
  }

  return { ok: false, message: "Backend indisponible." };
}

async function loadDashboardData(showAlert) {
  if (showAlert === undefined) showAlert = true;
  const alertBox = document.getElementById("dashboard-alert");
  if (showAlert && alertBox) {
    alertBox.className = "dashboard-alert dashboard-alert--info";
    alertBox.textContent = "Chargement des données administrateur en cours.";
  }

  try {
    const res = await fetchWithFallback(
      ADMIN_API_CANDIDATES,
      {
        method: "GET",
        headers: buildDashboardAuthHeaders(),
        credentials: "include",
        cache: "no-store",
      },
      7000,
    );

    if (!res) throw new Error("Aucun endpoint reachable");

    if (res.status === 401) {
      if (alertBox) {
        alertBox.className = "dashboard-alert dashboard-alert--error";
        alertBox.innerHTML =
          'Session expirée ou absente. <a href="admin-login.html">Connectez-vous ici</a>.';
      }
      dashboardData = emptyDashboardData();
      renderHomeSummary();
      return;
    }

    if (res.status === 403) {
      if (alertBox) {
        alertBox.className = "dashboard-alert dashboard-alert--error";
        alertBox.textContent = "Accès refusé: compte non administrateur.";
      }
      dashboardData = emptyDashboardData();
      renderHomeSummary();
      return;
    }

    if (!res.ok) {
      const text = await res.text().catch(function () {
        return "";
      });
      throw new Error("HTTP " + res.status + " " + text);
    }

    let payload = null;
    try {
      payload = await res.json();
    } catch (e) {
      throw new Error("Réponse API invalide (JSON)");
    }

    dashboardData = payload && payload.data ? payload.data : payload;
    if (!dashboardData) dashboardData = emptyDashboardData();

    if (alertBox) {
      alertBox.className = "dashboard-alert dashboard-alert--info";
      alertBox.textContent =
        (payload && payload.message) || "Données chargées.";
    }

    if (dashboardViewMode === "gestion") renderManagementWorkspace();
    else renderHomeSummary();
  } catch (err) {
    console.error("loadDashboardData", err);
    dashboardData = emptyDashboardData();
    if (alertBox) {
      alertBox.className = "dashboard-alert dashboard-alert--error";
      alertBox.textContent = "Impossible de récupérer les données backend.";
    }
    if (dashboardViewMode === "gestion") renderManagementWorkspace();
    else renderHomeSummary();
  }
}

async function fetchWithFallback(endpoints, fetchOptions, perRequestTimeout) {
  if (fetchOptions === undefined) fetchOptions = {};
  if (perRequestTimeout === undefined) perRequestTimeout = 5000;
  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const id = setTimeout(function () {
        controller.abort();
      }, perRequestTimeout);
      const res = await fetch(
        ep,
        Object.assign({}, fetchOptions, { signal: controller.signal }),
      );
      clearTimeout(id);
      if (!res) continue;
      return res;
    } catch (e) {
      continue;
    }
  }
  return null;
}

function emptyDashboardData() {
  return {
    current_user: {},
    stats: {},
    signalements: [],
    idees: [],
    cancelled_history: [],
    deleted_history: [],
    messages: [],
    users: [],
    admins: [],
    filters: {},
    map_points: [],
  };
}

function renderAll() {
  renderStats();
  renderSignalementsTable();
  renderIdeesTable();
  renderMessagesTable();
  renderUsersTable();
  renderAdminsTable();
  renderHistories();
  syncSuperAdminPanelVisibility();
  renderMap();
}

function renderManagementWorkspace() {
  if (!adminMap) {
    if (typeof L === "undefined") {
      loadLeafletOnce()
        .then(function () {
          initMap();
          renderAll();
        })
        .catch(function () {
          renderAll();
        });
      return;
    }
    initMap();
  }
  renderAll();
}

function renderHomeSummary() {
  renderStats();
  renderHistories();
}

function syncSuperAdminPanelVisibility() {
  const panel = document.getElementById("admin-management-panel");
  if (!panel) return;

  const currentUser =
    dashboardData && dashboardData.current_user
      ? dashboardData.current_user
      : {};
  const role = String(
    currentUser.role || localStorage.getItem("admin_user_role") || "",
  ).toLowerCase();
  const isSuperAdmin = role === "super_admin";

  panel.hidden = !isSuperAdmin;
  panel.setAttribute("aria-hidden", isSuperAdmin ? "false" : "true");
}

function bindLegendFilters() {
  document.querySelectorAll(".legend-item[data-type]").forEach(function (item) {
    if (item.dataset.bound === "1") return;
    item.addEventListener("click", function () {
      const type = String(item.getAttribute("data-type") || "").toLowerCase();
      if (!type) return;
      adminMapFilter = adminMapFilter === type ? null : type;
      updateAdminMapFilter();
    });
    item.dataset.bound = "1";
  });
}

function clearAdminMapFilter() {
  adminMapFilter = null;
  updateAdminMapFilter();
}

function toggleStatsVisibility() {
  const grid = document.getElementById("dashboard-stats-grid");
  const button = document.getElementById("btn-stats-toggle");
  if (!grid || !button) return;

  const collapsed = grid.getAttribute("data-collapsed") !== "false";
  const nextCollapsed = !collapsed;
  grid.setAttribute("data-collapsed", nextCollapsed ? "true" : "false");
  button.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
  button.textContent = nextCollapsed ? "Voir plus" : "Voir moins";
}

function toggleHistoryVisibility() {
  const panel = document.getElementById("dashboard-history-panel");
  const button = document.getElementById("btn-history-toggle");
  if (!panel || !button) return;

  const isHidden = panel.hidden;
  panel.hidden = !isHidden;
  button.setAttribute("aria-expanded", isHidden ? "true" : "false");
  button.textContent = isHidden ? "Masquer historiques" : "Voir historiques";

  if (isHidden && typeof panel.scrollIntoView === "function") {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderStats() {
  const s = dashboardData && dashboardData.stats ? dashboardData.stats : {};
  animateCounter("users-total", Number(s.users_total || 0));
  animateCounter("signalements-total", Number(s.signalements_total || 0));
  animateCounter("signalements-en-cours", Number(s.signalements_en_cours || 0));
  animateCounter("signalements-resolus", Number(s.signalements_resolus || 0));
  animateCounter("signalements-annules", Number(s.signalements_annules || 0));
  animateCounter(
    "signalements-supprimes",
    Number(s.signalements_supprimes || 0),
  );
  animateCounter("idees-total", Number(s.idees_total || 0));
  animateCounter("idees-en-cours", Number(s.idees_en_cours || 0));
  animateCounter("likes-total", Number(s.likes_total || 0));
  animateCounter("messages-total", Number(s.messages_total || 0));
  animateCounter("warnings-total", Number(s.warnings_total || 0));
  animateCounter("idees-realisees", Number(s.idees_realisees || 0));
  animateCounter("idees-annulees", Number(s.idees_annulees || 0));
  animateCounter("idees-supprimees", Number(s.idees_supprimees || 0));
}

function renderHistories() {
  const cancelledList = document.getElementById("cancelled-history-list");
  const deletedList = document.getElementById("deleted-history-list");
  if (cancelledList) cancelledList.innerHTML = renderCancelledHistoryItems();
  if (deletedList) deletedList.innerHTML = renderDeletedHistoryItems();
}

function renderCancelledHistoryItems() {
  const rows = Array.isArray(dashboardData && dashboardData.cancelled_history)
    ? dashboardData.cancelled_history
    : [];
  if (!rows.length) {
    return '<div class="empty-state">Aucune annulation récente.</div>';
  }

  return rows
    .map(function (row) {
      const typeLabel = row.resource_type === "idee" ? "Idée" : "Signalement";
      const title = escapeHtml(
        row.resource_title || row.resource_id || "Sans titre",
      );
      const reason = escapeHtml(row.reason || "Motif non renseigné");
      const date = escapeHtml(formatDate(row.cancelled_at || ""));
      const author = escapeHtml(row.updated_by || "");
      return (
        '<div class="history-item">' +
        "<strong>" +
        typeLabel +
        " - " +
        title +
        "</strong>" +
        '<div class="history-meta">Annulé le ' +
        date +
        (author ? "<br>Par: " + author : "") +
        "<br>Motif: " +
        reason +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

function renderDeletedHistoryItems() {
  const rows = Array.isArray(dashboardData && dashboardData.deleted_history)
    ? dashboardData.deleted_history
    : [];
  if (!rows.length) {
    return '<div class="empty-state">Aucune suppression récente.</div>';
  }

  return rows
    .map(function (row) {
      const typeLabel = row.resource_type === "idee" ? "Idée" : "Signalement";
      const title = escapeHtml(
        row.resource_title || row.resource_id || "Sans titre",
      );
      const date = escapeHtml(formatDate(row.deleted_at || ""));
      const author = escapeHtml(row.deleted_by || "");
      return (
        '<div class="history-item">' +
        "<strong>" +
        typeLabel +
        " - " +
        title +
        "</strong>" +
        '<div class="history-meta">Supprimé le ' +
        date +
        (author ? "<br>Par: " + author : "") +
        "</div>" +
        "</div>"
      );
    })
    .join("");
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = target.toLocaleString("fr-FR");
}

function renderSignalementsTable() {
  const body = document.getElementById("signalements-table-body");
  if (!body) return;
  const rows = getFilteredAdminSignalements();
  if (rows.length === 0) {
    body.innerHTML =
      '<tr><td colspan="6"><div class="empty-state">Aucun signalement trouvé.</div></td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(function (r) {
      const id = escapeHtml(r.id_signalement || r.id || "");
      const status = String(r.status || "")
        .toLowerCase()
        .trim();
      const primaryLabel = getWorkflowPrimaryLabel("signalement", status);
      const secondaryLabel = getWorkflowSecondaryLabel(status);
      const secondaryAction = status === "en_cours" ? "cancel" : "delete";
      return (
        "<tr>" +
        "<td><strong>" +
        escapeHtml(r.titre || "") +
        '</strong><div class="row-subtle">' +
        escapeHtml(r.lieu || "") +
        '</div><div class="row-subtle">' +
        escapeHtml(renderWorkflowDates(r)) +
        "</div></td>" +
        "<td>" +
        escapeHtml(formatCategory(r.type || "")) +
        "</td>" +
        "<td>" +
        escapeHtml(displaySignalementStatus(r.status || "")) +
        "</td>" +
        "<td>" +
        escapeHtml(r.user_nom || "") +
        "</td>" +
        "<td>" +
        escapeHtml(formatDate(r.timestamp || "")) +
        "</td>" +
        '<td><div class="action-group">' +
        '<button class="btn btn-small btn-warning" type="button" data-admin-action="status" data-resource="signalement" data-id="' +
        id +
        '" data-status="en_cours">' +
        escapeHtml(primaryLabel) +
        "</button>" +
        '<button class="btn btn-small btn-success" type="button" data-admin-action="status" data-resource="signalement" data-id="' +
        id +
        '" data-status="resolu">Résolu</button>' +
        '<button class="btn btn-small ' +
        (secondaryAction === "cancel" ? "btn-primary" : "btn-danger") +
        '" type="button" data-admin-action="' +
        secondaryAction +
        '" data-resource="signalement" data-id="' +
        id +
        '">' +
        escapeHtml(secondaryLabel) +
        "</button>" +
        "</div></td>" +
        "</tr>"
      );
    })
    .join("");
}

function getFilteredAdminSignalements() {
  const rows = Array.isArray(dashboardData.signalements)
    ? dashboardData.signalements
    : [];
  if (!adminMapFilter) return rows;

  return rows.filter(function (row) {
    return (
      String(row.type || "")
        .toLowerCase()
        .trim() === adminMapFilter
    );
  });
}

function focusAdminSignalementOnMap(id) {
  if (!adminMap) return;

  const signalement = findAdminSignalementById(id);
  if (!signalement) return;

  clearAdminMapFilter();

  const lat = Number(signalement.lat);
  const lng = Number(signalement.lng);
  if (isNaN(lat) || isNaN(lng)) return;

  try {
    adminMap.flyTo([lat, lng], 16, { duration: 1.1 });
  } catch (e) {}

  const marker = adminMarkers.find(function (m) {
    return String(m._adminId || "") === String(id);
  });
  if (marker) {
    try {
      marker.openPopup();
    } catch (e) {}
  }
}

function findAdminSignalementById(id) {
  const rows = Array.isArray(dashboardData.signalements)
    ? dashboardData.signalements
    : [];
  for (const row of rows) {
    if (String(row.id_signalement || row.id || "") === String(id)) {
      return row;
    }
  }
  return null;
}

function renderIdeesTable() {
  const body = document.getElementById("idees-table-body");
  if (!body) return;
  const rows = Array.isArray(dashboardData.idees) ? dashboardData.idees : [];
  if (rows.length === 0) {
    body.innerHTML =
      '<tr><td colspan="6"><div class="empty-state">Aucune idée trouvée.</div></td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(function (r) {
      const id = escapeHtml(r.id_idee || r.id || "");
      const status = String(r.status || "")
        .toLowerCase()
        .trim();
      const primaryLabel = getWorkflowPrimaryLabel("idee", status);
      const secondaryLabel = getWorkflowSecondaryLabel(status);
      const secondaryAction = status === "en_cours" ? "cancel" : "delete";
      return (
        "<tr>" +
        "<td><strong>" +
        escapeHtml(r.titre || "") +
        '</strong><div class="row-subtle">' +
        escapeHtml(r.description || "") +
        '</div><div class="row-subtle">' +
        escapeHtml(renderWorkflowDates(r)) +
        "</div></td>" +
        "<td>" +
        escapeHtml(formatCategory(r.categorie || "")) +
        "</td>" +
        "<td>" +
        escapeHtml(displayIdeaStatus(r.status || "")) +
        "</td>" +
        "<td>" +
        escapeHtml(String(r.likes || 0)) +
        "</td>" +
        "<td>" +
        escapeHtml(r.user_nom || "") +
        "</td>" +
        '<td><div class="action-group">' +
        '<button class="btn btn-small btn-warning" type="button" data-admin-action="status" data-resource="idee" data-id="' +
        id +
        '" data-status="en_cours">' +
        escapeHtml(primaryLabel) +
        "</button>" +
        '<button class="btn btn-small btn-success" type="button" data-admin-action="status" data-resource="idee" data-id="' +
        id +
        '" data-status="realisee">' +
        "Réaliser" +
        "</button>" +
        '<button class="btn btn-small ' +
        (secondaryAction === "cancel" ? "btn-primary" : "btn-danger") +
        '" type="button" data-admin-action="' +
        secondaryAction +
        '" data-resource="idee" data-id="' +
        id +
        '">' +
        escapeHtml(secondaryLabel) +
        "</button>" +
        "</div></td>" +
        "</tr>"
      );
    })
    .join("");
}

function renderMessagesTable() {
  const body = document.getElementById("messages-table-body");
  if (!body) return;
  const rows = Array.isArray(dashboardData.messages)
    ? dashboardData.messages
    : [];
  if (rows.length === 0) {
    body.innerHTML =
      '<tr><td colspan="5"><div class="empty-state">Aucun message trouvé.</div></td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(function (r) {
      const id = escapeHtml(r.id_message || r.id || "");
      return (
        "<tr>" +
        "<td><strong>" +
        escapeHtml(r.nom || "") +
        '</strong><div class="row-subtle">' +
        escapeHtml(shorten(r.message || "", 90)) +
        "</div></td>" +
        "<td>" +
        escapeHtml(r.email || "") +
        "</td>" +
        "<td>" +
        escapeHtml(r.sujet || "") +
        "</td>" +
        "<td>" +
        escapeHtml(formatDate(r.timestamp || "")) +
        "</td>" +
        '<td><div class="action-group"><button class="btn btn-small btn-danger" type="button" data-admin-action="delete" data-resource="message" data-id="' +
        id +
        '">Supprimer</button></div></td>' +
        "</tr>"
      );
    })
    .join("");
}

function renderUsersTable() {
  const body = document.getElementById("users-table-body");
  if (!body) return;
  const rows = Array.isArray(dashboardData.users) ? dashboardData.users : [];
  if (rows.length === 0) {
    body.innerHTML =
      '<tr><td colspan="7"><div class="empty-state">Aucun compte trouvé.</div></td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(function (r) {
      const id = escapeHtml(r.id_utilisateur || r.id || "");
      const blocked = Number(r.is_blocked || 0) === 1;
      return (
        "<tr>" +
        "<td><strong>" +
        escapeHtml(
          [r.prenom, r.nom].filter(Boolean).join(" ") || "Utilisateur",
        ) +
        "</strong></td>" +
        "<td>" +
        escapeHtml(r.email || "") +
        "</td>" +
        "<td>" +
        escapeHtml(r.role || "") +
        "</td>" +
        "<td>" +
        escapeHtml(String(r.warnings || 0)) +
        "</td>" +
        "<td>" +
        escapeHtml(String(r.is_blocked || 0)) +
        "</td>" +
        "<td>" +
        escapeHtml(formatDate(r.timestamp || "")) +
        "</td>" +
        '<td><div class="action-group">' +
        '<button class="btn btn-small btn-warning" type="button" data-admin-action="warn" data-resource="user" data-id="' +
        id +
        '">Avertissement</button>' +
        '<button class="btn btn-small ' +
        (blocked ? "btn-success" : "btn-primary") +
        '" type="button" data-admin-action="' +
        (blocked ? "unblock" : "block") +
        '" data-resource="user" data-id="' +
        id +
        '">' +
        (blocked ? "Débloquer" : "Bloquer") +
        "</button>" +
        '<button class="btn btn-small btn-danger" type="button" data-admin-action="delete" data-resource="user" data-id="' +
        id +
        '">Supprimer</button>' +
        "</div></td>" +
        "</tr>"
      );
    })
    .join("");
}

function renderAdminsTable() {
  const body = document.getElementById("admins-table-body");
  if (!body) return;
  const rows = Array.isArray(dashboardData.admins) ? dashboardData.admins : [];
  if (rows.length === 0) {
    body.innerHTML =
      '<tr><td colspan="5"><div class="empty-state">Aucun administrateur trouvé.</div></td></tr>';
    return;
  }

  body.innerHTML = rows
    .map(function (r) {
      return (
        "<tr>" +
        "<td><strong>" +
        escapeHtml(
          [r.prenom, r.nom].filter(Boolean).join(" ") || "Administrateur",
        ) +
        "</strong></td>" +
        "<td>" +
        escapeHtml(r.email || "") +
        "</td>" +
        "<td>" +
        escapeHtml(r.role || "") +
        "</td>" +
        "<td>-</td>" +
        "<td>" +
        escapeHtml(formatDate(r.timestamp || "")) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function initMap() {
  const el = document.getElementById("admin-map");
  if (!el) return;

  if (typeof L === "undefined") {
    loadLeafletOnce()
      .then(function () {
        try {
          adminMap = L.map("admin-map").setView([-4.0383, 21.7587], 12);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(adminMap);
        } catch (e) {
          console.error("Leaflet init failed", e);
        }
      })
      .catch(function (e) {
        console.warn("Leaflet dynamic load failed", e);
      });
    return;
  }

  adminMap = L.map("admin-map").setView([-4.0383, 21.7587], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(adminMap);
}

function renderMap() {
  if (!adminMap) return;
  adminMarkers.forEach(function (marker) {
    try {
      adminMap.removeLayer(marker);
    } catch (e) {}
  });
  adminMarkers = [];

  const pts = Array.isArray(dashboardData.map_points)
    ? dashboardData.map_points
    : [];
  pts.forEach(function (point) {
    if (!point || !point.lat || !point.lng) return;
    try {
      const meta = getAdminMapTypeMeta(point.type);
      const markerOptions = {};
      const icon = getAdminMapIcon(point.type);
      if (icon) {
        markerOptions.icon = icon;
      }
      const marker = L.marker(
        [Number(point.lat), Number(point.lng)],
        markerOptions,
      ).addTo(adminMap);
      marker._adminId = String(point.id || point.id_signalement || "");
      marker._adminType = meta.key;
      marker.bindPopup(buildMapPopup(point));
      adminMarkers.push(marker);
    } catch (e) {}
  });

  updateAdminMapFilter();
  fitMapToPoints();
}

function fitMapToPoints() {
  if (!adminMap || adminMarkers.length === 0) return;
  const visibleMarkers = getVisibleAdminMarkers();
  const latlngs = visibleMarkers.map(function (marker) {
    return marker.getLatLng();
  });
  if (latlngs.length === 0) return;
  adminMap.fitBounds(latlngs, { padding: [30, 30] });
}

function updateAdminMapFilter() {
  adminMarkers.forEach(function (marker) {
    const type = String(marker._adminType || "").toLowerCase();
    const show = !adminMapFilter || adminMapFilter === type;
    try {
      if (show && !adminMap.hasLayer(marker)) {
        adminMap.addLayer(marker);
      } else if (!show && adminMap.hasLayer(marker)) {
        adminMap.removeLayer(marker);
      }
    } catch (e) {}
  });

  updateLegendActiveState();
  updateMapSummary();
  renderSignalementsTable();

  if (adminMapFilter) {
    fitMapToPoints();
  } else if (adminMarkers.length) {
    fitMapToPoints();
  }
}

function getVisibleAdminMarkers() {
  return adminMarkers.filter(function (marker) {
    const type = String(marker._adminType || "").toLowerCase();
    return !adminMapFilter || adminMapFilter === type;
  });
}

function updateLegendActiveState() {
  document.querySelectorAll(".legend-item[data-type]").forEach(function (item) {
    const type = String(item.getAttribute("data-type") || "").toLowerCase();
    const active = !!adminMapFilter && adminMapFilter === type;
    item.classList.toggle("active-filter", active);
  });
}

function updateMapSummary() {
  const summary = document.getElementById("map-summary");
  if (!summary) return;
  const count = getVisibleAdminMarkers().length;
  const label = adminMapFilter ? formatCategory(adminMapFilter) : "";
  summary.textContent =
    count +
    (count > 1 ? " points affichés" : " point affiché") +
    (label ? " · " + label : "");
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

function formatDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("fr-FR");
  } catch (e) {
    return d;
  }
}

function formatCategory(c) {
  if (!c) return "";
  return String(c).replace(/_/g, " ");
}

function displaySignalementStatus(status) {
  const normalized = String(status || "")
    .toLowerCase()
    .trim();
  if (normalized === "en_cours") return "Traitement";
  if (normalized === "resolu") return "Résolu";
  if (normalized === "annule") return "Annulé";
  return "Nouveau";
}

function displayIdeaStatus(status) {
  const normalized = String(status || "")
    .toLowerCase()
    .trim();
  if (normalized === "en_cours") return "En traitement";
  if (normalized === "realisee") return "Réalisé";
  if (normalized === "annule") return "Annulée";
  return "Nouvelle";
}

function getWorkflowPrimaryLabel(resource, status) {
  const normalized = String(status || "")
    .toLowerCase()
    .trim();
  if (normalized === "en_cours") return "Traitement";
  if (resource === "idee" && normalized === "realisee") return "Résolu";
  if (resource === "signalement" && normalized === "resolu") return "Résolu";
  return "En cours";
}

function getWorkflowSecondaryLabel(status) {
  const normalized = String(status || "")
    .toLowerCase()
    .trim();
  return normalized === "en_cours" ? "Annuler" : "Supprimer";
}

function renderWorkflowDates(row) {
  const pieces = [];
  const start = formatDate(row && row.started_at ? row.started_at : "");
  const resolved = formatDate(row && row.resolved_at ? row.resolved_at : "");
  const cancelled = formatDate(row && row.cancelled_at ? row.cancelled_at : "");
  if (start) pieces.push("Début: " + start);
  if (resolved) pieces.push("Fin: " + resolved);
  if (cancelled) pieces.push("Annulation: " + cancelled);
  if (row && row.cancel_reason) pieces.push("Motif: " + row.cancel_reason);
  return pieces.join(" · ");
}

function getAdminMapTypeMeta(typeValue) {
  const iconBasePath = "../icon-map/";
  const key = String(typeValue || "").toLowerCase();
  const meta = {
    voirie: {
      key: "voirie",
      label: "Route abimée",
      iconUrl: iconBasePath + "icons8-route-48.png",
      size: [48, 48],
    },
    eau: {
      key: "eau",
      label: "Eau",
      iconUrl: iconBasePath + "icons8-eau-48.png",
      size: [48, 48],
    },
    electricite: {
      key: "electricite",
      label: "Electricité",
      iconUrl: iconBasePath + "icons8-électricité-32.png",
      size: [32, 32],
    },
    insecurite: {
      key: "insecurite",
      label: "Insécurité",
      iconUrl: iconBasePath + "icons8-protection-du-trou-de-serrure-48.png",
      size: [48, 48],
    },
    dechet: {
      key: "dechet",
      label: "Déchet",
      iconUrl: iconBasePath + "icons8-corbeille-48.png",
      size: [48, 48],
    },
  };

  return (
    meta[key] || {
      key: "autre",
      label: formatCategory(typeValue) || "Autre",
      iconUrl: "",
      size: [32, 32],
    }
  );
}

function getAdminMapIcon(typeValue) {
  const meta = getAdminMapTypeMeta(typeValue);
  if (!meta.iconUrl || typeof L === "undefined") return null;

  const size = Array.isArray(meta.size) ? meta.size : [32, 32];
  return L.icon({
    iconUrl: meta.iconUrl,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1]],
  });
}

function shorten(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function buildMapPopup(p) {
  const meta = getAdminMapTypeMeta(p.type);
  const typeIcon = meta.iconUrl
    ? '<img src="' +
      meta.iconUrl +
      '" alt="' +
      escapeHtml(meta.label) +
      '" class="popup-type-icon">'
    : "";
  return (
    '<div class="popup-card"><strong>' +
    escapeHtml(p.titre || "Signalement") +
    "</strong><div>" +
    escapeHtml(displaySignalementStatus(p.status || "")) +
    '</div><div class="popup-card-type">' +
    typeIcon +
    escapeHtml(formatCategory(p.type || "")) +
    "</div><div>" +
    escapeHtml(p.lieu || "") +
    "</div><div>" +
    escapeHtml(renderWorkflowDates(p)) +
    "</div></div>"
  );
}

function buildDashboardAuthHeaders(extraHeaders) {
  if (extraHeaders === undefined) extraHeaders = {};
  const headers = Object.assign({ Accept: "application/json" }, extraHeaders);
  const token = getDashboardAuthToken();
  if (token) {
    headers.Authorization = "Bearer " + token;
    headers["X-Auth-Token"] = token;
  }
  return headers;
}

function getDashboardAuthToken() {
  return String(localStorage.getItem("admin_auth_token") || "").trim();
}

function loadLeafletOnce() {
  return new Promise(function (resolve, reject) {
    if (typeof L !== "undefined") return resolve();
    try {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
    } catch (e) {}

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = function () {
      setTimeout(function () {
        if (typeof L !== "undefined") resolve();
        else reject(new Error("Leaflet not available after load"));
      }, 50);
    };
    script.onerror = function (e) {
      reject(e || new Error("Failed to load Leaflet"));
    };
    document.head.appendChild(script);
    setTimeout(function () {
      if (typeof L === "undefined") reject(new Error("Leaflet load timeout"));
    }, 8000);
  });
}
