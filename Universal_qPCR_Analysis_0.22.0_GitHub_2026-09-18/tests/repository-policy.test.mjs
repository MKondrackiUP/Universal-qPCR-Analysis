import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { parseProjectText } from "../docs/project-file.js";

const root = path.resolve(import.meta.dirname, "..");
const textExtensions = new Set([".css", ".csv", ".html", ".js", ".json", ".md", ".mjs", ".txt", ".yaml", ".yml"]);

async function collectText(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectText(fullPath, files);
    else if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

async function collectAll(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectAll(fullPath, files);
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

test("public repository is assay and disease neutral", async () => {
  const forbiddenAssay = ["AM", "DV"].join("");
  const legacyTerm = new RegExp(`\\b${["B", "[0-4]"].join("")}\\b`, "i");
  const matches = [];
  for (const base of [path.join(root, "docs"), path.join(root, "documentation")]) {
    for (const file of await collectText(base)) {
      const text = await readFile(file, "utf8");
      if (text.includes(forbiddenAssay) || legacyTerm.test(text)) matches.push(path.relative(root, file));
    }
  }
  assert.deepEqual(matches, []);
});

test("the bundled evidence profile names only synthetic example preparations", async () => {
  // A profile shipped with the application is the default input to every Tier
  // decision, so it must not carry preparation names whose scores a reader
  // could mistake for published pharmacological judgements.
  const allowed = new Set(["Atlas", "Borealis", "Cygnus", "Draco", "Equinox", "Fenix"]);
  const configuration = path.join(root, "docs", "config");
  const columns = { "universal_candidate_evidence_v1.csv": "source_preparation", "universal_candidate_map_v1.csv": "source_preparation", "universal_screening_reference_v1.csv": "preparation" };
  for (const [file, column] of Object.entries(columns)) {
    const [header, ...rows] = (await readFile(path.join(configuration, file), "utf8")).trim().split(/\r?\n/);
    const index = header.split(",").indexOf(column);
    assert.ok(index >= 0, `${file} has no ${column} column`);
    const unexpected = rows.map((row) => row.split(",")[index]).filter((name) => !allowed.has(name));
    assert.deepEqual(unexpected, [], `${file} names preparations outside the synthetic example set`);
  }
});

test("repository contains only explicitly synthetic spreadsheet examples", async () => {
  const allowedRoot = path.join(root, "docs", "examples", "synthetic-qpcr-validation");
  const spreadsheets = (await collectAll(root)).filter((file) => [".xls", ".xlsx"].includes(path.extname(file).toLowerCase()));
  assert.equal(spreadsheets.length, 6);
  assert.ok(spreadsheets.every((file) => file.startsWith(`${allowedRoot}${path.sep}`)));
});

test("package and application versions agree", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const escapedVersion = packageJson.version.replaceAll(".", "\\.");
  const citation = await readFile(path.join(root, "CITATION.cff"), "utf8");
  const index = await readFile(path.join(root, "docs", "index.html"), "utf8");
  assert.match(citation, new RegExp(`version:\\s*[\"']?${escapedVersion}`));
  assert.match(index, new RegExp(escapedVersion));
});

test("the served citation metadata matches the repository metadata", async () => {
  // docs/CITATION.cff is what a user of the deployed application downloads to
  // cite the software, so it must not drift from the authoritative copy.
  const [repository, served] = await Promise.all([
    readFile(path.join(root, "CITATION.cff"), "utf8"),
    readFile(path.join(root, "docs", "CITATION.cff"), "utf8"),
  ]);
  assert.equal(served, repository);
});

test("privacy boundary excludes accounts, databases and upload endpoints", async () => {
  const privacy = await readFile(path.join(root, "PRIVACY.md"), "utf8");
  const server = await readFile(path.join(root, "serve.mjs"), "utf8");
  assert.match(privacy, /no account system/i);
  assert.match(privacy, /no .*database/i);
  assert.doesNotMatch(server, /request\.on\(["']data["']/);
  assert.doesNotMatch(server, /multipart|formidable|multer/i);
});

test("the shipped example project loads and is labelled synthetic", async () => {
  // A committed example is read by users as a template, so it must stay
  // loadable by the current schema and must announce that it is not evidence.
  const text = await readFile(path.join(root, "docs", "examples", "synthetic-example-project.qpcrproj"), "utf8");
  const { project, result } = parseProjectText(text);
  assert.equal(project.schema_version, "1.0");
  assert.ok(result.candidates.length >= 3);
  assert.equal(result.demo.synthetic, true);
  assert.equal(result.demo.biological_interpretation_permitted, false);
  assert.match(project.privacy.warning, /synthetic/i);
});
