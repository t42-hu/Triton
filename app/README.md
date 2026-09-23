# Triton

Expo 57 alkalmazás helyi SQLite-adattárolással, React Native Reusables felülettel, ICS/JSON-importtal, saját naptárlink frissítésével, kézi órákkal és profilok összehasonlításával. Nincs alkalmazásszerver vagy fiókrendszer.

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

Mobilon a saját naptár használat közben 15 perces cooldownnal frissül; háttérben az operációs rendszer ütemez. Weben a link egyszeri import, CORS-hibánál fájlos fallbackkel. Mások órarendje statikus fájlimport. A térkép későbbi fázis; a célhardveres teljesítménymérés állapotát az ellenőrzési jegyzőkönyv rögzíti.
