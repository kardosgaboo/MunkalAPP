// TESZT FÁZIS — egyszerű, memóriában/fájlban tárolt próba-fiókok.
// FONTOS: a jelszavak itt egyszerű szövegként (plaintext) szerepelnek,
// ez KIZÁRÓLAG helyi teszteléshez elfogadható. Mielőtt ez az app online,
// több ügyfél által elérhető verzióvá válik, a jelszavakat hash-elve
// (pl. bcrypt-tel) kell tárolni, és ezt a listát valódi felhasználó-
// adatbázisra kell cserélni.

module.exports = [
  {
    username: 'KardosGabor_kft',
    password: 'Debrecen123',
    displayName: 'Kardos Gábor Kft.',
  },
  {
    username: 'admin',
    password: 'admin',
    displayName: 'Administrator',
  },
];
