import { createHash, randomBytes } from "node:crypto";
import { ENV } from "./_core/env";
import { consumeWearableOAuthState, disconnectWearable, getWearableConnectionPrivate, ingestWearableActivity, refreshWearableAccessToken, saveWearableDailySummary, saveWearableTokens, updateWearableSyncState, upsertWearableConnection } from "./db";
import { decryptWearableSecret, encryptWearableSecret } from "./wearable-crypto";

type Provider = "google_health" | "garmin" | "coros";
const oauthConfig: Record<Exclude<Provider, "coros">, { clientId: string; clientSecret: string; authorize: string; token: string; redirect: string; scopes: string[] }> = {
  google_health: { clientId: ENV.googleHealthClientId, clientSecret: ENV.googleHealthClientSecret, authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", redirect: ENV.googleHealthRedirectUri, scopes: ["https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly", "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly", "https://www.googleapis.com/auth/googlehealth.sleep.readonly"] },
  garmin: { clientId: ENV.garminClientId, clientSecret: ENV.garminClientSecret, authorize: ENV.garminAuthorizeUrl, token: ENV.garminTokenUrl, redirect: `${ENV.appPublicUrl}/api/wearables/callback/garmin`, scopes: [] },
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function beginWearableOAuth(userId: number, provider: Provider) {
  const existing = await getWearableConnectionPrivate(userId, provider);
  if (provider === "coros") return beginCorosOAuth(userId, existing?.tokenPayloadEncrypted ?? null);
  const cfg = oauthConfig[provider];
  if (!ENV.wearableTokenEncryptionKey || !cfg.clientId || !cfg.clientSecret || !cfg.authorize || !cfg.token || !cfg.redirect) {
    if (!existing?.tokenPayloadEncrypted) await upsertWearableConnection({ userId, provider, status: "authorization_required", lastSyncStatus: "authorization_required", lastSyncError: "OAuth backend credentials are not configured." });
    return { status: "authorization_required" as const, authorizationUrl: null, message: "A plataforma ainda requer credenciais e configuração OAuth no backend." };
  }
  if (!existing?.tokenPayloadEncrypted) await upsertWearableConnection({ userId, provider, status: "authorization_required", lastSyncStatus: "authorization_required", lastSyncError: null });
  const state = randomBytes(32).toString("base64url");
  const verifier = provider === "google_health" ? randomBytes(48).toString("base64url") : null;
  await (await import("./db")).saveWearableOAuthState({ stateHash: hash(state), userId, provider, verifierEncrypted: verifier ? encryptWearableSecret(verifier) : null, expiresAt: new Date(Date.now() + 10 * 60_000) });
  const url = new URL(cfg.authorize);
  url.searchParams.set("client_id", cfg.clientId); url.searchParams.set("redirect_uri", cfg.redirect); url.searchParams.set("response_type", "code"); url.searchParams.set("state", state);
  if (verifier) { url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url")); url.searchParams.set("code_challenge_method", "S256"); }
  if (cfg.scopes.length) { url.searchParams.set("scope", cfg.scopes.join(" ")); url.searchParams.set("access_type", "offline"); url.searchParams.set("prompt", "consent"); }
  return { status: "authorization_required" as const, authorizationUrl: url.toString(), message: "A autorização ocorrerá diretamente na plataforma." };
}

async function beginCorosOAuth(userId: number, existingPayload: string | null) {
  const alreadyConnected = Boolean(existingPayload);
  if (!ENV.wearableTokenEncryptionKey || !ENV.appPublicUrl) {
    if (!alreadyConnected) await upsertWearableConnection({ userId, provider: "coros", status: "authorization_required", lastSyncStatus: "authorization_required", lastSyncError: "COROS OAuth requires the public app URL and token encryption key." });
    return { status: "authorization_required" as const, authorizationUrl: null, message: "Configure PUBLIC_APP_URL e WEARABLE_TOKEN_ENCRYPTION_KEY no backend para ligar a COROS." };
  }
  const resourceResponse = await fetch("https://mcp.coros.com/.well-known/oauth-protected-resource/mcp", { signal: AbortSignal.timeout(10_000) });
  if (!resourceResponse.ok) throw new Error("COROS authorization metadata is unavailable.");
  const resource = await resourceResponse.json() as { resource?: string; authorization_servers?: string[] };
  const issuer = resource.authorization_servers?.[0];
  const isOfficialCorosUrl = (value: string) => { try { const url = new URL(value); return url.protocol === "https:" && (url.hostname === "coros.com" || url.hostname.endsWith(".coros.com")); } catch { return false; } };
  if (!issuer || !resource.resource || !isOfficialCorosUrl(issuer) || !isOfficialCorosUrl(resource.resource) || new URL(resource.resource).pathname !== "/mcp") throw new Error("Unexpected COROS OAuth metadata.");
  const metadataResponse = await fetch(`${issuer}/.well-known/oauth-authorization-server`, { signal: AbortSignal.timeout(10_000) });
  if (!metadataResponse.ok) throw new Error("COROS OAuth server metadata is unavailable.");
  const metadata = await metadataResponse.json() as { authorization_endpoint?: string; token_endpoint?: string; registration_endpoint?: string; revocation_endpoint?: string };
  if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.registration_endpoint || !isOfficialCorosUrl(metadata.authorization_endpoint) || !isOfficialCorosUrl(metadata.token_endpoint) || !isOfficialCorosUrl(metadata.registration_endpoint) || (metadata.revocation_endpoint && !isOfficialCorosUrl(metadata.revocation_endpoint))) throw new Error("COROS OAuth metadata is incomplete or invalid.");
  const redirectUri = `${ENV.appPublicUrl.replace(/\/$/, "")}/api/wearables/callback/coros`;
  let registeredClientId: string | undefined;
  if (existingPayload) {
    try { registeredClientId = (JSON.parse(decryptWearableSecret(existingPayload)) as { client_id?: string }).client_id; } catch { registeredClientId = undefined; }
  }
  if (!registeredClientId) {
    const registrationResponse = await fetch(metadata.registration_endpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ client_name: "Ritmo Pro Man", application_type: "web", redirect_uris: [redirectUri], response_types: ["code"], grant_types: ["authorization_code", "refresh_token"], token_endpoint_auth_method: "none", scope: "openid mcp.tools offline_access" }), signal: AbortSignal.timeout(15_000) });
    const registration = await registrationResponse.json() as { client_id?: string };
    if (!registrationResponse.ok || !registration.client_id) throw new Error("COROS dynamic client registration failed.");
    registeredClientId = registration.client_id;
  }
  const state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
  const oauthPayload = { verifier, clientId: registeredClientId, tokenEndpoint: metadata.token_endpoint, revokeEndpoint: metadata.revocation_endpoint, mcpUrl: resource.resource, redirectUri };
  await (await import("./db")).saveWearableOAuthState({ stateHash: hash(state), userId, provider: "coros", verifierEncrypted: encryptWearableSecret(JSON.stringify(oauthPayload)), expiresAt: new Date(Date.now() + 10 * 60_000) });
  if (!alreadyConnected) await upsertWearableConnection({ userId, provider: "coros", status: "authorization_required", lastSyncStatus: "authorization_required", lastSyncError: null });
  const authorize = new URL(metadata.authorization_endpoint);
  authorize.searchParams.set("client_id", registeredClientId); authorize.searchParams.set("redirect_uri", redirectUri); authorize.searchParams.set("response_type", "code"); authorize.searchParams.set("scope", "openid mcp.tools offline_access"); authorize.searchParams.set("state", state); authorize.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url")); authorize.searchParams.set("code_challenge_method", "S256"); authorize.searchParams.set("resource", resource.resource);
  return { status: "authorization_required" as const, authorizationUrl: authorize.toString(), message: "A autorização ocorrerá diretamente na COROS." };
}

