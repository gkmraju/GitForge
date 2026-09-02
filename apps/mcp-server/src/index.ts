import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GitHubProvider } from "../../../packages/github-provider/src/githubProvider.js";
import { prepareContributionWorkspace } from "../../../packages/orchestration/src/prepareContributionWorkspace.js";
import { GitForgeError, type RepoRef } from "../../../packages/core/src/types.js";

function parseGitHubRepo(value: string): RepoRef {
  const trimmed = value.trim().replace(/\.git$/, "");
  const match = trimmed.match(/^(?:https:\/\/github\.com\/)?([^/\s]+)\/([^/\s]+)$/i);
  if (!match) throw new GitForgeError("INVALID_REPOSITORY", "Expected owner/repo or a github.com repository URL.");
  return { provider: "github", owner: match[1]!, repo: match[2]! };
}

const token = process.env.GITHUB_TOKEN;
if (!token) throw new GitForgeError("AUTH_REQUIRED", "GITHUB_TOKEN is required for the development MCP server.");

const provider = GitHubProvider.fromToken(token);
const server = new McpServer({ name: "gitforge", version: "0.1.0" });

server.registerTool(
  "prepare_contribution_workspace",
  {
    title: "Prepare contribution workspace",
    description: "Safely prepare a writable GitHub fork and isolated contribution branch. Does not edit code, merge PRs, or accept legal agreements.",
    inputSchema: {
      repository: z.string().min(3),
      destinationOwner: z.string().min(1),
      branch: z.string().min(3),
      forkTimeoutMs: z.number().int().min(1_000).max(180_000).optional(),
    },
  },
  async ({ repository, destinationOwner, branch, forkTimeoutMs }) => {
    try {
      const workspace = await prepareContributionWorkspace(provider, {
        upstream: parseGitHubRepo(repository),
        destinationOwner,
        branch,
        ...(forkTimeoutMs === undefined ? {} : { forkTimeoutMs }),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(workspace, null, 2) }],
        structuredContent: workspace,
      };
    } catch (error) {
      const safe = error instanceof GitForgeError
        ? { code: error.code, message: error.message, retryable: error.retryable }
        : { code: "PROVIDER_ERROR", message: "GitForge operation failed.", retryable: false };
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(safe) }],
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
