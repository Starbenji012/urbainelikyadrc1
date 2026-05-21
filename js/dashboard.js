const ADMIN_API_ENDPOINTS = buildApiEndpoints("admin/dashboard.php");
const ADMIN_ACTION_ENDPOINTS = buildApiEndpoints("admin/action.php");
const REFRESH_INTERVAL_MS = 30000;

function emptyDashboardData() {
  return {
    current_user: {},
    stats: {},
    signalements: [],
    idees: [],
    messages: [],
    users: [],
    admins: [],
    filters: {},
    map_points: [],
  };
}

let dashboardData = emptyDashboardData();
let adminMap = null;
let adminMarkers = [];
let selectedMessage = null;
let activeSignalementCategory = "";

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();
  bindDashboardControls();
  initMap();

  // Si l'utilisateur ouvre le fichier en local (file://), afficher une info claire
  if (window.location.protocol === "file:") {
    const alertBox = document.getElementById("dashboard-alert");
    if (alertBox) {
      alertBox.className = "dashboard-alert dashboard-alert--error";
      alertBox.textContent =
        "Servez cette page via un serveur local (ex: php -S localhost:8000) pour activer le backend et la carte.";
    }
    showToast(
      "Servez via un serveur local (php -S localhost:8000) pour activer les fonctionnalités backend.",
      true,
    );
  }

  loadDashboardData();
  window.setInterval(() => loadDashboardData(false), REFRESH_INTERVAL_MS);
});

function bindDashboardControls() {
  const refreshButton = document.getElementById("btn-refresh-dashboard");
  if (refreshButton) {
    refreshButton.addEventListener("click", () => loadDashboardData());
  }

  const mapFitButton = document.getElementById("btn-map-fit");
  if (mapFitButton) {
    mapFitButton.addEventListener("click", fitMapToPoints);
  }

  [
    "signalements-search",
    "signalements-category",
    "signalements-status",
    "idees-search",
    "idees-category",
    "idees-status",
    "messages-search",
    "users-search",
  ].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("input", () => {
        renderAllSections();
        syncLegendActiveState();
      });
      input.addEventListener("change", () => {
        renderAllSections();
        syncLegendActiveState();
      });
    }
  });

  const sendReplyButton = document.getElementById("btn-send-reply");
  if (sendReplyButton) {
    sendReplyButton.addEventListener("click", sendReplyEmail);
  }

  const adminCreateForm = document.getElementById("admin-create-form");
  if (adminCreateForm) {
    adminCreateForm.addEventListener("submit", sendCreateAdminRequest);
  }

  // Legend filter icons on dashboard (activer comme page signaler)
  const legendIcons = document.querySelectorAll(
    ".legend-item[data-type], .legend-icon[data-type]",
  );
  legendIcons.forEach((el) => {
    el.addEventListener("click", (ev) => {
      const item = el.closest(".legend-item[data-type]") || el;
      const img = item.matches("img")
        ? item
        : item.querySelector("img[data-type]");
      const type = normalizeCategoryKey(
        item.dataset?.type || (img ? img.dataset.type : ""),
      );
      const select = document.getElementById("signalements-category");
      if (!select) return;

      const nextCategory = normalizeCategoryKey(
        activeSignalementCategory === type ? "" : type,
      );
      setSignalementCategory(nextCategory);
    });
  });
}