export async function finishWearableOAuth(provider: Provider, state: string, code: string) {
  const stateRow = await consumeWearableOAuthState(hash(state));
  if (!stateRow || stateRow.provider !== provider) throw new Error("OAuth state expired or invalid");
  if (provider === "coros") {
    if (!stateRow.verifierEncrypted) throw new Error("COROS OAuth verifier missing.");
    const oauth = JSON.parse(decryptWearableSecret(stateRow.verifierEncrypted)) as { verifier: string; clientId: string; tokenEndpoint: string; revokeEndpoint?: string; mcpUrl: string; redirectUri: string };
    const response = await fetch(oauth.tokenEndpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: oauth.clientId, redirect_uri: oauth.redirectUri, code_verifier: oauth.verifier }), signal: AbortSignal.timeout(15_000) });
    const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!response.ok || !token.access_token) throw new Error("COROS token exchange failed.");
    await saveWearableTokens({ userId: stateRow.userId, provider, tokenPayloadEncrypted: encryptWearableSecret(JSON.stringify({ ...token, client_id: oauth.clientId, token_endpoint: oauth.tokenEndpoint, revoke_endpoint: oauth.revokeEndpoint, mcp_url: oauth.mcpUrl, redirect_uri: oauth.redirectUri })), tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null, grantedScopes: token.scope ?? "openid mcp.tools offline_access", timeZone: ENV.appTimeZone });
    return;
  }
  const cfg = oauthConfig[provider as Exclude<Provider, "coros">];
  const body = new URLSearchParams({ grant_type: "authorization_code", code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirect });
  if (stateRow.verifierEncrypted) body.set("code_verifier", decryptWearableSecret(stateRow.verifierEncrypted));
  const response = await fetch(cfg.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body, signal: AbortSignal.timeout(15_000) });
  const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
  if (!response.ok || !token.access_token) throw new Error("Provider token exchange failed");
  const old = await getWearableConnectionPrivate(stateRow.userId, provider);
  const payload = { access_token: token.access_token, refresh_token: token.refresh_token ?? (old?.tokenPayloadEncrypted ? JSON.parse(decryptWearableSecret(old.tokenPayloadEncrypted)).refresh_token : undefined), token_type: "Bearer" };
  await saveWearableTokens({ userId: stateRow.userId, provider, tokenPayloadEncrypted: encryptWearableSecret(JSON.stringify(payload)), tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null, grantedScopes: token.scope ?? null, timeZone: ENV.appTimeZone });
}

