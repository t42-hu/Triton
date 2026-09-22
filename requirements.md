> **Triton – jóváhagyott pontosítás, 2026-09-22:** Mobile-first Expo 57, React Native Reusables, NativeWind 4.2.7, Tailwind 3.4 és helyi SQLite. Saját profilhoz HTTPS/webcal ICS-link, mobilon előtérben 15 perces cooldown és OS által ütemezett háttérfrissítés, külön engedélyezhető helyi változásértesítés. Mások órarendje statikus ICS/JSON-import. Weben egyszeri linkimport, CORS-hibánál letöltés + fájlimport; nincs automatikus polling, proxy vagy alkalmazásszerver. Hibánál az utolsó sikeres órarend megmarad. A privát link és a valódi tesztadat nem része a kiadott alkalmazásnak. A név Triton, a fő szín az Óbudai Egyetem logójából vett kék; light/dark/system téma megmarad.
>
> **Jóváhagyott első kiadás – 2026-09-21:** Expo 57, React Native Reusables, NativeWind 4.2.7, Tailwind 3.4 és SQLite. Az alábbi eredeti specifikáció a későbbi fázisokat is tartalmazza; az első kiadás hatókörét az alábbi pontosítás rögzíti.
>
> Első kiadás: üres kezdőállapot; elnevezett helyi profilok, egy saját profil, profilonként egy cserélhető ICS/JSON-forrás és kézi órák; teljes import vagy változatlan korábbi adatok; megőrzött eredeti forrás és offline tartománybővítés; A/B heti ismétlődés közös hétfői referenciával; alkalmonkénti és jóváhagyott jövőbeli mezőfelülírások, visszaállítás és elrejtés; Budapest szerinti idő; napi/heti rács, nagyítás, egész napos/többnapos események; reszponzív összehasonlítás, szinkronlapozás, közösóra-jelölés és szűrés; nézetállapot-megőrzés; rendszer/világos/sötét téma a megadott palettával. Valódi mintafájl nem kerül a kiadásba.
>
> Közös óra: azonos látható név, kezdés, befejezés és azonos, nem üres terem, elrejtett alkalmak nélkül. A felülírás csak a módosított mezőkre vonatkozik; forrásból eltűnéskor törlődik. Tartományszűkítés nem töröl korábban importált alkalmat. Tömeges időmódosítás megőrzi az érintett dátumokat; később importált alkalom nem örökli automatikusan.
>
> Későbbi fázis: térkép és modulok közötti térképes navigáció, időalapú kezdőképernyő. Nincs fiókrendszer vagy eszközök közötti szinkronizáció. Weben offline indítás nem követelmény.
>
> Elfogadási cél: 15 × 15 000 alkalom mellett legfeljebb 2 s indulás és 200 ms hét-/profilváltás és szűrés kiadási buildben, iPhone SE 2020 és régebbi 3–4 GB RAM-os Android eszközön. Ezek eszközös mérés nélkül nem tekinthetők igazoltnak. A felhasználó webes és a saját MacBookján iOS-/Android-szimulátoros tesztelést kért; commit és push nélkül.
>
> [Használat és UI-beállítás](docs/app.md) · [Importformátum és példák](docs/import-format.md) · [Fogalomtár](CONTEXT.md) · [Ellenőrzési eredmények](docs/validation.md)

Íme a hangfelvétel alapján készített, strukturált és átlátható projekt specifikáció (követelményrendszer). Ezt a leírást már könnyedén használhatod fejlesztési útmutatóként vagy kiadhatod egy fejlesztőcsapatnak.

---

# Projekt Specifikáció: Egyetemi Órarend és Térkép Alkalmazás

## 1. A projekt célja
Egy iOS és Android platformokon futó mobilalkalmazás fejlesztése, amely megkönnyíti az egyetemi hallgatók számára az órarendek kezelését, a csoporttársak órarendjeinek összehasonlítását, valamint a termek megtalálását egy beépített, egyedi térképnézegető segítségével.

## 2. Technológiai megfontolások (Keretrendszer)
*   **Elsődleges preferencica:** **React Native (Expo)**, amennyiben a teljesítménye megfelelő, mivel a megrendelő/fejlesztő ehhez jobban ért.
*   **Alternatíva:** **Flutter**, abban az esetben, ha a React Native Expo teljesítménye jelentősen elmaradna a kívánt szinttől.
*   **Lokális adatbázis:** A kliensoldali perzisztenciához **SQLite** használata kötelező.
*   **Célplatformok:** Az alkalmazás fusson böngészőben, iOS-en és Androidon is (Expo környezetben).
*   **Offline működés telefonon:** iOS és Android eszközökön internetkapcsolat nélkül is használhatónak kell lennie az órarend funkcióknak.

## 3. Fő modulok és Funkciók