async function loadDashboardData(showAlert = true) {
  const alertBox = document.getElementById("dashboard-alert");

  // Vérification d'accès basique côté client (state local); le backend effectue la vérification finale
  const localRole = String(
    localStorage.getItem("user_role") || "",
  ).toLowerCase();
  if (!["admin", "super_admin"].includes(localRole)) {
    if (alertBox && showAlert) {
      alertBox.className = "dashboard-alert dashboard-alert--error";
      alertBox.textContent =
        "Vous n'êtes pas connecté en tant qu'administrateur localement. Connectez-vous pour activer les actions.";
    }
    // on continue quand même; le backend renverra 401 si nécessaire
  }

  try {
    if (showAlert && alertBox) {
      alertBox.className = "dashboard-alert dashboard-alert--info";
      alertBox.textContent = "Chargement des données administrateur en cours.";
    }

    let responseData = null;
    let responseMessage = "";
    let usedFallback = false;
    let lastStatus = 0;
    for (const endpoint of ADMIN_API_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "include",
          cache: "no-store",
        });

        lastStatus = response.status;

        if (!response.ok) {
          continue;
        }

        const payload = await response.json();
        responseMessage = String(payload?.message || "").trim();
        usedFallback = /mode secours/i.test(responseMessage);
        responseData =
          payload && typeof payload === "object"
            ? payload.data && typeof payload.data === "object"
              ? payload.data
              : payload
            : null;
        if (responseData) {
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (responseData) {
      const serverRole = String(
        responseData?.current_user?.role || "",
      ).toLowerCase();
      if (serverRole) {
        localStorage.setItem("user_role", serverRole);
      }

      dashboardData = {
        current_user: responseData.current_user || {},
        stats: responseData.stats || {},
        signalements: Array.isArray(responseData.signalements)
          ? responseData.signalements
          : [],
        idees: Array.isArray(responseData.idees) ? responseData.idees : [],
        messages: Array.isArray(responseData.messages)
          ? responseData.messages
          : [],
        users: Array.isArray(responseData.users) ? responseData.users : [],
        admins: Array.isArray(responseData.admins) ? responseData.admins : [],
        filters: responseData.filters || {},
        map_points: Array.isArray(responseData.map_points)
          ? responseData.map_points
          : [],
      };

      if (alertBox) {
        alertBox.className = "dashboard-alert dashboard-alert--info";
        alertBox.textContent = usedFallback
          ? "Données chargées en mode secours depuis les fichiers locaux (MySQL indisponible)."
          : responseMessage ||
            "Données chargées et synchronisées avec le backend.";
      }
    } else {
      dashboardData = emptyDashboardData();
      if (alertBox) {
        alertBox.className = "dashboard-alert dashboard-alert--error";
        if (lastStatus === 401) {
          alertBox.textContent =
            "Session expirée ou absente. Connectez-vous avec un compte admin pour charger le dashboard.";
        } else if (lastStatus === 403) {
          alertBox.textContent =
            "Accès refusé: ce compte n’a pas le rôle administrateur.";
        } else {
          alertBox.textContent =
            "Impossible de récupérer les données backend pour le moment. L’interface reste accessible en local.";
        }
      }
    }

    populateFilterOptions();
    renderAllSections();
    syncLegendActiveState();
  } catch (error) {
    dashboardData = emptyDashboardData();
    if (alertBox) {
      alertBox.className = "dashboard-alert dashboard-alert--error";
      alertBox.textContent = "Erreur pendant le chargement du tableau de bord.";
    }
    populateFilterOptions();
    renderAllSections();
    syncLegendActiveState();
  }
}

function syncLegendActiveState() {
  const current = normalizeCategoryKey(
    activeSignalementCategory ||
      document.getElementById("signalements-category")?.value ||
      "",
  );

  document
    .querySelectorAll(".legend-item, .legend-icon")
    .forEach((element) => element.classList.remove("active-filter"));

  if (!current) return;

  const item = document.querySelector(
    '.legend-item[data-type="' + current + '"]',
  );
  const icon = document.querySelector(
    '.legend-icon[data-type="' + current + '"]',
  );

  if (item) item.classList.add("active-filter");
  if (icon) icon.classList.add("active-filter");
}

function setSignalementCategory(category) {
  activeSignalementCategory = normalizeCategoryKey(category);

  const select = document.getElementById("signalements-category");
  if (select) {
    select.value = activeSignalementCategory;
  }

  syncLegendActiveState();
  renderAllSections();

  if (activeSignalementCategory) {
    centerMapOnCategory(activeSignalementCategory);
  } else {
    fitMapToPoints();
  }
}

function populateFilterOptions() {
  populateSelectFromValues(
    "signalements-category",
    dashboardData.filters.signalement_types || [],
  );
  populateSelectFromValues(
    "idees-category",
    dashboardData.filters.idee_categories || [],
  );
}

function populateSelectFromValues(selectId, values) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const currentValue = select.value;
  const options = ['<option value="">Toutes catégories</option>'];
  values.forEach((value) => {
    const label = formatCategory(value);
    options.push(
      `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`,
    );
  });

  select.innerHTML = options.join("");
  if (currentValue) {
    select.value = currentValue;
  }
}