export async function disconnectWearableAccount(userId: number, provider: Provider | "apple_health" | "health_connect") {
  const row = await getWearableConnectionPrivate(userId, provider);
  if (provider === "google_health" && row?.tokenPayloadEncrypted) {
    try {
      const token = JSON.parse(decryptWearableSecret(row.tokenPayloadEncrypted)) as { access_token?: string; refresh_token?: string };
      const revokeToken = token.refresh_token ?? token.access_token;
      if (revokeToken) await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: revokeToken }), signal: AbortSignal.timeout(10_000) });
    } catch { /* Locally remove tokens even if upstream revocation is unavailable. */ }
  }
  if (provider === "coros" && row?.tokenPayloadEncrypted) {
    try {
      const token = JSON.parse(decryptWearableSecret(row.tokenPayloadEncrypted)) as CorosTokens;
      const revokeToken = token.refresh_token ?? token.access_token;
      if (revokeToken && token.revoke_endpoint) await fetch(token.revoke_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: revokeToken, client_id: token.client_id, token_type_hint: token.refresh_token ? "refresh_token" : "access_token" }), signal: AbortSignal.timeout(10_000) });
    } catch { /* Locally remove tokens even if upstream revocation is unavailable. */ }
  }
  await disconnectWearable(userId, provider);
  return { status: "disconnected" as const };
}

async function googleAccessToken(userId: number) {
  const row = await getWearableConnectionPrivate(userId, "google_health");
  if (!row?.tokenPayloadEncrypted) throw new Error("AUTHORIZATION_REQUIRED");
  const payload = JSON.parse(decryptWearableSecret(row.tokenPayloadEncrypted)) as { access_token: string; refresh_token?: string };
  if (!row.tokenExpiresAt || row.tokenExpiresAt.getTime() > Date.now() + 60_000) return payload.access_token;
  if (!payload.refresh_token) throw new Error("AUTHORIZATION_REQUIRED");
  const cfg = oauthConfig.google_health;
  const response = await fetch(cfg.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: payload.refresh_token, client_id: cfg.clientId, client_secret: cfg.clientSecret }), signal: AbortSignal.timeout(15_000) });
  const result = await response.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !result.access_token) throw new Error("AUTHORIZATION_REQUIRED");
  await refreshWearableAccessToken({ userId, provider: "google_health", tokenPayloadEncrypted: encryptWearableSecret(JSON.stringify({ ...payload, access_token: result.access_token })), tokenExpiresAt: result.expires_in ? new Date(Date.now() + result.expires_in * 1000) : null });
  return result.access_token;
}

