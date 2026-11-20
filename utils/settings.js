const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'settings.json');

const MAX_LOGO_LENGTH = 800000; // ~600 KB kép base64-ben
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

function readAll() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || {};
  } catch (e) {
    return {};
  }
}

function writeAll(obj) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
}

function s(v, max) {
  return String(v === undefined || v === null ? '' : v).trim().slice(0, max || 300);
}

function normalize(raw) {
  raw = raw || {};
  const sz = raw.szerviz || {};
  return {
    szerviz: {
      nev: s(sz.nev, 200),
      adoszam: s(sz.adoszam, 50),
      cim: s(sz.cim, 300),
      telefon: s(sz.telefon, 60),
      email: s(sz.email, 150),
    },
    oradij: s(raw.oradij, 12).replace(/[^\d]/g, ''),
    garanciaSzoveg: s(raw.garanciaSzoveg, 2000),
    logo: typeof raw.logo === 'string' ? raw.logo : '',
  };
}

function get(owner) {
  return normalize(readAll()[owner]);
}

// input.logo: undefined = változatlan, '' = törlés, data URI = új logó
function save(owner, input) {
  input = input || {};
  const all = readAll();
  const current = normalize(all[owner]);
  const next = normalize(input);

  if (input.logo === undefined) {
    next.logo = current.logo;
  } else if (input.logo === '') {
    next.logo = '';
  } else if (!LOGO_RE.test(input.logo) || input.logo.length > MAX_LOGO_LENGTH) {
    throw new Error('A logó formátuma vagy mérete nem megfelelő (PNG, JPG vagy WebP, legfeljebb ~600 KB).');
  }

  all[owner] = next;
  writeAll(all);
  return next;
}

module.exports = { get, save };