function initMap() {
  const mapContainer = document.getElementById("admin-map");
  if (!mapContainer || typeof L === "undefined") {
    return;
  }

  adminMap = L.map("admin-map").setView([-4.0383, 21.7587], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(adminMap);
}

function renderAllSections() {
  renderStats();
  renderMap();
  renderSignalementsTable();
  renderIdeesTable();
  renderMessagesTable();
  renderUsersTable();
  renderAdminManagement();
}

function renderStats() {
  const stats = dashboardData.stats || {};
  animateCounter("users-total", Number(stats.users_total || 0));
  animateCounter("signalements-total", Number(stats.signalements_total || 0));
  animateCounter(
    "signalements-en-cours",
    Number(stats.signalements_en_cours || 0),
  );
  animateCounter(
    "signalements-resolus",
    Number(stats.signalements_resolus || 0),
  );
  animateCounter("idees-total", Number(stats.idees_total || 0));
  animateCounter("likes-total", Number(stats.likes_total || 0));
  animateCounter("messages-total", Number(stats.messages_total || 0));
  animateCounter("warnings-total", Number(stats.warnings_total || 0));
}

function animateCounter(elementId, targetValue) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const duration = 700;
  const steps = 24;
  let currentStep = 0;

  const tick = () => {
    currentStep += 1;
    const nextValue = Math.floor(targetValue * (currentStep / steps));
    element.textContent = nextValue.toLocaleString("fr-FR");

    if (currentStep < steps) {
      window.setTimeout(tick, duration / steps);
    } else {
      element.textContent = targetValue.toLocaleString("fr-FR");
    }
  };

  tick();
}

function renderMap() {
  if (!adminMap) return;

  adminMarkers.forEach((marker) => {
    try {
      adminMap.removeLayer(marker);
    } catch (error) {
      // ignore
    }
  });
  adminMarkers = [];

  const points = Array.isArray(dashboardData.map_points)
    ? dashboardData.map_points
    : [];
  const activeCategory =
    activeSignalementCategory ||
    normalizeCategoryKey(
      document.getElementById("signalements-category")?.value || "",
    );
  const filteredSignalements = getFilteredSignalements();
  const signalementIds = new Set(filteredSignalements.map((item) => item.id));
  const displayedPoints = points.filter((point) =>
    signalementIds.has(point.id),
  );

  displayedPoints.forEach((point) => {
    const marker = L.marker([Number(point.lat), Number(point.lng)], {
      icon: getMarkerIcon(point.type),
    }).addTo(adminMap);

    // attach category type to marker for later filtering/centering
    try {
      marker._type = normalizeCategoryKey(point.type);
    } catch (e) {}

    marker.bindPopup(buildMapPopup(point));
    adminMarkers.push(marker);
  });

  const mapSummary = document.getElementById("map-summary");
  if (mapSummary) {
    mapSummary.textContent = activeCategory
      ? `${displayedPoints.length} point${displayedPoints.length > 1 ? "s" : ""} pour ${formatCategory(activeCategory)}`
      : `${displayedPoints.length} point${displayedPoints.length > 1 ? "s" : ""} affiché${displayedPoints.length > 1 ? "s" : ""}`;
  }

  fitMapToPoints();
}

function fitMapToPoints() {
  if (!adminMap) return;
  const points = adminMarkers.map((marker) => marker.getLatLng());
  if (points.length > 0) {
    adminMap.fitBounds(points, { padding: [30, 30] });
  }
}

function centerMapOnCategory(type) {
  if (!adminMap || !type) return;
  const normalizedType = normalizeCategoryKey(type);

  // find markers that match the category type
  const matched = adminMarkers.filter(
    (m) => String(m._type || "").toLowerCase() === normalizedType,
  );
  if (!matched || matched.length === 0) {
    // fallback: try to find raw points in dashboardData.map_points
    const pts = (dashboardData.map_points || [])
      .filter((p) => normalizeCategoryKey(p.type) === normalizedType)
      .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    if (pts.length === 0) return;

    if (pts.length === 1) {
      adminMap.setView([pts[0].lat, pts[0].lng], 15);
      return;
    }

    const bounds = pts.map((p) => L.latLng(p.lat, p.lng));
    adminMap.fitBounds(bounds, { padding: [30, 30] });
    return;
  }

  const latlngs = matched.map((m) => m.getLatLng());
  if (latlngs.length === 1) {
    adminMap.setView(latlngs[0], 15);
  } else {
    adminMap.fitBounds(latlngs, { padding: [30, 30] });
  }
}

function getMarkerIcon(type) {
  const icons = {
    dechet: "../icon-map/icons8-corbeille-48.png",
    eau: "../icon-map/icons8-eau-48.png",
    insecurite: "../icon-map/icons8-protection-du-trou-de-serrure-48.png",
    voirie: "../icon-map/icons8-route-48.png",
    electricite: "../icon-map/icons8-électricité-32.png",
  };

  const iconUrl = icons[normalizeCategoryKey(type)] || icons.dechet;
  return L.icon({
    iconUrl,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
  });
}

