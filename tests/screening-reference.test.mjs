import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { analyzeWorkbooksLocally, loadLocalScientificProfile, validateScreeningReferenceRows } from "../docs/local-analysis.js";

const root = path.resolve(import.meta.dirname, "..");

async function fileFetch(url) {
  const text = await readFile(path.resolve(root, "docs", url.replace(/^\.\//, "")), "utf8");
  return { ok: true, text: async () => text };
}

const HEADER = "Preparation,Sample Name,Detector,Task,Ct,Qty";
const FACTORS = { Alpha: 0.5, Beta: 0.95, Gamma: 0.5 };

/** Six complete pairs per preparation, so the frozen six-pair rule can apply. */
function workbook(term) {
  const rows = [HEADER];
  for (const [preparation, factor] of Object.entries(FACTORS)) {
    for (let index = 1; index <= 6; index += 1) {
      const quantity = 100 + index;
      const value = term === "T0" ? quantity : quantity * factor;
      rows.push(`${preparation},S${index},Target,Unknown,${25 + index * 0.1},${value.toFixed(4)}`);
    }
  }
  return new File([`${rows.join("\n")}\n`], `${term}.csv`, { type: "text/csv" });
}

const EVIDENCE = `source_preparation,evidence_category,defined_compound_score,context_specific_evidence_score,mechanistic_fit_score,transcriptomic_readiness_score,safety_risk_score,mechanistic_fit_label,safety_risk_label,transcriptomic_readiness_label
Alpha,study profile,2,2,1,2,0,supportive,low,direct
Beta,study profile,2,1,0,2,1,neutral,moderate,direct
Gamma,study profile,1,1,0,1,1,unknown,moderate,limited
`;

// Alpha and Gamma both decrease in all six pairs; the benchmark qualified only
// Alpha, so Gamma must surface as a documented disagreement.
const SCREENING = `preparation,reference_qualified,reference_group
Alpha,true,study group
Beta,false,study group
Gamma,false,study group
`;

async function analyze({ evidence = null, screening = null } = {}) {
  const profile = await loadLocalScientificProfile(fileFetch);
  return analyzeWorkbooksLocally({
    selections: [
      { term: "T0", timeValue: 0, file: workbook("T0") },
      { term: "T1", timeValue: 1, file: workbook("T1") },
    ],
    assay: { technology: "qpcr", target_category: "other", target_name: "Target", analysis_goal: "decrease" },
    timeUnit: "day",
    profile,
    candidateEvidenceFile: evidence ? new File([evidence], "profile.csv", { type: "text/csv" }) : null,
    screeningReferenceFile: screening ? new File([screening], "benchmark.csv", { type: "text/csv" }) : null,
    tierEnabled: true,
  });
}

const rowFor = (result, preparation) => result.screening_reconstruction.rows.find((row) => row.preparation === preparation);

test("a benchmark supplied with a study profile is compared, not discarded", async () => {
  const result = await analyze({ evidence: EVIDENCE, screening: SCREENING });
  assert.equal(result.screening_reference.source, "user_supplied_local_csv");
  assert.equal(result.screening_reference.rows, 3);
  assert.equal(rowFor(result, "Alpha").reference_applicable, true);
  assert.equal(rowFor(result, "Alpha").reference_qualified, true);
  assert.equal(rowFor(result, "Alpha").reconstructed_qualified, true);
  assert.equal(rowFor(result, "Alpha").agreement, true);
  assert.equal(rowFor(result, "Beta").agreement, true);
  assert.equal(rowFor(result, "Gamma").agreement, false);
});

test("without a supplied benchmark a study profile still has nothing to compare", async () => {
  // Previous behaviour, kept deliberately: the built-in benchmark describes the
  // built-in preparations and must not be applied to someone else's names.
  const result = await analyze({ evidence: EVIDENCE });
  assert.equal(result.screening_reference.source, "built_in_versioned_reference");
  for (const row of result.screening_reconstruction.rows) {
    assert.equal(row.reference_applicable, false);
    assert.equal(row.agreement, null);
  }
});

test("a benchmark exported with semicolons is accepted", async () => {
  const result = await analyze({ evidence: EVIDENCE, screening: SCREENING.replaceAll(",", ";") });
  assert.equal(result.screening_reference.rows, 3);
  assert.equal(rowFor(result, "Alpha").reference_applicable, true);
});

test("a malformed benchmark is refused with a specific reason", () => {
  assert.throws(() => validateScreeningReferenceRows([]), /at least one data row/);
  assert.throws(() => validateScreeningReferenceRows([{ preparation: "A", reference_group: "g" }]), /missing columns: reference_qualified/);
  assert.throws(() => validateScreeningReferenceRows([{ preparation: "", reference_qualified: "true", reference_group: "g" }]), /has no preparation/);
  assert.throws(() => validateScreeningReferenceRows([{ preparation: "A", reference_qualified: "yes", reference_group: "g" }]), /must be true or false/);
  assert.throws(() => validateScreeningReferenceRows([
    { preparation: "A", reference_qualified: "true", reference_group: "g" },
    { preparation: "A", reference_qualified: "false", reference_group: "g" },
  ]), /duplicate preparation/);
});
