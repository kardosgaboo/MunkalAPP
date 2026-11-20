(function () {
  const tbody = document.querySelector('#history-table tbody');
  const emptyMsg = document.getElementById('empty-msg');

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('hu-HU') + ' ' + d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  }

  async function load() {
    try {
      const res = await fetch('/api/workorders');
      if (window.munkalappAuth && window.munkalappAuth.handleUnauthorized(res)) return;
      const list = await res.json();

      if (!list.length) {
        emptyMsg.style.display = 'block';
        document.getElementById('history-table').style.display = 'none';
        return;
      }

      tbody.innerHTML = list
        .map(
          (w) => `
        <tr>
          <td><strong>${w.munkalapszam}</strong></td>
          <td>${formatDate(w.createdAt)}</td>
          <td>${escapeHtml(w.ugyfelNev)}</td>
          <td>${escapeHtml(w.rendszam)}</td>
          <td>${escapeHtml(w.marka)} ${escapeHtml(w.tipus)}</td>
          <td style="white-space:nowrap"><a class="btn-secondary" href="/index.html?id=${w.id}">Szerkesztés</a> <a class="btn-secondary" href="/api/workorders/${w.id}/pdf">PDF</a></td>
        </tr>`
        )
        .join('');
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="6">Hiba a lista betöltésekor.</td></tr>`;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  load();
})();
