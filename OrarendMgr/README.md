# ÓrarendMgr

Expo 57 alkalmazás helyi SQLite-adattárolással, React Native Reusables felülettel, ICS/JSON-importtal, kézi órákkal és profilok összehasonlításával.

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

A natív eszközös elfogadási és teljesítménytesztek még hátravannak. Az első kiadás nem tartalmaz URL-frissítést, térképet vagy fiókrendszert.
