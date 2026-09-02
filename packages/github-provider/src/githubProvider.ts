import { Octokit } from "@octokit/rest";
import type { SourceControlProvider, CreateBranchInput, CreateForkInput } from "../../core/src/provider.js";
import { GitForgeError, type AccessCheck, type AccessLevel, type ForkState, type RepoRef } from "../../core/src/types.js";

const permissions: AccessLevel[] = ["none", "read", "triage", "write", "maintain", "admin"];

function repoArgs(repository: RepoRef) {
  return { owner: repository.owner, repo: repository.repo };
}

function asRepo(owner: string, repo: string): RepoRef {
  return { provider: "github", owner, repo };
}

export class GitHubProvider implements SourceControlProvider {
  readonly name = "github" as const;

  constructor(private readonly octokit: Octokit) {}

  static fromToken(token: string): GitHubProvider {
    if (!token.trim()) throw new GitForgeError("AUTH_REQUIRED", "GitHub credential is required.");
    return new GitHubProvider(new Octokit({ auth: token }));
  }

  async getAuthenticatedLogin(): Promise<string> {
    const { data } = await this.octokit.rest.users.getAuthenticated();
    return data.login;
  }

  async checkAccess(repository: RepoRef, username: string): Promise<AccessCheck> {
    const actor = await this.getAuthenticatedLogin();
    let permission: AccessLevel = "none";

    if (actor.toLowerCase() === username.toLowerCase()) {
      const { data } = await this.octokit.rest.repos.get(repoArgs(repository));
      const p = data.permissions;
      permission = p?.admin ? "admin" : p?.maintain ? "maintain" : p?.push ? "write" : p?.triage ? "triage" : p?.pull ? "read" : "none";
    } else {
      try {
        const { data } = await this.octokit.rest.repos.getCollaboratorPermissionLevel({ ...repoArgs(repository), username });
        permission = permissions.includes(data.permission as AccessLevel) ? (data.permission as AccessLevel) : "none";
      } catch {
        permission = "none";
      }
    }

    return { repository, authenticatedLogin: actor, permission, writable: ["write", "maintain", "admin"].includes(permission) };
  }

  async findFork(upstream: RepoRef, destinationOwner: string): Promise<ForkState | null> {
    try {
      const { data } = await this.octokit.rest.repos.get({ owner: destinationOwner, repo: upstream.repo });
      const parent = data.parent?.full_name?.toLowerCase();
      if (!data.fork || parent !== `${upstream.owner}/${upstream.repo}`.toLowerCase()) return null;
      const fork = asRepo(destinationOwner, upstream.repo);
      const access = await this.checkAccess(fork, destinationOwner);
      return {
        upstream,
        fork,
        created: false,
        ready: true,
        writable: access.writable,
        defaultBranch: data.default_branch,
      };
    } catch (error: unknown) {
      const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: number }).status) : undefined;
      if (status === 404) return null;
      throw new GitForgeError("PROVIDER_ERROR", "Unable to inspect destination fork.", status === 429 || status === 403);
    }
  }

  async createFork(input: CreateForkInput): Promise<ForkState> {
    try {
      const { data } = await this.octokit.rest.repos.createFork({ ...repoArgs(input.upstream), organization: input.destinationOwner });
      return {
        upstream: input.upstream,
        fork: asRepo(data.owner.login, data.name),
        created: true,
        ready: false,
        writable: false,
        defaultBranch: data.default_branch,
      };
    } catch (error: unknown) {
      const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: number }).status) : undefined;
      throw new GitForgeError("FORK_FAILED", "GitHub fork creation failed.", status === 429 || status === 403 || (status !== undefined && status >= 500));
    }
  }

  async waitForFork(fork: RepoRef, timeoutMs: number): Promise<ForkState> {
    const started = Date.now();
    let delayMs = 500;
    while (Date.now() - started < timeoutMs) {
      try {
        const { data } = await this.octokit.rest.repos.get(repoArgs(fork));
        const access = await this.checkAccess(fork, fork.owner);
        if (access.writable) {
          const parent = data.parent;
          return {
            upstream: parent ? asRepo(parent.owner.login, parent.name) : fork,
            fork,
            created: true,
            ready: true,
            writable: true,
            defaultBranch: data.default_branch,
          };
        }
      } catch {
        // Fork creation is asynchronous; retry until the bounded deadline.
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(Math.floor(delayMs * 1.7), 5_000);
    }
    throw new GitForgeError("FORK_TIMEOUT", "Fork did not become writable before the deadline.", true);
  }

  async getDefaultBranchHead(repository: RepoRef): Promise<{ branch: string; sha: string }> {
    const { data: repo } = await this.octokit.rest.repos.get(repoArgs(repository));
    const branch = repo.default_branch;
    const { data: ref } = await this.octokit.rest.git.getRef({ ...repoArgs(repository), ref: `heads/${branch}` });
    return { branch, sha: ref.object.sha };
  }

  async syncFork(fork: RepoRef, branch: string): Promise<{ synced: boolean; sha: string }> {
    try {
      const { data } = await this.octokit.rest.repos.mergeUpstream({ ...repoArgs(fork), branch });
      const { data: ref } = await this.octokit.rest.git.getRef({ ...repoArgs(fork), ref: `heads/${branch}` });
      return { synced: data.merge_type !== "none", sha: ref.object.sha };
    } catch {
      throw new GitForgeError("SYNC_FAILED", "Unable to synchronize fork with upstream.", true);
    }
  }

  async createBranch(input: CreateBranchInput): Promise<void> {
    try {
      await this.octokit.rest.git.createRef({ ...repoArgs(input.repository), ref: `refs/heads/${input.branch}`, sha: input.sha });
    } catch (error: unknown) {
      const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: number }).status) : undefined;
      if (status === 422) {
        const { data } = await this.octokit.rest.git.getRef({ ...repoArgs(input.repository), ref: `heads/${input.branch}` });
        if (ref.object.sha === input.sha) return;
      }
      throw new GitForgeError("BRANCH_FAILED", "Unable to create contribution branch.", status === 429 || (status !== undefined && status >= 500));
    }
  }
}
