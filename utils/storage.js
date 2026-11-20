const fs = require('fs');
const path = require('path');
const appSettings = require('./settings');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'workorders.json');

// A Műhely tábla státuszai (a "lezarva" az archívum, nem látszik a táblán)
const STATUSES = [
  'beerkezett',
  'atvizsgalas',
  'jovahagyasra_var',
  'javitas_alatt',
  'atadasra_kesz',
  'lezarva',
];

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

function readAll() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeAll(list) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function nextWorkOrderNumber(list) {
  const year = new Date().getFullYear();
  const thisYearCount = list.filter((w) => (w.munkalapszam || '').startsWith(String(year))).length;
  const seq = String(thisYearCount + 1).padStart(4, '0');
  return `${year}-${seq}`;
}

function newId() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
}

function str(v, max) {
  return String(v === undefined || v === null ? '' : v).slice(0, max || 500);
}

function todayStr() {
  const d = new Date();
  return (
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  );
}

function isDateStr(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v || '');
}

// ---------- Munkalapok (minden rekord egy fiókhoz / "owner"-hez tartozik) ----------

function addWorkOrder(record, owner) {
  const list = readAll();
  const now = new Date().toISOString();
  const full = Object.assign({}, record, {
    id: newId(),
    munkalapszam: nextWorkOrderNumber(list),
    owner,
    createdAt: now,
    status: 'beerkezett',
    surgos: !!record.surgos,
    alkatreszreVar: {
      aktiv: !!(record.alkatreszreVar && record.alkatreszreVar.aktiv),
      nev: str(record.alkatreszreVar && record.alkatreszreVar.nev, 200),
    },
    statusLog: [{ status: 'beerkezett', at: now, by: owner }],
  });
  list.push(full);
  writeAll(list);
  return full;
}

function getById(id, owner) {
  const w = readAll().find((x) => x.id === id);
  if (!w || w.owner !== owner) return null;
  return w;
}

