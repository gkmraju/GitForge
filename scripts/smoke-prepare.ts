import { GitHubProvider } from "../packages/github-provider/src/githubProvider.js";
import { prepareContributionWorkspace } from "../packages/orchestration/src/prepareContributionWorkspace.js";
import type { RepoRef } from "../packages/core/src/types.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseRepo(value: string): RepoRef {
  const match = value.trim().replace(/\.git$/, "").match(/^(?:https:\/\/github\.com\/)?([^/\s]+)\/([^/\s]+)$/i);
  if (!match) throw new Error("GITFORGE_TARGET_REPOSITORY must be owner/repo or a GitHub repository URL");
  return { provider: "github", owner: match[1]!, repo: match[2]! };
}

const provider = GitHubProvider.fromToken(required("GITFORGE_GITHUB_TOKEN"));
const workspace = await prepareContributionWorkspace(provider, {
  upstream: parseRepo(required("GITFORGE_TARGET_REPOSITORY")),
  destinationOwner: required("GITFORGE_DESTINATION_OWNER"),
  branch: required("GITFORGE_BRANCH"),
  forkTimeoutMs: 120_000,
});

// Deliberately output only non-secret verified workspace state.
process.stdout.write(JSON.stringify(workspace, null, 2) + "\n");
