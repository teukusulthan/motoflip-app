# motoflip

A private business operating system for a motorcycle flipping business.
Mobile-first, financially exact, and honest about what it does not know.

## Quick start

```bash
npm install
cp .env.example .env          # then set DATABASE_URL and SESSION_SECRET
npm run db:push               # create the schema
npm run db:seed               # operator account, categories, demo data
npm run dev                   # http://localhost:3100
```

Seeded credentials (development only):

```
admin@motoflip.local / motoflip123
```

### Local database

The dev database runs as a private PostgreSQL cluster owned by your own user,
so it needs no `sudo` and does not touch a system-wide Postgres install:

```bash
export PATH=/usr/lib/postgresql/16/bin:$PATH
PGDATA=~/.motoflip/pgdata

initdb -D "$PGDATA" -U motoflip_dev --auth=trust -E UTF8 --locale=C
pg_ctl -D "$PGDATA" -l ~/.motoflip/postgres.log \
  -o "-p 5433 -k ~/.motoflip -c listen_addresses=127.0.0.1" start
createdb -h 127.0.0.1 -p 5433 -U motoflip_dev motoflip_dev
```

Stop it with `pg_ctl -D ~/.motoflip/pgdata stop`.

`--auth=trust` is acceptable here because the cluster listens only on
`127.0.0.1` and is owned by your user. **Do not use trust auth in production** —
set a password and use `scram-sha-256`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on :3100 |
| `npm run build` | Production build |
| `npm test` | Domain + library test suite (no database needed) |
| `npm run test:integration` | Integration checks against a live database |
| `npm run test:cov` | Tests with coverage thresholds |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, including the domain-purity rule |
| `npm run db:push` | Sync schema to the database |
| `npm run db:seed` | Seed categories, accounts, demo data |
| `npm run db:studio` | Prisma Studio |

## Architecture

```
src/
├─ domain/        Pure financial engine. No Prisma, no React, no I/O.
│                 117 tests run with no database.
├─ data/          The only place Prisma is imported. Maps rows → domain values.
├─ server/        Auth, sessions, password hashing.
├─ app/           App Router screens + server actions.
├─ components/    ui/ primitives + motoflip/ product components.
└─ lib/           Formatting (id-ID), validation schemas, Prisma client.
```

### The one rule that holds it together

**`LedgerEntry` is the only writable source of truth for money.**

A motorcycle row stores identity, lifecycle and *projections*. Every actual
figure — purchase price, total cost, sale price, profit, ROI, holding period —
is derived from the ledger by pure functions. There is exactly one writable copy
of each rupiah figure, so no two numbers in the app can disagree, and
projected-vs-actual variance is a subtraction rather than a reconciliation.

`src/domain` may not import Prisma, React, Next or the data layer. This is
enforced by an ESLint `no-restricted-imports` rule, not left to discipline.

### Money

- Stored as `bigint` in **whole rupiah**. Indonesia's minor unit (sen) is
  defunct, so scaling by 100 would add no precision and inflate every number.
- Percentages are integer **basis points**, divided down only at display time.
- Rounding is defined once, in `divRound`, as half away from zero.
- ROI on zero cost returns `null`, never `Infinity`.
- Profit-per-day floors the divisor at 1, so a same-day flip is well defined.
- `TRANSFER` entries are excluded from every profit function *by type*, so
  moving money between your own accounts can never be read as a cost.
- Corrections are **void-and-reissue**. Financial rows are never mutated.

## Market Intelligence

Market data arrives through a provider abstraction (`src/server/market`), with
two backends:

| Provider | Source | Confidence | Counts toward scores |
|---|---|---|---|
| `demo` | Deterministic synthetic data | `NONE` | **No** |
| manual | Listings you record yourself | `LOW`–`HIGH` by sample size | Yes |

The rule that governs the whole subsystem: **synthetic data is shown but never
counted.** A demo figure that looks like a finding is worse than no figure at
all, because it can drive a real purchase. Concretely:

