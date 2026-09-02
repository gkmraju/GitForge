# Security Policy

GitForge performs privileged write operations against source-control providers. Security boundaries are therefore product requirements, not optional hardening.

## MVP security invariants

- Deny write operations unless the target repository and action pass policy checks.
- Prefer GitHub App installation/user tokens with short lifetimes; development PATs are fallback-only.
- Never log access tokens, private keys, webhook secrets, Authorization headers, or raw credential-bearing errors.
- Never expose tools for merge, auto-merge, CLA/DCO acceptance, legal attestation, secret management, branch-protection bypass, or destructive repository administration in the MVP.
- Mutation operations must be idempotent where practical and return verified resulting state.
- Contribution pull requests are Draft-only when PR creation is introduced.
- Provider responses are treated as untrusted input and normalized before reaching the agent-facing layer.
- Audit records must capture actor/installation, operation, target, policy decision, request correlation ID, timestamp, and result without secret material.

## Credential model

Production design uses a GitHub App and obtains short-lived tokens at request/job execution time. Long-lived user PATs must not be persisted by the hosted service. Development credentials are loaded only from process environment and must never be committed.

## Reporting vulnerabilities

Until a private disclosure channel is configured, do not publish credential exposure or exploitable authorization findings in a public issue. Contact the repository owner privately through GitHub instead.