function buildMapPopup(point) {
  return `
    <div class="popup-card">
      <strong>${escapeHtml(point.titre || "Signalement")}</strong>
      <div>${escapeHtml(formatStatus(point.status))}</div>
      <div>${escapeHtml(formatCategory(point.type))}</div>
      <div>${escapeHtml(point.lieu || "Lieu inconnu")}</div>
      <div>${escapeHtml(point.user_nom || "Utilisateur")}</div>
    </div>
  `;
}

function renderSignalementsTable() {
  const tbody = document.getElementById("signalements-table-body");
  if (!tbody) return;

  const filtered = getFilteredSignalements();
  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6"><div class="empty-state">Aucun signalement trouvé.</div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (item) => `
    <tr>
      <td>
        <div class="row-title">
          <strong>${escapeHtml(item.titre || "Sans titre")}</strong>
          <span class="row-subtle">${escapeHtml(item.lieu || "Lieu inconnu")}</span>
        </div>
      </td>
      <td>${escapeHtml(formatCategory(item.type))}</td>
      <td>${renderStatusBadge(item.status)}</td>
      <td>
        <div class="row-title">
          <strong>${escapeHtml(item.user_nom || "Utilisateur local")}</strong>
          <span class="row-subtle">${escapeHtml(item.user_email || "")}</span>
        </div>
      </td>
      <td>${escapeHtml(formatDate(item.timestamp))}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-soft" type="button" data-action="signalement-progress" data-id="${escapeHtml(item.id)}">En cours</button>
          <button class="btn btn-success" type="button" data-action="signalement-resolve" data-id="${escapeHtml(item.id)}">Résolu</button>
          <button class="btn btn-danger" type="button" data-action="signalement-delete" data-id="${escapeHtml(item.id)}">Supprimer</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  bindTableActions(tbody);
}

function renderIdeesTable() {
  const tbody = document.getElementById("idees-table-body");
  if (!tbody) return;

  const filtered = getFilteredIdees();
  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6"><div class="empty-state">Aucune idée trouvée.</div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (item) => `
    <tr>
      <td>
        <div class="row-title">
          <strong>${escapeHtml(item.titre || "Sans titre")}</strong>
          <span class="row-subtle">${escapeHtml(item.description || "")}</span>
        </div>
      </td>
      <td>${escapeHtml(formatCategory(item.categorie))}</td>
      <td>${renderIdeaStatusBadge(item.status)}</td>
      <td><strong>${Number(item.likes || 0)}</strong></td>
      <td>
        <div class="row-title">
          <strong>${escapeHtml(item.user_nom || "Utilisateur local")}</strong>
          <span class="row-subtle">${escapeHtml(item.user_email || "")}</span>
        </div>
      </td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-soft" type="button" data-action="idee-progress" data-id="${escapeHtml(item.id)}">En cours</button>
          <button class="btn btn-success" type="button" data-action="idee-realisee" data-id="${escapeHtml(item.id)}">Réalisée</button>
          <button class="btn btn-danger" type="button" data-action="idee-delete" data-id="${escapeHtml(item.id)}">Supprimer</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  bindTableActions(tbody);
}

function renderMessagesTable() {
  const tbody = document.getElementById("messages-table-body");
  if (!tbody) return;

  const filtered = getFilteredMessages();
  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5"><div class="empty-state">Aucun message trouvé.</div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (item) => `
    <tr>
      <td>
        <div class="row-title">
          <strong>${escapeHtml(item.nom || "Anonyme")}</strong>
          <span class="row-subtle">${escapeHtml(shorten(item.message || "", 90))}</span>
        </div>
      </td>
      <td>${escapeHtml(item.email || "")}</td>
      <td>${escapeHtml(item.sujet || "")}</td>
      <td>${escapeHtml(formatDate(item.timestamp))}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-primary" type="button" data-action="message-reply" data-id="${escapeHtml(item.id)}">Répondre</button>
          <button class="btn btn-danger" type="button" data-action="message-delete" data-id="${escapeHtml(item.id)}">Supprimer</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  bindTableActions(tbody);
}

