import crypto from "node:crypto";
import { ENV } from "./_core/env";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SIGNED_URL_SECONDS = 900;

type StorageConfig = { base: string; key: string; bucket: string };
type StorageResponse = {
  statusCode?: unknown;
  code?: unknown;
  error?: unknown;
  message?: unknown;
};

function config(): StorageConfig {
  const rawUrl = ENV.supabaseUrl.trim();
  const key = ENV.supabaseServiceRoleKey.trim();
  const bucket = ENV.supabaseStorageBucket.trim();
  if (!rawUrl || !key)
    throw new Error(
      "Storage config missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid SUPABASE_URL: expected an HTTPS project origin");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/+$/.test(url.pathname)
  )
    throw new Error("Invalid SUPABASE_URL: expected an HTTPS project origin");
  if (
    /\s/.test(key) ||
    (!key.startsWith("sb_secret_") &&
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key))
  )
    throw new Error(
      "Invalid SUPABASE_SERVICE_ROLE_KEY: expected a server secret key"
    );
  if (!/^[a-zA-Z0-9_-]+$/.test(bucket))
    throw new Error("Invalid SUPABASE_STORAGE_BUCKET");
  return { base: url.origin, key, bucket };
}
function normalizeKey(relKey: string) {
  if (
    !/^[a-zA-Z0-9_./-]+$/.test(relKey) ||
    relKey.startsWith("/") ||
    relKey.split("/").some(part => !part || part === "." || part === "..")
  )
    throw new Error("Invalid private storage path");
  return relKey;
}
function headers({ key }: StorageConfig): Record<string, string> {
  // New server secret keys are opaque API keys, not JWT bearer tokens.
  return key.startsWith("sb_secret_")
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
}
async function request(url: string, options: RequestInit = {}) {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Supabase Storage request unavailable");
  }
}
async function errorBody(response: Response): Promise<StorageResponse> {
  try {
    return (await response.json()) as StorageResponse;
  } catch {
    return {};
  }
}
function bucketMissing(response: Response, body: StorageResponse) {
  return (
    response.status === 404 ||
    (response.status === 400 &&
      (body.code === "NoSuchBucket" ||
        (Number(body.statusCode) === 404 &&
          [body.message, body.error].some(
            value =>
              typeof value === "string" && /bucket not found/i.test(value)
          ))))
  );
}
function bucketExists(response: Response, body: StorageResponse) {
  return (
    response.status === 409 ||
    (response.status === 400 &&
      (Number(body.statusCode) === 409 ||
        ["BucketAlreadyExists", "ResourceAlreadyExists"].includes(
          String(body.code)
        )))
  );
}
function requirePrivateBucket(
  details: { id?: unknown; public?: unknown },
  bucket: string
) {
  if (details.id !== bucket || details.public !== false)
    throw new Error(
      "Supabase storage bucket must be private and match the configured bucket"
    );
}
async function ensureBucket(settings: StorageConfig) {
  const { base, bucket } = settings;
  const metadataUrl = `${base}/storage/v1/bucket/${encodeURIComponent(bucket)}`;
  const existing = await request(metadataUrl, { headers: headers(settings) });
  if (existing.ok) {
    requirePrivateBucket(await existing.json(), bucket);
    return;
  }
  if (!bucketMissing(existing, await errorBody(existing)))
    throw new Error(`Supabase bucket lookup failed (${existing.status})`);
  // Create only after a confirmed missing bucket. Never update an existing bucket.
  const created = await request(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...headers(settings), "content-type": "application/json" },
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: false,
      file_size_limit: MAX_IMAGE_BYTES,
      allowed_mime_types: ["image/*"],
    }),
  });
  // A concurrent request may have created it. Legacy Storage sends HTTP 400
  // while the JSON body contains statusCode 409; that is not an auth failure.
  if (!created.ok && !bucketExists(created, await errorBody(created)))
    throw new Error(`Supabase bucket setup failed (${created.status})`);
  const verified = await request(metadataUrl, { headers: headers(settings) });
  if (!verified.ok)
    throw new Error(
      `Supabase created bucket could not be verified (${verified.status})`
    );
  requirePrivateBucket(await verified.json(), bucket);
}
function appendHash(key: string) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const extensionIndex = key.lastIndexOf(".");
  return extensionIndex < 0
    ? `${key}_${hash}`
    : `${key.slice(0, extensionIndex)}_${hash}${key.slice(extensionIndex)}`;
}
function objectPath(bucket: string, key: string) {
  return `${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const settings = config();
  const key = appendHash(normalizeKey(relKey));
  const body = Buffer.from(data);
  if (!IMAGE_MIME_TYPES.has(contentType))
    throw new Error("Storage accepts JPEG, PNG or WebP images only");
  if (!body.length || body.length > MAX_IMAGE_BYTES)
    throw new Error("Storage image must be nonempty and at most 10 MB");
  await ensureBucket(settings);
  const res = await request(
    `${settings.base}/storage/v1/object/${objectPath(settings.bucket, key)}`,
    {
      method: "POST",
      headers: {
        ...headers(settings),
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body,
    }
  );
  if (!res.ok) throw new Error(`Supabase upload failed (${res.status})`);
  return { key, url: await storageGetSignedUrl(key) };
}
export async function storageGet(relKey: string) {
  const key = normalizeKey(relKey);
  return { key, url: await storageGetSignedUrl(key) };
}
export async function storageRemove(relKey: string) {
  const settings = config();
  const key = normalizeKey(relKey);
  const res = await request(
    `${settings.base}/storage/v1/object/${encodeURIComponent(settings.bucket)}`,
    {
      method: "DELETE",
      headers: { ...headers(settings), "content-type": "application/json" },
      body: JSON.stringify({ prefixes: [key] }),
    }
  );
  if (!res.ok && res.status !== 404)
    throw new Error(`Supabase delete failed (${res.status})`);
}
export async function storageGetSignedUrl(relKey: string) {
  const settings = config();
  const key = normalizeKey(relKey);
  await ensureBucket(settings);
  const res = await request(
    `${settings.base}/storage/v1/object/sign/${objectPath(settings.bucket, key)}`,
    {
      method: "POST",
      headers: { ...headers(settings), "content-type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
    }
  );
  if (!res.ok) throw new Error(`Supabase signed URL failed (${res.status})`);
  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) throw new Error("Supabase returned no signed URL");
  const relative = data.signedURL.startsWith("/object/")
    ? `/storage/v1${data.signedURL}`
    : data.signedURL;
  let url: URL;
  try {
    url = new URL(relative, settings.base);
  } catch {
    throw new Error("Supabase returned an invalid signed URL");
  }
  if (
    url.origin !== settings.base ||
    url.pathname !==
      `/storage/v1/object/sign/${objectPath(settings.bucket, key)}` ||
    !url.searchParams.get("token")
  )
    throw new Error("Supabase returned an invalid signed URL");
  return url.toString();
}
