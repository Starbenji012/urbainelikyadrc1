// Liste des idées en mémoire (restauration depuis localStorage si présente)
const idees = JSON.parse(localStorage.getItem('idees') || '[]');

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formIdee');
    const container = document.getElementById('listeIdees');
    const totalEl = document.getElementById('totalIdees');
    const btnVider = document.getElementById('btnViderIdees');

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const titre = (document.getElementById('titre')?.value || '').trim();
            const categorie = (document.getElementById('categorie')?.value || '').trim();
            const description = (document.getElementById('description')?.value || '').trim();

            // Validation basique
            if (!titre || !description) {
                    showMessage('Merci de renseigner un titre et une description.', 'error');
                    return;
            }

            const idee = { titre, categorie, description, likes: 0 };
            idees.push(idee);
                saveAndRender();
                form.reset();
                showMessage('Idée ajoutée ✅', 'success');
        });
    }

    if (btnVider) {
        btnVider.addEventListener('click', () => {
            if (!idees.length) return alert("Il n'y a aucune idée à supprimer.");
            if (confirm('Voulez-vous vraiment supprimer toutes les idées ?')) {
                idees.length = 0;
                saveAndRender();
                showMessage('Toutes les idées ont été supprimées.', 'success');
            }
        });
    }

    // affichage initial
    renderIdees();
});

function saveAndRender() {
    try {
        localStorage.setItem('idees', JSON.stringify(idees));
    } catch (err) {
        console.warn('Impossible de sauvegarder en localStorage', err);
    }
    renderIdees();
}

function renderIdees() {
    const container = document.getElementById('listeIdees');
    if (!container) return;

    // Construction efficiente du DOM
    container.innerHTML = '';
    const frag = document.createDocumentFragment();

    idees.forEach((idee, index) => {
        const card = document.createElement('div');
        card.className = 'carte-idee';

        const h3 = document.createElement('h3');
        h3.textContent = idee.titre;

        const p = document.createElement('p');
        p.textContent = idee.description;

        const span = document.createElement('span');
        span.textContent = idee.categorie;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-like';
        btn.innerHTML = `❤️ ${idee.likes}`;
        btn.addEventListener('click', () => {
            idees[index].likes++;
            saveAndRender();
        });

        card.appendChild(h3);
        card.appendChild(p);
        card.appendChild(span);
        card.appendChild(btn);

        frag.appendChild(card);
    });

    container.appendChild(frag);
    // Mettre à jour le compteur
    const totalEl = document.getElementById('totalIdees');
    if (totalEl) totalEl.textContent = idees.length;
}

// Affiche un message temporaire (toast). type: 'success' | 'error' | undefined
function showMessage(text, type) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type) toast.classList.add(`toast--${type}`);
    toast.textContent = text;
    document.body.appendChild(toast);

    // small delay to allow transition
    requestAnimationFrame(() => toast.classList.add('show'));

    // remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
