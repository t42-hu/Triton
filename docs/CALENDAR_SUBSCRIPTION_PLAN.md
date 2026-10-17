# Szerveroldali naptárfrissítés — megvalósítási terv

Állapot: megvalósítva a jelenlegi munkafában, 2026-10-15. Az alábbi terv eredeti döntéseit és a dokumentum végén a tényleges ellenőrzési eredményeket is rögzítjük.

## Elvárt működés

A külső naptárak akkor is frissüljenek, ha a tulajdonos összes alkalmazása zárva van. A megosztási link a szerveren tárolt legutóbbi sikeres állapotot adja. Hálózati hiba esetén a korábbi események megmaradnak, a késés látható és mérhető. A külső szolgáltatások rendelkezésre állása és a más gyártók naptárklienseinek lekérdezési ideje nem garantálható.

## 1. A szerver kezelje az előfizetéseket

- A PostgreSQL legyen az előfizetések, sikeres tartalomverziók és frissítési állapotok hiteles tárolója.
- A meglévő `calendar_source_connection` kapjon `next_attempt_at`, `etag`, `last_modified`, `consecutive_failures`, `lease_until`, `lease_token` és kapcsolati generáció mezőket. A meglévő utolsó próbálkozás/siker/hiba mezők megmaradnak.
- Percenként ébredő, párhuzamosan biztonságosan futtatható szerveres feldolgozó foglaljon esedékes forrásokat rövid `FOR UPDATE SKIP LOCKED` tranzakcióval. A letöltés a tranzakción kívül történjen; a lejáró foglalás összeomlás után is engedje az újrapróbálkozást.
- Kezdetben 15 perces sikeres ellenőrzési periódus kis véletlen eltolással. A saját Triton-megosztások változásai közvetlenül, a következő feldolgozási körben továbbadhatók. Később WageTrackr webhorgony gyorsíthat, de a lekérdezés maradjon javító mechanizmus.
- Az ütemezés és a foglalás PostgreSQL-alapú legyen, így Redis-hiba nem állítja le. A már meglévő BullMQ később gyorsíthatja az ébresztést, de a feladat esedékességét nem kizárólag Redisben tároljuk.

## 2. Egyetlen letöltési és importálási útvonal

- A tiszta ICS-feldolgozást közös, platformfüggetlen modulba kell kiemelni. A szerver és a kliensek ugyanazokat az időzóna-, ismétlődés-, kivétel- és kategóriaszabályokat használják.
- Feltételes HTTP-letöltés `ETag`/`Last-Modified` használatával. A 304 sikeres ellenőrzés, eseményújraírás nélkül. Hash-összehasonlítás előzze meg az újrafeldolgozást.
- Szerveroldali URL-ellenőrzés: HTTPS, idő- és méretkorlát, átirányítások és minden célcím DNS/IP-ellenőrzése. Privát, loopback, link-local és infrastruktúra-végpontok kizárása; a DNS-ellenőrzés és a tényleges kapcsolat ne válhasson szét.
- Stabil eseményazonosítás a forrás és az ICS UID + eredeti előfordulásazonosító alapján. A helyi felülírások, feladatok és emlékeztetők a meglévő eseményhez kapcsolva maradnak.
- Új verzió előkészítése, majd atomikus publikálás a meglévő esemény- és szinkronváltozás-rendszeren keresztül. A kapcsolat generációjának és a forrás verziójának ellenőrzése akadályozza meg a leválasztott vagy időközben módosított forrás késői felülírását.
- Gördülő feldolgozási időablak; a jövőbeli tartomány rendszeresen bővül. A feldolgozási ablakból kikerülés önmagában nem jelent upstream törlést. Az eredeti ICS és a történeti megőrzési szabály külön marad.

## 3. Törlés és hibakezelés

- A szabályos, teljesen letöltött és validált üres VCALENDAR érvényes új állapot: az utolsó esemény törlésének is át kell jutnia.
- HTML bejelentkezési oldal, csonka letöltés, parse-hiba, 401/403/404/410 vagy hálózati hiba nem üríti ki a naptárt. A visszavont link külön hibás/visszavont állapotot kap.
- Hibánál növekvő újrapróbálkozási idő, felső korláttal és `Retry-After` figyelembevételével. Egy hibás forrás ne akadályozza a többit.
- Állapotként külön jelenjen meg az utolsó sikeres ellenőrzés, az utolsó tartalmi változás és az aktuális hiba. A tárolt események megléte nem jelent sikeres frissítést.

## 4. Megosztás és kliensek

