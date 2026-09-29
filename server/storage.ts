import crypto from "node:crypto";
import { ENV } from "./_core/env";

function config() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) throw new Error("Storage config missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return { base: ENV.supabaseUrl.replace(/\/+$/, ""), key: ENV.supabaseServiceRoleKey, bucket: ENV.supabaseStorageBucket };
}
function normalizeKey(relKey: string) { return relKey.replace(/^\/+/, "").replace(/\.\./g, ""); }
function headers() { const { key } = config(); return { Authorization: `Bearer ${key}`, apikey: key }; }
async function ensureBucket() {
  const { base, bucket } = config();
  const res = await fetch(`${base}/storage/v1/bucket`, { method:"POST", headers:{...headers(), "content-type":"application/json"}, body:JSON.stringify({ id:bucket, name:bucket, public:false, file_size_limit:10485760, allowed_mime_types:["image/*"] }) });
  if (res.status === 409) {
    const existing = await fetch(`${base}/storage/v1/bucket/${encodeURIComponent(bucket)}`, { headers: headers() });
    if (!existing.ok) throw new Error(`Supabase existing bucket could not be verified (${existing.status})`);
    const details = await existing.json() as { public?: unknown };
    if (details.public !== false) throw new Error("Supabase storage bucket must be private");
    return;
  }
  if (!res.ok) { const t=await res.text(); throw new Error(`Supabase bucket setup failed (${res.status}): ${t}`); }
}
function appendHash(key:string) { const h=crypto.randomUUID().replace(/-/g,"").slice(0,8); const i=key.lastIndexOf("."); return i<0 ? `${key}_${h}` : `${key.slice(0,i)}_${h}${key.slice(i)}`; }
export async function storagePut(relKey:string,data:Buffer|Uint8Array|string,contentType="application/octet-stream"):Promise<{key:string;url:string}> {
  const {base,bucket}=config(); await ensureBucket(); const key=appendHash(normalizeKey(relKey));
  const res=await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`,{method:"POST",headers:{...headers(),"Content-Type":contentType,"x-upsert":"false"},body:typeof data === "string" ? Buffer.from(data) : Buffer.from(data)});
  if(!res.ok){const t=await res.text();throw new Error(`Supabase upload failed (${res.status}): ${t}`);} return {key,url:await storageGetSignedUrl(key)};
}
export async function storageGet(relKey:string){const key=normalizeKey(relKey);return {key,url:await storageGetSignedUrl(key)};}
export async function storageRemove(relKey:string) {
  const {base,bucket}=config(); const key=normalizeKey(relKey);
  const res=await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`,{method:"DELETE",headers:headers()});
  if(!res.ok && res.status!==404){const t=await res.text();throw new Error(`Supabase delete failed (${res.status}): ${t}`);}
}
export async function storageGetSignedUrl(relKey:string){
  const {base,bucket}=config(); await ensureBucket(); const path=normalizeKey(relKey);
  const res=await fetch(`${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`,{method:"POST",headers:{...headers(),"content-type":"application/json"},body:JSON.stringify({expiresIn:3600})});
  if(!res.ok){const t=await res.text();throw new Error(`Supabase signed URL failed (${res.status}): ${t}`);} const data=await res.json() as {signedURL?:string};
  if(!data.signedURL) throw new Error("Supabase returned no signed URL"); return data.signedURL.startsWith("http") ? data.signedURL : `${base}/storage/v1${data.signedURL}`;
}