async function googleRollup(access: string, dataType: string, from: string, to: string) {
  const [sy, sm, sd] = from.split("-").map(Number);
  const end = new Date(`${to}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
  const ey = end.getUTCFullYear(), em = end.getUTCMonth() + 1, ed = end.getUTCDate();
  const midnight = { hours: 0, minutes: 0, seconds: 0, nanos: 0 };
  const res = await fetch(`https://health.googleapis.com/v4/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints:dailyRollUp`, { method: "POST", headers: { authorization: `Bearer ${access}`, "content-type": "application/json" }, body: JSON.stringify({ range: { start: { date: { year: sy, month: sm, day: sd }, time: midnight }, end: { date: { year: ey, month: em, day: ed }, time: midnight } }, windowSizeDays: 1, dataSourceFamily: "users/me/dataSourceFamilies/google-wearables" }), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) { if (res.status === 401 || res.status === 403) throw new Error("AUTHORIZATION_REQUIRED"); throw new Error(`Google Health API error (${res.status})`); }
  const json = await res.json() as { rollupDataPoints?: Array<Record<string, unknown>> };
  return json.rollupDataPoints ?? [];
}
function dateOf(point: Record<string, unknown>) {
  const d = (point.civilStartTime as { date?: { year?: number; month?: number; day?: number } } | undefined)?.date;
  return d?.year && d.month && d.day ? `${d.year}-${String(d.month).padStart(2,"0")}-${String(d.day).padStart(2,"0")}` : null;
}
function value(point: Record<string, unknown>, path: string[]): number | null { let item: unknown = point; for (const key of path) item = item && typeof item === "object" ? (item as Record<string, unknown>)[key] : undefined; const n = typeof item === "string" ? Number(item) : item; return typeof n === "number" && Number.isFinite(n) ? n : null; }
async function googleList(access: string, dataType: "exercise" | "sleep", filter: string) {
  const points: Array<Record<string, unknown>> = []; let pageToken = "";
  for (let page = 0; page < 10; page++) {
    const url = new URL(`https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints:reconcile`);
    url.searchParams.set("filter", filter); url.searchParams.set("dataSourceFamily", "users/me/dataSourceFamilies/google-wearables"); url.searchParams.set("pageSize", "25"); if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) { if (response.status === 401 || response.status === 403) throw new Error("AUTHORIZATION_REQUIRED"); throw new Error(`Google Health API error (${response.status})`); }
    const result = await response.json() as { dataPoints?: Array<Record<string, unknown>>; nextPageToken?: string };
    points.push(...(result.dataPoints ?? [])); pageToken = result.nextPageToken ?? ""; if (!pageToken) break;
  }
  return points;
}
function dateInZone(instant: string, timeZone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant)); }
function durationSeconds(value: unknown) { if (typeof value !== "string") return null; const match = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(value); if (!match) return null; const n = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0); return n > 0 ? n : null; }
type CorosTokens = { access_token: string; refresh_token?: string; expires_in?: number; client_id: string; token_endpoint: string; revoke_endpoint?: string; mcp_url: string; redirect_uri: string };
async function corosAccessToken(userId: number) {
  const row = await getWearableConnectionPrivate(userId, "coros");
  if (!row?.tokenPayloadEncrypted) throw new Error("AUTHORIZATION_REQUIRED");
  const payload = JSON.parse(decryptWearableSecret(row.tokenPayloadEncrypted)) as CorosTokens;
  if (!row.tokenExpiresAt || row.tokenExpiresAt.getTime() > Date.now() + 60_000) return payload;
  if (!payload.refresh_token) throw new Error("AUTHORIZATION_REQUIRED");
  const response = await fetch(payload.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: payload.refresh_token, client_id: payload.client_id }), signal: AbortSignal.timeout(15_000) });
  const next = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!response.ok || !next.access_token) throw new Error("AUTHORIZATION_REQUIRED");
  const refreshed = { ...payload, ...next, refresh_token: next.refresh_token ?? payload.refresh_token };
  await refreshWearableAccessToken({ userId, provider: "coros", tokenPayloadEncrypted: encryptWearableSecret(JSON.stringify(refreshed)), tokenExpiresAt: next.expires_in ? new Date(Date.now() + next.expires_in * 1000) : null });
  return refreshed;
}
async function corosMcp(userId: number, accessToken: string, method: string, params: Record<string, unknown> = {}, session?: { id?: string; version: string }) {
  const row = await getWearableConnectionPrivate(userId, "coros");
  if (!row?.tokenPayloadEncrypted) throw new Error("AUTHORIZATION_REQUIRED");
  const token = JSON.parse(decryptWearableSecret(row.tokenPayloadEncrypted)) as CorosTokens;
  const headers: Record<string, string> = { authorization: `Bearer ${accessToken}`, "content-type": "application/json", accept: "application/json, text/event-stream" };
  if (session?.id) headers["mcp-session-id"] = session.id;
  if (session?.version) headers["mcp-protocol-version"] = session.version;
  const response = await fetch(token.mcp_url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", ...(method.startsWith("notifications/") ? {} : { id: randomBytes(8).toString("hex") }), method, ...(Object.keys(params).length ? { params } : {}) }), signal: AbortSignal.timeout(25_000) });
  if (response.status === 401 || response.status === 403) throw new Error("AUTHORIZATION_REQUIRED");
  if (response.status === 202 && method.startsWith("notifications/")) return { result: null, sessionId: session?.id, version: session?.version };
  if (!response.ok) throw new Error(`COROS MCP error (${response.status})`);
  const sessionId = response.headers.get("mcp-session-id") ?? session?.id;
  const version = response.headers.get("mcp-protocol-version") ?? session?.version ?? "2025-11-25";
  const text = await response.text();
  let result: Record<string, unknown> | null = null;
  const jsonText = response.headers.get("content-type")?.includes("text/event-stream") ? text.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).at(-1) ?? "" : text;
  if (jsonText) result = JSON.parse(jsonText) as Record<string, unknown>;
  if (result?.error) throw new Error("COROS MCP request failed.");
  return { result, sessionId, version };
}
export function buildCorosToolArgs(schema: Record<string, unknown>, from: string, to: string, timeZone: string) {
  const properties = (schema.properties && typeof schema.properties === "object" ? schema.properties : {}) as Record<string, { description?: string; type?: string }>;
  const required = Array.isArray(schema.required) ? schema.required as string[] : [];
  const args: Record<string, unknown> = {};
  const toProviderDate = (value: string, description = "") => /yyyymmdd/i.test(description) ? value.replaceAll("-", "") : value;
  for (const [name, spec] of Object.entries(properties)) {
    const lower = name.toLowerCase(), description = spec.description ?? "";
    if (/start.?date|date.?from|from.?date|starttime|start_time|^from$/.test(lower)) args[name] = toProviderDate(from, description);
    else if (/end.?date|date.?to|to.?date|endtime|end_time|^to$/.test(lower)) args[name] = toProviderDate(to, description);
    else if (/timezone|time_zone/.test(lower)) args[name] = timeZone;
    else if (/limit|pagesize|page_size/.test(lower)) args[name] = 100;
  }
  if (required.some(key => !(key in args))) throw new Error("COROS MCP tool requires an unsupported filter; no data was imported.");
  return args;
}
export function parseCorosToolData(result: Record<string, unknown>) {
  if (result.structuredContent && typeof result.structuredContent === "object") return result.structuredContent;
  const content = Array.isArray(result.content) ? result.content as Array<{ text?: string }> : [];
  for (const item of content) if (item.text) {
    const candidate = item.text.replace(/^```(?:json)?\s*|\s*```$/g, "");
    try { return JSON.parse(candidate) as unknown; } catch { /* prose-only MCP output is not treated as data */ }
  }
  return null;
}
function walkObjects(value: unknown, output: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) value.forEach(item => walkObjects(item, output));
  else if (value && typeof value === "object") { const item = value as Record<string, unknown>; output.push(item); Object.values(item).forEach(child => walkObjects(child, output)); }
  return output;
}
function numericField(object: Record<string, unknown>, pattern: RegExp) {
  for (const [key, value] of Object.entries(object)) if (pattern.test(key)) { const n = typeof value === "string" ? Number(value) : value; if (typeof n === "number" && Number.isFinite(n)) return n; }
  return null;
}
function textField(object: Record<string, unknown>, pattern: RegExp) {
  for (const [key, value] of Object.entries(object)) if (pattern.test(key) && typeof value === "string") return value;
  return null;
}
async function corosTool(access: string, userId: number, session: { id?: string; version: string }, name: string, schema: Record<string, unknown>, from: string, to: string, timeZone: string) {
  const called = await corosMcp(userId, access, "tools/call", { name, arguments: buildCorosToolArgs(schema, from, to, timeZone) }, session);
  const result = called.result?.result as Record<string, unknown> | undefined;
  if (!result || result.isError === true) throw new Error(`COROS MCP ${name} failed.`);
  const data = parseCorosToolData(result);
  if (data === null) throw new Error(`COROS MCP ${name} returned no structured records.`);
  return data;
}
async function syncCoros(userId: number, from: string, to: string) {
  const token = await corosAccessToken(userId);
  const initialized = await corosMcp(userId, token.access_token, "initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "ritmo-pro-man", version: "1.0.0" } });
  const initResult = initialized.result?.result as { protocolVersion?: string } | undefined;
  if (!initResult?.protocolVersion) throw new Error("COROS MCP initialization failed.");
  const session = { id: initialized.sessionId, version: initResult.protocolVersion };
  await corosMcp(userId, token.access_token, "notifications/initialized", {}, session);
  const listed = await corosMcp(userId, token.access_token, "tools/list", {}, session);
  const listResult = listed.result?.result as { tools?: Array<{ name?: string; inputSchema?: Record<string, unknown> }> } | undefined;
  const tools = listResult?.tools ?? [];
  const getTool = (name: string) => { const tool = tools.find(item => item.name === name); if (!tool?.inputSchema) throw new Error(`COROS MCP tool ${name} is unavailable.`); return tool.inputSchema; };
  const activityData = await corosTool(token.access_token, userId, session, "querySportRecords", getTool("querySportRecords"), from, to, ENV.appTimeZone);
  const [dailyData, sleepData, recoveryData] = await Promise.all([
    tools.some(item => item.name === "queryDailyHealthData") ? corosTool(token.access_token, userId, session, "queryDailyHealthData", getTool("queryDailyHealthData"), from, to, ENV.appTimeZone) : null,
    tools.some(item => item.name === "querySleepData") ? corosTool(token.access_token, userId, session, "querySleepData", getTool("querySleepData"), from, to, ENV.appTimeZone) : null,
    tools.some(item => item.name === "queryRecoveryStatus") ? corosTool(token.access_token, userId, session, "queryRecoveryStatus", getTool("queryRecoveryStatus"), from, to, ENV.appTimeZone) : null,
  ]);
  const activityObjects = walkObjects(activityData);
  let imported = 0;
  const daily = new Map<string, Record<string, number>>();
  for (const record of activityObjects) {
    const externalId = textField(record, /^(labelId|activityId|recordId|externalId)$/i) ?? numericField(record, /^(labelId|activityId|recordId|externalId)$/i)?.toString();
    const startRaw = textField(record, /^(startTime|startTimestamp|startedAt|startDateTime)$/i) ?? numericField(record, /^(startTimestamp|startTime)$/i);
    if (!externalId || startRaw == null) continue;
    const timestamp = typeof startRaw === "number" ? startRaw : /^\d{10,13}$/.test(startRaw) ? Number(startRaw) : null;
    const instant = timestamp != null ? new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp) : new Date(String(startRaw));
    if (!Number.isFinite(instant.getTime())) continue;
    const date = dateInZone(instant.toISOString(), ENV.appTimeZone); if (date < from || date > to) continue;
    const calories = numericField(record, /^(caloriesKcal|workoutCaloriesKcal|activityCaloriesKcal)$/i);
    const seconds = numericField(record, /^(durationSeconds|activeDurationSeconds)$/i);
    const distanceKm = numericField(record, /^(distanceKm)$/i);
    const distanceMeters = numericField(record, /^(distanceMeters|distanceMillimeters)$/i);
    const distanceStoredKm = distanceKm != null ? distanceKm : distanceMeters == null ? null : distanceMeters / (Object.keys(record).some(key => /^distanceMillimeters$/i.test(key)) ? 1_000_000 : 1000);
    const averageHr = numericField(record, /^(averageHeartRate|avgHeartRate|averageHr)$/i);
    const maxHr = numericField(record, /^(maxHeartRate|maximumHeartRate|maxHr)$/i);
    const steps = numericField(record, /^steps$/i);
    await ingestWearableActivity({ userId, provider: "coros", externalId, activityDate: date, activityStartedAt: instant, activityType: textField(record, /^(sportTypeName|sportName|activityType|name)$/i)?.slice(0,80) ?? "COROS workout", durationMinutes: seconds == null ? null : Math.round(seconds / 60), caloriesKcal: calories == null ? null : Math.round(calories), averageHeartRate: averageHr == null ? null : Math.round(averageHr), maxHeartRate: maxHr == null ? null : Math.round(maxHr), steps: steps == null ? null : Math.round(steps), distanceKm: distanceStoredKm == null ? null : distanceStoredKm.toFixed(3), cardioMinutes: seconds == null ? null : Math.round(seconds / 60), sourceType: "provider_api", sourceTimeZone: ENV.appTimeZone });
    const summary = daily.get(date) ?? {}; if (calories != null) summary.workoutCalories = (summary.workoutCalories ?? 0) + calories; if (seconds != null) summary.duration = (summary.duration ?? 0) + seconds / 60; summary.activityCount = (summary.activityCount ?? 0) + 1; daily.set(date, summary); imported++;
  }
  for (const data of [dailyData, sleepData, recoveryData]) for (const record of walkObjects(data)) {
    const rawDate = textField(record, /^(date|activityDate|calendarDate)$/i);
    let date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : rawDate && /^\d{8}$/.test(rawDate) ? `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}` : null;
    const instant = textField(record, /^(endTime|endTimestamp|sleepEndTime)$/i); if (!date && instant) date = dateInZone(instant, ENV.appTimeZone);
    if (!date || date < from || date > to) continue;
    const summary = daily.get(date) ?? {};
    const steps = numericField(record, /^(steps|stepCount)$/i); if (steps != null) summary.steps = steps;
    const active = numericField(record, /^(activityCaloriesKcal|activeCaloriesKcal|activeCalories)$/i); if (active != null) summary.activeCalories = active;
    const total = numericField(record, /^(totalCaloriesKcal|totalCalories)$/i); if (total != null) summary.totalCalories = total;
    const sleep = numericField(record, /^(minutesAsleep|sleepMinutes)$/i); if (sleep != null) summary.sleep = sleep;
    const avg = numericField(record, /^(averageHeartRate|avgHeartRate|averageHr)$/i); if (avg != null) summary.avgHr = avg;
    const max = numericField(record, /^(maxHeartRate|maximumHeartRate|maxHr)$/i); if (max != null) summary.maxHr = max;
    const recovery = numericField(record, /^(recoveryScore|recoveryPercent)$/i); if (recovery != null) summary.recovery = recovery;
    const recoveryLabel = textField(record, /^(recoveryStatus|recoveryLevel|recoveryLabel)$/i); if (recoveryLabel) summary.hasRecoveryLabel = 1;
    const distanceKm = numericField(record, /^(distanceKm)$/i); if (distanceKm != null) summary.distance = distanceKm;
    daily.set(date, summary);
  }
  await Promise.all(Array.from(daily.entries()).map(([date, m]) => saveWearableDailySummary({ userId, provider: "coros", activityDate: date, timeZone: ENV.appTimeZone, workoutCaloriesKcal: m.workoutCalories == null ? undefined : Math.round(m.workoutCalories), activityCaloriesKcal: m.activeCalories == null ? undefined : Math.round(m.activeCalories), totalCaloriesKcal: m.totalCalories == null ? undefined : Math.round(m.totalCalories), durationMinutes: m.duration == null ? undefined : Math.round(m.duration), activityCount: m.activityCount, steps: m.steps == null ? undefined : Math.round(m.steps), sleepMinutes: m.sleep == null ? undefined : Math.round(m.sleep), averageHeartRate: m.avgHr == null ? undefined : Math.round(m.avgHr), maxHeartRate: m.maxHr == null ? undefined : Math.round(m.maxHr), recoveryScore: m.recovery == null ? undefined : Math.round(m.recovery), recoveryNote: m.hasRecoveryLabel ? "Provider recovery status available" : undefined, distanceKm: m.distance == null ? undefined : m.distance.toFixed(2) })));
  return { imported, days: daily.size };
}

