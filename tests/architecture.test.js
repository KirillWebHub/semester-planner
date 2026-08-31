import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const src = join(root, "src");
const layers = ["shared", "entities", "features", "widgets", "pages", "app"];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".js", ".jsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function layerOf(path) {
  return relative(src, path).split(sep)[0];
}

test("FSD imports only point to the same or a lower layer", () => {
  const violations = [];
  for (const file of sourceFiles(src)) {
    const sourceLayer = layerOf(file);
    const sourceRank = layers.indexOf(sourceLayer);
    if (sourceRank === -1) continue;
    const imports = [
      ...readFileSync(file, "utf8").matchAll(
        /from\s+["'](\.{1,2}\/[^"']+)["']/g,
      ),
    ];
    for (const [, specifier] of imports) {
      const target = resolve(dirname(file), specifier);
      if (!target.startsWith(src)) continue;
      const targetLayer = layerOf(target);
      const targetRank = layers.indexOf(targetLayer);
      if (targetRank > sourceRank) {
        violations.push(`${relative(src, file)} -> ${relative(src, target)}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("legacy monolith files are removed after the FSD migration", () => {
  const legacy = [
    "App.jsx",
    "Builder.jsx",
    "calendar.js",
    "planner.js",
    "storage.js",
    "useWorkspace.js",
    "styles.css",
  ];
  assert.deepEqual(
    legacy.filter((file) => existsSync(join(src, file))),
    [],
  );
});
