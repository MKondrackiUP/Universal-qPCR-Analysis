import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const roots = [path.join(root, "docs"), path.join(root, "scripts"), path.join(root, "tests")];
const files = [path.join(root, "serve.mjs")];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(fullPath);
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(fullPath);
  }
}

for (const directory of roots) await collect(directory);

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exitCode = 1;
  }
}

if (!process.exitCode) console.log(`Syntax OK: ${files.length} JavaScript files.`);
