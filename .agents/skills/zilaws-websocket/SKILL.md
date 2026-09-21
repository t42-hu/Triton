---
name: zilaws-websocket
description: Guides setup and implementation of ZilaWS websocket flows using zilaws-server and zilaws-client, including waiter patterns, message handlers, local events, cookie sync, and 3.0 migration rules. Use when working on ZilaWS setup, awaiters/waiters, websocket event emission, or client-server messaging.
disable-model-invocation: true
---

# ZilaWS WebSocket Workflow

Use this skill when implementing or reviewing websocket logic with ZilaWS.

## Scope and source of truth

- Use local repo docs as canonical source:
  - `zilaws/docs/docs/intro.mdx`
  - `zilaws/docs/docs/waiters.mdx`
  - `zilaws/docs/docs/messagehandlers.mdx`
  - `zilaws/docs/docs/client-api/*.mdx`
  - `zilaws/docs/docs/server-api/*.mdx`
  - `zilaws/docs/docs/changelog.mdx`
- Validated behavior against tests:
  - `zilaws/client/test/index.test.ts`
  - `zilaws/client/test/puppeteer.test.ts`
  - `zilaws/client/test/cookieSync.puppeteer.test.ts`
  - `zilaws/server/test/index.test.ts`
- Prefer current docs version (`3.0.0`) from `zilaws/docs/docusaurus.config.ts` and `zilaws/docs/versions.json`.

## Terms

- ZilaWS docs use `waiter`.
- If a request says `awaiter`, treat it as `waiter` in ZilaWS context.
- MessageHandlers are websocket RPC handlers.
- Local events are process-local listener callbacks.

## Install and setup

## Prerequisites

- Node.js `>=18.0.0` or Bun `>=1.22.2` from `zilaws/docs/docs/intro.mdx`.

## Packages

```bash
npm i zilaws-server@latest
npm i zilaws-client@latest
```

## Minimum server setup

```ts
import { ZilaServer } from "zilaws-server";

const server = new ZilaServer({
  port: 6589,
  logger: true,
  verbose: true,
});
```

## Minimum client setup

```ts
import { ZilaConnection } from "zilaws-client";

const client = new ZilaConnection();
client.setMessageHandler("GetData", () => ({ ok: true }));
await client.connectTo("ws://127.0.0.1:6589");
```

## Critical 3.0 ordering rule

- Always instantiate client first, register MessageHandlers and local events, then connect.
- Do not rely on immediate factory connect pattern when handlers are required at startup.
- Backward-compatible factory still exists:
  - `ZilaConnection.connectTo(...)`
  - `connectTo(...)`
- Use these only if race-safe for your flow.

## Messaging model

## Register handlers (receive side)

- Server:
  - `server.setMessageHandler(identifier, (socket, ...args) => result)`
  - `server.onceMessageHandler(identifier, ...)`
- Client:
  - `client.setMessageHandler(identifier, (...args) => result)`
  - `client.onceMessageHandler(identifier, ...)`

## Emit/send events (fire-and-forget)

- Client -> Server:
  - `client.send("EventName", ...data)`
- Server -> one Client:
  - `server.send(socket, "EventName", ...data)`
  - `socket.send("EventName", ...data)`
- Server -> all Clients:
  - `server.broadcastSend("EventName", ...data)`

Use `send` when caller does not need a return value.

## Waiters (awaiters)

## What waiter does

- Executes handler on remote side and awaits its return/resolve value.
- On timeout it resolves `undefined`.

## Client waiter APIs

```ts
const response = await client.waiter<ResultType>("ServerHandler", arg1, arg2);
const response2 = await client.waiterTimeout<ResultType>("ServerHandler", 300, arg1);
```

## Server waiter APIs

```ts
const one = await server.waiter<ResultType>(socket, "ClientHandler", arg1);
const one2 = await server.waiterTimeout<ResultType>(socket, "ClientHandler", 300, arg1);
```

## Broadcast waiter APIs

```ts
const many = await server.broadcastWaiter<ResultType>("ClientHandler", payload);
const many2 = await server.broadcastWaiterTimeout<ResultType>("ClientHandler", 300, payload);
```

## Waiter timeout rules

- Default timeout:
  - Server: `maxWaiterTime` (default `800`)
  - Client: `client.maxWaiterTime` (default `1200`)
