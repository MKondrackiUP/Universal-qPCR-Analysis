/**
 * Verify a study dataset against expectations recorded outside this repository.
 *
 *   node validation/verify-study-case.mjs path/to/case.json
 *
 * The repository ships the universal application and synthetic examples only, so
 * a study's measurements, evidence profile and benchmark table live with that
 * study — typically as supplementary material to the article that reports it.
 * This runner is the generic half: it contains no dataset and no expected value.
 *
 * The case file is JSON. Paths inside it are resolved relative to the file
 * itself, and every key of `expected` is optional; only what is present is
 * asserted.
 *
 * {
 *   "label": "...",
 *   "assay": { "technology": "...", "target_category": "...",
 *              "target_name": "...", "analysis_goal": "decrease" },
 *   "time_unit": "day",
 *   "timepoints": [{ "term": "T0", "time_value": 0, "file": "T0.xlsx" }, ...],
 *   "evidence_profile": "profile.csv",
 *   "screening_reference": "benchmark.csv",
 *   "expected": { "long_records": 288, "min_quantity_q": 0.071875, ... }
 * }
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casePath = process.argv[2];
if (!casePath) {
  console.error("usage: node validation/verify-study-case.mjs <case.json>");
  process.exit(2);
}

const caseFile = path.resolve(process.cwd(), casePath);
const caseDirectory = path.dirname(caseFile);
const study = JSON.parse(await readFile(caseFile, "utf8"));
const resolve = (relative) => path.resolve(caseDirectory, relative);
const asFile = async (relative) => new File([await readFile(resolve(relative))], path.basename(relative));

const { analyzeWorkbooksLocally, loadLocalScientificProfile } = await import(new URL("../docs/local-analysis.js", import.meta.url).href);

const profile = await loadLocalScientificProfile(async (url) => {
  const text = await readFile(path.join(root, "docs", url.replace(/^\.\//, "")), "utf8");
  return { ok: true, text: async () => text };
});

const result = await analyzeWorkbooksLocally({
  selections: await Promise.all(study.timepoints.map(async (point) => ({
    term: point.term,
    timeValue: point.time_value,
    file: await asFile(point.file),
  }))),
  assay: study.assay,
  timeUnit: study.time_unit ?? "day",
  profile,
  candidateEvidenceFile: study.evidence_profile ? await asFile(study.evidence_profile) : null,
  screeningReferenceFile: study.screening_reference ? await asFile(study.screening_reference) : null,
  tierEnabled: study.tier_enabled ?? Boolean(study.evidence_profile),
});

const finiteQ = (endpoint) => result.candidates
  .map((candidate) => candidate.tests[endpoint].q_value)
  .filter(Number.isFinite);
const direction = (value) => result.candidates.filter((candidate) => candidate.observed_change === value).length;
const screening = result.screening_reconstruction?.rows ?? [];
const qualifiedBy = (key) => new Set(screening.filter((row) => row[key]).map((row) => row.preparation));

const actual = {
  long_records: result.overview.long_records,
  preparations: result.candidates.length,
  nominal_pairs: result.overview.nominal_pair_records,
  complete_quantity_pairs: result.overview.complete_quantity_pairs,
  complete_ct_pairs: result.overview.complete_ct_pairs,
  decreased: direction("decreased"),
  increased: direction("increased"),
  no_change: direction("no_change"),
  min_quantity_q: finiteQ("quantity_signed_rank").length ? Math.min(...finiteQ("quantity_signed_rank")) : null,
  min_ct_q: finiteQ("ct_signed_rank").length ? Math.min(...finiteQ("ct_signed_rank")) : null,
  integrity_relations: result.overview.integrity_relations,
  tier_counts: result.overview.tier_counts ?? null,
  benchmark_applicable: screening.filter((row) => row.reference_applicable).length,
  benchmark_agreements: screening.filter((row) => row.agreement === true).length,
  benchmark_disagreements: screening.filter((row) => row.agreement === false).map((row) => row.preparation),
};

const referenceSet = qualifiedBy("reference_qualified");
const reconstructedSet = qualifiedBy("reconstructed_qualified");
const union = new Set([...referenceSet, ...reconstructedSet]).size;
actual.benchmark_jaccard = union
  ? Number(([...referenceSet].filter((name) => reconstructedSet.has(name)).length / union).toFixed(6))
  : null;

let checks = 0;
const failures = [];
for (const [key, expected] of Object.entries(study.expected ?? {})) {
  checks += 1;
  try {
    if (typeof expected === "number" && !Number.isInteger(expected)) {
      assert.ok(Math.abs(actual[key] - expected) < 1e-9, `${key}: expected ${expected}, got ${actual[key]}`);
    } else {
      assert.deepEqual(actual[key], expected, `${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual[key])}`);
    }
  } catch (error) {
    failures.push(error.message);
  }
}

console.log(`study case: ${study.label ?? path.basename(caseFile)}`);
console.log(`software: ${result.software.name} ${result.software.version}, engine ${result.scientific_engine.version}`);
console.log(`evidence profile: ${result.candidate_evidence_profile?.source ?? "none"}; benchmark: ${result.screening_reference.source}`);
console.log(JSON.stringify(actual, null, 2));
console.log(`checks run: ${checks}`);
if (failures.length) {
  console.log(`failed: ${failures.length}`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log("all recorded expectations reproduced");
