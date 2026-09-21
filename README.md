# DUYS (React + Node)

Rewrite of the Flask DUYS platform: **Vite + React** SPA + **Express** API, Prisma, Socket.io,
plus an optional Python face-verification worker (`face-worker/`) and the original Flask app
(`DUYS/`, kept as the behaviour spec).

## Database: SQLite for dev, PostgreSQL for prod

`server/prisma/schema.prisma` is the single source of truth and ships configured as **SQLite**,
so local development and the API test suite need no database server:

```bash
npm install
npm run db:push     # creates server/prisma/dev.db from the schema
npm run test        # boots the API against a throwaway SQLite DB and runs the suite
```

Production runs PostgreSQL. `npm run db:generate:pg` / `npm run db:push:pg` derive
`prisma/schema.postgres.prisma` (provider switched to `postgresql`) from that same file, so the
two flavours can never drift apart:

```bash
# DATABASE_URL=postgresql://user:pass@host:5432/duys
npm run db:push:pg
npm run build        # picks the right provider automatically — see below
```

**Builds select the provider from `DATABASE_URL` themselves.** `npm run build` (and its
`build:prod` alias, which is now just an alias) runs `server/scripts/prisma-setup.mjs`:

| `DATABASE_URL` starts with | Schema used | Steps |
| --- | --- | --- |
| `file:` | `prisma/schema.prisma` (sqlite) | `generate` + `db push` |
| `postgres://` or `postgresql://` | derived `prisma/schema.postgres.prisma` | `generate` + `db push` |
| anything else / unset | — | exits 1 with an actionable message |

This exists because Prisma validates that the datasource `provider` matches the URL scheme. A
build that always ran the SQLite schema against a `postgres://` URL died before TypeScript even
started, with `P1012 … the URL must start with the protocol 'file:'`. Now the same command is
correct in both environments, so a hosting dashboard whose build command drifted from
`render.yaml` still deploys.

`docker-compose.yml` still starts a local PostgreSQL if you prefer to develop against Postgres.

## Quick start

```bash
copy .env.example .env
npm install
npm run db:push
npm run dev:server   # Express API -> http://localhost:5000
npm run dev:client   # Vite SPA    -> http://localhost:5173 (proxies /api + /socket.io)
```

Open http://localhost:5173 — sign up, or use the admin account from `.env`.

## Notes

- Media goes to Cloudflare R2 when the `R2_*` values are set, otherwise to `server/uploads`
  (served at `/media`). Deleting a post or story also removes its stored objects.
- Token claims live in `server/src/services/claims.ts`. `POST /api/claim-rewards` is canonical and
  `POST /api/wallet/claim-tokens` is a thin alias; both deduct points atomically (guarded
  `points >= spent`), enforce the daily limit and refund points if the chain transfer fails.
- Linking a wallet requires an EIP-191 signature over the server nonce
  (`POST /api/wallet/connect/nonce` → `personal_sign` → `POST /api/wallet/connect/verify`).
  Uniqueness is enforced on `sha256(address)`, so unlinked accounts never collide.
- CSP is enforced in production only — the Vite dev server injects an inline preamble script.
- Prisma generates one client at a time: after running a production build locally
  (`npm run build:prod`, which generates the PostgreSQL client), re-run `npm run db:generate`
  before `npm run dev:server` to point the client back at SQLite.
- Credential routes (`/api/auth/login|register|2fa|google`) have a tighter rate limit than the
  global one, and the rewarded-ad webhook refuses unsigned calls outside dev/test.

## Never-blank-page invariants

These three rules exist because each one, when broken, produced a fully blank screen in
production. Please keep them when adding pages or changing the shell.

1. **Auth bootstrapping is a three-state machine.** `AuthProvider` (`client/src/auth.tsx`) exposes
   `boot` *and* a separate `loading` flag. `boot` stays `null` until `/api/bootstrap` actually
   resolves; only `.finally()` clears `loading`. Do not "recover" from a failed bootstrap by
   setting a fake `boot` object — that was the original bug: routes mounted and fired their fetches
   before the `user === null` redirect effect ran, the rejection went unhandled, and React
   unmounted the tree.
2. **Every data page renders a placeholder, never `null`.** Use `PageLoading` / `PageError` from
   `client/src/components/PageState.tsx` for the pre-fetch and error states. `return null` while
   loading turns a slow network into an empty document. `PageError` maps terse API codes
   (`not_found`, `unauthorized`, `not_subscribed`, …) to readable text and offers a retry.
   `AdminShell` must do its own gate: `/admin` renders *outside* `AppShell`.
   `PageLoading` is not a bare spinner: it draws an animated mark (sweeping arc, expanding ripple
   halo, pulsing core), sheens the label, and shimmers placeholder rows. `Skeleton` (one bar) and
   `SkeletonList` (avatar + two lines) are exported for content-shaped placeholders — use them
   instead of letting an empty list flash its "nothing here yet" state before the fetch lands
   (see `MessagesPage`, which gates its empty state on a `listLoaded` flag).
3. **The service worker only ever touches navigations.** `client/public/sw.js` answers
   `mode === "navigate"` requests network-first and falls back to the precached `/offline.html`.
   It must never synthesise responses for JS/CSS chunks — returning a plain-text body for a script
   makes the browser parse `"Offline"` as JavaScript, throw a syntax error and render a blank page.
   `/api`, `/media` and `/socket.io` are always passed through untouched.

Related cache rule (`server/src/index.ts`): `index.html` and `sw.js` are sent with
`no-cache, must-revalidate`, while hashed Vite assets are `immutable`. A cached `index.html` keeps
requesting a bundle filename that no longer exists after a deploy, which is blank until a hard
refresh. `ErrorBoundary` in `main.tsx` is the last line of defence if a render still throws.