function listSummaries(owner) {
  return readAll()
    .filter((w) => w.owner === owner)
    .map((w) => ({
      id: w.id,
      munkalapszam: w.munkalapszam,
      createdAt: w.createdAt,
      status: w.status,
      ugyfelNev: (w.ugyfel && w.ugyfel.nev) || '',
      rendszam: (w.gepjarmu && w.gepjarmu.rendszam) || '',
      marka: (w.gepjarmu && w.gepjarmu.marka) || '',
      tipus: (w.gepjarmu && w.gepjarmu.tipus) || '',
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// A teljes munkalap-űrlap mentése meglévő rekordra (a tábla-adatok megmaradnak)
function saveForm(id, owner, body) {
  const list = readAll();
  const idx = list.findIndex((w) => w.id === id && w.owner === owner);
  if (idx < 0) return null;
  const old = list[idx];
  const merged = Object.assign({}, old, body, {
    id: old.id,
    munkalapszam: old.munkalapszam,
    owner: old.owner,
    createdAt: old.createdAt,
    status: old.status,
    surgos: old.surgos,
    alkatreszreVar: old.alkatreszreVar,
    statusLog: old.statusLog,
  });
  list[idx] = merged;
  writeAll(list);
  return merged;
}

// ---------- Műhely tábla ----------

function boardView(w) {
  return {
    id: w.id,
    munkalapszam: w.munkalapszam,
    status: w.status || 'beerkezett',
    surgos: !!w.surgos,
    alkatreszreVar: w.alkatreszreVar || { aktiv: false, nev: '' },
    rendszam: (w.gepjarmu && w.gepjarmu.rendszam) || '',
    marka: (w.gepjarmu && w.gepjarmu.marka) || '',
    tipus: (w.gepjarmu && w.gepjarmu.tipus) || '',
    ugyfelNev: (w.ugyfel && w.ugyfel.nev) || '',
    ugyfelTelefon: (w.ugyfel && w.ugyfel.telefon) || '',
    panasz: w.panasz || '',
    szereloNev: w.szereloNev || '',
    hatarido: (w.datumok && w.datumok.varhatoBefejezes) || '',
    createdAt: w.createdAt,
    statusLog: w.statusLog || [],
  };
}

function listBoard(owner) {
  return readAll()
    .filter((w) => w.owner === owner && (w.status || 'beerkezett') !== 'lezarva')
    .map(boardView);
}

// Gyors "Új autó" felvétel: a szerviz adatait a Beállításokból veszi (ennek hiányában az előző munkalapról)
function createCard(data, owner) {
  const last = readAll()
    .filter((w) => w.owner === owner && w.szerviz && w.szerviz.nev)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  const st = appSettings.get(owner);
  const record = {
    szerviz: st.szerviz.nev ? st.szerviz : last ? last.szerviz : {},
    garanciaSzoveg: st.garanciaSzoveg || (last ? last.garanciaSzoveg : undefined),
    ugyfel: { nev: str(data.ugyfelNev, 200), telefon: str(data.ugyfelTelefon, 100) },
    gepjarmu: { rendszam: str(data.rendszam, 40), marka: str(data.marka, 100), tipus: str(data.tipus, 100) },
    datumok: {
      felvetel: isDateStr(data.felvetel) ? data.felvetel : todayStr(),
      varhatoBefejezes: isDateStr(data.hatarido) ? data.hatarido : '',
    },
    panasz: str(data.panasz, 2000),
    szereloNev: str(data.szereloNev, 200),
    surgos: !!data.surgos,
    alkatreszek: [],
    munkadijak: [],
    afaSzazalek: '27',
    fizetesiMod: 'Készpénz',
  };
  return addWorkOrder(record, owner);
}

// Tábla-mezők módosítása (státusz, szerelő, határidő, jelölők, alapadatok)
function updateBoard(id, owner, patch, by) {
  const list = readAll();
  const idx = list.findIndex((w) => w.id === id && w.owner === owner);
  if (idx < 0) return null;
  const w = list[idx];

  w.gepjarmu = w.gepjarmu || {};
  w.ugyfel = w.ugyfel || {};
  w.datumok = w.datumok || {};
  w.statusLog = Array.isArray(w.statusLog) ? w.statusLog : [];

  if ('rendszam' in patch) w.gepjarmu.rendszam = str(patch.rendszam, 40);
  if ('marka' in patch) w.gepjarmu.marka = str(patch.marka, 100);
  if ('tipus' in patch) w.gepjarmu.tipus = str(patch.tipus, 100);
  if ('ugyfelNev' in patch) w.ugyfel.nev = str(patch.ugyfelNev, 200);
  if ('ugyfelTelefon' in patch) w.ugyfel.telefon = str(patch.ugyfelTelefon, 100);
  if ('panasz' in patch) w.panasz = str(patch.panasz, 2000);
  if ('szereloNev' in patch) w.szereloNev = str(patch.szereloNev, 200);
  if ('hatarido' in patch) w.datumok.varhatoBefejezes = isDateStr(patch.hatarido) ? patch.hatarido : '';
  if ('surgos' in patch) w.surgos = !!patch.surgos;

  if ('alkatreszreVarAktiv' in patch || 'alkatreszreVarNev' in patch) {
    w.alkatreszreVar = w.alkatreszreVar || { aktiv: false, nev: '' };
    if ('alkatreszreVarAktiv' in patch) w.alkatreszreVar.aktiv = !!patch.alkatreszreVarAktiv;
    if ('alkatreszreVarNev' in patch) w.alkatreszreVar.nev = str(patch.alkatreszreVarNev, 200);
  }

  if (patch.status && STATUSES.includes(patch.status) && patch.status !== w.status) {
    w.status = patch.status;
    w.statusLog.push({ status: patch.status, at: new Date().toISOString(), by });
  }

  list[idx] = w;
  writeAll(list);
  return w;
}

module.exports = {
  STATUSES,
  addWorkOrder,
  getById,
  listSummaries,
  saveForm,
  boardView,
  listBoard,
  createCard,
  updateBoard,
  readAll,
};
