# GitForge Architecture

GitForge is an agent-safe orchestration layer for preparing contribution workspaces across source-control providers.

## North-star operation

`prepare_contribution_workspace(repo)` performs a policy-checked sequence:

1. Normalize provider/repository identity.
2. Resolve caller identity and installation scope.
3. Check whether an execution-ready writable fork already exists.
4. Create a fork when policy permits and no fork exists.
5. Poll until the fork is readable and writable.
6. Compare fork default branch with upstream and synchronize safely.
7. Create an isolated contribution branch from the verified upstream default SHA.
8. Return a verified readiness result plus audit correlation ID.

## Layering

- `apps/mcp-server`: MCP transport and tool registration only. No provider business logic.
- `packages/core`: provider-neutral contracts, normalized errors, and result models.
- `packages/github-provider`: GitHub API adapter. All provider-specific semantics stay here.
- `packages/policy`: deny-by-default authorization and operation constraints.
- `packages/orchestration`: idempotent multi-step workflows such as workspace preparation.
- Future `packages/audit`: append-oriented audit sink abstraction.
- Future `apps/worker`: asynchronous jobs for fork readiness, syncing, and provider rate-limit recovery.

## Scalability

The MCP/API process is designed to be stateless. Long-running/retryable work will move behind a queue while PostgreSQL stores durable job/audit metadata. Provider operations must tolerate retries and use deterministic idempotency keys. Horizontal workers may process independent repositories concurrently while a repository-scoped lease prevents conflicting mutations.

## Security

Authentication and authorization are separate. A valid GitHub token is not sufficient authorization: every write must also pass GitForge policy. Production credentials should be short-lived GitHub App tokens minted just-in-time. Secrets never enter agent-facing tool responses or audit payloads.

## Sustainability

Provider-neutral contracts are intentionally separate from GitHub. The open-source core should remain self-hostable. Hosted value can later come from managed auth, policy administration, audit retention, team approvals, observability, multi-provider routing, and SLA-backed job execution.

## Non-goals for MVP

GitForge will not edit arbitrary source code, merge pull requests, bypass repository protections, accept legal agreements, manage repository secrets, or provide unrestricted GitHub administration.