function renderUsersTable() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  const filtered = getFilteredUsers();
  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7"><div class="empty-state">Aucun compte trouvé.</div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map((item) => {
      const isBlocked =
        Boolean(item.is_blocked) || String(item.is_blocked || "") === "1";
      const accountActions = isBlocked
        ? [
            `<button class="btn btn-primary" type="button" data-action="user-unblock" data-id="${escapeHtml(item.id)}">Débloquer</button>`,
            `<button class="btn btn-outline" type="button" data-action="user-delay" data-id="${escapeHtml(item.id)}">Délai</button>`,
          ].join("")
        : `<button class="btn btn-warning" type="button" data-action="user-block" data-id="${escapeHtml(item.id)}">Bloquer</button>`;

      return `
    <tr>
      <td>
        <div class="row-title">
          <strong>${escapeHtml([item.prenom, item.nom].filter(Boolean).join(" ") || "Utilisateur")}</strong>
          <span class="row-subtle">${escapeHtml(item.surnom || "")}</span>
        </div>
      </td>
      <td>${escapeHtml(item.email || "")}</td>
      <td>${escapeHtml(item.role || "citoyen")}</td>
      <td>${renderWarningBadge(Number(item.warnings || 0))}</td>
      <td>${renderBlockBadge(item)}</td>
      <td>${escapeHtml(formatDate(item.timestamp))}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-soft" type="button" data-action="user-warn" data-id="${escapeHtml(item.id)}">Avertir</button>
          ${accountActions}
          <button class="btn btn-danger" type="button" data-action="user-delete" data-id="${escapeHtml(item.id)}">Supprimer</button>
        </div>
      </td>
    </tr>
  `;
    })
    .join("");

  bindTableActions(tbody);
}

function renderAdminManagement() {
  const panel = document.getElementById("admin-management-panel");
  const tbody = document.getElementById("admins-table-body");
  const summary = document.getElementById("admin-summary");
  if (!panel || !tbody || !summary) return;

  const currentUser = dashboardData.current_user || {};
  const isSuperAdmin =
    String(currentUser.role || "").toLowerCase() === "super_admin";

  panel.hidden = !isSuperAdmin;
  if (!isSuperAdmin) {
    return;
  }

  summary.textContent = `Connecté en tant que ${[currentUser.prenom, currentUser.nom].filter(Boolean).join(" ") || "Super admin"}. Vous pouvez créer et gérer les autres administrateurs.`;

  const admins = Array.isArray(dashboardData.admins)
    ? dashboardData.admins
    : [];
  if (admins.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5"><div class="empty-state">Aucun administrateur trouvé.</div></td></tr>';
    return;
  }

  tbody.innerHTML = admins
    .map(
      (admin) => `
      <tr>
        <td>
          <div class="row-title">
            <strong>${escapeHtml([admin.prenom, admin.nom].filter(Boolean).join(" ") || "Administrateur")}</strong>
            <span class="row-subtle">${escapeHtml(admin.surnom || "")}</span>
          </div>
        </td>
        <td>${escapeHtml(admin.email || "")}</td>
        <td>${renderAdminRoleBadge(admin.role)}</td>
        <td>${renderAdminPermissions(admin.permissions || {}, admin.id)}</td>
        <td>${escapeHtml(formatDate(admin.timestamp))}</td>
      </tr>
      `,
    )
    .join("");
}

function renderAdminRoleBadge(role) {
  const normalized = String(role || "admin").toLowerCase();
  const className =
    normalized === "super_admin"
      ? "badge badge--done"
      : "badge badge--progress";
  const label = normalized === "super_admin" ? "Super admin" : "Admin";
  return `<span class="${className}">${escapeHtml(label)}</span>`;
}

function renderAdminPermissions(permissions, adminId) {
  const labels = {
    manage_signalements: "Signalements",
    manage_idees: "Idées",
    manage_messages: "Messages",
    manage_users: "Comptes",
    manage_stats: "Stats",
    manage_map: "Carte",
    manage_admins: "Admins",
  };

  return Object.entries(labels)
    .map(([permission, label]) => {
      const allowed = Boolean(permissions[permission]);
      const buttonLabel = allowed ? `Retirer ${label}` : `Donner ${label}`;
      return `<button class="btn ${allowed ? "btn-soft" : "btn-outline"} admin-permission-btn" type="button" data-action="admin-permission" data-id="${escapeHtml(adminId)}" data-permission="${escapeHtml(permission)}" data-allowed="${allowed ? "0" : "1"}">${escapeHtml(buttonLabel)}</button>`;
    })
    .join(" ");
}

