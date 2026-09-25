# Ellenőrzési jegyzőkönyv

## ÓE témájú felületfrissítés — 2026-09-22

- Az ÓE logójának mintavett `#122347` kékje, új világos/sötét szemantikus paletta és natív navigációs színek.
- Közös web/iOS/Android fejléc, ikonok, 44 pontos fő vezérlők, tördelődő mobilos eszköztár, mai nap és A/B hét kiemelése.
- iPhone 17e szimulátoron világos téma, Android 15 emulátoron sötét téma képernyőképpel ellenőrizve a felhasználó MacBookján. Mindkét platformon működött a Ma művelet, Androidon a korábbi importált és kézi órák megjelentek.
- Az összehasonlító panel rövid áttűnése és a dialógusok animációi a rendszer csökkentett mozgás beállítását használják.
- Lint, TypeScript, 15 automatizált teszt és web export sikeres. A böngészős vizuális ellenőrzést a T3 előnézet időtúllépése és később elérhetetlen automatizálási hostja korlátozta; ebből a körből nincs teljes webes vizuális regressziós eredmény.

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

## Triton Release és naptárfrissítés — 2026-09-23

A natív build és futtatás a felhasználó MacBookján történt: Xcode 27, iPhone 17e / iOS 27 szimulátor és Android 15 / API 35 ARM64 emulátor. Mindkét platform önálló, beágyazott JavaScriptet tartalmazó Release buildet kapott, Metro és Expo Go nélkül. Androidon JDK 17-tel készült az APK; az iOS-szimulátoros build nem terjesztési aláírással készült.

### Sikeres ellenőrzések

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (21 teszt), `pnpm build:web` és `git diff --check`.
- Weben, Androidon és iOS-en tényleges rendszerfájlválasztós ICS-import: `Saját órarend` és `TTRMB_TEST`, profilonként 133 alkalom a kiválasztott tartományban. A saját profil korábbi sikeres letöltésből származó ICS-cache-t, a társ a felhasználó helyi ICS-exportját használta.
- Két különböző profil összehasonlítása, közös órák jelölése és szűrése, szinkronizált lapozás A és B hét között mindhárom platformon. Ez hétváltási próba; nem helyettesíti az A/B-referencia átállításának teljes natív elfogadási tesztjét.
- Webes újratöltés és natív újranyitás után megmaradó profilok és órák. Androidon kikapcsolt Wi-Fi mellett Release-újraindítás után is elérhető a cache és a korábban választott B hét; a Wi-Fi a próba után visszakapcsolva.
- Weben 390 px-es nézet teljes oldalas vízszintes túlcsordulás nélkül, világos/sötét téma, dialógusba ágyazott választó, tárolt forrásból offline tartománybővítés. Playwright Chromium alatt nem keletkezett oldalhiba.
- A hat új integrációs teszt valódi SQLite-adattárral és kontrollált HTTP-válaszokkal ellenőrzi a validációt, megszakítást, méretkorlátot, közös frissítési időkorlátot, változásösszesítést, helyi felülírás megőrzését, hibás frissítés utáni cache-t és az elavult/párhuzamos import visszautasítását.

### Javított natív hibák

- iOS 27 indítási hiba: az Expo build-properties `ios.enableSceneSupport` beállítása bekapcsolva; az újragenerált natív projekt Release buildje elindul.
- Az iOS rendszerfájlválasztót elfedte a dialógus FullWindowOverlay rétege. A közös PortalHost használatával a fájlválasztás és az import jóváhagyása működik.
- Az iOS billentyűzet által elfoglalt helyet a közös dialógus és a görgethető űrlap figyelembe veszi.
- Tiszta pnpm környezetben hiányzó Babel JSX-transzformáló függőség közvetlenül rögzítve.

### Külső blokkolók és fennmaradó korlátok

A megadott privát Neptun-link a vizsgálatkor HTTP 500 választ adott, Androidon az alkalmazás ezt tényleges lekérés után megjelenítette, a meglévő import sértetlen maradt. Weben a közvetlen hozzáférés hibája/CORS miatt a letöltés–fájlimport fallback szükséges. A saját profilok ezért jelenleg statikus cache-t használnak, nincs sikeresen aktivált élő előfizetés. A teljes élő automatikus frissítés és a változásértesítés szolgáltatással együtt nem kapott sikeres minősítést. iOS-en a hosszú URL automatizált bevitelét karaktervesztés akadályozta; ez nem sikeres URL-import teszt.

