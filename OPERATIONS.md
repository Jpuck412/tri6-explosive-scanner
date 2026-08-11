# TRI6 ELITE — Operations Runbook

## Production environment

Required: `POLYGON_API_KEY` or `MASSIVE_API_KEY`.

Recommended on public deployments: `SCANNER_ACCESS_TOKEN` and `SCANNER_MAX_REQUESTS_PER_MINUTE`.

Never create `NEXT_PUBLIC_POLYGON_API_KEY` or any browser-visible provider secret.

## Vercel

1. Import `Jpuck412/tri6-explosive-scanner`.
2. Framework preset: Next.js; root: repository root.
3. Add the live provider key under Project Settings → Environment Variables.
4. Add `SCANNER_ACCESS_TOKEN` if public.
5. Redeploy.
6. Open `/api/status`; `providerConfigured` must be true before live scanning.

## Release verification

- TRI6 CI is green.
- `/api/status` reports the expected engine version.
- `providerConfigured=true`.
- Known-symbol scans return real bars or explicit provider errors, never demo results.
- No provider key appears in browser requests or response bodies.
- Narrow mobile layout remains usable.

## Incidents

`PROVIDER_NOT_CONFIGURED`: add the server-side provider key and redeploy.

`RATE_LIMITED`: respect `Retry-After`; do not remove protection to hide provider capacity problems.

Provider 429/5xx: bounded retry/backoff runs automatically. Persistent errors are surfaced per symbol.

No matches: this is valid. Do not automatically loosen gates. Review real charts first and tune one threshold at a time only when evidence supports it.
