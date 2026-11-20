const storage = require('./storage');
const { calcTotals } = require('../pdf/template');

// "abc-123", "ABC 123" és "ABC123" ugyanaz az autó
function plateKey(p) {
  return String(p || '')
    .toUpperCase()
    .replace(/[^A-Z0-9ÁÉÍÓÖŐÚÜŰ]/g, '');
}

function entryDate(w) {
  return (w.datumok && w.datumok.felvetel) || String(w.createdAt || '').slice(0, 10);
}

// Rendszámonként csoportosított autók a hozzájuk tartozó javítási előzményekkel
function listVehicles(owner) {
  const all = storage.readAll().filter((w) => w.owner === owner);
  const groups = new Map();

  all.forEach((w) => {
    const key = plateKey(w.gepjarmu && w.gepjarmu.rendszam);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  });

  const vehicles = [];
  groups.forEach((records, key) => {
    // legújabb elöl
    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const pick = (getter) => {
      for (const w of records) {
        const v = getter(w);
        if (v) return v;
      }
      return '';
    };

    const history = records
      .map((w) => ({
        id: w.id,
        munkalapszam: w.munkalapszam,
        date: entryDate(w),
        createdAt: w.createdAt,
        status: w.status || 'beerkezett',
        kmora: (w.gepjarmu && w.gepjarmu.kmora) || '',
        panasz: w.panasz || '',
        elvegzettMunka: w.elvegzettMunka || '',
        alkatreszek: (w.alkatreszek || [])
          .map((r) => (r.megnevezes || '').trim())
          .filter(Boolean)
          .slice(0, 8),
        brutto: Math.round(calcTotals(w).brutto),
        szereloNev: w.szereloNev || '',
      }))
      .sort((a, b) => (a.date === b.date ? new Date(b.createdAt) - new Date(a.createdAt) : a.date < b.date ? 1 : -1));

    vehicles.push({
      key,
      rendszam: String(records[0].gepjarmu.rendszam || '').toUpperCase(),
      marka: pick((w) => w.gepjarmu.marka),
      tipus: pick((w) => w.gepjarmu.tipus),
      evjarat: pick((w) => w.gepjarmu.evjarat),
      alvazszam: pick((w) => w.gepjarmu.alvazszam),
      motorszam: pick((w) => w.gepjarmu.motorszam),
      uzemanyag: pick((w) => w.gepjarmu.uzemanyag),
      szin: pick((w) => w.gepjarmu.szin),
      utolsoKm: pick((w) => w.gepjarmu.kmora),
      ugyfelNev: pick((w) => w.ugyfel && w.ugyfel.nev),
      ugyfelTelefon: pick((w) => w.ugyfel && w.ugyfel.telefon),
      ugyfelEmail: pick((w) => w.ugyfel && w.ugyfel.email),
      count: history.length,
      lastDate: history[0] ? history[0].date : '',
      history,
    });
  });

  vehicles.sort((a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0));
  return vehicles;
}

module.exports = { listVehicles, plateKey };
