# NIK térképek újratervezése

## Alap és források

A jóváhagyott F szint a koordinátarendszer alapja. A többi szint helyiségeit ehhez kell illeszteni, nem külön-külön elrendezni a képernyőn. A fotók axonometrikus tájékoztató ábrák, nem méretezett alaprajzok.

| Forrás | Mire használjuk |
| --- | --- |
| `nik1.jpg` | F/A szint, Bécsi úti bejárat, garázs, porta, AED, függőleges közlekedők |
| `nik2.jpg` | 1/2 szint szárnyai, híd, nagyelőadó, rektori és EKIK funkciók |
| `nik3.jpg` | 3/4 szint NIK-sávjai, központi mag, 4.01 és dékáni hivatal |
| `nik4.jpg` | Funkciószínek és lépcső/lift jelmagyarázat |
| [Az épület építészeti bemutatása](https://epiteszforum.hu/foiskola-az-amfiteatrumnal-bmf-bovites) | Két szárny, központi összekötés, kör alaprajzú nagyelőadó; nem aktuális szobahatárok |
| [Bérces László DLA-anyaga](https://dla.epitesz.bme.hu/storage/2024/05/534-_DLA-tezisfuzet_BercesL.pdf) | Épülettömeg, eltérő utcaszintek és bejáratok; nem aktuális szobabeosztás |

## Az előző változat javítandó hibái

- A rektori szárny eltávolodott az F.01 fölötti területtől.
- Az 1. emeleti tárgyaló és Emeritus-iroda tévesen a rektori sávokba került.
- A 2. emeleti EKIK-főigazgatói iroda tévesen a rektori szárnyban szerepelt.
- A nagyelőadó és az alsó EKIK-blokkok oldalra tolódtak, így nem illeszkedtek a földszinthez.
- A 2. emeletre olyan észak–déli folyosó került, amely a táblán nem látható. A halvány tetőfelületet nem kezeljük közlekedőként.
- A garázs bejárata és a lépcső/lift pontjai külön koordinátákat kaptak a fölöttük levő szintektől.
- A két HTML-nézet saját másolatban tartalmazta ugyanazokat az alaprajzi adatokat.

## Rögzített illesztési pontok

| Támpont | Jóváhagyott F-adat | Következmény |
| --- | --- | --- |
| Nyugati szárny | F.01: x132–405, y270–426 | Az 1/2 rektori szárny ugyanezen terület fölött |
| Ferde NIK-szárny | F.02–F.06 és az előtte futó folyosó | Az 1–4 hosszanti szárny azonos tengelyen |
| Északi felvonó | x913, y190 | Az 1–4 felvonó azonos ponton |
| Nagyelőadó környezete | Büfé/mosdó és két oldalsó lépcső | Az 1.32 e terület fölé; a két lépcső F-ből átvett ponton |
| Alsó nyugati szárny | F.07/F.08 | EKIK kutatói tömb az 1/2 szinten |
| Alsó keleti szárny | F.09 környezete | Kisebb EKIK-blokkok és saját közlekedőmag |
| Bejárati lépcső | x448, y780 | A/F/1/2 egymáshoz igazított frontoldali mag |

Ezek alkalmazáson belüli illesztési pontok; nem felmért építészeti méretek. A F-en nem jelölt további magok pontos helyét csak a fotó által indokolt szinten közelítjük.

## Szintenkénti terv

- **A:** garázs az aula/udvar alatti területen; külön hátsó kiszolgáló rész; az utcai előtérben porta, AED, lépcső és lift; külön garázsbejárat. A porta jelölés, nem kitalált helyiségfal.
- **1:** két összefüggő rektori sáv nyugaton, középen folyosó. A nyugati mag kapcsolódik a ferde NIK-szárnyhoz és a központi hídhoz. A nagyelőadó a büfé/mosdó fölött. Lent az EKIK főtömbje, tőle jobbra a tárgyaló, egy kutatói blokk és az Emeritus-iroda.
- **2:** nyugaton a 2.02 tárgyaló és a rektori hivatal/kabinet; az EKIK-főigazgatói iroda az alsó keleti kutatói csoportban. A felső és alsó szárny között nincs forrással nem igazolt emeleti folyosó. Mindkét rész a fotón látható saját közlekedőmaggal jelenik meg.
- **3:** csak a hosszanti NIK-szárny, kétoldali helyiségsávokkal és központi lépcső/lift/mosdó maggal.
- **4:** ugyanaz az északi szerkezet; bal felső sáv elején 4.01, jobb felső sávban a dékáni hivatal, a többi NIK-terület. A névtartomány nem jelent ismert egyedi ajtóhelyeket.

```text
rektori szárny ─ nyugati mag ─ ferde NIK-szárny ─ északi mag
                    │
                 híd (1.) ─ nagyelőadó (1.)
                    │
           EKIK főtömb ─ frontoldali mag ─ kisebb EKIK-blokkok
```

## Megjelenítés és megvalósítás

Színek: teremkék `#193D64`, kutatói türkiz `#3A8198`, vezetőségi okker `#E7AD38`, folyosókék `#DCECF0`, mosdócián `#A3D2DF`, alap `#F9FCFC`. A meglévő sans-serif betűcsalád marad; a helynevek középre, a kezelőfelületi szövegek balra igazodnak. A tagolást a valós szárnyak és közlekedők adják. Az üres udvar/tető nem kap kitöltött, bejárhatónak látszó folyosót.

A helyek és a szintkontúrok egyetlen típusos adatforrásból kerülnek a 2D és 3D sablonba. A F geometriája és saját megjelenítése változatlan. A 3D a közös 2D lábnyomok kiemelésével készül.

## Ellenőrzés

- A F-adatok és a F 2D-ábrája változatlanok.
- Mindkét nézet ugyanazokat a helyeket és szintkontúrokat kapja.
- Az északi lift és a frontlépcső illeszkedik a megfelelő szinteken.
- A funkciók a fotón jelölt szárnyban vannak; a 2. emeleti kitalált folyosó eltűnik.
- Térképmód és szintváltás, kijelölés, nagyítás az alkalmazásban, asztali és mobil képernyőn.
- Lint, típusellenőrzés, térképtesztek, webes export és Android-csomag.

Az iOS ugyanazt az adatforrást használja; aláírt IPA továbbra is csak a korábban hiányzó terjesztési hitelesítő adatok beállítása után készíthető.
