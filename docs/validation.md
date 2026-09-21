# Ellenőrzési jegyzőkönyv

Dátum: 2026-09-21. Környezet: Linux, Node 22.22.2, Expo 57. A felhasználó kérésére az interaktív ellenőrzés weben történt; Android-eszköz nem állt rendelkezésre.

## Automatizált ellenőrzések

- `pnpm typecheck`: sikeres.
- `pnpm lint`: sikeres; a saját alkalmazásmodulokra a 40 soros függvényhatár és legfeljebb két szintű vezérlési beágyazás is ellenőrzött.
- `pnpm test`: 15 sikeres teszt. Budapest-idő és DST, A/B hetek, JSON-validálás, ICS RRULE/EXDATE/RECURRENCE-ID és RDATE periódus, beágyazott VTIMEZONE, egész napos/többnapos események, megszüntetett és áthelyezett alkalmak, közös órák, tömeges időmódosítás és ütköző események elhelyezése.
- A repository tesztek a tényleges alkalmazás-SQL-t futtatják Node SQLite adapterrel: inaktív importverzió, atomikus közzététel, mezőfelülírás megtartása, hibás csere, forrásból eltűnés/visszatérés, A/B atomikus újraszámítás, valamint megszakítás már kiírt kötegek után.
- `pnpm build:web`: sikeres; JavaScript, SQLite worker és WASM elkészül.
- Android- és iOS-JavaScript/Hermes export sikeres volt (`expo export --platform android --platform ios`). Ez nem natív alkalmazásfordítás és nem eszközös futtatás.
- A helyi Neptun-mintafájl feldolgozása 133 alkalmat adott; a személyes forrás nem kerül a kiadott csomagba.

## Böngészős ellenőrzés

A fejlesztői és statikus kiadási webváltozatban elvégzett folyamatok:

- Üres profil létrehozása, import-előnézet és jóváhagyás; JSON-ból heti és egész napos események megjelenítése.
- Terem módosítása, majd újratöltés: az adatbázis és a helyi felülírás megmaradt.
- Sötét téma kiválasztása és visszaállítása újratöltés után.
- Második profil importja, összehasonlítás és közösóra-jelölés.
- Kézi esemény létrehozása a kiadási buildben.
- Portálban megnyitott választók használata; a beágyazott Select korábban bezárta a Dialogot, a javított változatban megmaradt.
- 375 px-es nézetben nincs teljes oldalas vízszintes túlcsordulás; a két panel egymás alatt jelenik meg. 1280 px-en egymás mellett.
- A kiadási kiszolgálón `crossOriginIsolated === true`, a SQLite worker/WASM betöltődik és az alkalmazás írja az adatbázist.

A böngészőeszköz képernyőkép-funkciója a későbbi nézetméret-váltást követően hibázott; ezután DOM-alapú ellenőrzés működött, majd az automatizálási kapcsolat is megszűnt. Ez korlátozta a végső vizuális újraellenőrzést. Teljes képernyőolvasós, billentyűzetes és böngészőmátrix-ellenőrzés még nem történt.

## Terhelési mérés

Futtatás: `pnpm benchmark`. A mérés ugyanazt az importot, SQL-lekérdezést, közösórakeresést és rácselrendezést használja Node SQLite adattárral.

| Mérőszám | Eredmény |
| --- | --- |
| Profilok | 15 |
| Tárolt alkalmak | 225 000 |
| Teljes import | 10 291 ms |
| Két profil látható időszakának lekérdezése, összehasonlítása és elrendezése | 8 ms |
| Vizsgált látható alkalmak | 336 |
| Jelentett JS heap | 16 MB |

A JS heap nem tartalmazza a SQLite natív memóriáját és nem a böngésző teljes memóriahasználata. Ez fejlesztői gépen végzett algoritmus-/SQL-mérés, nem mobilos vagy böngészős renderelési benchmark. A 2 másodperces indulási és 200 ms-os interakciós célt nem igazolja.

## Eszközös elfogadáskor hátralévő ellenőrzések

iPhone SE 2020 és régebbi, 3–4 GB RAM-os Android kiadási build: indulás, hét-/profilváltás, importidő és teljes memória; offline hidegindítás; csippentés; Android-visszalépés; mobilbillentyűzet; képernyőolvasó. Weben további Safari/Firefox vizsgálat, fájlválasztó és tárhelykorlát/privát böngészés ellenőrzése szükséges. Ezek elvégzését a jelenlegi jegyzőkönyv nem állítja.