- A nyilvános ICS-kérés az utolsó sikeres szerververziót adja. Ne indítson kötelező, blokkoló upstream letöltési láncot minden látogatónál.
- A megosztott események UID-ja stabil; `DTSTAMP`/`LAST-MODIFIED` a publikált módosításhoz kötött, `SEQUENCE` tényleges változáskor nő. A HTTP ETag is a megosztás tartalomverziójából származik.
- A helyi kliensek a szervertől kapják a friss importált eseményeket. A háttérben letöltött import alapadatait csak a szerver írja; a kliens felülírásokat írhat. Ezzel megszűnik a több eszközön végzett párhuzamos upstream frissítés és az elavult kliensből visszatöltés.
- A szerveren belüli Triton-linkeknél valódi függőség és változásjelzés legyen: új publikáció után a jogosult függő importok esedékessé válnak. Ciklusok és korlátlan láncok tiltása, meglévő megosztási kiválasztás/jogosultság/visszavonás betartásával.
- A kézi frissítés ugyanazt a szerveres folyamatot kéri, deduplikálva. A kliens a feldolgozás állapotát és eredményét mutatja.
- Külső naptárkliensek saját ellenőrzési gyakorisággal dolgoznak; egy egyszeri ICS-fájlimport nem előfizetés.

## 5. Redis és infrastruktúra

A korábbi WageTrackr-hiba pontos üzenete: `MISCONF Errors writing to the AOF file: No space left on device`. A globális rate limiter Redisben ír, ezért a hiba a naptárletöltést is elérte még az ICS előállítása előtt.

Az új vizsgálat mérései:

- Docker Desktop context: `desktop-linux`; konfigurált virtuális lemez: 50 GiB.
- A Redis `/data` névvel ellátott Docker-volume-on van. A mögöttes `/dev/vda1` jelenleg 49,0 GiB, ebből 29,9 GiB foglalt, 16,6 GiB szabad; az inode-ok 40%-a foglalt.
- A macOS adatlemezen körülbelül 127 GiB szabad. Ez külön kapacitás a Docker virtuális lemezének belső szabad helyétől.
- Redis memória: kb. 1,25 MiB; AOF: kb. 30 MB. Jelenleg `aof_last_write_status:ok`, `rdb_last_bgsave_status:ok`, `PING → PONG`.
- A publikus WageTrackr tesztfeed ismét HTTP 200, érvényes VCALENDAR.
- A Redis-konténer nem indult újra. A korábbi hiba lemezírási helyhiányt bizonyít, a betöltő konkrét fájlt/konténert nem. A köztes felszabadítás oka ebből a vizsgálatból nem állapítható meg. Ebben a körben nem történt takarítás vagy konfigurációmódosítás.

Javasolt intézkedések:

1. Docker-volume-ok és építési csúcsterhelés felmérése után az 50 GiB-os limit emelése, például 80 GiB-ra, a host számára is tartalékot hagyva. A névvel ellátott adatbázis- és Redis-volume-okat meg kell őrizni.
2. Forgatott konténernaplók, korlátozott buildcache-megőrzés és dokumentált takarítás. Volume-ot automatikus általános prune ne töröljön.
3. Szabad hely és inode figyelése a Docker-lemezen; figyelmeztetés 75%, kritikus 85% körül, abszolút szabadhely-korláttal is. Redis AOF/RDB írási állapot külön riasztás.
4. A Redis healthcheck a tényleges `PONG` választ ellenőrizze. A jelenlegi `redis-cli ping` egyszerű folyamatkilépése korábban MISCONF üzenet mellett is sikeresnek látszott. Readiness az írási állapotot is ellenőrizze, a liveness maradjon külön.
5. A nyilvános aláírt ICS-letöltéshez Redis-kieséskor korlátozott, folyamatonkénti vészhelyzeti rate limiter tervezendő; az autentikációs és jogosultsági ellenőrzések megmaradnak. Több példánynál a helyi limit összeadódását figyelembe kell venni. Hitelesítéshez kapcsolódó limitnél ettől külön hibakezelés szükséges.
6. AOF és adatvédelem megőrzése. A tartósság kikapcsolása nem javítja meg a tárhelyproblémát.

## 6. Megvalósítási sorrend és elfogadás

1. Tárhely- és Redis-healthcheck javítás, megfigyelhetőség.
2. Közös parser, PostgreSQL foglalás/ütemezés és biztonságos szerveres letöltés.
3. Atomikus importpublikálás, üres feed és törlések, megosztások érvénytelenítése.
4. Kliensek áttérése a szerver által kezelt importokra, fokozatos bekapcsolás a meglévő kapcsolatok megőrzésével.
5. Éles WageTrackr-teszt: minden tulajdonosi kliens zárva, új/módosított/törölt/utolsóként törölt műszak. A szerver és a címzett a frissítési határidőn belül ugyanazt az állapotot mutassa.
6. 304, timeout, hibás ICS, lejárt link, Redis-kiesés, worker-összeomlás, több worker, leválasztás közbeni letöltés és párhuzamos szerkesztés tesztelése. Régi adatok megőrzése hibánál és stabil UID/felülírás vizsgálata.
7. Safari Technology Preview, telepített Pixel 7 és meglévő iOS-szimulátor végigtesztelése látható ablakokkal és T3 Device panelekkel, alkalmazásadatok törlése nélkül.

