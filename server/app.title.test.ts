import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("application branding", () => {
  it("uses Ritmo Pro Man in the delivered HTML and PWA manifest", () => {
    const html = readFileSync("client/index.html", "utf8");
    const manifest = readFileSync("client/public/manifest.json", "utf8");
    expect(html).toContain('content="Ritmo Pro Man"');
    expect(html).toContain("<title>Ritmo Pro Man — Treino 4x por semana</title>");
    expect(manifest).toContain('"name": "Ritmo Pro Man"');
    expect(manifest).toContain('"short_name": "Ritmo Pro Man"');
  });
});
