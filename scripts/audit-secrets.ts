import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";

// Reports only counts, paths and variable names. Never prints matched values.
const envFiles = [".env", ".env.save"];
const secrets: string[] = [];
for (const file of envFiles) {
  try {
    const parsed = dotenv.parse(readFileSync(file));
    for (const [key, value] of Object.entries(parsed))
      if (
        /(SECRET|TOKEN|PASSWORD|API_KEY|SERVICE_ROLE|DATABASE_URL|ENCRYPTION_KEY)/i.test(
          key
        ) &&
        value.length >= 8
      )
        secrets.push(value);
  } catch {
    /* Optional environment files. */
  }
}
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const added = execFileSync(
  "git",
  ["ls-files", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" }
)
  .split("\0")
  .filter(Boolean);
function artifacts(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap(name => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? artifacts(path) : [path];
    });
  } catch {
    return [];
  }
}
const files = Array.from(new Set([...tracked, ...added, ...artifacts("dist")]));
const findings: string[] = [];
const highConfidence = [
  /AIza[0-9A-Za-z_-]{35}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk_live|rk_live)_[A-Za-z0-9]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
];
for (const path of files) {
  try {
    const buffer = readFileSync(path);
    const text = buffer.toString("utf8");
    if (
      secrets.some(value => buffer.includes(Buffer.from(value))) ||
      highConfidence.some(pattern => pattern.test(text))
    )
      findings.push(path);
  } catch {
    /* Missing/deleted files. */
  }
}
const accidentallyTracked = tracked.filter(path =>
  /(^|\/)\.env(?:$|\.)/.test(path)
);
console.log(
  JSON.stringify({
    scannedFiles: files.length,
    knownSecretMatches: findings.length,
    paths: findings,
    trackedEnvironmentFiles: accidentallyTracked,
  })
);
if (findings.length || accidentallyTracked.length) process.exitCode = 1;
