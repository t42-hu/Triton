# Application API contract

`openapi.json` describes the HTTP routes owned by the Nest application. Its
paths come from Nest controller metadata; generating the document fails when a
route is added or renamed without a contract entry. Shared Zod schemas describe
the profile, public configuration, checkout, and native authentication payloads.
Request schemas use Zod's input shape so defaults remain optional to callers.
The document also covers binary profile uploads, local image reads, health,
and the signed Stripe webhook.

Better Auth owns `/api/auth/*` separately. These routes and their client SDK are
not part of this generated contract. The webhook is documented for operators;
client applications should not call it. `openapi.json` is a source artifact;
the app does not serve a public Swagger UI by default.

```bash
pnpm api:generate  # Regenerate openapi.json and Orval client after route changes
pnpm api:check     # Fail when either generated artifact is stale
pnpm verify        # Includes the contract check, tests, and builds
```

The CI verify job runs `api:check`. Orval writes a typed fetch client under
`frontend/src/lib/api/generated/`. The handwritten adapter in
`frontend/src/lib/api/generated-mutator.ts` preserves the common 15-second
timeout, cookie or native token transport, and stable API errors. The generated adapter validates consumed responses with shared Zod schemas,
retaining the request ID when the server sends malformed data. Feature wrappers
check the result again at their public boundary. Add a response schema to the
adapter when adopting another generated operation. The same
frontend bundle is used by web and Electron. The Expo app has a separate React Native UI.

When adding an endpoint, update its Nest controller, add its operation in
`backend/src/openapi-contract.ts`, and use a shared Zod schema for JSON payloads.
Regenerate artifacts and run `pnpm verify` plus relevant integration tests.
Use a dedicated native auth integration test for native endpoints. Add query
caching or TanStack Query when a feature needs shared cache invalidation; the
current profile screen has a single read and explicit mutations.
