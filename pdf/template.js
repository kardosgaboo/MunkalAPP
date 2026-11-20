function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function formatCurrency(n) {
  const rounded = Math.round(toNum(n));
  return rounded.toLocaleString('hu-HU') + ' Ft';
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return escapeHtml(d);
  return date.toLocaleDateString('hu-HU');
}

function calcTotals(wo) {
  const alkatreszek = wo.alkatreszek || [];
  const munkadijak = wo.munkadijak || [];

  const alkatreszSum = alkatreszek.reduce(
    (sum, r) => sum + toNum(r.mennyiseg) * toNum(r.egysegar),
    0
  );
  const munkadijSum = munkadijak.reduce(
    (sum, r) => sum + toNum(r.ora) * toNum(r.oradij),
    0
  );

  const netto = alkatreszSum + munkadijSum;
  const afaSzazalek = wo.afaSzazalek !== undefined && wo.afaSzazalek !== '' ? toNum(wo.afaSzazalek) : 27;
  const afaOsszeg = netto * (afaSzazalek / 100);
  const brutto = netto + afaOsszeg;

  return { alkatreszSum, munkadijSum, netto, afaSzazalek, afaOsszeg, brutto };
}

function rowsOrPlaceholder(rows, cols) {
  if (!rows || rows.length === 0) {
    return `<tr class="empty-row"><td colspan="${cols}">&nbsp;</td></tr>`;
  }
  return rows;
}

