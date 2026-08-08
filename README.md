# TRI6 Explosive Scanner

TRI6 is a professional live-market **price-structure scanner** built around exactly six converging compression formations:

1. Ascending Triangle
2. Descending Triangle
3. Bullish Symmetrical Triangle
4. Bearish Symmetrical Triangle
5. Falling Wedge
6. Rising Wedge

The pattern score uses **geometry only**: swing-high/low trendlines, regression fit, repeated boundary touches, convergence, range compression, candle containment, apex progress, and breakout proximity. It does **not** score catalysts, RSI, ADX, MACD, moving averages, or unrelated indicators.

## Production posture

- Next.js 16 App Router
- React 19
- TypeScript 7 strict mode
- Live Polygon/Massive-compatible REST provider
- Server-side detector and concurrency-controlled scan service
- Auto universe or explicit symbol scans
- 1m / 5m / 15m / 1h / 1d structure analysis
- Responsive operator UI designed for narrow mobile screens and desktop
- No runtime demo provider and no fabricated scanner results
- API request validation, optional access-token lock, and scan rate guard
- CI: typecheck, lint, unit tests, production build

## Pattern lifecycle

`FORMING → COMPRESSED → READY → BREAKING → CONFIRMED`

A structure can also be rejected entirely. TRI6 does not force every chart into a pattern.

## Score model

TRI6's 0-100 score is weighted only from:

- line fit quality
- boundary touches
- convergence / apex geometry
- compression
- containment
- distance to the directional breakout boundary

Universe price and day-volume settings only limit how many symbols are sent through the expensive bar-by-bar detector. They do not change a symbol's TRI6 score.

## Live setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set either:

```bash
POLYGON_API_KEY=your_key
```

or:

```bash
MASSIVE_API_KEY=your_key
```

The API returns `PROVIDER_NOT_CONFIGURED` if neither exists. There is intentionally no demo fallback.

For a public deployment, set `SCANNER_ACCESS_TOKEN` and enter that token in the dashboard Security section. The market-data key always stays server-side.

For Vercel, add the same key under **Project → Settings → Environment Variables** and redeploy.

## API

### `POST /api/scan`

Auto-universe scan:

```json
{}
```

Specific symbols:

```json
{
  "symbols": ["RGC", "CPHI"],
  "timespan": "minute",
  "multiplier": 1,
  "minScore": 68,
  "direction": "ALL",
  "maxResults": 40
}
```

### `GET /api/health`

Returns service status and whether a live provider key is configured. It never exposes the key.

## Local verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Important

TRI6 is market-analysis software, not investment advice. Geometric formations can fail, and a `CONFIRMED` state means the configured price-close condition was observed—not that a future move is guaranteed.
