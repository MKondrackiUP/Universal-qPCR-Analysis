import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "SHA256SUMS.txt");
const ignoredDirectories = new Set([".git", "node_modules"]);
const ignoredFiles = new Set(["SHA256SUMS.txt"]);
const textExtensions = new Set([".css", ".csv", ".html", ".js", ".json", ".md", ".mjs", ".txt", ".yaml", ".yml"]);

async function collect(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    if (entry.isFile() && ignoredFiles.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(fullPath, files);
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

async function currentManifest() {
  const files = (await collect(root)).sort((left, right) => relative(left).localeCompare(relative(right), "en"));
  const lines = [];
  for (const file of files) {
    const source = await readFile(file);
    const content = textExtensions.has(path.extname(file).toLowerCase())
      ? Buffer.from(source.toString("utf8").replace(/\r\n?/g, "\n"), "utf8")
      : source;
    const hash = createHash("sha256").update(content).digest("hex");
    lines.push(`${hash}  ${relative(file)}`);
  }
  return `${lines.join("\n")}\n`;
}

const mode = process.argv[2];
if (mode === "--write") {
  const manifest = await currentManifest();
  await writeFile(manifestPath, manifest, "ascii");
  console.log(`Wrote ${manifest.trimEnd().split("\n").length} checksums.`);
} else if (mode === "--verify") {
  const expected = await readFile(manifestPath, "ascii");
  const actual = await currentManifest();
  if (actual !== expected) {
    console.error("SHA256SUMS.txt is stale. Run: npm run checksums:write");
    process.exitCode = 1;
  } else {
    console.log(`Checksums OK: ${actual.trimEnd().split("\n").length} files.`);
  }
} else {
  console.error("Usage: node scripts/checksums.mjs --write|--verify");
  process.exitCode = 2;
}