export async function syncWearable(userId: number, provider: Provider, from: string, to: string) {
  const row = await getWearableConnectionPrivate(userId, provider);
  if (!row?.tokenPayloadEncrypted || row.status !== "connected") return { status: "authorization_required" as const, imported: 0, message: "A autorização oficial ainda é necessária." };
  await updateWearableSyncState({ userId, provider, status: "connected", lastSyncStatus: "syncing", lastSyncError: null });
  if (provider === "garmin") {
    await updateWearableSyncState({ userId, provider, status: "connected", lastSyncStatus: "error", lastSyncError: "A API de sincronização requer acesso ao programa de parceiros e um adaptador aprovado." });
    return { status: "error" as const, imported: 0, message: "Conexão autorizada, mas a API de dados requer aprovação de parceiro e configuração do adaptador oficial." };
  }
  try {
    if (provider === "coros") {
      const result = await syncCoros(userId, from, to);
      await updateWearableSyncState({ userId, provider, status: "connected", lastSyncStatus: "synced", lastSyncedAt: new Date(), lastSyncError: null });
      return { status: "synced" as const, imported: result.imported, message: result.imported || result.days ? "Atividades e métricas COROS sincronizadas." : "A COROS não devolveu dados para este intervalo." };
    }
    const access = await googleAccessToken(userId);
    const [steps, totals, active, hr, distance] = await Promise.all([
      googleRollup(access, "steps", from, to), googleRollup(access, "total-calories", from, to), googleRollup(access, "active-energy-burned", from, to), googleRollup(access, "heart-rate", from, to), googleRollup(access, "distance", from, to),
    ]);
    const byDate = new Map<string, Record<string, number>>();
    const merge = (rows: Record<string, unknown>[], fields: Array<[string, string[]]>) => rows.forEach(p => { const date = dateOf(p); if (!date) return; const item = byDate.get(date) ?? {}; for (const [key, path] of fields) { const n = value(p, path); if (n !== null) item[key] = n; } byDate.set(date, item); });
    merge(steps, [["steps", ["steps", "countSum"]]]); merge(totals, [["total", ["totalCalories", "kcalSum"]]]); merge(active, [["active", ["activeEnergyBurned", "kcalSum"]]]); merge(hr, [["avgHr", ["heartRate", "beatsPerMinuteAvg"]], ["minHr", ["heartRate", "beatsPerMinuteMin"]], ["maxHr", ["heartRate", "beatsPerMinuteMax"]]]); merge(distance, [["distance", ["distance", "millimetersSum"]]]);
    const tz = row.timeZone ?? ENV.appTimeZone;
    const end = new Date(`${to}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
    const endDate = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2,"0")}-${String(end.getUTCDate()).padStart(2,"0")}`;
    const [workouts, sleepSessions] = await Promise.all([
      googleList(access, "exercise", `exercise.interval.civil_start_time >= "${from}" AND exercise.interval.civil_start_time < "${endDate}"`),
      googleList(access, "sleep", `sleep.interval.civil_end_time >= "${from}" AND sleep.interval.civil_end_time < "${endDate}"`),
    ]);
    for (const point of workouts) {
      const exercise = point.exercise as Record<string, unknown> | undefined;
      const interval = exercise?.interval as Record<string, unknown> | undefined;
      const metrics = exercise?.metricsSummary as Record<string, unknown> | undefined;
      const startTime = typeof interval?.startTime === "string" ? interval.startTime : null;
      if (!exercise || !startTime) continue;
      const date = dateInZone(startTime, tz); if (date < from || date > to) continue;
      const externalId = typeof point.name === "string" ? point.name.split("/").at(-1) : null; if (!externalId) continue;
      const activeSeconds = durationSeconds(exercise.activeDuration);
      const calories = value(metrics ?? {}, ["caloriesKcal"]), workoutSteps = value(metrics ?? {}, ["steps"]);
      const workoutDistance = value(metrics ?? {}, ["distanceMillimeters"]), avgHeartRate = value(metrics ?? {}, ["averageHeartRateBeatsPerMinute"]);
      const offsetMatch = /([+-])(\d{2}):(\d{2})$/.exec(startTime);
      const utcOffsetMinutes = offsetMatch ? (offsetMatch[1] === "-" ? -1 : 1) * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3])) : null;
      await ingestWearableActivity({ userId, provider, externalId, activityDate: date, activityStartedAt: new Date(startTime), activityType: String(exercise.displayName ?? exercise.exerciseType ?? "Exercise").slice(0, 80), durationMinutes: activeSeconds == null ? null : Math.round(activeSeconds / 60), caloriesKcal: calories == null ? null : Math.round(calories), steps: workoutSteps == null ? null : Math.round(workoutSteps), distanceKm: workoutDistance == null ? null : (workoutDistance / 1_000_000).toFixed(3), averageHeartRate: avgHeartRate == null ? null : Math.round(avgHeartRate), cardioMinutes: activeSeconds == null ? null : Math.round(activeSeconds / 60), sourceType: "provider_api", sourceTimeZone: tz, utcOffsetMinutes });
      const daily = byDate.get(date) ?? {};
      if (calories != null) daily.workoutCalories = (daily.workoutCalories ?? 0) + calories;
      if (activeSeconds != null) daily.duration = (daily.duration ?? 0) + activeSeconds / 60;
      daily.count = (daily.count ?? 0) + 1; byDate.set(date, daily);
    }
    for (const point of sleepSessions) {
      const sleep = point.sleep as Record<string, unknown> | undefined;
      const interval = sleep?.interval as Record<string, unknown> | undefined;
      const summary = sleep?.summary as Record<string, unknown> | undefined;
      const endTime = typeof interval?.endTime === "string" ? interval.endTime : null;
      if (!endTime) continue;
      const date = dateInZone(endTime, tz); if (date < from || date > to) continue;
      const sleepMinutes = value(summary ?? {}, ["minutesAsleep"]); if (sleepMinutes == null) continue;
      const daily = byDate.get(date) ?? {}; daily.sleep = (daily.sleep ?? 0) + sleepMinutes; byDate.set(date, daily);
    }
    await Promise.all(Array.from(byDate.entries()).map(([date, m]) => saveWearableDailySummary({ userId, provider, activityDate: date, timeZone: tz, steps: m.steps == null ? undefined : Math.round(m.steps), totalCaloriesKcal: m.total == null ? undefined : Math.round(m.total), activityCaloriesKcal: m.active == null ? undefined : Math.round(m.active), workoutCaloriesKcal: m.workoutCalories == null ? undefined : Math.round(m.workoutCalories), durationMinutes: m.duration == null ? undefined : Math.round(m.duration), activityCount: m.count == null ? undefined : m.count, sleepMinutes: m.sleep == null ? undefined : Math.round(m.sleep), averageHeartRate: m.avgHr == null ? undefined : Math.round(m.avgHr), minHeartRate: m.minHr == null ? undefined : Math.round(m.minHr), maxHeartRate: m.maxHr == null ? undefined : Math.round(m.maxHr), distanceKm: m.distance == null ? undefined : (m.distance / 1_000_000).toFixed(2) })));
    await updateWearableSyncState({ userId, provider, status: "connected", lastSyncStatus: "synced", lastSyncedAt: new Date(), lastSyncError: null });
    return { status: "synced" as const, imported: workouts.length, message: workouts.length || byDate.size ? "Métricas oficiais sincronizadas." : "A plataforma não devolveu métricas para este intervalo." };
  } catch (error) {
    const auth = error instanceof Error && error.message === "AUTHORIZATION_REQUIRED";
    const message = auth ? "Autorização expirada. Volte a ligar a conta." : error instanceof Error ? error.message.slice(0, 220) : "Falha de sincronização.";
    await updateWearableSyncState({ userId, provider, status: auth ? "authorization_required" : "connected", lastSyncStatus: auth ? "authorization_required" : "error", lastSyncError: message });
    return { status: auth ? "authorization_required" as const : "error" as const, imported: 0, message };
  }
}
