# Adatbázis- és szinkronellenőrzés (2026-10-15)

## Tárolási határok

Az eredeti ellenőrzés óta tartós, fiókonként elkülönített SQLite-cache és offline szerkesztés készült. A mentés helyben tranzakcióban történik, majd automatikusan szinkronizál a szerverrel. A részletes működést és korlátokat az [OFFLINE_SYNC.md](OFFLINE_SYNC.md) írja le.

| Adat | Szerveres erőforrás |
| --- | --- |
| Profilok és saját profil | profiles, calendars, profile-calendars |
| Importált fájl teljes tartalma | calendar_source_content, /sync/commit contents |
| Link, automatikus frissítés, utolsó eredmény | sources, source-connections |
| Események, jegyzet, helyszín, kategória, elrejtés | events, overrides |
| Eseményhez tartozó feladatok, kész állapot | tasks |
| Tantárgyi jegyzetlinkek | notebook-links |
| Paletta, sorozat- és alkalomszínek | palettes, palette-colors, color-rules |
| Globális és alkalmi értesítési szabályok | reminder-settings, event-reminder-settings, reminder-rules |
| Téma, naptárnézet, hétvégék, A/B hét, változásértesítési kapcsoló | preferences |
| Eszköz nézete, nagyítás, megnyitott profilok, helyi ütemezési állapot | device-preferences |

A rendszerengedélyek, értesítési csatornák és a ténylegesen ütemezett OS-értesítések készülékfüggők. Ezeket egy másik platform adatbázisértéke nem helyettesítheti. A belépési token a natív biztonságos tárolóban, weben a munkamenet-cookie-ban marad; nem kerül munkaterületi beállítások közé.

A szinkron megnyitáskor, előtérbe kerüléskor és aktív állapotban 15 másodpercenként fut. A helyi adatváltoztatás után automatikus szerveres commit indul; offline a változtatás tartósan az eszközön marad. A verzióellenőrzés elutasítja az ütköző módosításokat; nem írja felül csendben a másik kliens változtatását. Ez időszakos frissítés, nem websocketes azonnali együttszerkesztés.

## Javítás

A `changeNotifications` korábban a készülék `viewState.accountSettings` mezőjében volt. Most a meglévő fiókszintű `preferences.changeNotifications` mezőbe kerül, így web, Android és iOS között átadható. A régi készülékértéket a kliens egyszer átemeli, majd eltávolítja a készülékmásolatból. A készülékfüggő ütemezési állapot nem költözik más platformra.

A kiadási Dockerfile-okból hiányzott a workspace-ben hivatkozott `patches` könyvtár bemásolása; ez már a függőségtelepítést megakasztotta. A web/backend fejlesztői és kiadási buildje is megkapja a könyvtárat.

## Ellenőrzés

- Universal tesztek: 120/120 sikeres; ezek között háromplatformos visszaállítás, régi beállítás migrációja, törlési sorrend, verzióütközéshez tartozó mutációk, mentési hiba visszagörgetése és fiókelkülönítés.
- Universal TypeScript-ellenőrzés sikeres.
- A teljes universal lint a már módosított auth-screen.tsx és auth-state.tsx fájlokban 8 hibát jelzett; a szinkronjavítás ezeket nem módosítja. A módosított szinkronfájlok és az új HTTP-teszt célzott lintje sikeres.
- Az elkülönített API/PostgreSQL-integrációs futás nem fejeződött be: a Docker virtuális lemeze megtelt (ENOSPC). Ez nem sikeres integrációs eredmény. A buildcache és nem használt image-ek takarítása nem töröl adatbázis-volume-ot.

- A helyreállított fejlesztői PostgreSQL-en a workspace commit HTTP-integrációs teszt sikeres, külön ideiglenes felhasználókkal és teljes takarítással.
- Új háromplatformos HTTP/PostgreSQL-teszt sikeres: webes mentés Android/iOS snapshotban, androidos módosítás web/iOS snapshotban, elavult iOS-módosítás 409-es elutasítása, idempotens újraküldés, lapozott snapshot és ack, törlés átadása mindhárom eszközre. A teszt az általános API-integrációs futásba is bekötve.
- A meglévő adatbázisban 15 aktív profil, 21 forrás, 1351 esemény, 16 felülírás és 3 jegyzetlink volt az ellenőrzéskor. 18 forrás nyers tartalma közvetlenül a tartalomtáblában található; a további 3-hoz aktív, aktuális fájlrevízió tartozik a szerver tárhelyén (a content endpoint támogatja ennek visszaolvasását). A tárhelyobjektumok bájtonkénti épségét ez a lekérdezés nem ellenőrzi.
- Friss webexport publikálva a Next.js alkalmazásba. Az Android release és az iOS release elkészült és adatürítés nélkül települt a meglévő Pixel 7 / iPhone eszközre. A Device panelek nyitva vannak. Mindkét mobilon az offline hidegindítás és a helyi próbaadat automatikus DB-feltöltése is igazolt. Androidon a webes fiók van belépve; iOS-en még egy korábbi tesztfiók, ezért a saját fiókkal végzett teljes élő háromplatformos kör függőben van. A Gboardot visszaállítottuk. Részletek: [OFFLINE_SYNC.md](./OFFLINE_SYNC.md).

Az élő platformellenőrzés eredményét a feladat végső jelentése egészíti ki. A tesztek nem bizonyítják önmagukban minden meglévő felhasználói rekord hiánytalanságát.