- A `DEMO` snapshot carries `NONE` confidence, which propagates through scoring
  and renders as an `ILUSTRASI` badge with dashed, muted styling.
- Demo data receives zero weight in the opportunity score, so a model where you
  have real flipping history scores purely on that history — and the screen says
  so in plain language.
- A deal analysed with demo market data scores *identically* to one analysed
  with no market data at all. There is a test asserting exactly that.
- `HIGH` confidence on a deal requires both real market data and a real personal
  track record. Neither alone is enough.

To replace the provider, implement `MarketDataProvider`, register it, and set
`MARKET_PROVIDER`. No screen, score or domain function changes.

### Recording real market data

The Market screen's **Catat Listing yang Anda Lihat** records an asking price
you actually saw. You are in the market daily, so this is genuine evidence —
and it is what lifts a model out of illustration territory. Confidence rises
with sample size: under 6 observations is `LOW`, 12 or more is `HIGH`. A month
with no observations produces no snapshot; a gap is reported as a gap, never
interpolated.

## Correction, not mutation

Financial records are never edited in place (§38):

- **Transactions** are corrected by voiding and re-entering. The original row is
  retained with its void reason, so the history shows what was entered and when
  it was reversed.
- **Motorcycles** can be edited for identity and projections, but not for money.
  The edit screen says so and points at the void flow.
- **Vendors, cash accounts and categories** archive rather than delete, because
  historical ledger entries reference them.
- **Photos** soft-delete, so a sold motorcycle's gallery survives a mis-tap.

System categories (the `PURCHASE` and `SALE` roles) can be renamed but not
re-grouped or archived: the entire financial engine derives from those roles.

## Integrations (Composio)

Optional. Set `COMPOSIO_API_KEY` and `ANTHROPIC_API_KEY` in `.env`, then open
**Lainnya -> Integrasi** to authorise apps (Gmail, Google Sheets, Notion, …).

| Piece | Path |
|---|---|
| Client + config guards | `src/server/composio/client.ts` |
| Connection management | `src/server/composio/toolkits.ts` |
| Agent loop | `src/server/composio/agent.ts` |
| Connection API | `src/app/api/composio/connections/route.ts` |
| Assistant API | `src/app/api/chat/route.ts` |
| UI | `src/app/(app)/lainnya/integrasi` |

Design decisions worth knowing:

- **Every route is authenticated**, and the Composio user id is namespaced as
  `motoflip:<userId>`, so one operator's connected accounts are never visible
  to another.
- **Credentials live with Composio**, never in this database. The API key is
  read server-side only and never reaches the browser.
- **The agent can only reach apps you explicitly connect.** Tools are fetched
  for the toolkits present in *your* connected accounts — not the full catalog.
- **Not the Claude Agent SDK.** That harness spawns a Claude Code process with
  filesystem and bash access, which has no business in a web request handling
  financial data. This uses the plain Messages API tool-use loop, capped at 8
  iterations so a confused model cannot loop indefinitely on your bill.
- The system prompt instructs the model to confirm before creating, updating
  or deleting anything in an external app, and never to invent financial
  figures.

Without the keys, the app runs exactly as before — the Integrations page shows
a configuration notice and the assistant endpoint returns 503.

## Security notes

- Sessions are opaque random tokens stored **hashed**; the cookie is HttpOnly.
- Every read and write re-checks ownership server-side; ids in form fields are
  never trusted.
- `.env` is gitignored. Set a real `SESSION_SECRET` before deploying.
- Uploads are validated by magic number, not by the client-supplied MIME type,
  so a script renamed to `.jpg` is rejected.
- Documents are served through `/api/dokumen/[id]`, which checks the session and
  ownership before minting a short-lived signed Cloudinary URL or streaming the
  local file. Ownership papers are never reachable by guessing a URL.
