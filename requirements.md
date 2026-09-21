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