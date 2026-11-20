(function () {
  const form = document.getElementById('settings-form');
  const statusMsg = document.getElementById('status-msg');
  const saveBtn = document.getElementById('save-btn');
  const preview = document.getElementById('logo-preview');
  const fileInput = document.getElementById('logo-file');
  const removeBtn = document.getElementById('logo-remove');

  let logo = '';          // aktuális logó (data URI)
  let logoChanged = false; // csak akkor küldjük, ha módosult

  function showLogo() {
    if (logo) {
      preview.innerHTML = '';
      const img = document.createElement('img');
      img.src = logo;
      img.alt = 'Logó';
      preview.appendChild(img);
      removeBtn.style.display = '';
    } else {
      preview.innerHTML = '<span class="muted">Nincs logó</span>';
      removeBtn.style.display = 'none';
    }
  }

  function setByName(name, value) {
    const el = form.querySelector('[name="' + name + '"]');
    if (el) el.value = value || '';
  }

  async function load() {
    try {
      const res = await fetch('/api/settings');
      if (window.munkalappAuth && window.munkalappAuth.handleUnauthorized(res)) return;
      const data = await res.json();
      const st = data.settings || {};
      ['nev', 'adoszam', 'cim', 'telefon', 'email'].forEach((k) => setByName('szerviz.' + k, (st.szerviz || {})[k]));
      setByName('oradij', st.oradij);
      setByName('garanciaSzoveg', st.garanciaSzoveg);
      logo = st.logo || '';
      showLogo();
    } catch (err) {
      statusMsg.textContent = 'Hiba a beállítások betöltésekor.';
      statusMsg.className = 'status-msg error';
    }
  }

  // A logót a böngészőben kicsinyítjük, hogy kicsi maradjon a fájl
  function processLogo(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('A fájl nem olvasható.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Ez a fájl nem képként nyitható meg.'));
        img.onload = () => {
          const maxW = 480;
          const maxH = 180;
          const scale = Math.min(1, maxW / img.width, maxH / img.height);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          let out = canvas.toDataURL('image/png');
          if (out.length > 600000) out = canvas.toDataURL('image/jpeg', 0.85);
          if (out.length > 780000) return reject(new Error('A kép túl nagy, válassz kisebbet.'));
          resolve(out);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      logo = await processLogo(file);
      logoChanged = true;
      showLogo();
      statusMsg.textContent = 'A logó még nincs elmentve – kattints a Mentésre.';
      statusMsg.className = 'status-msg';
    } catch (err) {
      statusMsg.textContent = err.message;
      statusMsg.className = 'status-msg error';
    }
    fileInput.value = '';
  });

  removeBtn.addEventListener('click', () => {
    logo = '';
    logoChanged = true;
    showLogo();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    statusMsg.textContent = 'Mentés...';
    statusMsg.className = 'status-msg';

    const val = (n) => form.querySelector('[name="' + n + '"]').value.trim();
    const payload = {
      szerviz: {
        nev: val('szerviz.nev'),
        adoszam: val('szerviz.adoszam'),
        cim: val('szerviz.cim'),
        telefon: val('szerviz.telefon'),
        email: val('szerviz.email'),
      },
      oradij: val('oradij'),
      garanciaSzoveg: val('garanciaSzoveg'),
    };
    if (logoChanged) payload.logo = logo;

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (window.munkalappAuth && window.munkalappAuth.handleUnauthorized(res)) return;
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Ismeretlen hiba');
      logoChanged = false;
      statusMsg.textContent = 'Beállítások elmentve.';
      statusMsg.className = 'status-msg success';
    } catch (err) {
      statusMsg.textContent = 'Hiba: ' + err.message;
      statusMsg.className = 'status-msg error';
    } finally {
      saveBtn.disabled = false;
    }
  });

  load();
})();
