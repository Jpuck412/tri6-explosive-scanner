# TRI6 ELITE

Professional live-market geometry scanner for six converging price structures.

TRI6 ELITE does one job: locate valid compression geometry, prove that the structure is real, rank it, and show the exact boundary that confirms or invalidates it.

## Six structures only

1. Ascending Triangle — bullish
2. Descending Triangle — bearish
3. Bullish Symmetrical Triangle
4. Bearish Symmetrical Triangle
5. Falling Wedge — bullish
6. Rising Wedge — bearish

No catalyst score. No RSI. No MACD. No ADX. No news score. No tape score. Universe price/volume filters reduce API workload only and never change a TRI6 score.

## ELITE validation

A candidate must pass plateau-aware pivot extraction, robust two-pass trendline regression with outlier trimming, repeated distributed boundary touches, upper/lower pivot alternation, forward-apex convergence, boundary compression, candle-range compression, wick containment, body containment, violation rejection, formation-age limits, breakout lifecycle validation, and opposite-boundary invalidation.

## Geometry-only score

- line fit 20%
- touch quality 14%
- convergence/apex 14%
- compression 16%
- containment 16%
- oscillation structure 12%
- breakout proximity 8%

Grades: `A+` 90+, `A` 82+, `B` 74+, `C` below 74. Hard professional gates run before dashboard score filters, so lowering the minimum score cannot force invalid geometry into results.

## Lifecycle

`FORMING -> COMPRESSED -> READY -> BREAKING -> CONFIRMED`

A wick probe can be `BREAKING`; `CONFIRMED` requires a boundary close with a strong candle finish. Every result carries a PROOF LEVEL and FAIL LEVEL.

## Live-data policy

There is no runtime demo provider and no fabricated fallback. Without `POLYGON_API_KEY` or `MASSIVE_API_KEY`, scans return `PROVIDER_NOT_CONFIGURED`.

The provider includes request coalescing, bounded TTL caching, timeout handling, retry/backoff for 429/5xx, bar validation, sorting, and duplicate timestamp removal.

## API

`GET /api/status` returns engine version, provider readiness, supported patterns and active gates without exposing secrets.

`POST /api/scan` accepts symbols or auto-universe mode plus timeframe, minimum score/grade, direction, state and pattern filters.

## Local run

```bash
cp .env.example .env.local
npm install
npm run dev
```

Never expose provider credentials with `NEXT_PUBLIC_*`.

## Release gate

GitHub Actions runs production dependency audit, TypeScript, ESLint, Vitest and the production Next.js build. A scanner commit is not release-ready until the entire workflow passes.

See `OPERATIONS.md` for deployment and incident procedures.

TRI6 identifies price geometry; it does not guarantee future movement and is not investment advice.