async function sendCreateAdminRequest(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const payload = {
    resource: "admin",
    action: "create",
    nom: String(document.getElementById("admin-nom")?.value || "").trim(),
    prenom: String(document.getElementById("admin-prenom")?.value || "").trim(),
    surnom: String(document.getElementById("admin-surnom")?.value || "").trim(),
    email: String(document.getElementById("admin-email")?.value || "").trim(),
    password: String(document.getElementById("admin-password")?.value || ""),
    role: String(
      document.getElementById("admin-role")?.value || "admin",
    ).trim(),
    permissions: {
      manage_signalements: Boolean(
        document.getElementById("perm-signalements")?.checked,
      ),
      manage_idees: Boolean(document.getElementById("perm-idees")?.checked),
      manage_messages: Boolean(
        document.getElementById("perm-messages")?.checked,
      ),
      manage_users: Boolean(document.getElementById("perm-users")?.checked),
      manage_stats: Boolean(document.getElementById("perm-stats")?.checked),
      manage_map: Boolean(document.getElementById("perm-map")?.checked),
      manage_admins: Boolean(document.getElementById("perm-admins")?.checked),
    },
  };

  if (!payload.nom || !payload.prenom || !payload.email || !payload.password) {
    showToast(
      "Nom, prenom, email et mot de passe sont requis pour créer un admin.",
      true,
    );
    return;
  }

  const ok = await performAdminAction(
    payload.resource,
    payload.action,
    payload.email,
    payload,
    false,
  );
  if (ok) {
    form.reset();
    await loadDashboardData(false);
  }
}

function bindTableActions(container) {
  container.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action") || "";
      const id = button.getAttribute("data-id") || "";

      if (action === "signalement-progress") {
        performAdminAction("signalement", "status", id, { status: "en_cours" });
        return;
      }

      if (action === "signalement-resolve") {
        performAdminAction("signalement", "status", id, { status: "resolu" });
        return;
      }

      if (action === "signalement-delete") {
        confirmAndRun("Supprimer ce signalement ?", () =>
          performAdminAction("signalement", "delete", id),
        );
        return;
      }

      if (action === "idee-progress") {
        updateIdeaStatusLocally(id, "en_cours");
        renderAllSections();
        performAdminAction("idee", "status", id, { status: "en_cours" });
        return;
      }

      if (action === "idee-realisee") {
        updateIdeaStatusLocally(id, "realisee");
        renderAllSections();
        performAdminAction("idee", "status", id, { status: "realisee" });
        return;
      }

      if (action === "idee-delete") {
        confirmAndRun("Supprimer cette idée ?", () =>
          performAdminAction("idee", "delete", id),
        );
        return;
      }

      if (action === "message-reply") {
        selectMessageForReply(id);
        return;
      }

      if (action === "message-delete") {
        confirmAndRun("Supprimer ce message ?", () =>
          performAdminAction("message", "delete", id),
        );
        return;
      }

      if (action === "user-warn") {
        const note = window.prompt(
          "Motif de l’avertissement (optionnel) :",
          "Comportement non conforme",
        );
        if (note === null) {
          return;
        }
        performAdminAction("user", "warn", id, { note });
        return;
      }

      if (action === "user-block") {
        const daysInput = window.prompt(
          "Nombre de jours avant déblocage (laisser vide pour blocage sans date) :",
          "7",
        );
        if (daysInput === null) {
          return;
        }
        const days = String(daysInput).trim();
        const reason = window.prompt(
          "Motif du blocage (optionnel) :",
          "Compte bloqué par un administrateur",
        );
        if (reason === null) {
          return;
        }
        const payload = { reason };
        if (days !== "") {
          payload.days = Number(days);
        }
        performAdminAction("user", "block", id, payload);
        return;
      }

      if (action === "user-delay") {
        const daysInput = window.prompt(
          "Nombre de jours supplémentaires avant déblocage :",
          "7",
        );
        if (daysInput === null) {
          return;
        }
        const days = Number(String(daysInput).trim());
        if (!Number.isFinite(days) || days <= 0) {
          showToast(
            "Le délai doit être un nombre de jours supérieur à 0.",
            true,
          );
          return;
        }
        const reason = window.prompt(
          "Motif du délai (optionnel) :",
          "Délai de déblocage défini par un administrateur",
        );
        if (reason === null) {
          return;
        }
        performAdminAction("user", "delay", id, { days, reason });
        return;
      }

      if (action === "user-unblock") {
        confirmAndRun("Débloquer ce compte ?", () =>
          performAdminAction("user", "unblock", id),
        );
        return;
      }

      if (action === "user-delete") {
        confirmAndRun("Supprimer ce compte ?", () =>
          performAdminAction("user", "delete", id),
        );
        return;
      }

      if (action === "admin-permission") {
        const permission = button.getAttribute("data-permission") || "";
        const allowed = button.getAttribute("data-allowed") === "1";
        performAdminAction("admin", "permission", id, {
          permission,
          allowed,
        });
        return;
      }
    });
  });
}