A háttérfrissítés időpontját az operációs rendszer dönti el; a 15 perc nem háttérbeli garancia. iOS-szimulátoron a BackgroundTask nem támogatott. A háttérfuttatás és értesítés fizikai készülékes ellenőrzése, a célhardveres teljesítmény, valamint a teljes akadálymentességi és böngészőmátrix-teszt még hátravan. A tesztfájlok átviteléhez használt ideiglenes helyi HTTP-kiszolgáló nem része az alkalmazásnak; a Tritonnak nincs saját szervere.

Az alkalmazás neve és csomagazonosítója Triton / `hu.t42.triton`, a GitHub-repository neve `t42-hu/Triton`. Commit és push nem történt.

### Új naptárlink ellenőrzése — 2026-09-23

A felhasználó újabb, az előzőktől eltérő linkje sikeresen letölthető az alkalmazás `fetchCalendar` függvényével, böngészős bejelentkezés és cookie nélkül. A válasz 43 148 byte; az alkalmazás `expandIcs` feldolgozója 2026-09-01–2027-03-22 között 133 alkalmat állított elő hiba nélkül. A privát URL és a letöltés csak ideiglenes, repositoryn kívüli fájlban van. Ez feloldja a korábbi HTTP 500 blokkolót ennél az új linknél, de nem igazol natív URL-importot, időzített frissítést vagy notification kézbesítést; ezek külön end-to-end ellenőrzést igényelnek.

## Óra előtti reminderek, időrács és preview — 2026-09-23

- 27 automatizált teszt, lint, TypeScript és web export sikeres. Új ellenőrzések: globális/szaktársi szétválasztás, alkalmankénti kizárás és felülírás, lejárt/elhagyott jelzések, DST, legközelebbi 60 jelzés, idempotens ütemezési különbség, SQLite szabálymegőrzés/frissítés/törlés, 07:00–21:00 határok metszése.
- Playwright Chromium: globális reminder-űrlap invalid 0 perc elutasítása, jelzőprofil kiválasztása, mentés/újratöltés, sor hozzáadása/törlése. Tailscale HTTPS címen is sikeres. Napi/heti nézet, Ma, billentyűzetes tabváltás, mobilméret és mindkét téma ellenőrizve; 00:00 és 22:00 hiányzik, 07:00 és 21:00 megvan.
- MacBookon Android API 35 és iOS 27 önálló Release build: engedélykérés, globális bekapcsolás és 60 pending jelzés. iOS-en kikapcsolás után 0 pending jelzés, beállítások újranyitáskor is megmaradnak. Androidon alkalmankénti 1 perces szabály, globális kizárás, időpontmódosítás; csatorna hang/rezgés rendszeroldala és a pontos ébresztések engedélyoldala ténylegesen megnyílik.
- Androidon a pontos ébresztés külön engedélye kezdetben tiltott volt, az első próba nem érkezett meg a kívánt percben. Az app ezért külön gombot ad az engedélyhez; onnan visszatérve újraütemezi a pending jelzéseket. A rendszer energiatakarékossága, néma/Ne zavarjanak módja és engedélyei továbbra is hatnak a kézbesítésre.
- A Tailscale 8444-es porthoz hiányzott a Serve beállítás. A háttérben tartósan konfigurált proxy és a `triton-preview.service` systemd user service helyreállította. A MacBookról HTTP/2 200 és SQLite-hoz szükséges izolációs fejlécek érkeznek; a meglévő 443-as Tailscale-szolgáltatás megmaradt.

Az OS által ütemezett többnapos háttérfuttatás, a tényleges készülékhang/rezgéserősség és a fizikai telefonos akkukímélési mátrix nincs ezekkel a szimulátoros próbákkal igazolva.

Az Android pontos ébresztési engedély megadása után a `ReminderSmoke` alkalom kezdését 11:13-ról 11:19-re módosítottuk, saját 1 perces előjelzéssel és globális kizárással. Az app a háttérben volt. 11:18-kor a rendszer értesítési sávjában megjelent a „ReminderSmoke — 1 perc múlva kezdődik” Triton-értesítés. Ez az egyszeri helyi reminder tényleges kézbesítését és az óramódosítás utáni újraütemezést igazolja; iOS-en ebben a körben a permission/pending/cancel folyamatot vizsgáltuk, tényleges kézbesítést nem.