### 3.1. Órarend Kezelő Modul
*   **Adatimportálás és Értelmezés:**
    *   **Offline ICS betöltés:** Alapértelmezett ICS fájlok helyi (offline) beolvasása és értelmezése (napokra és hetekre lebontva).
    *   Referencia mintaformátum: `NeptunCalendarExport.ics`.
    *   **Online ICS betöltés:** Legyen lehetőség URL-alapú, online ICS forrás betöltésére és frissítésére.
    *   **Fallback és cache logika:** Ha az online ICS forrás nem elérhető, az alkalmazás automatikusan a legutóbb lokálisan elérhető verziót használja. Az online ICS tartalmát cache-elni kell a lokális **SQLite** adatbázisban.
    *   Rugalmas adatkezelés: lehetőség egyedi, akár nyelvi modell (LLM) által generált strukturált fájlok importálására is.
    *   Több különböző órarend egyidejű tárolása (pl. saját, és különböző szaktársak órarendjei).
    *   Egyedi elnevezések biztosítása az importált fájlokhoz/felhasználókhoz.
*   **Megjelenítés és Interakció:**
    *   Nagyítási és kicsinyítési (zoom) lehetőség a nézetben.
    *   Részletes nézet: egy adott órára kattintva felugró ablak/kártya (details) jelenik meg az óra adataival (különös tekintettel a **terem számára**).
    *   **Egyedi órabeszúrás:** Lehetőség manuálisan, egyedileg új óra felvitelére (pl. óra neve, időpontja, helyszíne/terme), amely az órarendben ugyanúgy megjelenik, mint az importált elemek.
*   **Összehasonlító Mód (Side-by-side):**
    *   Fekvő nézetben a képernyő kettéosztása, két különböző személy órarendjének egymás melletti megjelenítése.
    *   Mindkét oldalon legördülő listából (dropdown) választható ki a megjeleníteni kívánt személy.
    *   **Közös órák funkció:** Két kiválasztott személy esetén az alkalmazás mutassa meg a közös óráikat.
    *   **Lapozás és szinkronizáció:** Kapcsoló (toggle switch) segítségével állítható, hogy a két oldal egyszerre (szinkronban) vagy egymástól függetlenül lapozódjon az időben.
    *   **Pozíciótartás:** Ha a felhasználó egy adott napnál/hétnél átállítja az egyik oldalon a személyt, az órarend nem ugrik vissza alaphelyzetbe, hanem az aktuális időpozíción mutatja az új személy beosztását.

### 3.2. Térkép és Navigációs Modul
*   **Jelenlegi státusz:** Ezzel a modullal egyelőre nem kell foglalkozni; a megvalósítása későbbi fázisban történik.
*   **Térkép jelleg:** Nem egy teljes Google Maps implementáció, hanem egy "okos", kiemelésekkel (highlight) ellátott képnézegető, amely az egyetem alaprajzaira épül.
*   **Struktúra:** Az alkalmazásnak kezelnie kell a különböző épületeket és a bennük lévő emeleteket. A felületen mindig egyértelműen látszania kell, hogy éppen melyik épület melyik emeletét nézi a felhasználó.
*   **Kereső funkció:**
    *   Keresősáv a térképnézet tetején.
    *   Valós idejű javaslatok (autocomplete) gépelés közben (teremnevek, teremszámok).
    *   Enter megnyomására a legrelevánsabb találatok listázása a térkép alatt.
    *   Találatra kattintáskor a lista alatti térképen a terem kiemelésre kerül.
    *   A lista bezárása után a térkép teljes képernyőre vált, a kiválasztott terem továbbra is kiemelve marad.

### 3.3. Integráció a két modul között
*   Ha a felhasználó az **Órarend nézetben** rákattint egy órára, majd azon belül a teremre, az alkalmazás automatikusan átnavigál a **Térkép nézetre**.
*   A térképen azonnal megnyílik a megfelelő épület és emelet, az adott terem pedig vizuálisan kiemelve (highlightolva) jelenik meg.

## 4. Indítási viselkedés (Állapotkezelés és Okos routing)
Az alkalmazás megnyitásakor a betöltődő kezdőképernyő rugalmasan konfigurálható, akár időhöz is köthető:
*   **Időalapú logika (Opcionális/Szoftveres preferencia):** Pl. munkanapokon 08:00 és 16:00 között megnyitva az alkalmazás automatikusan a **saját órarendet** tölti be.
*   **Állapot megőrzése:** Egyéb időszakokban (vagy alternatív beállításként) az alkalmazás pontosan ott nyílik meg, és azt a személyt/nézetet mutatja, **ahol a felhasználó legutóbb bezárta** azt (Last visited state).

## 5. Szükséges külső erőforrások (Előkészítendő anyagok)
*   Az egyetem releváns épületeinek és emeleteinek alaprajzai (kép formátumban).
*   A képekhez tartozó koordináta/terület adatok (mapping), amelyek alapján a szoftver azonosítani és kiemelni (highlight) tudja az egyes termeket a képen.

## 6. UI téma és vizuális követelmények
*   Az alkalmazásnak kötelezően támogatnia kell a **dark mode** és **light mode** megjelenítést.
*   Az alkalmazás vizuális stílusa a következő palettára kell épüljön: `#0D1B2A`, `#1B263B`, `#415A77`, `#778DA9`, `#E0E1DD`.
*   A fenti színpaletta forrása: https://freecolorpalettes.co/palette/palette-0d1b2a-mlsssm2g
*   A palettát a projektben a `palette.css` és a `tailwind.palette.js` fájlokba betöltve kell kezelni és használni.
