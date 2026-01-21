const switches = document.querySelectorAll('.switch');
const forms = document.querySelectorAll('.form');

switches.forEach(sw => {
  sw.addEventListener('click', () => {
    forms.forEach(f => f.classList.toggle('active'));
  });
});

(() => {
  const form = document.getElementById('loginForm');
  const email = document.getElementById('email');
  const pwd = document.getElementById('password');
  const emailError = document.getElementById('emailError');
  const pwdError = document.getElementById('passwordError');
  const toggleBtn = document.getElementById('togglePwd');

  const emailIsValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  function clearErrors() {
    [email, pwd].forEach(i => i.classList.remove('input-error'));
    emailError.textContent = '';
    pwdError.textContent = '';
  }

  toggleBtn?.addEventListener('click', () => {
    if (pwd.type === 'password') {
      pwd.type = 'text';
      toggleBtn.textContent = 'Masquer';
    } else {
      pwd.type = 'password';
      toggleBtn.textContent = 'Afficher';
    }
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();
    let valid = true;

    if (!email.value.trim()) {
      emailError.textContent = 'Email requis.';
      email.classList.add('input-error');
      valid = false;
    } else if (!emailIsValid(email.value.trim())) {
      emailError.textContent = 'Email invalide.';
      email.classList.add('input-error');
      valid = false;
    }

    if (!pwd.value.trim()) {
      pwdError.textContent = 'Mot de passe requis.';
      pwd.classList.add('input-error');
      valid = false;
    } else if (pwd.value.length < 6) {
      pwdError.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
      pwd.classList.add('input-error');
      valid = false;
    }

    if (!valid) {
      return;
    }

    // Remplacer par appel réel (fetch / formulaire serveur)
    // Exemple minimal pour démonstration :
    const payload = {
      email: email.value.trim(),
      password: pwd.value,
      remember: document.getElementById('remember')?.checked || false
    };

    console.log('Submit payload', payload);
    // Simuler envoi et redirection
    form.querySelector('.btn-envoyer').textContent = 'Connexion...';
    setTimeout(() => {
      form.querySelector('.btn-envoyer').textContent = 'Se connecter';
      // en production: rediriger ou afficher message serveur
      alert('Connexion simulée — vérifier votre logique serveur.');
    }, 800);
  });
})();