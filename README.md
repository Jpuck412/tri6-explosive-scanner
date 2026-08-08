# TRI6 Explosive Scanner

Professional live-market price-structure scanner for six converging compression patterns:

1. Ascending Triangle
2. Descending Triangle
3. Bullish Symmetrical Triangle
4. Bearish Symmetrical Triangle
5. Falling Wedge
6. Rising Wedge

TRI6 scores **geometry only**: swing-high/low trendlines, line fit, touches, convergence, compression, apex progress, breakout distance, and breakout confirmation. It does not use catalyst, RSI, ADX, MACD, or unrelated indicator scoring.

## Stack
- Next.js 16 App Router
- React 19
- TypeScript 7
- Live Polygon/Massive-compatible REST market data provider
- Server-side scan engine
- Responsive operator dashboard
- GitHub Actions CI

## Live-data policy
There is intentionally **no runtime demo provider**. If a live provider is not configured the API returns `PROVIDER_NOT_CONFIGURED` instead of fabricated market results.

## Quick start
```bash
cp .env.example .env.local
npm install
npm run dev
```

Then set `POLYGON_API_KEY` in `.env.local` (and in Vercel Environment Variables for deployment).

## Environment
See `.env.example` for all scanner controls.

## Scanner states
`FORMING -> COMPRESSED -> READY -> BREAKING -> CONFIRMED`

Invalid structures are rejected rather than forced into a pattern label.

## Important
This is market-analysis software, not investment advice. Pattern detection is probabilistic and cannot guarantee future price movement.
