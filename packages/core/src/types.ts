export type ProviderName = "github";

export type RepoRef = {
  provider: ProviderName;
  owner: string;
  repo: string;
};

export type AccessLevel = "none" | "read" | "triage" | "write" | "maintain" | "admin";

export type AccessCheck = {
  repository: RepoRef;
  authenticatedLogin: string;
  permission: AccessLevel;
  writable: boolean;
};

export type ForkState = {
  upstream: RepoRef;
  fork: RepoRef;
  created: boolean;
  ready: boolean;
  writable: boolean;
  defaultBranch: string;
};

export type ContributionWorkspace = {
  provider: ProviderName;
  upstream: RepoRef;
  fork: RepoRef;
  forkCreated: boolean;
  forkReady: boolean;
  defaultBranch: string;
  upstreamHeadSha: string;
  forkSynced: boolean;
  writeAccess: boolean;
  contributionBranch: string;
  status: "ready" | "blocked";
  auditId: string;
};

export class GitForgeError extends Error {
  constructor(
    public readonly code:
      | "INVALID_REPOSITORY"
      | "AUTH_REQUIRED"
      | "POLICY_DENIED"
      | "NOT_WRITABLE"
      | "FORK_FAILED"
      | "FORK_TIMEOUT"
      | "SYNC_FAILED"
      | "BRANCH_FAILED"
      | "PROVIDER_ERROR",
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "GitForgeError";
  }
}