function selectMessageForReply(messageId) {
  const message = dashboardData.messages.find(
    (item) => String(item.id) === String(messageId),
  );
  if (!message) return;

  selectedMessage = message;
  const emailField = document.getElementById("reply-email");
  const subjectField = document.getElementById("reply-subject");
  const bodyField = document.getElementById("reply-body");
  const targetLabel = document.getElementById("reply-target");

  if (emailField) emailField.value = message.email || "";
  if (subjectField)
    subjectField.value = `Reponse UrbainElikyaDRC - ${message.sujet || ""}`;
  if (bodyField) {
    bodyField.value = `Bonjour ${message.nom || ""},\n\nMerci pour votre message concernant "${message.sujet || ""}".\n\n`;
  }
  if (targetLabel) {
    targetLabel.textContent = `${message.nom || "Correspondant"} · ${message.email || ""}`;
  }
}

async function sendReplyEmail() {
  const emailField = document.getElementById("reply-email");
  const subjectField = document.getElementById("reply-subject");
  const bodyField = document.getElementById("reply-body");

  const email = emailField ? emailField.value.trim() : "";
  const subject = subjectField ? subjectField.value.trim() : "";
  const body = bodyField ? bodyField.value.trim() : "";

  if (!selectedMessage && email === "" && body === "") {
    showToast("Sélectionnez un message ou remplissez la réponse.", true);
    return;
  }

  const ok = await performAdminAction(
    "message",
    "reply",
    String(selectedMessage ? selectedMessage.id : ""),
    {
      email,
      subject,
      body,
    },
    false,
  );

  if (ok && bodyField) {
    bodyField.value = "";
    selectedMessage = null;
    const targetLabel = document.getElementById("reply-target");
    if (targetLabel) {
      targetLabel.textContent = "Aucun message sélectionné";
    }
  }
}

async function performAdminAction(
  resource,
  action,
  id,
  extraPayload = {},
  refreshAfter = true,
) {
  try {
    let responseData = null;

    for (const endpoint of ADMIN_ACTION_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ resource, action, id, ...extraPayload }),
        });

        if (!response.ok) {
          continue;
        }

        responseData = await response.json();
        break;
      } catch (error) {
        continue;
      }
    }

    if (responseData && responseData.ok !== false) {
      showToast(responseData.message || "Action exécutée.", false);
      if (refreshAfter) {
        await loadDashboardData(false);
      }
      return true;
    }

    showToast("Action impossible pour le moment.", true);
    return false;
  } catch (error) {
    showToast("Erreur réseau pendant l’action.", true);
    return false;
  }
}

function getFilteredSignalements() {
  const search = readFilterValue("signalements-search");
  const category =
    activeSignalementCategory ||
    normalizeCategoryKey(readFilterValue("signalements-category"));
  const status = readFilterValue("signalements-status");

  return dashboardData.signalements.filter(
    (item) =>
      matchesSearch(
        [
          item.titre,
          item.lieu,
          item.user_nom,
          item.user_email,
          item.description,
        ],
        search,
      ) &&
      matchesExact(normalizeCategoryKey(item.type), category) &&
      matchesExact(item.status, status),
  );
}

function getFilteredIdees() {
  const search = readFilterValue("idees-search");
  const category = normalizeCategoryKey(readFilterValue("idees-category"));
  const status = readFilterValue("idees-status");

  return dashboardData.idees.filter(
    (item) =>
      matchesSearch(
        [item.titre, item.description, item.user_nom, item.user_email],
        search,
      ) &&
      matchesExact(normalizeCategoryKey(item.categorie), category) &&
      matchesExact(item.status, status),
  );
}

function getFilteredMessages() {
  const search = readFilterValue("messages-search");
  return dashboardData.messages.filter((item) =>
    matchesSearch([item.nom, item.email, item.sujet, item.message], search),
  );
}

function getFilteredUsers() {
  const search = readFilterValue("users-search");
  return dashboardData.users.filter((item) =>
    matchesSearch(
      [item.nom, item.prenom, item.surnom, item.email, item.role],
      search,
    ),
  );
}

