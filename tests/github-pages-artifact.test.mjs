import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const basePath = "/Target-website";
const appsScriptUrl =
  "https://script.google.com/macros/s/AKfycbxxlAtOJJZKmV3eB9pXpycVlo26OMXutP8saC0a_-Gbz-chnx8Sx14hodPYzOI84O8r/exec";
const html = readFileSync(new URL("../out/index.html", import.meta.url), "utf8");

test("GitHub Pages export uses the repository base path", () => {
  const references = Array.from(
    html.matchAll(/(?:src|href)=["'](\/Target-website\/[^"']+)["']/g),
    (match) => match[1],
  );

  assert.ok(references.length > 0, "expected repository-prefixed asset references");
  for (const reference of references) {
    const localPath = reference.slice(basePath.length).replace(/^\//, "");
    assert.ok(existsSync(new URL(`../out/${localPath}`, import.meta.url)), reference);
  }
});

test("GitHub Pages export keeps the configured Apps Script backend", () => {
  const builtJavaScript = Array.from(
    html.matchAll(/src=["'](\/Target-website\/_next\/static\/[^"']+\.js)["']/g),
    (match) => match[1],
  )
    .map((reference) =>
      readFileSync(
        new URL(`../out/${reference.slice(basePath.length + 1)}`, import.meta.url),
        "utf8",
      ),
    )
    .join("\n");

  assert.ok(builtJavaScript.includes(appsScriptUrl));
  assert.ok(!html.includes("chatgpt.site"));
  assert.ok(!builtJavaScript.includes("chatgpt.site"));
});
