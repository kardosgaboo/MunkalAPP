(function () {
  const STATUS_LABEL = {
    beerkezett: 'Beérkezett',
    atvizsgalas: 'Átvizsgálás',
    jovahagyasra_var: 'Jóváhagyásra vár',
    javitas_alatt: 'Javítás alatt',
    atadasra_kesz: 'Átadásra kész',
    lezarva: 'Lezárva',
  };

  const tbody = document.querySelector('#vehicle-table tbody');
  const table = document.getElementById('vehicle-table');
  const emptyMsg = document.getElementById('empty-msg');
  const subEl = document.getElementById('db-sub');
  const searchEl = document.getElementById('plate-search');
  const panel = document.getElementById('panel');
  const backdrop = document.getElementById('panel-backdrop');
  const detail = document.getElementById('vehicle-detail');

  let vehicles = [];

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function plateKey(p) {
    return String(p || '').toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÖŐÚÜŰ]/g, '');
  }

  function fmtDate(s) {
    if (!s) return '–';
    const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('hu-HU');
  }

  function fmtMoney(n) {
    return Math.round(n || 0).toLocaleString('hu-HU') + ' Ft';
  }

  // ---------- lista + keresés ----------

  function filtered() {
    const raw = searchEl.value.trim();
    if (!raw) return vehicles;
    const k = plateKey(raw);
    const t = raw.toLowerCase();
    const plateHits = vehicles.filter((v) => k && v.key.includes(k));
    const otherHits = vehicles.filter(
      (v) =>
        !plateHits.includes(v) &&
        [v.ugyfelNev, v.marka, v.tipus, v.alvazszam].join(' ').toLowerCase().includes(t)
    );
    // a rendszám-találatok elöl, a pontos egyezés legelöl
    plateHits.sort((a, b) => (b.key === k) - (a.key === k) || Number(b.key.startsWith(k)) - Number(a.key.startsWith(k)));
    return plateHits.concat(otherHits);
  }

  function render() {
    const list = filtered();
    const totalOrders = vehicles.reduce((n, v) => n + v.count, 0);
    subEl.textContent = vehicles.length + ' autó · ' + totalOrders + ' munkalap';

    if (!list.length) {
      table.style.display = 'none';
      emptyMsg.style.display = 'block';
      emptyMsg.textContent = vehicles.length
        ? 'Nincs találat erre a keresésre.'
        : 'Még nincs autó az adatbázisban. Az autók az első munkalap vagy a Műhely tábla új kártyája után jelennek meg itt.';
      return;
    }
    table.style.display = '';
    emptyMsg.style.display = 'none';

    tbody.innerHTML = list
      .map(
        (v) => `
      <tr class="click" data-key="${esc(v.key)}">
        <td><strong class="plate">${esc(v.rendszam)}</strong></td>
        <td>${esc((v.marka + ' ' + v.tipus).trim()) || '–'}</td>
        <td>${esc(v.ugyfelNev) || '–'}</td>
        <td>${v.count}</td>
        <td>${fmtDate(v.lastDate)}</td>
      </tr>`
      )
      .join('');
  }

  tbody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-key]');
    if (tr) openDetail(tr.dataset.key);
  });

  searchEl.addEventListener('input', render);
  // Enter: ha egyetlen találat van, rögtön megnyitjuk
  searchEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const list = filtered();
      if (list.length === 1) openDetail(list[0].key);
    }
  });

  // ---------- részletek panel ----------

  function infoRow(label, value) {
    return value ? `<div class="v-row"><span>${label}</span><strong>${esc(value)}</strong></div>` : '';
  }

  function openDetail(key) {
    const v = vehicles.find((x) => x.key === key);
    if (!v) return;

    const car = (v.marka + ' ' + v.tipus).trim();
    const hist = v.history
      .map((h) => {
        const work = h.elvegzettMunka || h.panasz;
        return `
        <li class="hist-item">
          <div class="hist-top">
            <span><strong>${fmtDate(h.date)}</strong> · #${esc(h.munkalapszam)}</span>
            <span class="badge badge-status">${esc(STATUS_LABEL[h.status] || h.status)}</span>
          </div>
          ${work ? `<div class="hist-work">${esc(work)}</div>` : ''}
          ${h.alkatreszek.length ? `<div class="hist-parts">Alkatrészek: ${esc(h.alkatreszek.join(', '))}</div>` : ''}
          <div class="hist-foot">
            <span>${h.brutto ? fmtMoney(h.brutto) : ''}${h.kmora ? ' · ' + Number(h.kmora).toLocaleString('hu-HU') + ' km' : ''}${h.szereloNev ? ' · ' + esc(h.szereloNev) : ''}</span>
            <span class="hist-links">
              <a href="/index.html?id=${encodeURIComponent(h.id)}">Megnyitás</a>
              <a href="/api/workorders/${encodeURIComponent(h.id)}/pdf">PDF</a>
            </span>
          </div>
        </li>`;
      })
      .join('');

    detail.innerHTML = `
      <div class="panel-head">
        <h2>${esc(v.rendszam)}</h2>
        <button type="button" class="btn-remove-row" id="detail-close" title="Bezárás">✕</button>
      </div>
      <div class="panel-body">
        <div class="v-info">
          ${infoRow('Autó', car)}
          ${infoRow('Évjárat', v.evjarat)}
          ${infoRow('Üzemanyag', v.uzemanyag)}
          ${infoRow('Szín', v.szin)}
          ${infoRow('Alvázszám', v.alvazszam)}
          ${infoRow('Motorszám', v.motorszam)}
          ${infoRow('Utolsó km-óraállás', v.utolsoKm ? Number(v.utolsoKm).toLocaleString('hu-HU') + ' km' : '')}
          ${infoRow('Ügyfél', v.ugyfelNev)}
          ${infoRow('Telefon', v.ugyfelTelefon)}
          ${infoRow('E-mail', v.ugyfelEmail)}
        </div>
        <a class="btn-primary" style="text-align:center;text-decoration:none" href="/index.html?autokey=${encodeURIComponent(v.key)}">+ Új munkalap erre az autóra</a>
        <div class="log-box">
          <h3>Javítási előzmények (${v.count})</h3>
          <ul class="hist">${hist}</ul>
        </div>
      </div>`;

    detail.querySelector('#detail-close').addEventListener('click', closeDetail);
    panel.classList.add('open');
    backdrop.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closeDetail() {
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  backdrop.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetail();
  });

  async function load() {
    try {
      const res = await fetch('/api/vehicles');
      if (window.munkalappAuth && window.munkalappAuth.handleUnauthorized(res)) return;
      vehicles = await res.json();
      render();
    } catch (err) {
      subEl.textContent = 'Hiba az adatbázis betöltésekor.';
    }
  }

  load();
})();
