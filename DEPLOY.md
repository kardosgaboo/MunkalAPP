# Online tesztverzió kiadása – lépésről lépésre

Ez a leírás azt a legrövidebb utat mutatja meg, ahogy a munkalAPP-ot egy
élő, böngészőből elérhető linkre teheted, hogy műhelyek ki tudják
próbálni – anélkül, hogy most még a teljes regisztrációs rendszert meg
kellene építeni.

Ehhez már készen van a projektben egy `Dockerfile`, ami tartalmazza
mindent, amire a PDF-generáláshoz (Puppeteer/Chromium) szükség van –
ezt a legtöbb hosting szolgáltató fel tudja használni.

## 1. Kód feltöltése GitHub-ra

A hosting szolgáltatók (Render, Railway stb.) egy Git-repóból húzzák be
és telepítik a kódot.

1. Hozz létre egy **ingyenes GitHub fiókot**, ha még nincs: https://github.com
2. Hozz létre egy új, privát repót (pl. `munkalapp`).
3. A projekt mappájában:
   ```
   git init
   git add .
   git commit -m "munkalAPP – első verzió"
   git branch -M main
   git remote add origin https://github.com/FELHASZNALONEVED/munkalapp.git
   git push -u origin main
   ```

## 2. Hosting kiválasztása

Egy egyszerű, gyors teszt-kiadáshoz ezek a legjobb, kis erőfeszítéssel
beállítható opciók:

| Szolgáltató | Miért jó teszteléshez | Kb. költség |
|---|---|---|
| **Render.com** | Legegyszerűbb beállítás, automatikus HTTPS, ingyenes `.onrender.com` cím | Ingyenes / ~7 USD/hó a gyorsabb induláshoz |
| **Railway.app** | Hasonlóan egyszerű, használat alapú díjazás | Kis használatnál pár dollár/hó |
| **Fly.io** | Kicsit technikaibb, de nagyon olcsó | Ingyenes szint elérhető |

Kezdésnek a **Render.com** a legkényelmesebb. (Az ingyenes szint
"elalszik", ha percekig nincs forgalom, és az első kérésnél lassabban
indul újra – ez próbafázisban általában elfogadható, de ha zavaró, a
kis fizetős csomag ezt megszünteti.)

## 3. Render beállítása

1. Regisztrálj a https://render.com oldalon, és kösd hozzá a GitHub
   fiókodat.
2. **New +** → **Web Service** → válaszd ki a `munkalapp` repót.
3. Render automatikusan felismeri a `Dockerfile`-t – hagyd
   **Docker**-en a build módot.
4. Adj neki egy nevet, pl. `munkalapp-teszt` (ez lesz az URL-ben:
   `munkalapp-teszt.onrender.com`).
5. **Environment Variables** alatt add hozzá:
   - `SESSION_SECRET` = egy hosszú, véletlen szöveg (ez váltja ki a
     `server.js`-ben jelenleg beégetett titkot – lásd a 4. pontot)
6. Kattints **Create Web Service**-re. Az első build 2-5 percet vehet
   igénybe (Chromium telepítése miatt).

## 4. Egy apró kódmódosítás a session titokhoz

Mielőtt élesben elérhető lesz, cseréld ki a `server.js`-ben a
beégetett session titkot környezeti változóra, hogy ne kelljen kódban
tárolni:

```js
secret: process.env.SESSION_SECRET || 'munkalapp-teszt-titok-CSERELD-LE-PRODUCTIONBEN',
```

## 5. Adattárolás – amit tudni kell

A munkalapok jelenleg a `data/workorders.json` fájlban vannak. A
legtöbb hosting szolgáltatónál (Render ingyenes/alap szintjén is) a
fájlrendszer **nem tartós** – egy újratelepítésnél vagy szerver-
újraindításnál a benne lévő adat elveszhet.

Próbafázisban ez általában belefér ("ha elvesznek a teszt-munkalapok,
nem gond"), de ha ezt el szeretnéd kerülni:

- Render-en hozzá lehet adni egy **Persistent Disk**-et (kis havidíjért)
  a `data` mappához, ami megőrzi a fájlt újraindítások között.
- Hosszabb távon amúgy is az volt a terv, hogy ez egy valódi
  adatbázisra kerül át – onnantól ez a kérdés meg is szűnik.

## 6. Több műhely egyidejű tesztelése

Jelenleg csak 2 belépés van (`KardosGabor_kft` / `admin`), és mindkettő
**ugyanazt a közös munkalap-listát** látja. Ha egyszerre több
műhelynek szeretnéd kiküldeni a próbalinket, és nem szeretnéd, hogy
lássák egymás munkalapjait, a leggyorsabb megoldás: adj hozzá pár sort
a `utils/users.js`-hez, egy külön felhasználónevet/jelszót minden
tesztelő műhelynek. (A teljes, önálló regisztráció majd a következő
fejlesztési körben jön.)

## 7. Tesztelés és a link kiküldése

A deploy végén Render ad egy linket, pl.
`https://munkalapp-teszt.onrender.com`. Mielőtt kiküldöd:

- Nyisd meg magad, jelentkezz be, töltsd ki egy teszt-munkalapot, és
  töltsd le a PDF-et – győződj meg róla, hogy a PDF-generálás is
  működik éles környezetben (ez az egyetlen rész, ami hosting-tól
  hosting-ig eltérően viselkedhet a Chromium miatt).
- Ha ez megvan, küldheted is a linket + a belépési adatokat a
  műhelyeknek egy rövid útmutatóval.
