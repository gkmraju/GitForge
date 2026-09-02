import { randomUUID } from "node:crypto";
import type { SourceControlProvider } from "../../core/src/provider.js";
import { GitForgeError, type ContributionWorkspace, type RepoRef } from "../../core/src/types.js";
import { enforcePolicy } from "../../policy/src/policy.js";

export type PrepareWorkspaceInput = {
  upstream: RepoRef;
  destinationOwner: string;
  branch: string;
  forkTimeoutMs?: number;
};

export async function prepareContributionWorkspace(
  provider: SourceControlProvider,
  input: PrepareWorkspaceInput,
): Promise<ContributionWorkspace> {
  const auditId = randomUUID();
  const actor = await provider.getAuthenticatedLogin();

  enforcePolicy({ actor, operation: "prepare_workspace", repository: input.upstream, destinationOwner: input.destinationOwner });
  enforcePolicy({ actor, operation: "create_branch", repository: input.upstream, branch: input.branch });

  let fork = await provider.findFork(input.upstream, input.destinationOwner);
  let forkCreated = false;

  if (!fork) {
    enforcePolicy({ actor, operation: "create_fork", repository: input.upstream, destinationOwner: input.destinationOwner });
    fork = await provider.createFork({ upstream: input.upstream, destinationOwner: input.destinationOwner });
    forkCreated = true;
  }

  if (!fork.ready || !fork.writable) {
    fork = await provider.waitForFork(fork.fork, input.forkTimeoutMs ?? 60_000);
  }

  if (!fork.writable) {
    throw new GitForgeError("NOT_WRITABLE", "Destination fork exists but is not writable by the authenticated actor.");
  }

  const upstreamHead = await provider.getDefaultBranchHead(input.upstream);
  const sync = await provider.syncFork(fork.fork, upstreamHead.branch);

  // Branch from the verified upstream head, not from a stale cached fork SHA.
  await provider.createBranch({ repository: fork.fork, branch: input.branch, sha: upstreamHead.sha });

  return {
    provider: provider.name,
    upstream: input.upstream,
    fork: fork.fork,
    forkCreated,
    forkReady: true,
    defaultBranch: upstreamHead.branch,
    upstreamHeadSha: upstreamHead.sha,
    forkSynced: sync.sha === upstreamHead.sha || sync.synced,
    writeAccess: true,
    contributionBranch: input.branch,
    status: "ready",
    auditId,
  };
}
