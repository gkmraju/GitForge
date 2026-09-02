import assert from "node:assert/strict";
import test from "node:test";
import { enforcePolicy } from "../packages/policy/src/policy.js";

const repo = { provider: "github" as const, owner: "octo", repo: "project" };

test("allows focused contribution branches", () => {
  assert.doesNotThrow(() => enforcePolicy({ actor: "alice", operation: "create_branch", repository: repo, branch: "fix/fork-readiness" }));
});

test("rejects unsafe branch names", () => {
  assert.throws(
    () => enforcePolicy({ actor: "alice", operation: "create_branch", repository: repo, branch: "main" }),
    /approved prefix|cannot be targeted/,
  );
});

test("requires a fork destination", () => {
  assert.throws(
    () => enforcePolicy({ actor: "alice", operation: "create_fork", repository: repo }),
    /destination owner/i,
  );
});
