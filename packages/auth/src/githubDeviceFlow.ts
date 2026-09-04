import { GitForgeError } from "../../core/src/types.js";
import { GitHubProvider } from "../../github-provider/src/githubProvider.js";
import { sealPayload, unsealPayload, type GitHubDeviceRequest } from "./sessionToken.js";

type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  interval?: number;
};

async function postForm<T>(url: string, body: URLSearchParams): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new GitForgeError("PROVIDER_ERROR", "GitHub OAuth request failed.", response.status >= 500);
  return await response.json() as T;
}

export async function startGitHubDeviceFlow(clientId: string, sessionKey: string) {
  if (!clientId.trim()) throw new GitForgeError("AUTH_REQUIRED", "GITHUB_OAUTH_CLIENT_ID is required.");
  const data = await postForm<DeviceCodeResponse>(
    "https://github.com/login/device/code",
    new URLSearchParams({ client_id: clientId, scope: "public_repo" }),
  );
  const now = Date.now();
  const request: GitHubDeviceRequest = {
    kind: "github_device",
    deviceCode: data.device_code,
    issuedAt: now,
    expiresAt: now + data.expires_in * 1000,
    intervalSeconds: Math.max(data.interval, 5),
  };
  return {
    authRequest: sealPayload(request, sessionKey),
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresInSeconds: data.expires_in,
    intervalSeconds: request.intervalSeconds,
    scope: "public_repo",
  };
}

export async function pollGitHubDeviceFlow(
  authRequest: string,
  clientId: string,
  sessionKey: string,
) {
  const request = unsealPayload(authRequest, sessionKey);
  if (request.kind !== "github_device") throw new GitForgeError("AUTH_REQUIRED", "Invalid device authorization request.");

  const data = await postForm<TokenResponse>(
    "https://github.com/login/oauth/access_token",
    new URLSearchParams({
      client_id: clientId,
      device_code: request.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  );

  if (!data.access_token) {
    if (data.error === "authorization_pending" || data.error === "slow_down") {
      return {
        status: "pending" as const,
        retryAfterSeconds: data.error === "slow_down"
          ? Math.max((data.interval ?? request.intervalSeconds) + 5, 10)
          : request.intervalSeconds,
      };
    }
    if (data.error === "expired_token" || data.error === "access_denied") {
      throw new GitForgeError("AUTH_REQUIRED", data.error_description ?? "GitHub device authorization was not completed.");
    }
    throw new GitForgeError("PROVIDER_ERROR", "GitHub device authorization failed.");
  }

  const provider = GitHubProvider.fromToken(data.access_token);
  const login = await provider.getAuthenticatedLogin();
  const now = Date.now();
  const sessionToken = sealPayload({
    kind: "github_session",
    githubToken: data.access_token,
    githubLogin: login,
    issuedAt: now,
    expiresAt: now + 60 * 60 * 1000,
  }, sessionKey);

  return {
    status: "authorized" as const,
    sessionToken,
    login,
    expiresInSeconds: 3600,
    scope: data.scope ?? "public_repo",
  };
}
