# Hosted deployment

GitForge 0.2 exposes a stateless HTTP service suitable for a single container or horizontally scaled replicas behind HTTPS.

## Required environment

- `GITHUB_OAUTH_CLIENT_ID`: GitHub OAuth App client ID with Device Flow enabled.
- `GITFORGE_SESSION_KEY`: base64-encoded 32-byte key used only to encrypt short-lived GitForge session envelopes.
- `PORT`: optional HTTP port, default `3000`.

Generate the session key locally:

```bash
openssl rand -base64 32
```

Store both values in the deployment platform's secret manager. Never commit them.

## Routes

- `GET /health`: unauthenticated liveness check.
- `POST /auth/github/device/start`: begins GitHub Device Flow for `public_repo`.
- `POST /auth/github/device/poll`: polls authorization and returns a short-lived opaque GitForge session bearer.
- `POST /mcp`: MCP Streamable HTTP endpoint; requires `Authorization: Bearer <gitforge-session>`.

## Security properties

- Raw GitHub OAuth access tokens are never returned by GitForge.
- The GitForge bearer is AES-256-GCM encrypted and expires after one hour.
- The service stores no OAuth token database in Milestone 2, enabling stateless horizontal replicas.
- Tool policy remains independent from authentication.
- Production deployment must terminate TLS before traffic reaches this service.

## Current limitation

Because Milestone 2 is stateless, GitForge cannot independently revoke a previously issued one-hour session before expiry. Users can revoke the underlying GitHub OAuth authorization immediately through GitHub. A durable revocation/session registry belongs in the hosted multi-tenant milestone.
