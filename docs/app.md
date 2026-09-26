# Triton – használat és fejlesztés

## Indítás

A parancsok az `OrarendMgr` könyvtárban futnak. A pnpm lockfile a telepítés alapja.

```sh
pnpm install --frozen-lockfile
pnpm web
```

Kiadási webes változat:

```sh
pnpm build:web
pnpm preview
```

Az előnézet alapértelmezett címe `http://localhost:8082`. A tesztekhez és a méréshez `node:sqlite` támogatású Node szükséges (a fejlesztői ellenőrzés Node 22 környezetben történt).

## Használat

1. Első indításkor automatikusan létrejön a Me, Beni, Matyi és Parker profil a mellékelt ICS-naptárakkal; a Me lesz a saját profil. Meglévő telepítésen a korábbi saját profil megmarad. A profilok átnevezhetők és megerősítés után törölhetők.
2. Az Import műveletben válaszd ki a célprofilt és az ICS- vagy JSON-fájlt, illetve illeszd be a tartalmát. Add meg a feldolgozandó dátumtartományt, ellenőrizd az alkalomszámokat, majd hagyd jóvá a cserét. A sikeresen importált másik profil naptára automatikusan megnyílik.
3. Üres forrásszöveggel a korábban tárolt forrás újra feldolgozható, így a tartomány internet nélkül is bővíthető. A korábbi és az új tartomány unióját őrizzük meg.
4. A Kézi óra művelet a választott profilhoz egyszeri, heti, A vagy B heti, véges sorozatot hoz létre. A megadott helyi idő Budapest szerinti; egész napos eseménynél a végdátum kizáró.
5. Egy alkalomra kattintva szerkeszthető a neve, ideje és terme, vagy elrejthető. A jövőbeli alkalmak listájában jóváhagyható, melyek kapják meg a módosítást. Tömeges időmódosításnál a dátumok megmaradnak; dátumot egyenként módosíts.
6. A visszaállítás törli az alkalom helyi módosításait. Az elrejtett alkalmak a Beállításokban ismét megjeleníthetők. Kézi sorozat külön megerősítéssel teljesen törölhető.
7. A saját naptár mindig legfelül látszik. A „Naptár hozzáadása” gombbal tetszőleges számú másik profil nyitható alatta, mindegyik egyszer; a saját naptár állandó, a többiek külön bezárhatók. A szinkronlapozás bekapcsolása a saját naptár dátumát veszi át. A saját és bármelyik megnyitott profil közös órái könyv ikont kapnak és külön szűrhetők.
8. A Beállításokban módosítható a téma és az A/B referencia. Az újraszámítás jóváhagyás előtt megmutatja a létrejövő, eltűnő alkalmak és elvesző felülírások számát.

A napi/heti nézet, dátumok, megnyitott profilok, kapcsolók, nagyítás és függőleges görgetés megmaradnak újranyitáskor. Nyitott párbeszéd és kitöltetlen űrlap nem áll vissza. A Ma gomb mindig visszavezet az aktuális napra. Szűk kijelzőn is egymás alatt láthatók a naptárak, a heti rács oldalra görgethető.

## UI-bekötés

Expo 57, React Native Reusables, NativeWind 4.2.7 és Tailwind 3.4. A meglévő generált komponenseket használjuk. A `tailwind-merge` 2.6 ága szükséges a Tailwind 3-hoz; ne frissítsd önállóan a 3-as főverzióra.

- `babel.config.js`: Expo preset és NativeWind JSX-transzformáció.
- `metro.config.js`: Expo Metro, NativeWind CSS, WASM asset és webes izolációs fejlécek.
- `tailwind.config.js`: teljes `src` feldolgozása, NativeWind preset, animációs plugin és a gyökérben lévő `tailwind.palette.js`.
- `src/global.css`: gyökérbeli `palette.css`, Tailwind-rétegek, világos/sötét szemantikus színek.
- `src/app/_layout.tsx`: egyetlen globális CSS-import, közös téma, gesztuskezelés és PortalHost.
- `src/lib/theme.ts`, a témasegédek és NativeWind ugyanazt a rendszer/kézi témát követik.

