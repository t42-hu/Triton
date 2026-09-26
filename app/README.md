# Triton

Expo 57 alkalmazás helyi SQLite-adattárolással, React Native Reusables felülettel, ICS/JSON-importtal, saját naptárlink frissítésével, kézi órákkal és profilok összehasonlításával. Nincs alkalmazásszerver vagy fiókrendszer.

## Telepíthető mobil build

```sh
./scripts/build.sh
./scripts/build.sh --apk
./scripts/build.sh --ipa
```

Argumentum nélkül APK és IPA készül; az eredmény a repó `output/` mappájába kerül. Az APK helyben épül, ezért Java, Android SDK és pnpm kell. Az IPA EAS Build szolgáltatással készül: Expo bejelentkezés, Apple Developer tagság és az iPhone [regisztrációja](https://docs.expo.dev/build/internal-distribution/) szükséges. Az EAS az első futáskor interaktívan beállítja az aláírást.

## Webes indítás

```sh
pnpm install --frozen-lockfile
pnpm web
```

Kiadási előnézet: `pnpm build:web`, majd `pnpm preview` (localhost:8082).

## Ellenőrzés

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm benchmark
```

[Használat, UI-beállítás és webes kiszolgálás](../docs/app.md) · [Importformátum és példák](../docs/import-format.md) · [Ellenőrzési jegyzőkönyv](../docs/validation.md) · [Követelmények](../requirements.md)

Mobilon a saját naptár használat közben 15 perces cooldownnal frissül; háttérben az operációs rendszer ütemez. Weben a link egyszeri import, CORS-hibánál fájlos fallbackkel. Mások órarendje statikus fájlimport. A célhardveres teljesítménymérés állapotát az ellenőrzési jegyzőkönyv rögzíti.

## Teremtérképek

A 2D és 3D térkép az app `assets/maps/model2d.json` és `assets/maps/model3d.json` állományaiból töltődik be. A teremkódok és helyek közös adata a `src/features/nik-map-data.ts` fájlban van. A térképeket ezeken az appos fájlokon módosítsd, majd a terem-térkép párbeszédablakban ellenőrizd a 2D és 3D nézetet; az önálló ZIP-ek nem az app forrásai.
