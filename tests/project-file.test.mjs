import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { buildLocalPrimaryResult, loadLocalScientificProfile } from "../docs/local-analysis.js";
import { buildProjectDocument, parseProjectText, serializeProjectDocument, validateProjectDocument } from "../docs/project-file.js";
import { safeResourceUrl } from "../docs/ui-helpers.js";

const root = path.resolve(import.meta.dirname, "..");

async function fileFetch(url) {
  const text = await readFile(path.resolve(root, "docs", url.replace(/^\.\//, "")), "utf8");
  return { ok: true, text: async () => text };
}

async function sampleResult() {
  const longRows = [];
  for (const preparation of ["Atlas", "Borealis"]) {
    for (let index = 1; index <= 6; index += 1) {
      const sample = `${preparation}-${index}`;
      longRows.push({ term: "T0", preparation, sample_name: sample, ct: 25, qty: 100 });
      longRows.push({ term: "T1", preparation, sample_name: sample, ct: 26, qty: preparation === "Atlas" ? 50 : 95 });
    }
  }
  const profile = await loadLocalScientificProfile(fileFetch);
  return buildLocalPrimaryResult({
    longRows,
    profile,
    assay: { technology: "qpcr", target_category: "other", target_name: "Synthetic target", analysis_goal: "decrease" },
    timepoints: [{ term: "T0", time_value: 0 }, { term: "T1", time_value: 1 }],
    tierEnabled: true,
  });
}

/** Build a valid project, then let a test corrupt it the way an edited file would be. */
async function corrupted(mutate) {
  const project = buildProjectDocument(await sampleResult());
  mutate(project);
  return project;
}

test("a saved project round-trips through serialization", async () => {
  const result = await sampleResult();
  const project = buildProjectDocument(result);
  const restored = parseProjectText(serializeProjectDocument(project));
  assert.equal(restored.result.analysis_type, "universal_qpcr");
  assert.equal(restored.result.candidates.length, result.candidates.length);
  assert.equal(restored.result.assay.target_name, "Synthetic target");
  assert.ok(restored.result.project_source);
});

test("only locally generated resource schemes are accepted", () => {
  assert.ok(safeResourceUrl("data:image/svg+xml;charset=utf-8,%3Csvg%3E"));
  assert.ok(safeResourceUrl("blob:http://127.0.0.1:8787/1234"));
  assert.equal(safeResourceUrl("javascript:alert(1)"), null);
  assert.equal(safeResourceUrl("  JavaScript:alert(1)"), null);
  assert.equal(safeResourceUrl("https://example.invalid/figure.svg"), null);
  assert.equal(safeResourceUrl("data:text/html,<script>"), null);
  assert.equal(safeResourceUrl(null), null);
});

test("a project cannot smuggle in a script URL as a figure", async () => {
  const project = await corrupted((document) => {
    document.result.artifacts[0].download_url = "javascript:alert(document.domain)";
  });
  assert.throws(() => validateProjectDocument(project), /unsupported resource address/);
});

test("a project cannot declare an analysis goal the rules are not defined for", async () => {
  const project = await corrupted((document) => { document.result.assay.analysis_goal = "reduce"; });
  assert.throws(() => validateProjectDocument(project), /unsupported analysis goal/);
});

test("a project with malformed preparation results is refused", async () => {
  const missingName = await corrupted((document) => { document.result.candidates[0] = { tests: {} }; });
  assert.throws(() => validateProjectDocument(missingName), /preparation name/);
  const missingTests = await corrupted((document) => { delete document.result.candidates[0].tests; });
  assert.throws(() => validateProjectDocument(missingTests), /quantity test result/);
  const notAnArray = await corrupted((document) => { document.result.candidates = { preparation: "A" }; });
  assert.throws(() => validateProjectDocument(notAnArray), /no preparation results/);
});

test("a foreign or unsupported file is refused before anything is rendered", () => {
  assert.throws(() => parseProjectText("not json"), /not valid JSON/);
  assert.throws(() => parseProjectText(JSON.stringify([])), /one JSON object/);
  assert.throws(() => parseProjectText(JSON.stringify({ schema: "something-else" })), /not a Universal qPCR Analysis project/);
  assert.throws(() => parseProjectText(JSON.stringify({ schema: "universal-qpcr-project", schema_version: "0.9" })), /Unsupported project schema version/);
});
