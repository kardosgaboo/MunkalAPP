(function () {
  async function loadSession() {
    try {
      const res = await fetch('/api/session');
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      const data = await res.json();
      const el = document.getElementById('current-user');
      if (el && data.user) {
        el.textContent = data.user.displayName || data.user.username;
      }
    } catch (err) {
      window.location.href = '/login.html';
    }
  }

  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      // ignore
    }
    window.location.href = '/login.html';
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSession();
    const btn = document.getElementById('logout-btn');
    if (btn) btn.addEventListener('click', logout);
  });

  // Más szkriptek (app.js, history.js) számára elérhetővé tesszük,
  // hogy egy API-válasz 401-es állapotára bejelentkezésre irányítsanak.
  window.munkalappAuth = {
    handleUnauthorized(res) {
      if (res && res.status === 401) {
        window.location.href = '/login.html';
        return true;
      }
      return false;
    },
  };
})();