Hivatalos háttér: [Docker Desktop tárhelybeállítások](https://docs.docker.com/desktop/settings-and-maintenance/settings/), [Docker Desktop Mac lemezkép](https://docs.docker.com/desktop/troubleshoot-and-support/faqs/macfaqs/), [Redis persistence](https://redis.io/docs/latest/management/persistence/).


## Megvalósítás és ellenőrzés

A `CalendarSubscriptions` PostgreSQL-alapú worker 10 másodpercenként keresi az esedékes munkákat, egyszerre legfeljebb öt letöltéssel. Siker után 15 perc + legfeljebb 30 másodperc szórás a következő ellenőrzés. A foglalás két perc után újrafelvehető; URL-csere és leválasztás érvényteleníti a korábbi eredményt. A migráció a meglévő linkeket szétterített kezdéssel veszi át.

A biztonságos HTTPS-letöltés legfeljebb 30 másodperc és 1 MB, az import legfeljebb 5000 előfordulás. DNS-ellenőrzés után a tényleges kapcsolat az ellenőrzött publikus IP-hez kötött. A közös ICS-parser a weben és a szerveren ugyanaz; a szerver a szabályos üres naptárat is publikálja. A jövőbeli feldolgozási tartomány automatikusan bővül.

A kliensek a szervertől kérnek ellenőrzést, majd a fiókszinkronnal veszik át az eredményt. Az import alapadatait a worker írja; a felülírások továbbra is felhasználói adatok. A megosztási függőségek változáskor esedékessé válnak. A publikus ICS stabil UID-t, módosítási dátumot, SEQUENCE-t és HTTP ETag-et használ; a változatlan feltételes kérés 304-et kap.

A valódi WageTrackr-tesztben nem volt nyitott tulajdonosi kliens. Az automatikus szerveres időzítő letöltötte a HTTPS-feedet, majd a módosítás, új műszak, törlés és az utolsó műszak törlése a Triton-megosztáson át eljutott a címzett szerveres importjába. A tesztben kizárólag a várakozási idő rövidítésére állítottuk előre a tesztforrás esedékességét; az importot a futó backend időzítője végezte. A publikus megosztás ETag/304 ellenőrzése is sikeres. A kért WageTrackr-fiókot és egy szintetikus műszakot megtartottuk, a külön Triton-tesztadatokat eltávolítottuk.

Ellenőrzések: 130 univerzális teszt; 44 sikeres backendteszt, 2 meglévő kihagyással; külön PostgreSQL-integráció foglalásra, 304-re, felülírásokra, elavult kliensre, címzetti továbbadásra, üres feedre, hibára, visszavonásra, leválasztásra és ciklusra. A backend Docker-környezetben végzett TypeScript-ellenőrzése sikeres. A hoston egy későbbi ellenőrzés memóriahatárba ütközött; ez külön fejlesztőkörnyezeti korlát, nem a frissítőfolyamat mért memóriafogyasztása. A frontend TypeScript- és lint-ellenőrzése, a célzott backend lint, az infrastruktúra-tesztek és az OpenAPI/generált kliens ellenőrzése is sikeres.

A migrációk előtt adatbázismentés készült. A backend és a Redis frissítve, az AOF megmaradt. A Redis healthcheck a PONG mellett az AOF/RDB állapotát is vizsgálja; a konténernaplók forgatottak. A worker 75/85 százalékos telítettség és alacsony szabad hely/inode esetén figyelmeztető/hibanaplót ad. A publikus aláírt naptárletöltés Redis-hibánál korlátozott, rövid megszakítóval védett helyi rate limiterre vált; a bejelentkezési útvonalak nem kapnak ilyen feloldást. A Docker Desktop teljes újraindítását és globális lemezkeretének módosítását nem végeztük el a többi aktív projekt mellett.

A webes export publikálva a Next.js alkalmazásba. Android release build elkészült, a meglévő Pixel 7 AVD-re települt. Az izolált iOS release build a meglévő iPhone-szimulátorra települt, és elindult; a meglévő fiók és órarend betöltését a Device panel képe igazolta. Az alkalmazásadatok megmaradtak. A felhasználó engedélyezte a kulcskarika-hozzáférést, de a készülékes jogosultságokkal aláírt csomagot a szimulátor provisioning profil hiányában elutasította. A sikeres indítást a szimulátorhoz fordított bináris saját, Xcode által generált szimulátoros jogosultságaival és üres aláírási entitlement-fájljával állítottuk helyre. A teljes felhasználói felület elfogadási próbáját a párhuzamos Safari- és Device-munkamenetek korlátozták; az API-s végigteszt és az indulási ellenőrzés nem helyettesíti ezeket. Külön natív Simulator-ablak vezérlése sem volt elérhető az automatizálási eszközben; a T3 Device panel nyitva maradt.

Utolsó szerveres állapotellenőrzés: a hét meglévő előfizetés mindegyikén volt sikeres ellenőrzés, hibás állapotú előfizetés nem volt. A WageTrackr tesztfeed ismételt letöltése HTTP 200-as érvényes naptárat adott.
