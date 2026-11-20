# munkalAPP

Digitális munkalap-kezelő autószerelő cégek részére. Kitölthető űrlap minden
szükséges mezővel, mentés, majd letisztult, modern PDF munkalap generálása.

## Telepítés (helyi futtatás)

Előfeltétel: [Node.js](https://nodejs.org) (LTS verzió, 18-as vagy újabb).

1. Csomagold ki a projektet egy mappába, majd nyiss terminált abban a mappában.
2. Telepítsd a függőségeket:

   ```
   npm install
   ```

   (Ez letölti a Puppeteer-t is, ami a PDF-generáláshoz egy beágyazott
   Chromium böngészőt használ – ehhez internetkapcsolat szükséges,
   de csak most, az első telepítéskor.)

3. Indítsd el a szervert:

   ```
   npm start
   ```

4. Nyisd meg a böngészőben: **http://localhost:3000**

Ezzel készen is vagy – az app teljesen a saját gépeden fut, adatot sehova
nem küld ki.

## Bejelentkezés (teszt fázis)

Az app most bejelentkezést kér. Két teszt-profil van eltárolva:

| Felhasználónév     | Jelszó       |
|---------------------|--------------|
| KardosGabor_kft     | Debrecen123  |
| admin               | admin        |

Ezek a `utils/users.js` fájlban vannak megadva. **Ez kizárólag teszt
fázisra való**: a jelszavak egyszerű szövegként (nem hash-elve) vannak
tárolva, és nincs jelszó-visszaállítás, jogosultságkezelés stb. Mielőtt
ez online, ügyfelek által is elérhető verzióvá válik:

- a jelszavakat hash-elve kell tárolni (pl. `bcrypt`),
- a `utils/users.js` helyett valódi, adatbázisban tárolt felhasználókat
  kell használni,
- a `server.js`-ben a session titkos kulcsát (`secret: '...'`) egy hosszú,
  véletlen, biztonságosan tárolt értékre kell cserélni.

## Műhely tábla

A **Műhely tábla** menüpont egy egyszerű Kanban nézet a műhelyben lévő autókról:

- 5 oszlop: Beérkezett → Átvizsgálás → Jóváhagyásra vár → Javítás alatt → Átadásra kész
- a kártyák húzással mozgathatók, vagy a kártyán lévő státusz-választóval (telefonon ez a kényelmesebb)
- „Sürgős" és „⏸ Alkatrészre vár" jelölő a kártyán (az alkatrészre váró autó a „Javítás alatt" oszlopban marad)
- keresés (rendszám, ügyfél, munkalapszám) és szűrés szerelő szerint
- a kártya egyben a munkalap: kattintásra oldalsó panel nyílik, innen megnyitható a teljes munkalap-űrlap (alkatrészek, munkadíj, PDF)
- „Átadva – lezárás": a kártya lekerül a tábláról, a munkalap a Korábbi munkalapok között megmarad
- minden státuszváltás naplózódik (ki és mikor)

Minden bejelentkezett fiók csak a saját munkalapjait és kártyáit látja.

## Beállítások

A **Beállítások** menüpontban egyszer megadható a szerviz neve, adószáma, címe, telefonja, e-mailje, a **logó**, az alapértelmezett **óradíj** és a garancia szöveg. Az új munkalapok ezekkel töltődnek elő, a PDF fejlécébe pedig a logó is bekerül.

## Adatbázis (autók)

Az **Adatbázis** menüpont rendszámonként gyűjti az autókat (az `abc-123`, `ABC 123` és `ABC123` ugyanaz az autó). A rendszám-kereső gépelés közben szűr, a találatra kattintva megjelenik az autó adatai és a teljes javítási előzmény (dátum, elvégzett munka, alkatrészek, összeg, km), innen megnyithatók a munkalapok és a PDF-ek, vagy egy kattintással új munkalap indítható az autóra.

## Használat

- **Új munkalap**: töltsd ki az ügyfél, gépjármű, hiba/panasz, elvégzett munka
  adatait, add hozzá az alkatrészeket és a munkadíjakat (a végösszeg
  automatikusan frissül), majd kattints a **„Munkalap mentése és PDF
  létrehozása”** gombra. Ez elmenti a munkalapot, és azonnal letölti a
  szép, modern kivitelű PDF-et.
- **Korábbi munkalapok**: a felső menüből elérhető, itt bármelyik korábban
  mentett munkalap PDF-je újra letölthető.

## Hogyan tárolódnak az adatok?

A munkalapok a `data/workorders.json` fájlban tárolódnak egyszerű JSON
formátumban. Ez helyi, egyfelhasználós használatra tökéletes; ha később
online, több felhasználós verzió készül, ez a réteg könnyen kicserélhető
valódi adatbázisra (pl. PostgreSQL) anélkül, hogy az űrlapon vagy a
PDF-sablonon módosítani kellene.

## Mappastruktúra

```
munkalapp/
├── server.js            # Express szerver, API végpontok
├── pdf/template.js       # A PDF HTML/CSS sablonja (itt lehet a designt igazítani)
├── utils/storage.js       # Egyszerű fájl-alapú adattárolás
├── public/                # Kliens oldal (űrlap, előzmények, stílus, JS)
│   ├── index.html
│   ├── history.html
│   ├── css/style.css
│   └── js/{app.js, history.js}
└── data/workorders.json   # Mentett munkalapok (automatikusan létrejön)
```

## Tervezett bővítési irányok (online, ügyfeleknek)

Az architektúra már erre készül:

- A `utils/storage.js` réteget cserélve könnyen bevezethető valódi adatbázis
  és több cég/felhasználó kezelése (bejelentkezés, jogosultságok).
- A `pdf/template.js` HTML/CSS sablonja szerkezetileg elválik a logikától,
  így a design (logó, színek, elrendezés) önállóan finomhangolható.
- A frontend jelenleg egyszerű statikus HTML/JS – online verzióban ez
  bővíthető ügyfél-bejelentkezéssel, státuszkövetéssel, e-mailes
  értesítésekkel stb.
