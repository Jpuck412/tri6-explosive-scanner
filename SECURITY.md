# Security Policy

TRI6 is live-market analysis software. Provider credentials are server-side secrets and must never use a `NEXT_PUBLIC_` prefix.

## Production controls

- Set `SCANNER_ACCESS_TOKEN` on public deployments.
- Keep provider credentials in the deployment secret store.
- `/api/scan` applies request-size, authentication and rate-limit controls.
- Provider errors are sanitized before returning to clients.
- CI blocks high-severity production dependency advisories.
- Runtime responses disable caching and expose request IDs for incident tracing.

## Reporting

Do not place credentials, tokens, complete request headers, or private market-data payloads in public GitHub issues. Revoke a credential immediately if it is accidentally committed or exposed.
