# Ellenőrzési jegyzőkönyv

Dátum: 2026-09-21–22. Környezet: Linux, Node 22.22.2, Expo 57. Az első ellenőrzési kör weben, a második a felhasználó MacBookján futó iOS- és Android-szimulátorokon történt.

## Automatizált ellenőrzések

- `pnpm typecheck`: sikeres.
- `pnpm lint`: sikeres; a teljes `src` fára érvényes a 40 soros függvényhatár, a legfeljebb két szintű vezérlési beágyazás, az egy szintű callback-beágyazás és a TypeScript `any` tiltása.
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

## MacBookon végzett natív próbák — 2026-09-22

A szimulátorok a felhasználó MacBookján futottak SSH/Tailscale kapcsolaton keresztül; a forrás és a Metro a Linux fejlesztőgépen maradt. Környezet: Xcode 27, iPhone 17e / iOS 27 szimulátor; Android Studio SDK, Pixel 7 AVD / Android 15 (API 35, ARM64); Expo Go 57.0.9. Ez fejlesztői futtatás, nem kiadási build vagy fizikai készüléken mért teljesítmény.

Az Android kezdetben ablak nélkül indult az eszközkezelő miatt. Újraindítottuk ablakos módban; a felhasználó visszaigazolta, hogy látja a MacBookján. A Macre Android parancssori SDK-eszközök, API 35 rendszerkép és Expo Go került. Az SSH-munkamenetek Java/Android SDK PATH-beállítását a `~/.zshenv` tartalmazza.

### Android: ellenőrzött folyamatok

- Profil létrehozása és sajátként jelölése; kézi óra mentése és terem módosítása.
- Emulátor-újraindítás után a profil és a D.404 teremre módosított óra megmaradt.
- Világos és sötét téma; témaválasztó portálja; Android-visszalépés bezárja a dialógust.
- JSON szöveges importja, előnézet, jóváhagyás, majd az importált esemény tényleges megjelenése a kézi esemény mellett.
- Hibás JSON elutasítása; visszalépés után az előző import és a kézi esemény változatlanul látható.
- Gombos nagyítás: 100%-ról 125%-ra, a rács és az események követik.
- Két különböző profil automatikus kiválasztása összehasonlításhoz; a közösóra-szűrő az üres második profil mellett elrejti az első profil eseményeit.
- Szinkron lapozáskor mindkét panel 2026-09-14-re váltott; kikapcsolt szinkronnál csak a jobb/alsó panel lépett vissza 2026-09-21-re.
- Tiszta újratöltés után a kapcsolók állapotváltása nem hozott létre új Reanimated renderelési figyelmeztetést.

### iOS: ellenőrzött folyamatok és korlátok

- Alkalmazásindítás, üres állapot, profil létrehozása, órarendrács megjelenése.
- Kézi óra mentése a mobilbillentyűzet mellett görgethető űrlapból; a mentett esemény a rácson megjelent és az Expo Go bezárása/újranyitása után is megmaradt.
- Napi/heti nézetváltás és csippentéses nagyítás; az iOS-szimulátor gesztusa 100%-ról 135%-ra módosította a rács nagyítását.
- Az automatizált szövegbevitel karaktervesztéssel és `TEXT_ENTRY_MISMATCH` hibával járt: az `iOS labor` próbából `iS labor` került a mezőbe. A hosszabb JSON-bevitel is sérült. Az automatizálás és az alkalmazás szerepe ebben még nincs elkülönítve; kézi gépeléses ellenőrzés szükséges. Az iOS-import ezért nem kapott sikeres minősítést.

### A próbák során javított hibák

1. Az órarendpanel natív, keskeny képernyőn nulla magasságra zsugorodott a függőleges görgetőben. A panel csak a széles, egymás melletti elrendezésben kap `flex: 1` értéket. Androidon és iOS-en a rács megjelenésével ellenőrizve.
2. A natív `AlertDialogAction` az `onPress` előtt bezárási értesítést küldött. A közös `Confirm` ezt megszakításként kezelte, így a jóváhagyás előtt törölte az import előkészített adatait. A jóváhagyást most normál gomb indítja, a bezárást a hívó kezeli; a megszakítógomb csak egyszer hívja a megszakítási kezelőt. Androidon ugyanazzal az egyeseményes JSON-nal a javítás előtt nem jelent meg esemény, utána igen. A közös komponens az A/B-váltás és törlések megerősítését is szolgálja.
3. A csippentés felesleges shared value-ja megszűnt: a gesztus inkrementális `scaleChange` értékével és funkcionális állapotfrissítéssel működik. A további figyelmeztetéseket a NativeWind 4 átmeneti stílusai és a React Compiler együtt okozták; a NativeWind 4 dokumentált beállításához igazodóan a compiler kikapcsolt. Tiszta Metro-indítás után ugyanazzal a naplópróbával nulla új figyelmeztetés keletkezett.
4. A közösóra-egyezés a követelmény négy mezőjén felül az eseménytípust is összevetette. Az eseménytípus kikerült a szignatúrából, az eseményazonosság pedig ütközésmentes, közös segédfüggvényt kapott.
5. Az import folyamatjelzője fix 0 értéket mutatott. Az ismeretlen elemszámú feldolgozás most meghatározatlan folyamatként jelenik meg, mellette továbbra is nő a feldolgozott elemek száma.

A módosítások után lint, TypeScript, webes export és mind a 15 automatizált teszt sikeres. A fájlválasztós natív ICS-import, forráscsere, A/B-előnézet és jóváhagyás, offline kiadási hidegindítás, képernyőolvasó, teljes billentyűzetes fókuszvizsgálat és célhardveres kiadási teljesítménymérés továbbra sincs igazolva ezekkel a próbákkal.
