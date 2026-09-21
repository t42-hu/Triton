# Órarend alkalmazás – használat és fejlesztés

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

1. Hozz létre egy profilt, és szükség szerint jelöld sajátként. A profil átnevezhető és megerősítés után törölhető.
2. Az Import műveletben válassz ICS- vagy JSON-fájlt, illetve illeszd be a tartalmát. Add meg a feldolgozandó dátumtartományt, ellenőrizd az alkalomszámokat, majd hagyd jóvá a cserét.
3. Üres forrásszöveggel a korábban tárolt forrás újra feldolgozható, így a tartomány internet nélkül is bővíthető. A korábbi és az új tartomány unióját őrizzük meg.
4. A Kézi óra művelet egyszeri, heti, A vagy B heti, véges sorozatot hoz létre. A megadott helyi idő Budapest szerinti; egész napos eseménynél a végdátum kizáró.
5. Egy alkalomra kattintva szerkeszthető a neve, ideje és terme, vagy elrejthető. A jövőbeli alkalmak listájában jóváhagyható, melyek kapják meg a módosítást. Tömeges időmódosításnál a dátumok megmaradnak; dátumot egyenként módosíts.
6. A visszaállítás törli az alkalom helyi módosításait. Az elrejtett alkalmak a Beállításokban ismét megjeleníthetők. Kézi sorozat külön megerősítéssel teljesen törölhető.
7. Összehasonlításnál válassz profilt mindkét panelen. A szinkronlapozás bekapcsolása a bal/felső panel dátumát veszi át. A közös órák gyémántjelölést kapnak és külön szűrhetők.
8. A Beállításokban módosítható a téma és az A/B referencia. Az újraszámítás jóváhagyás előtt megmutatja a létrejövő, eltűnő alkalmak és elvesző felülírások számát.

A napi/heti nézet, dátumok, profilválasztás, kapcsolók, nagyítás és függőleges görgetés megmaradnak újranyitáskor. Nyitott párbeszéd és kitöltetlen űrlap nem áll vissza. A Ma gomb mindig visszavezet az aktuális napra. Szűk kijelzőn a két panel egymás alatt látható, a heti rács oldalra görgethető.

## UI-bekötés

Expo 57, React Native Reusables, NativeWind 4.2.7 és Tailwind 3.4. A meglévő generált komponenseket használjuk. A `tailwind-merge` 2.6 ága szükséges a Tailwind 3-hoz; ne frissítsd önállóan a 3-as főverzióra.

- `babel.config.js`: Expo preset és NativeWind JSX-transzformáció.
- `metro.config.js`: Expo Metro, NativeWind CSS, WASM asset és webes izolációs fejlécek.
- `tailwind.config.js`: teljes `src` feldolgozása, NativeWind preset, animációs plugin és a gyökérben lévő `tailwind.palette.js`.
- `src/global.css`: gyökérbeli `palette.css`, Tailwind-rétegek, világos/sötét szemantikus színek.
- `src/app/_layout.tsx`: egyetlen globális CSS-import, közös téma, gesztuskezelés és PortalHost.
- `src/lib/theme.ts`, a témasegédek és NativeWind ugyanazt a rendszer/kézi témát követik.

A paletta sötétkék, szürkéskék és törtfehér színei kapják a háttér, kártya, szöveg, keret és művelet szerepeket. A hibajelzés szemantikus vörös színt is használ. A rács egyedi komponens; az általános kezelőszervek Reusables elemek.

Dokumentáció: [NativeWind telepítés](https://www.nativewind.dev/docs/getting-started/installation), [Reusables kézi telepítés](https://reactnativereusables.com/docs/installation/manual), [Expo SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/).

## Adattárolás és import

A `src/domain` végzi a validálást, az ICS/JSON kibontását és az időkezelést. A `src/data` SQLite-ban tárolja a profilokat, eredeti forrásokat, kibontott alkalmakat, mezőnkénti felülírásokat és beállításokat. A `src/features` tartalmazza a felületet és az állapotkezelést.

Az import inaktív forrásverzióba ír, 100 alkalmas tranzakciókban. A forrás csak a teljes feldolgozás és jóváhagyás után vált aktívvá, egy tranzakcióban. Hiba vagy megszakítás nem cseréli le a korábbi órarendet. Az eredeti szöveg megmarad. A megszakadt folyamatok régi, inaktív adatai későbbi indításkor takaríthatók.

Az azonosság forráshely + eseményazonosító + eredeti előfordulás. Az egyező alkalmak csak módosított mezői maradnak felülírva forráscsere után. Az eltűnt alkalmak felülírása törlődik; visszatérésük új, felülírás nélküli alkalom. Az A/B referencia átállítása az érintett JSON-forrásokkal együtt, egy tranzakcióban történik.

A lekérdezés csak a kiválasztott profilok látható időszakára fut. A helyi felülírások hatályos időpontjai is indexeltek, így az áthelyezett alkalmak a megfelelő napon jelennek meg.

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

URL-import és frissítés, térképek és teremkiemelés, időalapú kezdőképernyő. Nincs bejelentkezés, felhős szinkron vagy beépített LLM. Az URL-frissítés megvalósítása előtt tisztázni kell a tényleges ICS-elérést és a böngészős hozzáférést; a jóváhagyott automatikus/kézi frissítési szabályokat akkor kell bekötni.
