const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const session = require('express-session');
const puppeteer = require('puppeteer');

const storage = require('./utils/storage');
const users = require('./utils/users');
const appSettings = require('./utils/settings');
const vehicles = require('./utils/vehicles');
const { generateWorkOrderHTML } = require('./pdf/template');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Újrafelhasznált Puppeteer böngésző ----------
// Chrome elindítása a leglassabb rész egy PDF generálásánál, ezért nem
// minden kérésnél indítjuk újra: egyszer elindul, és utána minden
// PDF-kéréshez csak egy új "lapot" (page) nyitunk benne.
let browserPromise = null;

async function launchBrowser() {
  const userDataDir = path.join(os.tmpdir(), 'munkalapp-puppeteer-profile');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  return puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-crash-reporter',
    ],
  });
}

async function getBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      if (browser.isConnected()) return browser;
    } catch (err) {
      // A korábbi böngésző elszállt - lent újraindítjuk.
    }
  }
  browserPromise = launchBrowser();
  return browserPromise;
}

// Kilépéskor (pl. Render újratelepítés) rendesen zárjuk be a böngészőt.
async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch (err) {
    // nem gond, úgyis leáll a folyamat
  }
}
process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

app.use(express.json({ limit: '2mb' }));

app.use(
  session({
    // TESZT FÁZIS: cseréld ki egy hosszú, véletlen titkos kulcsra,
    // mielőtt ez az app online, több felhasználós verzióvá válik.
    secret: process.env.SESSION_SECRET || 'munkalapp-teszt-titok-CSERELD-LE-PRODUCTIONBEN',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000, // 8 óra
    },
  })
);

// ---------- Publikus, bejelentkezés nélkül elérhető részek ----------

app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = users.find((u) => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ ok: false, error: 'Hibás felhasználónév vagy jelszó.' });
  }

  req.session.user = { username: user.username, displayName: user.displayName };
  res.json({ ok: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ ok: true, user: req.session.user });
  }
  res.status(401).json({ ok: false });
});

// ---------- Mindent az alábbi ponttól kezdve bejelentkezés véd ----------

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ ok: false, error: 'Bejelentkezés szükséges.' });
  }
  return res.redirect('/login.html');
}

app.use(requireAuth);

// A bejelentkezett fiók azonosítója - minden munkalap ehhez tartozik
const me = (req) => req.session.user.username;

app.get('/', (req, res) => res.redirect('/index.html'));

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/history.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

app.get('/vehicles.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vehicles.html'));
});

app.get('/settings.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// ---------- Szerviz-beállítások ----------

app.get('/api/settings', (req, res) => {
  res.json({ ok: true, settings: appSettings.get(me(req)) });
});

app.put('/api/settings', (req, res) => {
  try {
    res.json({ ok: true, settings: appSettings.save(me(req), req.body || {}) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ---------- Autó-adatbázis (rendszámonként) ----------

app.get('/api/vehicles', (req, res) => {
  res.json(vehicles.listVehicles(me(req)));
});

app.get('/board.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'board.html'));
});

// ---------- Műhely tábla API ----------

// Aktív kártyák (a lezártak nem szerepelnek)
app.get('/api/board', (req, res) => {
  res.json(storage.listBoard(me(req)));
});

// Gyors új autó / kártya felvétel
app.post('/api/board/cards', (req, res) => {
  const b = req.body || {};
  if (!String(b.rendszam || '').trim()) {
    return res.status(400).json({ ok: false, error: 'A rendszám megadása kötelező.' });
  }
  try {
    const saved = storage.createCard(b, me(req));
    res.json({ ok: true, card: storage.boardView(saved) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Mentés sikertelen.' });
  }
});

// Kártya módosítása (státusz, szerelő, határidő, jelölők...)
app.patch('/api/board/cards/:id', (req, res) => {
  try {
    const w = storage.updateBoard(req.params.id, me(req), req.body || {}, me(req));
    if (!w) return res.status(404).json({ ok: false, error: 'Nem található.' });
    res.json({ ok: true, card: storage.boardView(w) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Mentés sikertelen.' });
  }
});

// Munkalap mentése
app.post('/api/workorders', (req, res) => {
  try {
    const saved = storage.addWorkOrder(req.body || {}, me(req));
    res.json({ ok: true, id: saved.id, munkalapszam: saved.munkalapszam });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Mentés sikertelen.' });
  }
});

// Meglévő munkalap szerkesztése (a teljes űrlap mentése)
app.put('/api/workorders/:id', (req, res) => {
  try {
    const saved = storage.saveForm(req.params.id, me(req), req.body || {});
    if (!saved) return res.status(404).json({ ok: false, error: 'Nem található.' });
    res.json({ ok: true, id: saved.id, munkalapszam: saved.munkalapszam });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Mentés sikertelen.' });
  }
});

// Korábbi munkalapok listázása
app.get('/api/workorders', (req, res) => {
  res.json(storage.listSummaries(me(req)));
});

// Egy munkalap teljes adatai
app.get('/api/workorders/:id', (req, res) => {
  const wo = storage.getById(req.params.id, me(req));
  if (!wo) return res.status(404).json({ ok: false, error: 'Nem található.' });
  res.json(wo);
});

// PDF generálása és letöltése egy mentett munkalapból
app.get('/api/workorders/:id/pdf', async (req, res) => {
  const wo = storage.getById(req.params.id, me(req));
  if (!wo) return res.status(404).send('A munkalap nem található.');

  let page;
  try {
    // A munkalapon rögzített szerviz-adatok az irányadók; ami hiányzik, azt a
    // Beállításokból pótoljuk. A logó mindig az aktuális beállításból jön.
    const st = appSettings.get(me(req));
    const szerviz = {};
    ['nev', 'adoszam', 'cim', 'telefon', 'email'].forEach((k) => {
      szerviz[k] = (wo.szerviz && wo.szerviz[k]) || st.szerviz[k];
    });
    const html = generateWorkOrderHTML(
      Object.assign({}, wo, {
        szerviz,
        garanciaSzoveg: wo.garanciaSzoveg || st.garanciaSzoveg,
        logo: st.logo,
      })
    );

    const browser = await getBrowser();
    page = await browser.newPage();
    // A sablonban nincs külső erőforrás (kép, webfont, külön CSS-fájl),
    // ezért a 'domcontentloaded' elég, és nem akad el hálózati várakozáson.
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // A logó (data URI) betöltését megvárjuk, mielőtt PDF készül
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images).map((img) =>
          img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })
        )
      )
    );

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '12mm', left: '10mm', right: '10mm' },
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="munkalap-${wo.munkalapszam}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('PDF generálása sikertelen: ' + err.message);
  } finally {
    if (page) await page.close();
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('  munkalAPP fut ->  http://localhost:' + PORT);
  console.log('  Bejelentkezés:  http://localhost:' + PORT + '/login.html');
  console.log('');

  // A Chrome-ot rögtön induláskor "bemelegítjük" a háttérben, hogy az
  // első PDF-letöltésnek ne kelljen megvárnia a böngésző elindulását.
  getBrowser()
    .then(() => console.log('  PDF-generátor (Chrome) készenlétben.'))
    .catch((err) => console.error('  PDF-generátor előmelegítése sikertelen:', err.message));
});