A fő szín az Óbudai Egyetem [publikált pecsétlogójából](https://uni-obuda.hu/wp-content/uploads/2023/01/oe_pecsetlogo.png) mintavett `#122347` (RGB 18, 35, 71). Világos módban fehér felületek és `#F4F6FA` háttér, sötét módban `#101827` alap és `#192438` felületek társulnak hozzá. A sötét témában a műveletek olvashatóságát világosabb, `#A9C3F5` kék biztosítja. A hibajelzés szemantikus vörös. A rendszerbetű, a tabuláris időszámok és a mai nap kiemelése az órarend gyors áttekintését szolgálják.

Az elrendezés közös weben, iOS-en és Androidon: 44 pontos fő kezelőszervek, tördelődő eszköztár, mobilon egymás alatti összehasonlítás. A panel 180 ms-os belépése és 120 ms-os kilépése, illetve a dialógusok rövid áttűnése követi a rendszer csökkentett mozgás beállítását. Nincs automatikus, ismétlődő díszanimáció.

Dokumentáció: [NativeWind telepítés](https://www.nativewind.dev/docs/getting-started/installation), [Reusables kézi telepítés](https://reactnativereusables.com/docs/installation/manual), [Expo SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/).

## Adattárolás és import

A `src/domain` végzi a validálást, az ICS/JSON kibontását és az időkezelést. A `src/data` SQLite-ban tárolja a profilokat, eredeti forrásokat, kibontott alkalmakat, mezőnkénti felülírásokat és beállításokat. A `src/features` tartalmazza a felületet és az állapotkezelést.

Az import inaktív forrásverzióba ír, 100 alkalmas tranzakciókban. A forrás csak a teljes feldolgozás és jóváhagyás után vált aktívvá, egy tranzakcióban. Hiba vagy megszakítás nem cseréli le a korábbi órarendet. Az eredeti szöveg megmarad. A megszakadt folyamatok régi, inaktív adatai későbbi indításkor takaríthatók.

Az azonosság forráshely + eseményazonosító + eredeti előfordulás. Az egyező alkalmak csak módosított mezői maradnak felülírva forráscsere után. Az eltűnt alkalmak felülírása törlődik; visszatérésük új, felülírás nélküli alkalom. Az A/B referencia átállítása az érintett JSON-forrásokkal együtt, egy tranzakcióban történik.

A lekérdezés csak a kiválasztott profilok látható időszakára fut. A helyi felülírások hatályos időpontjai is indexeltek, így az áthelyezett alkalmak a megfelelő napon jelennek meg.

## Saját naptárlink és frissítés

A saját profil Importálás ablakában a „Saját naptárlink” lehetőséggel HTTPS vagy webcal link adható meg. A webcal cím HTTPS-re alakul; beágyazott felhasználónév/jelszó nem használható. A letöltés legfeljebb 30 másodperc és 5 MB. A forrás teljes validálása és az első import jóváhagyása után a kapcsolat és a naptár egyetlen tranzakcióban mentődik. A link helyi SQLite-adat, nem kerül alkalmazáskódba, naplóba vagy Triton-szerverre; az alkalmazás nem használ cookie-t vagy Neptun-bejelentkezést.

Mobilon megnyitáskor és előtérben 15 percenként ellenőrizzük az esedékességet. A legutóbbi próbálkozás időpontja SQLite-ban tárolódik, így a kézi gomb, a háttérfeladat és az újraindítás ugyanazt a legalább 15 perces cooldown-t követi. A sikertelen kísérlet sem indít azonnali ismétlést. Háttérben az Expo BackgroundTask az operációs rendszer lehetőségei szerint fut; 15 perces háttérfrissítés nem garantálható. iOS-szimulátoron ez nem támogatott, fizikai eszköz kell az ütemezés teszteléséhez.

Sikeres frissítés csak a teljes új naptár feldolgozása után publikálható. Hálózati, formátum- vagy felülírási hiba esetén a korábbi naptár megmarad; a felület mutatja a legutóbbi sikert és a hibát. A felhasználó külön engedélyezheti az órarendváltozás helyi értesítését. Az értesítés csak az új, módosult és törölt alkalmak számát tartalmazza; nincs push token vagy külső értesítési szolgáltatás. Változatlan naptár nem értesít. Az összehasonlítás a tárolt importtartományban történik, a nyers eseményadatokon, így a helyi felülírás nem számít távoli változásnak.

Más profilokhoz fájl importálható, automatikus frissítés nélkül. Új fájl jóváhagyása lecseréli az adott profil importforrását, megőrzi a kézi órákat, és leválasztja a korábbi linket. A „Link leválasztása” megtartja az aktuális offline naptárt. Az üres tartalmú offline tartománybővítés megőrzi a kapcsolatot. Letöltés közben lecserélt forrást, leválasztott linket vagy megváltozott saját profilt egy késői válasz nem írhat felül.

Weben a link kizárólag egyszeri letöltés: nincs automatikus vagy háttérfrissítés. Ha a forrás CORS-beállítása tiltja a hozzáférést, az importablak letöltési és fájlválasztási gombot mutat. Nincs proxy és nincs böngészős biztonságikorlátozás-kikapcsolás. A hibás letöltést a fájlimport sem javítja meg: ilyenkor korábban mentett ICS szükséges.

Natív azonosító: `hu.t42.triton`, megjelenő név: `Triton`, URI-séma: `triton`. Az adatbázis neve kompatibilitásból `orarend.db` marad; a 2. séma hozzáadja a `source_sync` táblát. Az Expo Go és egy másik bundle/package azonosítójú alkalmazás külön sandboxot használ: azok helyi adatai nem kerülnek át automatikusan az önálló Triton buildbe.

Dokumentáció: [BackgroundTask](https://docs.expo.dev/versions/v57.0.0/sdk/background-task/), [helyi értesítések](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/). NativeWind Babel-feloldáshoz a `@babel/plugin-transform-react-jsx` 7-es ága közvetlen függőség; a Babel 8 nem illeszkedik ehhez a konfigurációhoz.

## Webes SQLite

A webes kiadás `web.output: single` beállítást használ. A SQLite worker és WASM a kiadott `dist` része; a kiszolgálón a `.wasm` MIME-típusa `application/wasm` legyen.

Minden alkalmazásválaszhoz szükséges:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

A mellékelt előnézeti szerver és a fejlesztői Metro beállítja ezeket. A `public/_headers` támogatott statikus tárhelyeken alkalmazható; más tárhelyen a fejléceket külön konfigurálni kell. HTTPS vagy localhost szükséges. A böngészőben `crossOriginIsolated` értéke legyen `true`.

A böngészős adatbázis originhez kötött: más port vagy domain más adattárat jelent. Újratöltéskor megmarad, de a böngésző tárhelyének törlése vagy kiürítése elveszítheti. A webes offline indítás nem követelmény; nincs service worker. A natív alkalmazás az importált adatokhoz nem igényel hálózatot.

## Ellenőrzés

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build:web
pnpm benchmark
```

A mérés és az elvégzett kézi ellenőrzések részletei: [validation.md](validation.md). Importformátum és példák: [import-format.md](import-format.md). Fogalomtár: [CONTEXT.md](../CONTEXT.md).

## Későbbi fázis

Időalapú kezdőképernyő. Nincs bejelentkezés, felhős szinkron vagy beépített LLM. A fejléc Térkép gombjával a 2D és 3D épülettérkép nyílik meg; a terem mezőből az adott terem is kiemelhető.

## Óra előtti helyi értesítések

A Beállítások → Óra előtti értesítések alatt globális előjelzések adhatók meg a sajátként jelölt profilhoz. Alapminta: 60, 20 és 5 perc; legfeljebb 20 különböző, 1–10080 perces előjelzés. Minden sorhoz Finom, Normál vagy Erős jelzőprofil választható. Egy konkrét óra → Alkalom értesítései alatt egyszeri extra jelzések adhatók hozzá saját vagy szaktársi órarendhez. A saját alkalom kizárható a globális szabályból; ez és az extra lista együtt teljesen egyedi beállítást ad. Azonos percnél az egyedi jelzőprofil nyer. A sorozat más alkalmai nem öröklik a helyi beállítást.

SQLite schema 3: a globális konfiguráció a `classReminders` setting, az alkalmankénti szabály az `event_reminders` tábla `(sourceId,key)` kulccsal. Importfrissítés megőrzi az egyező alkalmak szabályait, a törölt alkalmakét eltávolítja. Profil/forrás törlése kaszkádol. A notification terv az aktív forrásverziók tényleges, felülírásokkal korrigált kezdését használja; elrejtett és lejárt jelzés nem kerül ütemezésre. A nyári/téli időszámítás nem módosítja az előjelzés tényleges időtartamát. Egész napos eseménynél a kezdés budapesti éjfél.

A natív scheduler a következő 30 nap legközelebbi legfeljebb 60 jelzését tartja fenn, az egyéb pending értesítéseknek is helyet hagyva. Megnyitáskor, előtérbe kerüléskor, aktív appban 15 percenként, adatváltozás és engedélyezett háttérfutás után újratervez. Csak a saját reminder-azonosítóit törli; az órarendváltozás-értesítések függetlenek. A beállítóképernyő mutatja a pending darabszámot és az utolsó ütemezett időpontot. Hosszabb, megnyitás nélküli offline időszakra nincs korlátlan kézbesítési garancia; a háttérfutás nem garantált.

Androidon három tartós notification channel készül egy/kettő/három rezgéses alapmintával. Meglévő csatornát nem írunk felül, így a felhasználó hang- és rezgésbeállításai megmaradnak. A csatorna saját rendszerképernyője közvetlenül megnyitható; a további rezgésminta-választék készülékfüggő. Android 12+ esetén a manifest `SCHEDULE_EXACT_ALARM` engedélyt kér; a felhasználónak az Ébresztések és emlékeztetők rendszerbeállításban is engedélyeznie kellhet. Engedély nélkül az Expo best-effort ütemezése késhet. iOS-en az alap rendszerhang használatos, Android-szerű csatornánkénti hang/rezgés testreszabás nincs. A néma mód és a Ne zavarjanak beállítás továbbra is érvényes.

Weben a beállítások szerkeszthetők és lokálisan megmaradnak, de nincs háttérbeli notification és nincs szinkron a telefon beállításaival. A natív működés az Expo Notifications SDK 57 helyi DATE triggerét használja, backend vagy push token nélkül: https://docs.expo.dev/versions/v57.0.0/sdk/notifications/.

Az időrács 07:00–20:00 közötti budapesti időt mutat napi és heti módban. A határt metsző esemény blokkját vágjuk, az esemény adatait nem módosítjuk. A teljesen ezen kívüli időzített esemény nem látszik a rácson; az egész napos sáv és a reminder-ütemezés ettől független. A korábban tárolt görgetési pozíció továbbra is éjféltől számított perc, ezért az új kezdőhatár nem tolja el a visszaállított időpontot.

## Fejlesztői web preview a Tailscale hálózaton

A hoston a `triton-preview.service` systemd user service futtatja a `scripts/serve-web.mjs` kiszolgálót a 8092-es porton. A service engedélyezett, a user lingering aktív, ezért nem függ a terminál/SSH-session élettartamától. A Tailscale Serve háttérben a HTTPS 8444-es portot erre irányítja; a meglévő 443-as szolgáltatás változatlan. Ez tailneten belüli preview, nem nyilvános Funnel vagy production deployment. Előfeltétele a futó host és Tailscale. Új kódhoz `pnpm build:web` szükséges; a kiszolgáló az exportált `dist` tartalmát olvassa.