function generateWorkOrderHTML(wo) {
  const szerviz = wo.szerviz || {};
  const ugyfel = wo.ugyfel || {};
  const gepjarmu = wo.gepjarmu || {};
  const datumok = wo.datumok || {};
  const alkatreszek = wo.alkatreszek || [];
  const munkadijak = wo.munkadijak || [];
  const totals = calcTotals(wo);

  const alkatreszRows = alkatreszek
    .filter((r) => (r.megnevezes || '').trim() !== '')
    .map(
      (r, i) => `
      <tr>
        <td class="idx">${i + 1}</td>
        <td>${escapeHtml(r.megnevezes)}</td>
        <td>${escapeHtml(r.cikkszam)}</td>
        <td class="num">${toNum(r.mennyiseg)} db</td>
        <td class="num">${formatCurrency(r.egysegar)}</td>
        <td class="num strong">${formatCurrency(toNum(r.mennyiseg) * toNum(r.egysegar))}</td>
      </tr>`
    )
    .join('');

  const munkadijRows = munkadijak
    .filter((r) => (r.leiras || '').trim() !== '')
    .map(
      (r, i) => `
      <tr>
        <td class="idx">${i + 1}</td>
        <td colspan="2">${escapeHtml(r.leiras)}</td>
        <td class="num">${toNum(r.ora)} óra</td>
        <td class="num">${formatCurrency(r.oradij)}</td>
        <td class="num strong">${formatCurrency(toNum(r.ora) * toNum(r.oradij))}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8" />
<title>Munkalap ${escapeHtml(wo.munkalapszam)}</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1f2430;
    font-size: 10.5px;
    -webkit-font-smoothing: antialiased;
  }
  .page {
    padding: 34px 42px 18px 42px;
  }

  /* ---------- Header ---------- */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 14px;
    border-bottom: 2px solid #0f172a;
    margin-bottom: 20px;
  }
  .company-name {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0.2px;
    color: #0f172a;
    margin: 0 0 4px 0;
  }
  .company-meta {
    font-size: 9.5px;
    color: #5b6472;
    line-height: 1.5;
  }
  .doc-heading {
    text-align: right;
  }
  .doc-title {
    font-size: 12px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #0d9488;
    font-weight: 700;
    margin: 0 0 6px 0;
  }
  .doc-number {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
  }
  .doc-date {
    font-size: 9.5px;
    color: #5b6472;
    margin-top: 3px;
  }

  /* ---------- Section layout ---------- */
  .section-label {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #0d9488;
    margin: 0 0 8px 0;
  }
  .two-col {
    display: flex;
    gap: 22px;
    margin-bottom: 18px;
  }
  .col {
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e6e9ee;
    border-radius: 6px;
    padding: 12px 14px;
  }
  .kv {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    border-bottom: 1px dashed #e2e6eb;
    font-size: 10px;
  }
  .kv:last-child { border-bottom: none; }
  .kv .k { color: #6b7280; }
  .kv .v { font-weight: 600; color: #1f2430; text-align: right; max-width: 62%; }

  .block {
    margin-bottom: 16px;
  }
  .block-body {
    border: 1px solid #e6e9ee;
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 10.3px;
    line-height: 1.55;
    color: #313846;
    min-height: 20px;
    white-space: pre-wrap;
  }

  /* ---------- Tables ---------- */
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
  }
  table.items thead th {
    text-align: left;
    font-size: 8.6px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #6b7280;
    border-bottom: 1.5px solid #0f172a;
    padding: 5px 6px;
  }
  table.items tbody td {
    padding: 6px 6px;
    border-bottom: 1px solid #edf0f3;
    font-size: 10px;
  }
  table.items td.idx { color: #9aa2af; width: 18px; }
  table.items td.num { text-align: right; white-space: nowrap; }
  table.items td.strong { font-weight: 700; color: #0f172a; }
  .empty-row td { color: #b7bec8; font-style: italic; padding: 8px 6px; }

  .table-title {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #0f172a;
    margin: 14px 0 8px 0;
    padding-top: 10px;
    border-top: 1px solid #e6e9ee;
  }
  .table-title:first-child { border-top: none; padding-top: 0; margin-top: 0; }

  /* ---------- Totals ---------- */
  .totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
    margin-bottom: 18px;
  }
  .totals {
    width: 260px;
  }
  .totals .row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 10.3px;
    color: #4b5563;
  }
  .totals .row.grand {
    border-top: 2px solid #0f172a;
    margin-top: 5px;
    padding-top: 8px;
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
  }
  .totals .row.grand .v { color: #0d9488; }

  /* ---------- Fine print / signatures ---------- */
  .fineprint {
    font-size: 8.6px;
    color: #8a9099;
    line-height: 1.5;
    border-top: 1px solid #e6e9ee;
    padding-top: 8px;
    margin-bottom: 22px;
    white-space: pre-wrap;
  }
  .signatures {
    display: flex;
    gap: 40px;
    margin-top: 34px;
  }
  .sig {
    flex: 1;
    text-align: center;
  }
  .sig .line {
    border-top: 1px solid #1f2430;
    margin-bottom: 6px;
    height: 34px;
  }
  .sig .label {
    font-size: 9px;
    color: #6b7280;
    letter-spacing: 0.4px;
  }
  .sig .name {
    font-size: 10px;
    font-weight: 600;
    color: #1f2430;
    margin-top: 2px;
  }

  .footer {
    text-align: center;
    font-size: 8px;
    color: #b7bec8;
    margin-top: 24px;
  }

  .badge {
    display: inline-block;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
    padding: 2px 8px;
    border-radius: 10px;
    background: #ecfdf5;
    color: #0d9488;
    margin-left: 8px;
  }
</style>
</head>
<body>
  <div class="page">

    <div class="header">
      <div>
        <p class="company-name">${escapeHtml(szerviz.nev) || 'Autószerviz'}</p>
        <div class="company-meta">
          ${escapeHtml(szerviz.cim) || ''}<br/>
          ${szerviz.adoszam ? 'Adószám: ' + escapeHtml(szerviz.adoszam) + '<br/>' : ''}
          ${szerviz.telefon ? 'Tel: ' + escapeHtml(szerviz.telefon) + ' ' : ''}${szerviz.email ? '· ' + escapeHtml(szerviz.email) : ''}
        </div>
      </div>
      <div class="doc-heading">
        <p class="doc-title">Munkalap</p>
        <div class="doc-number">#${escapeHtml(wo.munkalapszam)}</div>
        <div class="doc-date">Felvétel dátuma: ${formatDate(datumok.felvetel)}</div>
      </div>
    </div>

    <div class="two-col">
      <div class="col">
        <p class="section-label">Ügyfél adatai</p>
        <div class="kv"><span class="k">Név</span><span class="v">${escapeHtml(ugyfel.nev)}</span></div>
        <div class="kv"><span class="k">Cím</span><span class="v">${escapeHtml(ugyfel.cim)}</span></div>
        <div class="kv"><span class="k">Telefon</span><span class="v">${escapeHtml(ugyfel.telefon)}</span></div>
        <div class="kv"><span class="k">E-mail</span><span class="v">${escapeHtml(ugyfel.email)}</span></div>
        ${ugyfel.adoszam ? `<div class="kv"><span class="k">Adószám</span><span class="v">${escapeHtml(ugyfel.adoszam)}</span></div>` : ''}
      </div>
      <div class="col">
        <p class="section-label">Gépjármű adatai</p>
        <div class="kv"><span class="k">Rendszám</span><span class="v">${escapeHtml(gepjarmu.rendszam)}</span></div>
        <div class="kv"><span class="k">Márka / típus</span><span class="v">${escapeHtml(gepjarmu.marka)} ${escapeHtml(gepjarmu.tipus)}</span></div>
        <div class="kv"><span class="k">Alvázszám</span><span class="v">${escapeHtml(gepjarmu.alvazszam)}</span></div>
        <div class="kv"><span class="k">Motorszám</span><span class="v">${escapeHtml(gepjarmu.motorszam)}</span></div>
        <div class="kv"><span class="k">Évjárat</span><span class="v">${escapeHtml(gepjarmu.evjarat)}</span></div>
        <div class="kv"><span class="k">Km óraállás</span><span class="v">${gepjarmu.kmora ? Number(gepjarmu.kmora).toLocaleString('hu-HU') + ' km' : ''}</span></div>
        <div class="kv"><span class="k">Üzemanyag / szín</span><span class="v">${escapeHtml(gepjarmu.uzemanyag)} ${gepjarmu.szin ? '· ' + escapeHtml(gepjarmu.szin) : ''}</span></div>
      </div>
    </div>

    <div class="block">
      <p class="section-label">Bejelentett hiba / ügyfél panasza</p>
      <div class="block-body">${escapeHtml(wo.panasz) || '—'}</div>
    </div>

    <div class="block">
      <p class="section-label">Diagnózis / elvégzett munka leírása</p>
      <div class="block-body">${escapeHtml(wo.elvegzettMunka) || '—'}</div>
    </div>

    <div>
      <p class="table-title">Felhasznált alkatrészek</p>
      <table class="items">
        <thead>
          <tr>
            <th style="width:18px"></th>
            <th>Megnevezés</th>
            <th style="width:90px">Cikkszám</th>
            <th style="width:60px" class="num">Menny.</th>
            <th style="width:90px" class="num">Egységár</th>
            <th style="width:100px" class="num">Összesen</th>
          </tr>
        </thead>
        <tbody>
          ${rowsOrPlaceholder(alkatreszRows, 6)}
        </tbody>
      </table>

      <p class="table-title">Munkadíjak</p>
      <table class="items">
        <thead>
          <tr>
            <th style="width:18px"></th>
            <th colspan="2">Munka leírása</th>
            <th style="width:60px" class="num">Idő</th>
            <th style="width:90px" class="num">Óradíj</th>
            <th style="width:100px" class="num">Összesen</th>
          </tr>
        </thead>
        <tbody>
          ${rowsOrPlaceholder(munkadijRows, 6)}
        </tbody>
      </table>
    </div>

    <div class="totals-wrap">
      <div class="totals">
        <div class="row"><span>Alkatrészek összesen</span><span class="v">${formatCurrency(totals.alkatreszSum)}</span></div>
        <div class="row"><span>Munkadíj összesen</span><span class="v">${formatCurrency(totals.munkadijSum)}</span></div>
        <div class="row"><span>Nettó összesen</span><span class="v">${formatCurrency(totals.netto)}</span></div>
        <div class="row"><span>ÁFA (${totals.afaSzazalek}%)</span><span class="v">${formatCurrency(totals.afaOsszeg)}</span></div>
        <div class="row grand"><span>Fizetendő végösszeg</span><span class="v">${formatCurrency(totals.brutto)}</span></div>
      </div>
    </div>

    ${wo.megjegyzes ? `
    <div class="block">
      <p class="section-label">Megjegyzés</p>
      <div class="block-body">${escapeHtml(wo.megjegyzes)}</div>
    </div>` : ''}

    <div class="fineprint">${escapeHtml(wo.garanciaSzoveg) || 'A javításra a beépített alkatrészek gyártói garanciája, valamint a Polgári Törvénykönyv szerinti jogszabályi garancia érvényes. Az elvégzett munkára a szerviz szavatosságot vállal a hatályos jogszabályok szerint.'}</div>

    <div class="signatures">
      <div class="sig">
        <div class="line"></div>
        <div class="label">SZERELŐ</div>
        <div class="name">${escapeHtml(wo.szereloNev) || ''}</div>
      </div>
      <div class="sig">
        <div class="line"></div>
        <div class="label">ÜGYFÉL ALÁÍRÁSA</div>
        <div class="name">${escapeHtml(ugyfel.nev) || ''}${wo.alairasDatum ? ' · ' + formatDate(wo.alairasDatum) : ''}</div>
      </div>
    </div>

    <div class="footer">munkalAPP · Generálva: ${new Date().toLocaleString('hu-HU')}</div>
  </div>
</body>
</html>`;
}

module.exports = { generateWorkOrderHTML, calcTotals };
