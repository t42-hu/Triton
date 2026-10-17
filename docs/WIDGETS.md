# Triton42 – Mai nap widget

> Átadási állapot (2026-10-15): az implementáció és a célzott tesztek elkészültek, de a natív telepítés és a háromplatformos látható ellenőrzés még nincs kész. A funkció nem tekinthető teljesen átadottnak.

Ellenőrzés: a három közös widgetteszt és a három export/service-worker teszt sikeres; a TypeScript-ellenőrzés és az érintett fájlok lintje sikeres. A `build:triton` publikálva lett, a Next.js 3042-es portján a worker és a manifest HTTP 200 választ ad. A Safari Technology Preview képernyő-ellenőrzése időtúllépett. A közös iOS-stagingben eltűnő generált ReactCodegen-forrás miatt külön `/tmp/triton42-widget-build` staging készült. Az Android-build naplója `/tmp/triton-widget-android-limited.log`, az izolált iOS-előkészítésé `/tmp/triton-widget-isolated-pods.log`. Az iPhone és a Pixel 7 vezérlését más aktív agent-device munkamenet foglalta; a foglalásokat nem vettük át. Meglévő alkalmazásadatot nem töröltünk. Windows és valódi iPhone–Mac Continuity ellenőrzés nem történt.

A widget a sajátként kijelölt profil mai eseményeit mutatja az aktuális budapesti időponttól. Felül a dátum és a Most időjelzés jelenik meg; a folyamatban lévő esemény megmarad, a befejezett alkalmak eltűnnek. Az egész napos események éjfélig maradnak. Az üres nap külön üzenetet kap. Az események időpontja és terme is látható; a további alkalmak számát külön jelezzük.

## Elérhetőség

- Android: natív, átméretezhető kezdőképernyős widget. Hosszan nyomj a kezdőképernyőre, majd Widgetek → Triton42 → Mai nap.
- iPhone és iPad: WidgetKit widget, kis/közepes/nagy mérettel; iPaden extra nagy méret is elérhető. Kezdőképernyő szerkesztése → Widget hozzáadása → Triton42 → Mai nap. Először nyisd meg az appot a naptár betöltéséhez.
- macOS: az iPhone-widget használható az Apple Continuity támogatásával, azonos Apple-fiókkal és megfelelő rendszerbeállításokkal. Ez nem külön macOS-os Electron-widget. Valódi iPhone és Mac szükséges a teljes ellenőrzéséhez: https://support.apple.com/en-in/guide/mac-help/-mchl52be5da5/mac.
- Windows 11: PWA-manifest, Adaptive Card és service worker integráció a Windows Widgets panelhez. A webalkalmazást widgeteket támogató Windows/Edge környezetben kell telepíteni; az Electron-csomag nem regisztrál Windows-widgetet. A helyi fejlesztői teszt Microsoft-előfeltételeit lásd: https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/widgets. A Windows-változat tényleges telepítése és OS-szintű ellenőrzése külön Windows-gépet igényel.
- A hagyományos böngésző nem ad általános rendszerwidget-API-t. Linuxra jelenleg nincs implementált asztalikörnyezet-specifikus provider.

## Adatok és frissítés

A widget saját, legfeljebb nyolc naptári napos helyi pillanatképet kap az aktív forrásverziókból, a helyi szerkesztésekkel és elrejtésekkel együtt. Csak cím, időpont és terem kerül a snapshotba; nincs benne jegyzet, naptárlink, fiókazonosító vagy munkamenettoken. A widget működéséhez ez a szűkített adatkör az appon kívüli widgettárban is megmarad. Kijelentkezés és munkamenet-lejárat törli. Windows alatt csak widget-API-val rendelkező böngésző tárol pillanatképet; a worker nem fog el hálózati kéréseket és nem gyorsítótáraz oldalakat vagy API-válaszokat.

Megnyitás, adatváltozás és sikeres háttérszinkron publikálja a friss adatokat. WidgetKit előre megkapja az eseménykezdésekhez, befejezésekhez és éjfélhez tartozó idővonalat. Android natív órát és rendszer által ütemezett frissítést használ. Az iOS élő időjelzés óraváltáskor is korrigált. Windows a widget megnyitásakor, kézi frissítésekor, appbeli változáskor és engedélyezett periodikus háttérfutáskor frissül.

Az OS energiatakarékossága késleltetheti az eseményváltást és a frissítést. Windows alatt a megjelenített idő az utolsó widgetfrissítés ideje; nem másodpercenként futó óra. Nyolc nap után a widget az app megnyitását kéri, és nem mutat tegnapi eseményeket maiként. A távoli naptár új tartalma csak sikeres appszinkron után jelenik meg.

## Fejlesztés

A közös adatformátum: `frontend/universal/src/domain/widget.ts`. Az Android-provider helyi Expo-modul: `modules/triton-widget`. Az Apple-widget az Expo Widgets SDK 57 konfigurációs pluginjával készül, generált natív projekt kézi módosítása nélkül: https://docs.expo.dev/versions/v57.0.0/sdk/widgets/.

A Windows-fájlok a universal `public` könyvtárból kerülnek a Next.js `public/triton` exportjába. A `/widget-sw.js` Next.js útvonal gyökérhatókörrel szolgálja ki a workert. A manifestet a webexport publikálója kapcsolja az oldalhoz. A normál webes szinkron és autentikáció a widgettől független.
