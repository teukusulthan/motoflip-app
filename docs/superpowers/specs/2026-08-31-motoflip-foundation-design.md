# motoflip — Foundation Design (Phases 1–5)

Date: 2026-08-31
Status: implemented

## Scope

Spec phases 1–5: foundation, garage, finance, analytics, deal analyzer.
Phases 6–7 (Market Intelligence, personalised market recommendations) are
deliberately deferred and will get their own spec.

Decisions taken with the user before implementation:

| Decision | Choice | Why |
|---|---|---|
| Architecture | Single Next.js full-stack app | One deploy, no network hop; domain stays extractable |
| First scope | Phases 1–5 | Market scores need real internal data first (§47) |
| Auth | Single operator, HttpOnly-cookie sessions | `userId` on every row, so multi-user is config not migration |
| Media | Cloudinary | Already run in `nyatetin`; gives §40 image optimisation free |
| Language | Indonesian | Data entry happens at a workshop, in Indonesian |
| Money model | Single append-only ledger, everything derived | Satisfies §16 and §38 structurally |

## Architecture

```
src/domain/   pure financial engine — no Prisma, React or I/O
src/data/     the only Prisma importer; maps rows → domain values
src/server/   auth, sessions, password hashing
src/app/      App Router screens + server actions
src/components/ ui primitives + product components
src/lib/      id-ID formatting, Zod schemas, Prisma client
```

Domain purity is enforced by an ESLint `no-restricted-imports` rule scoped to
`src/domain/**`, so the boundary cannot rot silently.

## The money model

`LedgerEntry` is the only writable source of truth for money:

```
type       INCOME | EXPENSE | TRANSFER
amount     BigInt, always positive — direction lives in `type`
accountId  source for EXPENSE/TRANSFER, destination for INCOME
toAccountId  TRANSFER only
motorcycleId  null = business-level
categoryId  → group + role (PURCHASE / SALE / NORMAL)
voidedAt   corrections are void + reissue, never UPDATE
```

Everything else is derived:

```
totalCost(bike)   = Σ EXPENSE
netProfit(bike)   = Σ INCOME − totalCost
roi               = netProfit × 10000 / totalCost   → basis points | null
cash              = Σ per account (TRANSFER nets to zero)
inventoryCapital  = Σ totalCost of non-SOLD
realizedProfit    = Σ netProfit of SOLD
```

`Motorcycle` stores no actual figures — only `projectedPurchasePrice`,
`projectedRepairCost` and `targetSellingPrice`. This is what makes §9's
variance a subtraction.

### Decisions that needed making explicit

- **Whole rupiah, not sen.** IDR's minor unit is defunct; ×100 buys no
  precision and inflates every stored value.
- **`ROI` on zero cost is `null`**, not `Infinity`. UI renders `—`.
- **Same-day flip**: `profitPerDay` floors the divisor at 1. The whole profit
  was earned in one day.
- **Rounding** is half away from zero, defined once in `divRound`, because
  bigint `/` truncates toward zero and would bias every percentage.
- **`rupiah(number)` rejects unsafe integers.** Above `MAX_SAFE_INTEGER` the
  argument has already lost precision before the constructor sees it.

## Honesty constraints (§29, §30, §39)

Market data is not connected. Rather than ship mock trends:

- The Market screen states plainly that it has no data source.
- The Deal Analyzer scores only projections + the user's own history, lists the
  signals it could not use, and **cannot reach HIGH confidence** by
  construction while market data is absent.
- A component with no data (e.g. no history for that model) is *not scored
  zero*; weights are renormalised over the components that could be scored.

## Testing

117 tests over `src/domain`, running with no database and no rendering. Covers
every case §37 lists, plus the §8 worked example asserted to land exactly on
`22.720.000` / `3.280.000`, verified again end-to-end against the rendered page.

## Known risks

1. **Derived-everything costs reads.** Free at dozens of bikes; a materialised
   view is the mitigation if volume grows. Deliberately not built now.
2. **`BigInt` does not JSON-serialise.** Handled at the `src/data` boundary and
   in the Deal Analyzer's server action, which returns strings.
3. **Cloudinary docs are sensitive** (BPKB/STNK are ownership papers). Private
   delivery + signed URLs required before any real document is uploaded.
4. **Upload flow is not yet built.** Gallery and Documents render and have
   honest empty states, but the Cloudinary upload path is outstanding.
