# Authentication strategy

GitForge separates development authentication from the production product model.

## Development smoke tests

For a short-lived end-to-end test against arbitrary public repositories, use a personal access token (classic) with only the `public_repo` scope.

Store it only as the repository Actions secret `GITFORGE_GITHUB_TOKEN`. Do not commit it, paste it into issues, or expose it to MCP responses. Prefer a short expiration and revoke it after the smoke test.

A fine-grained PAT is not a reliable universal solution for GitForge's core use case because the GitHub fork endpoint requires permissions on the source repository. GitForge must be able to fork arbitrary public repositories that the user does not own.

## Production direction

GitHub Apps are preferred where the app can be installed on both source and destination, but GitHub explicitly requires a fork-creating GitHub App to be installed on the destination account and on the source account with access to the source repository. That does not fit arbitrary public open-source contribution discovery.

For the hosted product, the preferred user-facing model is therefore an OAuth authorization flow restricted to public-repository access for the public-contribution workflow. GitForge should request broader private-repository access only as a separate, explicit capability.

Production tokens must be encrypted at rest if persistence is unavoidable, scoped per user/session, redacted from all logs, and rotated/revoked on disconnect.

## Safety boundary

Authentication proves who the caller is. It does not authorize every write. GitForge policy still independently constrains fork destination, branch naming, supported operations, and destructive/legal actions.