function readFilterValue(elementId) {
  const element = document.getElementById(elementId);
  return element ? element.value.trim().toLowerCase() : "";
}

function matchesSearch(values, search) {
  if (!search) return true;
  return values.some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(search),
  );
}

function matchesExact(value, expected) {
  if (!expected) return true;
  return String(value || "").toLowerCase() === expected.toLowerCase();
}

function normalizeCategoryKey(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();
  const map = {
    déchet: "dechet",
    dechets: "dechet",
    déchets: "dechet",
    eau: "eau",
    inondation: "eau",
    eau_inondation: "eau",
    insecurite: "insecurite",
    insécurité: "insecurite",
    voirie: "voirie",
    route: "voirie",
    route_abimee: "voirie",
    route_abîmée: "voirie",
    electricite: "electricite",
    électricité: "electricite",
    infrastructure: "infrastructure",
    environnement: "environnement",
    "services publics": "services-publics",
    "services-publics": "services-publics",
    transport: "transport",
    autre: "autre",
  };
  return map[normalized] || normalized;
}

function updateIdeaStatusLocally(ideaId, status) {
  const normalizedStatus = String(status || "nouvelle").toLowerCase();
  const idea = dashboardData.idees.find(
    (item) => String(item.id) === String(ideaId),
  );
  if (idea) {
    idea.status = normalizedStatus;
  }
}

function renderStatusBadge(status) {
  const normalized = String(status || "nouveau").toLowerCase();
  const label = formatStatus(normalized);
  const className =
    normalized === "resolu"
      ? "badge badge--resolved"
      : normalized === "en_cours"
        ? "badge badge--progress"
        : "badge badge--new";
  return `<span class="${className}">${escapeHtml(label)}</span>`;
}

function renderIdeaStatusBadge(status) {
  const normalized = String(status || "nouvelle").toLowerCase();
  const label = formatIdeaStatus(normalized);
  const className =
    normalized === "realisee"
      ? "badge badge--done"
      : normalized === "en_cours"
        ? "badge badge--progress"
        : "badge badge--new";
  return `<span class="${className}">${escapeHtml(label)}</span>`;
}

function renderWarningBadge(count) {
  const className = count >= 3 ? "badge badge--warning" : "badge badge--new";
  const label =
    count >= 3
      ? `${count} avertissements`
      : `${count} avertissement${count > 1 ? "s" : ""}`;
  return `<span class="${className}">${escapeHtml(label)}</span>`;
}

function renderBlockBadge(item) {
  const isBlocked =
    Boolean(item?.is_blocked) || String(item?.is_blocked || "") === "1";
  if (!isBlocked) {
    return '<span class="badge badge--resolved">Actif</span>';
  }

  const until = String(item?.blocked_until || "").trim();
  const label = until ? `Bloqué jusqu’au ${formatDate(until)}` : "Bloqué";
  return `<span class="badge badge--warning">${escapeHtml(label)}</span>`;
}

function formatStatus(status) {
  const map = {
    nouveau: "Nouveau",
    en_cours: "En cours",
    resolu: "Résolu",
  };
  return map[String(status || "").toLowerCase()] || status || "Nouveau";
}

function formatIdeaStatus(status) {
  const map = {
    nouvelle: "Nouvelle",
    en_cours: "En cours",
    realisee: "Réalisée",
  };
  return map[String(status || "").toLowerCase()] || status || "Nouvelle";
}

function formatCategory(category) {
  const value = String(category || "").toLowerCase();
  const map = {
    dechet: "Déchet",
    eau: "Eau / Inondation",
    insecurite: "Insécurité",
    voirie: "Route abîmée",
    electricite: "Électricité",
    infrastructure: "Infrastructure",
    environnement: "Environnement",
    "services-publics": "Services publics",
    transport: "Transport",
    autre: "Autre",
  };
  return map[value] || category || "Autre";
}

function formatDate(isoString) {
  if (!isoString) return "Date inconnue";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shorten(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function confirmAndRun(message, callback) {
  if (window.confirm(message)) {
    void callback();
  }
}

function showToast(message, isError) {
  let toast = document.getElementById("dashboard-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "dashboard-toast";
    toast.className = "dashboard-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.toggle("dashboard-toast--error", Boolean(isError));
  toast.classList.add("dashboard-toast--visible");

  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.classList.remove("dashboard-toast--visible");
  }, 2400);
}
