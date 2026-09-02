import { GitForgeError, type RepoRef } from "../../core/src/types.js";

export type PolicyContext = {
  actor: string;
  operation: "check_access" | "create_fork" | "wait_for_fork" | "sync_fork" | "create_branch" | "prepare_workspace";
  repository: RepoRef;
  destinationOwner?: string;
  branch?: string;
};

const SAFE_BRANCH = /^(?:contrib|fix|feat|docs|test|chore)\/[A-Za-z0-9._/-]{1,120}$/;

export function enforcePolicy(context: PolicyContext): void {
  if (!context.actor.trim()) {
    throw new GitForgeError("AUTH_REQUIRED", "Authenticated actor is required.");
  }

  if (!context.repository.owner.trim() || !context.repository.repo.trim()) {
    throw new GitForgeError("INVALID_REPOSITORY", "Repository owner and name are required.");
  }

  if (context.operation === "create_fork" && !context.destinationOwner?.trim()) {
    throw new GitForgeError("POLICY_DENIED", "Fork destination owner is required.");
  }

  if (context.operation === "create_branch") {
    if (!context.branch || !SAFE_BRANCH.test(context.branch)) {
      throw new GitForgeError(
        "POLICY_DENIED",
        "Contribution branches must use an approved prefix and safe branch-name characters.",
      );
    }

    if (["main", "master", "develop", "production"].includes(context.branch)) {
      throw new GitForgeError("POLICY_DENIED", "Protected/common default branches cannot be targeted.");
    }
  }
}
