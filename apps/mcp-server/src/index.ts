import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GitHubProvider } from "../../../packages/github-provider/src/githubProvider.js";
import { GitForgeError } from "../../../packages/core/src/types.js";
import { createGitForgeMcpServer } from "./serverFactory.js";

const token = process.env.GITHUB_TOKEN;
if (!token) throw new GitForgeError("AUTH_REQUIRED", "GITHUB_TOKEN is required for the development MCP server.");

const server = createGitForgeMcpServer(GitHubProvider.fromToken(token));
const transport = new StdioServerTransport();
await server.connect(transport);
