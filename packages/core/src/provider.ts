import type { AccessCheck, ForkState, RepoRef } from "./types.js";

export type CreateForkInput = {
  upstream: RepoRef;
  destinationOwner: string;
};

export type CreateBranchInput = {
  repository: RepoRef;
  branch: string;
  sha: string;
};

export interface SourceControlProvider {
  readonly name: "github";
  getAuthenticatedLogin(): Promise<string>;
  checkAccess(repository: RepoRef, username: string): Promise<AccessCheck>;
  findFork(upstream: RepoRef, destinationOwner: string): Promise<ForkState | null>;
  createFork(input: CreateForkInput): Promise<ForkState>;
  waitForFork(fork: RepoRef, timeoutMs: number): Promise<ForkState>;
  getDefaultBranchHead(repository: RepoRef): Promise<{ branch: string; sha: string }>;
  syncFork(fork: RepoRef, branch: string): Promise<{ synced: boolean; sha: string }>;
  createBranch(input: CreateBranchInput): Promise<void>;
}
