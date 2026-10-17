# Offline használat és visszaszinkronizálás

Az első bejelentkezéshez és az adatok első letöltéséhez internet kell. Ezután Androidon és iOS-en a letöltött órarend az app teljes újraindítása után is megnyitható és szerkeszthető internet nélkül.

A profilok, események, felülírások, feladatok, jegyzetlinkek, emlékeztető-szabályok és beállítások fiókonként külön SQLite-fájlban maradnak az eszközön. A helyi módosítás és törlés SQLite-tranzakcióban mentődik; nem kell megvárnia a feltöltést. A távoli naptár linkjének frissítése, az új bejelentkezés és a fiókbiztonsági műveletek továbbra is internetet igényelnek.

A korábban hitelesített natív fiók azonosítója a meglévő munkamenet-token mellett a biztonságos tárolóban marad. Offline hozzáférés csak megtartott tokennel nyílik. A szerver által elutasított vagy lejárt munkamenet nem használhatja a hálózati hibára fenntartott visszaállítást; új online belépés kell. A még fel nem töltött munkaterület ilyenkor is megmarad a fiókfájlban.

Helyi módosítás után automatikus feltöltés indul. Előtérbe kerüléskor és aktív appban 15 másodpercenként újra próbálkozunk, majd átveszünk minden elérhető szerveres változást. A párhuzamos előtéri/naptárfrissítési kérések ugyanazt a szinkronfutást használják. A háttérben történő futást az operációs rendszer ütemezése korlátozza; bezárt appnál nincs azonnali szinkrongarancia.

Az utolsó szerverállapot, a helyi eltérések és az elküldött, de még vissza nem igazolt csomag tartósan megmarad. Elveszett válasz esetén a kliens ugyanazokat a mutációazonosítókat és ugyanazt a fájltartalmat küldi újra; az azóta készült helyi változtatás külön következő feltöltésben megy. A szerver a fájltartalom írása utáni végső verziószámot tárolja az újraküldési nyugtában.

Verzióütközéskor nem írjuk felül csendben a másik eszköz változtatását. A helyi adatok megmaradnak, a Fiók panel választást ad a helyi vagy szerveres változatra. A szerveres változat választása előtt a helyi munkaterületről biztonsági másolat kerül a fiókfájl `cloudConflictBackup` beállításába. Az „Adatok frissítése” önmagában nem dobja el a helyi módosításokat.

A webes kliens is tartós fiókcache-t és ugyanazt a szinkronprotokollt használja. Már betöltött webes alkalmazásban hálózat nélkül is működnek a helyi adatműveletek. A teljes böngészőoldal internet nélküli hidegindításához külön alkalmazáshéj-cache szükséges; ezt ez a változtatás nem vezeti be. A privát böngészés vagy a böngésző tárhelykorlátozása a webes tartósságot korlátozhatja.

## Ellenőrzés

- A teljes universal csomag 130 tesztje sikeres volt a megvalósítás során.
- A végső helyi tárolási és munkamenettesztek valódi ideiglenes SQLite-fájlokat zárnak be és nyitnak újra, ellenőrzik a fiókelkülönítést, tranzakciós visszagörgetést és az ismételt értesítési/szinkronhurkok elkerülését.
- A végső offline szinkronprotokoll-tesztek ellenőrzik a visszacsatlakozást másik platform módosításai mellett, a párhuzamos szinkron összevonását, az elveszett feltöltési válasz újraküldését újabb fájlszerkesztés mellett, az ütközés megőrzését és az offline törlés átadását másik platformra.
- A valódi PostgreSQL/HTTP-integrációs teszt igazolja, hogy a fájltartalmat is tartalmazó commit ismétlése a végső forrásverziót adja vissza.

A friss webes alkalmazás a valódi Next.js-kiszolgálón, Safari Technology Preview-ban betöltött órarendet mutatott. Az Android release adatürítés nélkül települt; a rendszer-ANR miatt a meglévő Pixel 7 újraindult, a Gboard visszaállítva. A végső Android-fiókazonosság egyezik a Safari Technology Preview-ban használt fiókkal. Wi-Fi és mobiladat letiltása után az önálló release-csomag teljes leállítást követően is megnyitotta a mentett órarendet és az offline jelzést. Az offline létrehozott tesztprofil a helyi fájlban megmaradt, és visszakapcsolódás után megjelent a PostgreSQL-ben. A hálózat és a Gboard visszaállítva. A teszt során párhuzamosan debug build is visszakerült a készülékre; az offline hidegindítást végül közvetlen adb-műveletekkel, nem debuggable release-csomagon igazoltuk.

Az iOS release adatürítés nélkül települt és a meglévő fiókkal megnyílt. Rövid API-kiesés alatt a teljesen leállított, majd újraindított app a helyi órarendet betöltötte. A backend minden próbánál automatikusan visszaállt. Az API-kiesés alatt létrehozott ideiglenes profil teljes app-újraindítás után is megmaradt, majd a kapcsolat helyreállásakor automatikusan megjelent a PostgreSQL `schedule_profile` táblájában. A próbaadatot az ellenőrzés után eltávolítottuk. Az iPhone-on egy korábbi tesztfiók van belépve, míg a weben és Androidon a felhasználó saját fiókja. Emiatt a felhasználó saját fiókjával végzett háromplatformos élő kör még bejelentkezésre vár.

A szimulátoros build saját Xcode-aláírását kell megtartani. A generált `*-Simulated.xcent` tartalmának utólagos bemásolása a kódaláírásba ezen a Macen provisioning-profile hibával megakadályozza az indítást; az ilyen utólagos aláírási lépést eltávolítottuk. Az eredeti szimulátoros kódaláírással az app elindult és nem naplózott Keychain-jogosultsági hibát.