- Per-call override:
  - `waiterTimeout(..., maxWaitingTime, ...)`
  - `broadcastWaiterTimeout(..., maxWaiterTime, ...)`

## Waiter usage checklist

- Register remote MessageHandler before calling waiter.
- Use explicit timeout in latency-sensitive flows.
- Handle `undefined` as timeout/no-response path.
- For broadcast waiters, expect only successful responder values.

## Local events

## Client local events

- `onStatusChange`
- `onMessageRecieved`
- `onRawMessageRecieved`
- `onCookieSync`

API:

```ts
client.addEventListener("onStatusChange", (status) => {});
client.onceEventListener("onStatusChange", (status) => {});
client.removeEventListener("onStatusChange", callbackRef);
```

## Server local events

- `onClientConnect`
- `onClientDisconnect`
- `onClientMessage`
- `onClientMessageBeforeCallback`
- `onClientRawMessageBeforeCallback`

API:

```ts
server.addEventListener("onClientConnect", (socket) => {});
server.onceEventListener("onClientDisconnect", (socket, code, reason) => {});
server.removeEventListener("onClientConnect", callbackRef);
```

## Cookie sync flow

## Server-side cookie authority

- Server controls cookie state.
- Cookie sync endpoint: `GET /zilaws/cookieSync`.
- Recommended server writes:
  - `client.cookies.set(name, value)`
  - `client.cookies.delete(name)`

## Client-side sync trigger

- Call `await client.syncCookies()` after browser-side `document.cookie` mutations.
- React to completion with `onCookieSync` listener.

## Security/config recommendations

- Set `cookieSyncAllowedOrigins` explicitly in production.
- Keep `sessionTokenCookieName` aligned with auth session cookie if needed.
- Prefer HTTPS in production and use `allowSelfSigned` only for local testing.

## Connection lifecycle

- Connect:
  - `await client.connectTo(url, errorCb?, allowSelfSignedCert?)`
- Disconnect:
  - `await client.disconnectAsync()` preferred
  - `client.disconnect()` available
- Server stop:
  - `await server.stopServerAsync(reason?)` preferred
  - `server.stopServer(reason?)` available
- Termination:
  - `server.kickClient(socket, reason?)` or `socket.kick(reason?)`
  - `server.banClient(socket, reason?)` or `socket.ban(reason?)`

## Config quick reference (server)

- `port`
- `host`
- `reusePort` (Bun)
- `https.pathToCert`
- `https.pathToKey`
- `https.passphrase`
- `https.allowSelfSigned`
- `logger`
- `verbose`
- `headerEvent`
- `maxWaiterTime`
- `clientClass`
- `rejectBannedIpBeforeConnectionUpgrade`
- `cookieSyncAllowedOrigins`
- `sessionTokenCookieName`

## Extending

## Custom client class

- Extend `ZilaClient` to store auth/session context per connection.
- Pass class in server settings:
  - `new ZilaServer<MyClient>({ clientClass: MyClient, ... })`

## Custom server class

- Extend `ZilaServer<T>` for typed handler identifiers or domain wrappers.

## Patterns to prefer

- Use `send` for notifications.
- Use `waiter` for request/response.
- Keep identifiers stable and explicit.
- Register handlers before connect.
- Keep timeout values explicit on uncertain paths.

## Test-backed behavior expectations

- Invalid URL or unreachable socket should fail connect.
- Duplicate identical local event listener registration throws.
- `waiter`/`waiterTimeout` return `undefined` on timeout.
- Kick/ban reason should reach client error callback.
- Cookie sync merges browser cookies without overriding server-authoritative values.
- Multi-tab cookie sync is session-isolated.

## Migration notes (<=2.2.x to 3.0.0)

- Replace old immediate `connectTo` flow with instantiate -> register -> connect flow.
- Replace cookie mutation assumptions with cookie-sync endpoint model.
- Replace old cookie local events with `onCookieSync`.
- Re-verify any legacy docs snippets that still show old cookie methods.

## Working recipe

1. Install server and client packages.
2. Build server with explicit config and timeout.
3. Instantiate client.
4. Register all required MessageHandlers.
5. Register local lifecycle listeners.
6. Connect client.
7. Implement send and waiter paths with timeout handling.
8. Add cookie sync handling for browser updates.
9. Validate with integration tests covering timeout and disconnect paths.

**Dont try to use context7 for this because this is a js/ts libary from a friend of mine and its not that pupular.**
