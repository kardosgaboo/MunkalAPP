(function () {
  const COLUMNS = [
    { key: 'beerkezett', label: 'Beérkezett' },
    { key: 'atvizsgalas', label: 'Átvizsgálás' },
    { key: 'jovahagyasra_var', label: 'Jóváhagyásra vár' },
    { key: 'javitas_alatt', label: 'Javítás alatt' },
    { key: 'atadasra_kesz', label: 'Átadásra kész' },
  ];
  const STATUS_LABEL = { lezarva: 'Lezárva' };
  COLUMNS.forEach((c) => (STATUS_LABEL[c.key] = c.label));

  const boardEl = document.getElementById('board');
  const subEl = document.getElementById('board-sub');
  const searchEl = document.getElementById('search');
  const mechanicEl = document.getElementById('filter-mechanic');

  const panel = document.getElementById('panel');
  const backdrop = document.getElementById('panel-backdrop');
  const form = document.getElementById('card-form');
  const panelTitle = document.getElementById('panel-title');
  const panelMsg = document.getElementById('panel-msg');
  const statusSelect = document.getElementById('status-select');
  const logList = document.getElementById('log-list');
  const openWo = document.getElementById('open-wo');

  let cards = [];
  let editingId = null; // null = új kártya

  // ---------- segédfüggvények ----------

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('hu-HU');
  }

  function fmtDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('hu-HU') + ' ' + d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  }

  async function api(url, method, body) {
    const res = await fetch(url, {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (window.munkalappAuth && window.munkalappAuth.handleUnauthorized(res)) {
      throw new Error('Bejelentkezés szükséges.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Hiba történt.');
    return data;
  }

  function replaceCard(card) {
    const i = cards.findIndex((c) => c.id === card.id);
    if (i >= 0) cards[i] = card;
    else cards.push(card);
  }

  // ---------- szűrés / rendezés ----------

  function matches(c) {
    const q = searchEl.value.trim().toLowerCase();
    if (mechanicEl.value && c.szereloNev !== mechanicEl.value) return false;
    if (!q) return true;
    const hay = [c.rendszam, c.ugyfelNev, c.munkalapszam, c.marka, c.tipus, c.panasz].join(' ').toLowerCase();
    return hay.includes(q);
  }

  function sortCards(a, b) {
    if (a.surgos !== b.surgos) return a.surgos ? -1 : 1;
    if (a.hatarido && b.hatarido && a.hatarido !== b.hatarido) return a.hatarido < b.hatarido ? -1 : 1;
    if (a.hatarido && !b.hatarido) return -1;
    if (!a.hatarido && b.hatarido) return 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  }

  function refreshMechanicFilter() {
    const current = mechanicEl.value;
    const names = Array.from(new Set(cards.map((c) => c.szereloNev).filter(Boolean))).sort();
    mechanicEl.innerHTML =
      '<option value="">Összes szerelő</option>' +
      names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    mechanicEl.value = names.includes(current) ? current : '';
  }

  // ---------- megjelenítés ----------

  function statusOptions(selected) {
    return COLUMNS.map(
      (c) => `<option value="${c.key}" ${c.key === selected ? 'selected' : ''}>${c.label}</option>`
    ).join('');
  }

  function cardEl(c) {
    const today = todayStr();
    const overdue = c.hatarido && c.hatarido < today;
    const el = document.createElement('article');
    el.className = 'k-card' + (c.surgos ? ' urgent' : '');
    el.draggable = true;
    el.dataset.id = c.id;

    const badges = [];
    if (c.surgos) badges.push('<span class="badge badge-urgent">Sürgős</span>');
    if (c.alkatreszreVar && c.alkatreszreVar.aktiv) {
      const n = c.alkatreszreVar.nev ? ': ' + esc(c.alkatreszreVar.nev) : '';
      badges.push(`<span class="badge badge-wait">⏸ Alkatrészre vár${n}</span>`);
    }

    const meta = [];
    if (c.szereloNev) meta.push(`<span>🔧 ${esc(c.szereloNev)}</span>`);
    if (c.hatarido) meta.push(`<span class="${overdue ? 'overdue' : ''}">📅 ${fmtDate(c.hatarido)}</span>`);
    if (c.ugyfelNev) meta.push(`<span>${esc(c.ugyfelNev)}</span>`);

    el.innerHTML = `
      <div class="k-top">
        <div>
          <div class="k-plate">${esc(c.rendszam) || '—'}</div>
          <div class="k-car">${esc((c.marka + ' ' + c.tipus).trim())}</div>
        </div>
        <span class="k-num">#${esc(c.munkalapszam)}</span>
      </div>
      ${c.panasz ? `<div class="k-task">${esc(c.panasz)}</div>` : ''}
      ${badges.length ? `<div class="k-badges">${badges.join('')}</div>` : ''}
      ${meta.length ? `<div class="k-meta">${meta.join('')}</div>` : ''}
      <select class="k-status" title="Státusz módosítása">${statusOptions(c.status)}</select>
    `;

    const sel = el.querySelector('.k-status');
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', (e) => {
      e.stopPropagation();
      moveCard(c.id, sel.value);
    });

    el.addEventListener('click', () => openPanel(c.id));
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', c.id);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    return el;
  }

  function render() {
    refreshMechanicFilter();
    const visible = cards.filter(matches);
    boardEl.innerHTML = '';

    COLUMNS.forEach((col) => {
      const list = visible.filter((c) => c.status === col.key).sort(sortCards);
      const colEl = document.createElement('section');
      colEl.className = 'board-col';
      colEl.dataset.status = col.key;
      colEl.innerHTML = `
        <header class="col-head"><span>${col.label}</span><span class="col-count">${list.length}</span></header>
        <div class="col-body"></div>`;
      const body = colEl.querySelector('.col-body');
      if (!list.length) body.innerHTML = '<div class="col-empty">Nincs autó</div>';
      list.forEach((c) => body.appendChild(cardEl(c)));

      colEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        colEl.classList.add('drag-over');
      });
      colEl.addEventListener('dragleave', (e) => {
        if (!colEl.contains(e.relatedTarget)) colEl.classList.remove('drag-over');
      });
      colEl.addEventListener('drop', (e) => {
        e.preventDefault();
        colEl.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        if (id) moveCard(id, col.key);
      });

      boardEl.appendChild(colEl);
    });

    const today = todayStr();
    const overdue = cards.filter((c) => c.hatarido && c.hatarido < today).length;
    subEl.textContent =
      cards.length + ' aktív autó' + (overdue ? ' · ' + overdue + ' lejárt határidő' : '');
  }

  // ---------- műveletek ----------

  async function moveCard(id, status) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) {
      render();
      return;
    }
    const previous = card.status;
    card.status = status; // azonnali visszajelzés
    render();
    try {
      const data = await api('/api/board/cards/' + id, 'PATCH', { status });
      replaceCard(data.card);
      render();
    } catch (err) {
      card.status = previous;
      render();
      alert('A státusz mentése nem sikerült: ' + err.message);
    }
  }

  async function load() {
    try {
      cards = await api('/api/board');
      render();
    } catch (err) {
      subEl.textContent = 'Hiba a tábla betöltésekor: ' + err.message;
    }
  }

  // ---------- oldalsó panel ----------

  function setEditOnly(show) {
    panel.querySelectorAll('.edit-only').forEach((el) => {
      el.style.display = show ? '' : 'none';
    });
  }

  function openPanel(id) {
    editingId = id || null;
    panelMsg.textContent = '';
    panelMsg.className = 'status-msg';
    form.reset();

    if (editingId) {
      const c = cards.find((x) => x.id === editingId);
      if (!c) return;
      panelTitle.textContent = 'Munkalap #' + c.munkalapszam;
      form.rendszam.value = c.rendszam;
      form.marka.value = c.marka;
      form.tipus.value = c.tipus;
      form.ugyfelNev.value = c.ugyfelNev;
      form.ugyfelTelefon.value = c.ugyfelTelefon;
      form.panasz.value = c.panasz;
      form.szereloNev.value = c.szereloNev;
      form.hatarido.value = c.hatarido;
      form.surgos.checked = !!c.surgos;
      form.alkatreszreVarAktiv.checked = !!(c.alkatreszreVar && c.alkatreszreVar.aktiv);
      form.alkatreszreVarNev.value = (c.alkatreszreVar && c.alkatreszreVar.nev) || '';
      statusSelect.innerHTML = statusOptions(c.status);
      openWo.href = '/index.html?id=' + encodeURIComponent(c.id);

      const log = (c.statusLog || []).slice().reverse();
      logList.innerHTML = log.length
        ? log
            .map(
              (l) =>
                `<li><strong>${esc(STATUS_LABEL[l.status] || l.status)}</strong><span>${fmtDateTime(l.at)} · ${esc(l.by)}</span></li>`
            )
            .join('')
        : '<li><span>Még nincs előzmény.</span></li>';
      setEditOnly(true);
    } else {
      panelTitle.textContent = 'Új autó';
      setEditOnly(false);
    }

    panel.classList.add('open');
    backdrop.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    form.rendszam.focus();
  }

  function closePanel() {
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    editingId = null;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const base = {
      rendszam: form.rendszam.value.trim(),
      marka: form.marka.value.trim(),
      tipus: form.tipus.value.trim(),
      ugyfelNev: form.ugyfelNev.value.trim(),
      ugyfelTelefon: form.ugyfelTelefon.value.trim(),
      panasz: form.panasz.value.trim(),
      szereloNev: form.szereloNev.value.trim(),
      hatarido: form.hatarido.value,
      surgos: form.surgos.checked,
    };

    panelMsg.textContent = 'Mentés...';
    panelMsg.className = 'status-msg';
    try {
      if (editingId) {
        const patch = Object.assign({}, base, {
          status: statusSelect.value,
          alkatreszreVarAktiv: form.alkatreszreVarAktiv.checked,
          alkatreszreVarNev: form.alkatreszreVarNev.value.trim(),
        });
        const data = await api('/api/board/cards/' + editingId, 'PATCH', patch);
        replaceCard(data.card);
      } else {
        const data = await api('/api/board/cards', 'POST', Object.assign({ felvetel: todayStr() }, base));
        replaceCard(data.card);
      }
      render();
      closePanel();
    } catch (err) {
      panelMsg.textContent = err.message;
      panelMsg.className = 'status-msg error';
    }
  });

  document.getElementById('close-card').addEventListener('click', async () => {
    if (!editingId) return;
    if (!confirm('Az autót átadtad az ügyfélnek? A munkalap lekerül a tábláról (a Korábbi munkalapok között megmarad).')) return;
    try {
      await api('/api/board/cards/' + editingId, 'PATCH', { status: 'lezarva' });
      cards = cards.filter((c) => c.id !== editingId);
      render();
      closePanel();
    } catch (err) {
      panelMsg.textContent = err.message;
      panelMsg.className = 'status-msg error';
    }
  });

  document.getElementById('new-card').addEventListener('click', () => openPanel(null));
  document.getElementById('panel-close').addEventListener('click', closePanel);
  backdrop.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });
  searchEl.addEventListener('input', render);
  mechanicEl.addEventListener('change', render);

  setEditOnly(false);
  load();
})();
