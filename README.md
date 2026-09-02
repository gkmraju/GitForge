# GitForge

**Agent-safe contribution infrastructure for GitHub and MCP workflows.**

GitForge turns an external repository into an execution-ready contribution workspace for AI coding agents: permission check → fork → readiness wait → upstream sync → focused branch.

## Design principles

- **Security first:** least privilege, short-lived credentials, deny-by-default write policy, no merge/legal-attestation tools.
- **Agent safety:** explicit scopes, idempotent mutations, auditable actions, draft-only contribution workflows.
- **Scalable by design:** stateless MCP/API ingress, provider adapters, queue-friendly orchestration, external state.
- **Sustainable:** open core, provider-independent contracts, hosted policy/audit/team features later.
- **Honest execution:** never claim a mutation, validation, or readiness state unless verified.

## MVP

The first vertical slice exposes six GitHub-oriented capabilities:

1. `check_access`
2. `create_fork`
3. `wait_for_fork`
4. `sync_fork`
5. `create_branch`
6. `prepare_contribution_workspace`

The orchestrator is intentionally narrow. Code editing, merging, CLA/DCO acceptance, and unrestricted GitHub administration are out of scope for the MVP.

## Status

Early architecture/MVP build.
