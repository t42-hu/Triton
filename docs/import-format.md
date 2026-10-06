# Importformátumok

A fájl kiválasztása vagy a tartalom beillesztése után a felhasználó határozza meg az importtartományt. Egy hiba az egész cserét megakadályozza. A kiválasztott fájl legfeljebb 50 MB, az ismétlődés kibontása legfeljebb kétmillió ellenőrzött lépés lehet.

## JSON v1

Gyökér: `version: 1`, `events` tömb. Az `id` egy forráson belül egyedi, nem üres szöveg; a `title` nem üres szöveg. A `location` opcionális szöveg. Az üres eseménylista érvényes, és jóváhagyott cserekor kiüríti az importforrást.

| Mező | Jelentés |
| --- | --- |
| `kind: "timed"` | `start` és `end`: eltolásos ISO-időpont, például `2026-09-21T08:00:00+02:00`, vagy UTC `Z` |
| `kind: "allDay"` | `start` és `end`: `YYYY-MM-DD`; a végdátum nem része az eseménynek |
| `recurrence.frequency` | Kizárólag `weekly` |
| `recurrence.weeks` | `all`, `A` vagy `B` |
| `recurrence.until` | Utolsó engedélyezett kezdőnap, beleértve ezt a napot is |

Ismétlődés nélkül az esemény egyszeri. Ismétlődéskor a Budapest szerinti hét napja és falióra-idő marad állandó az óraátállításokon át; A/B esetén csak a közös referenciának megfelelő hetek kerülnek be. Az esemény nem kezdődhet a megadott kezdőnap előtt. A befejezés a kezdés után legyen. A tavaszi óraátállításkor nem létező helyi idő hiba; az ősszel kétszer előforduló helyi időnél az első előfordulást használjuk.

Példák: [timetable.json](examples/timetable.json) egyszeri, heti, A/B és többnapos egész napos eseménnyel. A `start` eltolását mindig a tényleges dátumhoz válaszd; ne cseréld automatikusan minden dátumnál `+02:00`-ra.

Duplikált azonosító, érvénytelen dátum, időzóna nélküli időzített érték, hibás időtartam vagy ismeretlen ismétlődési mód esetén nincs részleges import. A JSON-t külső eszköz vagy LLM is előállíthatja; az alkalmazás ugyanezt a validálást végzi rajta.

## ICS

Az `ical.js` dolgozza fel a VCALENDAR/VEVENT adatokat, többek között az RRULE, RDATE, EXDATE és RECURRENCE-ID kivételeket. Az eseménynek UID, DTSTART és név kell; kivétel a sorozat nevét örökölheti. A DTEND és DURATION együtt érvénytelen. A megszüntetett alkalmak nem jelennek meg.

UTC és lebegő időpontok, egész napos és többnapos események támogatottak. A lebegő idő Budapest szerint értendő. Névvel megadott TZID esetén a fájl tartalmazza a megfelelő VTIMEZONE definíciót; hiányzó definíciónál az app hibát jelez, nem találja ki az időzónát. Ismétlődési kivételhez szükséges a szülősorozat. A fájlban ismétlődő UID/RECURRENCE-ID pár hiba.

A módosított alkalom kulcsa az eredeti ismétlődési időpontot őrzi, ezért egy forrásban áthelyezett óra helyi teremfelülírása megmaradhat.
