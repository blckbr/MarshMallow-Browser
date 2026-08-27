import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("PBKDF2 do backend respeita o limite da Cloudflare", () => {
  const source = fs.readFileSync(
    new URL("../backend/src/index.js", import.meta.url),
    "utf8"
  );

  const match = source.match(
    /const\s+PBKDF2_ITERATIONS\s*=\s*([\d_]+)\s*;/
  );

  assert.ok(match, "PBKDF2_ITERATIONS não encontrado");

  const iterations = Number(match[1].replaceAll("_", ""));

  assert.ok(
    iterations <= 100000,
    `PBKDF2_ITERATIONS=${iterations}; Cloudflare suporta no máximo 100000`
  );
});
