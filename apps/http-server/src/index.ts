import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { GitForgeError } from "../../../packages/core/src/types.js";
import { GitHubProvider } from "../../../packages/github-provider/src/githubProvider.js";
import { pollGitHubDeviceFlow, startGitHubDeviceFlow } from "../../../packages/auth/src/githubDeviceFlow.js";
import { unsealPayload } from "../../../packages/auth/src/sessionToken.js";
import { createGitForgeMcpServer } from "../../mcp-server/src/serverFactory.js";

const port = Number(process.env.PORT ?? 3000);
const clientId = process.env.GITHUB_OAUTH_CLIENT_ID ?? "";
const sessionKey = process.env.GITFORGE_SESSION_KEY ?? "";

function json(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data),
    "cache-control": "no-store",
  });
  res.end(data);
}

async function readJson(req: IncomingMessage, limitBytes = 1_048_576): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limitBytes) throw new GitForgeError("PROVIDER_ERROR", "Request body too large.");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new GitForgeError("PROVIDER_ERROR", "Invalid JSON request body.");
  }
}

function bearer(req: IncomingMessage): string {
  const value = req.headers.authorization;
  if (!value?.startsWith("Bearer ")) throw new GitForgeError("AUTH_REQUIRED", "Bearer authorization is required.");
  return value.slice("Bearer ".length).trim();
}

function requireRuntimeSecrets(): void {
  if (!clientId.trim()) throw new GitForgeError("AUTH_REQUIRED", "GITHUB_OAUTH_CLIENT_ID is required.");
  if (!sessionKey.trim()) throw new GitForgeError("AUTH_REQUIRED", "GITFORGE_SESSION_KEY is required.");
}

function safeError(error: unknown) {
  return error instanceof GitForgeError
    ? { code: error.code, message: error.message, retryable: error.retryable }
    : { code: "PROVIDER_ERROR", message: "GitForge request failed.", retryable: false };
}

const httpServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { status: "ok", service: "gitforge", version: "0.2.0" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/auth/github/device/start") {
      requireRuntimeSecrets();
      json(res, 200, await startGitHubDeviceFlow(clientId, sessionKey));
      return;
    }

    if (req.method === "POST" && url.pathname === "/auth/github/device/poll") {
      requireRuntimeSecrets();
      const body = await readJson(req);
      const authRequest = typeof body.authRequest === "string" ? body.authRequest : "";
      if (!authRequest) throw new GitForgeError("AUTH_REQUIRED", "authRequest is required.");
      json(res, 200, await pollGitHubDeviceFlow(authRequest, clientId, sessionKey));
      return;
    }

    if (req.method === "POST" && url.pathname === "/mcp") {
      requireRuntimeSecrets();
      const payload = unsealPayload(bearer(req), sessionKey);
      if (payload.kind !== "github_session") throw new GitForgeError("AUTH_REQUIRED", "GitForge user session is required.");

      const body = await readJson(req);
      const provider = GitHubProvider.fromToken(payload.githubToken);
      const mcp = createGitForgeMcpServer(provider);
      // v1 SDK documents undefined as the stateless mode sentinel, but its published
      // types conflict with exactOptionalPropertyTypes. Keep the cast isolated here.
      const transportOptions = { sessionIdGenerator: undefined } as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0];
      const transport = new StreamableHTTPServerTransport(transportOptions);
      res.on("close", () => void transport.close());
      await mcp.connect(transport as unknown as Parameters<typeof mcp.connect>[0]);
      await transport.handleRequest(req, res, body);
      return;
    }

    if (url.pathname === "/mcp") {
      res.writeHead(405, { allow: "POST" });
      res.end();
      return;
    }

    json(res, 404, { code: "NOT_FOUND", message: "Route not found." });
  } catch (error) {
    const safe = safeError(error);
    json(res, safe.code === "AUTH_REQUIRED" ? 401 : 400, safe);
  }
});

httpServer.listen(port, "0.0.0.0", () => {
  process.stdout.write(`GitForge HTTP server listening on :${port}\n`);
});
