(function () {
  const partsBody = document.querySelector('#parts-table tbody');
  const laborBody = document.querySelector('#labor-table tbody');
  const form = document.getElementById('workorder-form');
  const statusMsg = document.getElementById('status-msg');
  const submitBtn = document.getElementById('submit-btn');
  const afaInput = document.getElementById('afa-input');
  let defaultRate = 0; // a Beállításokban megadott óradíj

  function fmt(n) {
    const rounded = Math.round(n || 0);
    return rounded.toLocaleString('hu-HU') + ' Ft';
  }

  function addPartRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="p-name" placeholder="Pl. Fékbetét szett" /></td>
      <td><input type="text" class="p-code" /></td>
      <td><input type="number" class="p-qty" min="0" step="1" value="1" /></td>
      <td><input type="number" class="p-price" min="0" step="1" value="0" /></td>
      <td class="row-total p-total">0 Ft</td>
      <td><button type="button" class="btn-remove-row" title="Sor törlése">✕</button></td>
    `;
    partsBody.appendChild(tr);
    wireRow(tr, 'part');
  }

  function addLaborRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="l-desc" placeholder="Pl. Fékbetét csere, első" /></td>
      <td><input type="number" class="l-hours" min="0" step="0.5" value="1" /></td>
      <td><input type="number" class="l-rate" min="0" step="100" value="${defaultRate}" /></td>
      <td class="row-total l-total">0 Ft</td>
      <td><button type="button" class="btn-remove-row" title="Sor törlése">✕</button></td>
    `;
    laborBody.appendChild(tr);
    wireRow(tr, 'labor');
  }

  function wireRow(tr, kind) {
    tr.querySelector('.btn-remove-row').addEventListener('click', () => {
      tr.remove();
      recalcAll();
    });
    tr.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('input', recalcAll);
    });
  }

  function recalcAll() {
    let partsSum = 0;
    partsBody.querySelectorAll('tr').forEach((tr) => {
      const qty = parseFloat(tr.querySelector('.p-qty').value) || 0;
      const price = parseFloat(tr.querySelector('.p-price').value) || 0;
      const total = qty * price;
      tr.querySelector('.p-total').textContent = fmt(total);
      partsSum += total;
    });

    let laborSum = 0;
    laborBody.querySelectorAll('tr').forEach((tr) => {
      const hours = parseFloat(tr.querySelector('.l-hours').value) || 0;
      const rate = parseFloat(tr.querySelector('.l-rate').value) || 0;
      const total = hours * rate;
      tr.querySelector('.l-total').textContent = fmt(total);
      laborSum += total;
    });

    const netto = partsSum + laborSum;
    const afaPct = parseFloat(afaInput.value) || 0;
    const afaOsszeg = netto * (afaPct / 100);
    const brutto = netto + afaOsszeg;

    document.getElementById('sum-parts').textContent = fmt(partsSum);
    document.getElementById('sum-labor').textContent = fmt(laborSum);
    document.getElementById('sum-netto').textContent = fmt(netto);
    document.getElementById('sum-afa').textContent = fmt(afaOsszeg);
    document.getElementById('sum-brutto').textContent = fmt(brutto);
  }

  afaInput.addEventListener('input', recalcAll);
  document.getElementById('add-part').addEventListener('click', addPartRow);
  document.getElementById('add-labor').addEventListener('click', addLaborRow);

  // Kezdetben egy-egy üres sor
  addPartRow();
  addLaborRow();
  recalcAll();

  // Alapértelmezett "Felvétel dátuma" = mai nap
  const felvetelInput = form.querySelector('[name="datumok.felvetel"]');
  if (felvetelInput) {
    felvetelInput.value = new Date().toISOString().slice(0, 10);
  }

  // ---------- Szerkesztő mód: /index.html?id=... ----------
  let editId = new URLSearchParams(window.location.search).get('id');
  const banner = document.getElementById('edit-banner');
  const bannerText = document.getElementById('edit-banner-text');

  function showBanner(num) {
    if (!banner) return;
    bannerText.textContent = 'Meglévő munkalap szerkesztése: #' + num;
    banner.style.display = 'flex';
  }

  function setByName(path, value) {
    const el = form.querySelector('[name="' + path + '"]');
    if (el && value !== undefined && value !== null) el.value = value;
  }

  async function loadExisting(id) {
    try {
      const res = await fetch('/api/workorders/' + encodeURIComponent(id));
      if (window.munkalappAuth && window.munkalappAuth.handleUnauthorized(res)) return;
      if (!res.ok) throw new Error('A munkalap nem található.');
      const wo = await res.json();

      ['szerviz', 'ugyfel', 'gepjarmu', 'datumok'].forEach((group) => {
        Object.keys(wo[group] || {}).forEach((k) => setByName(group + '.' + k, wo[group][k]));
      });
      ['panasz', 'elvegzettMunka', 'afaSzazalek', 'fizetesiMod', 'megjegyzes', 'garanciaSzoveg', 'szereloNev', 'alairasDatum'].forEach(
        (k) => setByName(k, wo[k])
      );

      partsBody.innerHTML = '';
      (wo.alkatreszek || []).forEach((r) => {
        addPartRow();
        const tr = partsBody.lastElementChild;
        tr.querySelector('.p-name').value = r.megnevezes || '';
        tr.querySelector('.p-code').value = r.cikkszam || '';
        tr.querySelector('.p-qty').value = r.mennyiseg || 0;
        tr.querySelector('.p-price').value = r.egysegar || 0;
      });
      if (!partsBody.children.length) addPartRow();

      laborBody.innerHTML = '';
      (wo.munkadijak || []).forEach((r) => {
        addLaborRow();
        const tr = laborBody.lastElementChild;
        tr.querySelector('.l-desc').value = r.leiras || '';
        tr.querySelector('.l-hours').value = r.ora || 0;
        tr.querySelector('.l-rate').value = r.oradij || 0;
      });
      if (!laborBody.children.length) addLaborRow();

      recalcAll();
      showBanner(wo.munkalapszam);
    } catch (err) {
      console.error(err);
      editId = null;
      statusMsg.textContent = 'Hiba: ' + err.message;
      statusMsg.className = 'status-msg error';
    }
  }

  // ---------- Új munkalap: Beállítások és (opcionálisan) autó előtöltése ----------
  async function loadSettingsForNewForm() {
    try {
      const res = await fetch('/api/settings');
      if (window.munkalappAuth && window.munkalappAuth.handleUnauthorized(res)) return;
      const st = (await res.json()).settings || {};
      const sz = st.szerviz || {};

      ['nev', 'adoszam', 'cim', 'telefon', 'email'].forEach((k) => setByName('szerviz.' + k, sz[k] || ''));
      if (st.garanciaSzoveg) setByName('garanciaSzoveg', st.garanciaSzoveg);

      if (st.oradij) {
        defaultRate = st.oradij;
        laborBody.querySelectorAll('tr').forEach((tr) => {
          const rate = tr.querySelector('.l-rate');
          if (rate && (rate.value === '0' || rate.value === '') && !tr.querySelector('.l-desc').value) {
            rate.value = st.oradij;
          }
        });
        recalcAll();
      }

      if (!sz.nev) {
        const warn = document.getElementById('settings-warning');
        if (warn) warn.style.display = 'flex';
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function prefillFromVehicle(key) {
    try {
      const res = await fetch('/api/vehicles');
      if (window.munkalappAuth && window.munkalappAuth.handleUnauthorized(res)) return;
      const v = (await res.json()).find((x) => x.key === key);
      if (!v) return;
      setByName('gepjarmu.rendszam', v.rendszam);
      setByName('gepjarmu.marka', v.marka);
      setByName('gepjarmu.tipus', v.tipus);
      setByName('gepjarmu.evjarat', v.evjarat);
      setByName('gepjarmu.alvazszam', v.alvazszam);
      setByName('gepjarmu.motorszam', v.motorszam);
      setByName('gepjarmu.uzemanyag', v.uzemanyag);
      setByName('gepjarmu.szin', v.szin);
      setByName('ugyfel.nev', v.ugyfelNev);
      setByName('ugyfel.telefon', v.ugyfelTelefon);
      setByName('ugyfel.email', v.ugyfelEmail);
    } catch (err) {
      console.error(err);
    }
  }

  if (editId) {
    loadExisting(editId);
  } else {
    loadSettingsForNewForm();
    const autoKey = new URLSearchParams(window.location.search).get('autokey');
    if (autoKey) prefillFromVehicle(autoKey);
  }

  function collectFormData() {
    const data = {};
    // sima mezők (pontozott néven -> beágyazott objektum)
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach((el) => {
      const path = el.name.split('.');
      let ref = data;
      for (let i = 0; i < path.length - 1; i++) {
        ref[path[i]] = ref[path[i]] || {};
        ref = ref[path[i]];
      }
      ref[path[path.length - 1]] = el.value;
    });

    // alkatrészek táblázat
    data.alkatreszek = Array.from(partsBody.querySelectorAll('tr')).map((tr) => ({
      megnevezes: tr.querySelector('.p-name').value,
      cikkszam: tr.querySelector('.p-code').value,
      mennyiseg: tr.querySelector('.p-qty').value,
      egysegar: tr.querySelector('.p-price').value,
    }));

    // munkadíj táblázat
    data.munkadijak = Array.from(laborBody.querySelectorAll('tr')).map((tr) => ({
      leiras: tr.querySelector('.l-desc').value,
      ora: tr.querySelector('.l-hours').value,
      oradij: tr.querySelector('.l-rate').value,
    }));

    return data;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submitBtn.disabled = true;
    statusMsg.textContent = 'Mentés folyamatban...';
    statusMsg.className = 'status-msg';

    try {
      const payload = collectFormData();
      const res = await fetch(editId ? '/api/workorders/' + encodeURIComponent(editId) : '/api/workorders', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (window.munkalappAuth && window.munkalappAuth.handleUnauthorized(res)) return;
      const result = await res.json();
      if (!result.ok) throw new Error(result.error || 'Ismeretlen hiba');

      statusMsg.textContent = `Munkalap mentve (#${result.munkalapszam}). PDF letöltése...`;
      statusMsg.className = 'status-msg success';

      // Innentől ugyanezt a munkalapot módosítjuk (ne jöjjön létre duplikátum)
      editId = result.id;
      showBanner(result.munkalapszam);

      // PDF letöltés indítása
      window.location.href = `/api/workorders/${result.id}/pdf`;
    } catch (err) {
      console.error(err);
      statusMsg.textContent = 'Hiba történt: ' + err.message;
      statusMsg.className = 'status-msg error';
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
