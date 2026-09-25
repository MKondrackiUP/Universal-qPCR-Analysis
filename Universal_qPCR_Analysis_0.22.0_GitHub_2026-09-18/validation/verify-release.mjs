/**
 * End-to-end verification of a release, reproducible from this repository alone.
 *
 *   node validation/verify-release.mjs
 *
 * The package test suite checks modules and contracts. This script instead walks
 * the paths a user walks — the two bundled demonstrations, DOCX generation, the
 * project-file round trip and a full T0–T4 run — and prints a countable number
 * of checks so a manuscript can cite one.
 *
 * It needs no data beyond the repository. For a study-specific dataset with
 * recorded expectations, use `verify-study-case.mjs`.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (relative) => import(new URL(`../${relative}`, import.meta.url).href);

const { analyzeWorkbooksLocally, buildLocalPrimaryResult, loadLocalScientificProfile } = await load("docs/local-analysis.js");
const { demoFiles } = await load("docs/demo-data.js");
const { buildGenericAssessmentReportModel } = await load("docs/lib/generic-report-model.mjs");
const { renderGenericAssessmentDocx } = await load("docs/lib/docx.mjs");
const { buildProjectDocument, parseProjectText, serializeProjectDocument } = await load("docs/project-file.js");

let checks = 0;
const failures = [];

function check(label, run) {
  checks += 1;
  try {
    run();
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
  }
}

async function profile() {
  return loadLocalScientificProfile(async (url) => {
    const text = await readFile(path.join(root, "docs", url.replace(/^\.\//, "")), "utf8");
    return { ok: true, text: async () => text };
  });
}

// ---------------------------------------------------------------- versions
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const version = packageJson.version;
for (const [file, pattern] of [
  ["CITATION.cff", new RegExp(`version:\\s*"${version.replaceAll(".", "\\.")}"`)],
  ["BUILD_INFO.txt", new RegExp(`Version: ${version.replaceAll(".", "\\.")}`)],
  ["nginx.conf", new RegExp(`"version":"${version.replaceAll(".", "\\.")}"`)],
  ["serve.mjs", new RegExp(`const VERSION = "${version.replaceAll(".", "\\.")}"`)],
  ["docs/index.html", new RegExp(version.replaceAll(".", "\\."))],
]) {
  const text = await readFile(path.join(root, file), "utf8");
  check(`version recorded in ${file}`, () => assert.match(text, pattern));
}

// ------------------------------------------------------------ demonstrations
const scenarios = [
  { label: "base demonstration", tiers: false },
  { label: "Tier demonstration", tiers: true },
];
const results = {};
for (const scenario of scenarios) {
  const demo = demoFiles({ tiers: scenario.tiers });
  const result = await analyzeWorkbooksLocally({
    selections: demo.selections,
    assay: demo.assay,
    timeUnit: demo.time_unit,
    candidateEvidenceFile: demo.candidateEvidenceFile,
    profile: await profile(),
    tierEnabled: scenario.tiers,
  });
  results[scenario.label] = result;
  check(`${scenario.label}: six preparations`, () => assert.equal(result.candidates.length, 6));
  check(`${scenario.label}: 46 complete Qty pairs`, () => assert.equal(result.overview.complete_quantity_pairs, 46));
  check(`${scenario.label}: 46 complete Ct pairs`, () => assert.equal(result.overview.complete_ct_pairs, 46));
  check(`${scenario.label}: no integrity relation`, () => assert.equal(result.overview.integrity_relations, 0));
  check(`${scenario.label}: analysis stayed local`, () => assert.equal(result.local_execution.mode, "browser_memory_only"));
  check(`${scenario.label}: no server run was created`, () => assert.equal(result.local_execution.server_run_created, false));
  check(`${scenario.label}: five effects in the declared direction`, () => assert.equal(
    result.candidates.filter((candidate) => candidate.observed_change === "decreased").length, 5));
  check(`${scenario.label}: five results below the FDR threshold`, () => assert.equal(
    result.candidates.filter((candidate) => candidate.tests.quantity_signed_rank.significant_after_fdr === true).length, 5));
  check(`${scenario.label}: offset and effect scale reported`, () => {
    assert.ok(Number.isFinite(result.effect_scaling.qty_offset));
    assert.equal(result.effect_scaling.dataset_dependent, true);
  });
}

const base = results["base demonstration"];
const tiered = results["Tier demonstration"];
check("Tier is absent from a run that did not request it", () => {
  assert.equal("tier_policy" in base, false);
  assert.deepEqual(base.candidates.filter((candidate) => "tier" in candidate), []);
});
check("the Tier demonstration produces all five categories", () => {
  const tiers = new Set(tiered.candidates.map((candidate) => candidate.tier));
  assert.deepEqual([...tiers].sort(), ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"]);
});
check("enabling Tier leaves the qPCR effects unchanged", () => {
  const effects = (result) => result.candidates
    .map((candidate) => [candidate.preparation, candidate.median_log10_quantity_ratio])
    .sort((left, right) => left[0].localeCompare(right[0]));
  assert.deepEqual(effects(tiered), effects(base));
});
check("a local profile is not merged with the built-in profile", () =>
  assert.equal(tiered.candidate_evidence_profile.source, "user_supplied_local_csv"));

// --------------------------------------------------------------- reporting
const report = buildGenericAssessmentReportModel(tiered, { language: "en", source: "verification" });
const docx = renderGenericAssessmentDocx(report);
check("DOCX is produced as bytes", () => assert.ok(docx instanceof Uint8Array));
check("DOCX is not trivially small", () => assert.ok(docx.byteLength > 50_000));
check("the report carries one method catalogue entry per rule", () => assert.ok(report.method_catalog.length >= 8));
check("the report repeats the effect scale", () => assert.ok(report.effect_scaling));

// ------------------------------------------------------------- project file
const project = buildProjectDocument(tiered, { language: "en" });
const restored = parseProjectText(serializeProjectDocument(project));
check("a project round-trips without losing preparations", () =>
  assert.equal(restored.result.candidates.length, tiered.candidates.length));
check("a project round-trips without losing the assay", () =>
  assert.equal(restored.result.assay.target_name, tiered.assay.target_name));
check("a project keeps its normalized records", () =>
  assert.ok(Array.isArray(restored.result.project_source.normalized_records)));

// --------------------------------------------------------- longitudinal run
const longRows = [];
const terms = ["T0", "T1", "T2", "T3", "T4"];
for (const [order, term] of terms.entries()) {
  for (const preparation of ["Alpha", "Beta", "Gamma"]) {
    for (let index = 1; index <= 6; index += 1) {
      longRows.push({
        term,
        preparation,
        sample_name: `S${index}`,
        ct: 24 + index * 0.1 + order * 0.2,
        qty: (100 + index) * (1 - order * 0.1),
      });
    }
  }
}
const longitudinal = buildLocalPrimaryResult({
  longRows,
  profile: await profile(),
  assay: { technology: "qpcr", target_category: "other", target_name: "Synthetic target", analysis_goal: "decrease" },
  timepoints: terms.map((term, order) => ({ term, time_value: order })),
  tierEnabled: true,
});
check("five time points produce seven contrasts", () => assert.equal(longitudinal.longitudinal.contrasts.length, 7));
check("every preparation receives a trajectory", () =>
  assert.equal(longitudinal.longitudinal.trajectories.length, longitudinal.candidates.length));
check("a contrast without a Tier specification reports no Tier", () =>
  assert.deepEqual([...new Set(longitudinal.longitudinal.contrasts[0].candidates.map((c) => c.tier))], [null]));

// -------------------------------------------------------------------- report
console.log(`checks run: ${checks}`);
if (failures.length) {
  console.log(`failed: ${failures.length}`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log("all checks passed");
