# motoflip — Market Intelligence & Decision Engine (Phases 6–7)

Date: 2026-08-31
Status: implemented
Follows: `2026-08-31-motoflip-foundation-design.md`

## The problem this design solves

Spec §22–§30 asks for market intelligence. No official Google Trends API
exists, and marketplace scraping is both fragile and ToS-hostile. §39 answers
this directly: build the provider abstraction, use clearly-labelled mock data,
and never pretend it is real.

The risk with that instruction is subtle. A demo demand curve renders
identically to a real one. If it feeds a score the user acts on, the labelling
is cosmetic and the feature is actively harmful.

## The governing rule

**Synthetic data is shown but never counted.**

Implemented at four levels, so it cannot be bypassed by forgetting a check:

1. `MarketConfidence` has a `NONE` level distinct from `LOW`. Synthetic data is
   not weak evidence; it is not evidence.
2. `scoreMarket` propagates `NONE` from provenance to the score.
3. `scoreOpportunity` assigns weight `0` to `NONE`-confidence market data, so it
   mathematically cannot move the combined figure.
4. `scoreDeal` refuses to score its market-alignment component unless
   confidence exceeds `NONE`, and names the omission in `missingSignals`.

The strongest test in the suite asserts that a deal scored *with* demo market
data returns an identical number to one scored with none at all.

## Where real data comes from

`MarketObservation` — an asking price the user saw on a marketplace. This is the
insight that makes the subsystem worth having now rather than later: a flipper
looks at listings every day, and that is genuine market evidence available with
no external API.

Observations aggregate into monthly snapshots with confidence scaled by sample
size (<6 `LOW`, 6–11 `MEDIUM`, 12+ `HIGH`). Months with no observations produce
no snapshot; gaps stay gaps.

Where observations dominate a model's history, the whole series is reclassified
as `MANUAL` and starts counting. A single real month against five demo months
does not qualify.

## Scoring

**Market Trend Score (§23)** — five weighted components, anchors in one exported
config: demand 22, price stability 18, liquidity 22, competition 15, profit
potential 23.

§29's rule is enforced structurally: demand carries less weight than liquidity
and profit potential combined, so a high-demand model with no spread or heavy
competition cannot score well. Tests assert each of those directly.

**Opportunity Score (§28)** — three separate figures. Market, Personal, and a
Combined score weighted by how much real evidence each side holds. It never
silently averages an illustration with a fact, and states its own weighting in
plain language ("Sepenuhnya dari rekam jejak Anda", "62% data pasar…").

**Rankings (§24)** — six lists, each stating what it sorts by. "Sedang Naik" is
deliberately not the default: the highest-growth model is a different question
from the best one to buy. "Permintaan Menguat" requires three consecutive rising
months, so a single spike cannot qualify.

## Architecture

```
src/domain/market/     pure: types, scoring, opportunity, rankings
src/server/market/     provider interface, demo provider, manual aggregation
src/data/market.ts     merges provider snapshots with user observations
```

`src/domain/interpolate.ts` was extracted so the deal scorer and market scorer
can share it without an import cycle once the former began consuming the latter.

The ESLint domain-purity rule caught a test for a server module placed inside
`src/domain` during this work — the guard rail is doing real work, not
decoration.

## Known limitations

1. **The demo provider's demand index is invented.** It is deterministic and
   plausible-looking, which is exactly why the labelling is aggressive.
2. **Manual observations measure what the user saw, not the market.** The
   demand proxy is relative to the busiest observed month, and the methodology
   string says so verbatim on screen.
3. **No external provider is implemented.** The interface is one method
   (`getSnapshots`); adding one touches no UI or domain code.
4. **Observation entry is manual.** A future provider or a paste-a-URL importer
   would reduce the friction that currently limits sample sizes.
