import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { analyzePrimaryQpcr } from "../docs/lib/scientific-engine.mjs";
import { readQpcrInput } from "../docs/xlsx-reader.js";

const root = path.resolve(import.meta.dirname, "..");
const fixtureRoot = path.join(root, "docs", "examples", "synthetic-qpcr-validation");
const specification = JSON.parse(await readFile(path.join(root, "docs", "config", "qpcr_analysis_specification_v2.json"), "utf8"));
const oracle = JSON.parse(await readFile(path.join(fixtureRoot, "expected-results.json"), "utf8"));

function approximately(actual, expected, label) {
  if (expected == null) assert.equal(actual, null, label);
  else assert.ok(Math.abs(actual - expected) <= oracle.numeric_tolerance, `${label}: expected ${expected}, received ${actual}`);
}

async function analyzeFixture(id, extension) {
  const workbooks = [];
  for (const term of ["T0", "T1"]) {
    const filename = `${id}_${term}.${extension}`;
    const workbook = await readQpcrInput(await readFile(path.join(fixtureRoot, filename)), term, filename);
    assert.equal(workbook.validation.source_format, extension);
    workbooks.push(workbook);
  }
  return analyzePrimaryQpcr({
    longRows: workbooks.flatMap((workbook) => workbook.rows),
    analysisSpecification: specification,
    tierSpecification: null,
    assay: { analysis_goal: oracle.analysis_goal },
  });
}

function assertExpected(result, dataset) {
  approximately(result.qty_offset, dataset.qty_offset, `${dataset.id} offset`);
  assert.equal(result.candidates.length, dataset.expected_candidates.length);
  const candidates = new Map(result.candidates.map((candidate) => [candidate.preparation, candidate]));
  for (const expected of dataset.expected_candidates) {
    const candidate = candidates.get(expected.preparation);
    assert.ok(candidate, `${dataset.id} is missing ${expected.preparation}`);
    assert.equal(candidate.complete_quantity_pairs, expected.complete_pairs);
    assert.equal(candidate.tests.quantity_signed_rank.nonzero_pairs, expected.nonzero_pairs);
    assert.equal(candidate.decreased_pairs, expected.decreased_pairs);
    assert.equal(candidate.increased_pairs, expected.increased_pairs);
    approximately(candidate.median_log10_quantity_ratio, expected.median_log10_ratio, `${expected.preparation} median`);
    assert.equal(candidate.observed_change, expected.observed_change);
    assert.equal(candidate.goal_alignment, expected.goal_alignment);
    approximately(candidate.tests.quantity_signed_rank.statistic_w, expected.w, `${expected.preparation} W`);
    approximately(candidate.tests.quantity_signed_rank.p_value, expected.p, `${expected.preparation} p`);
    approximately(candidate.tests.quantity_signed_rank.q_value, expected.q, `${expected.preparation} q`);
    assert.equal(candidate.assessment.code, expected.assessment);
  }
}

function comparable(result) {
  return result.candidates.map((candidate) => ({
    preparation: candidate.preparation,
    completePairs: candidate.complete_quantity_pairs,
    median: candidate.median_log10_quantity_ratio,
    w: candidate.tests.quantity_signed_rank.statistic_w,
    p: candidate.tests.quantity_signed_rank.p_value,
    q: candidate.tests.quantity_signed_rank.q_value,
    assessment: candidate.assessment.code,
  }));
}

for (const dataset of oracle.datasets) {
  test(`synthetic oracle ${dataset.id} matches CSV and XLSX`, async () => {
    const [csvResult, xlsxResult] = await Promise.all([analyzeFixture(dataset.id, "csv"), analyzeFixture(dataset.id, "xlsx")]);
    assertExpected(csvResult, dataset);
    assertExpected(xlsxResult, dataset);
    assert.deepEqual(comparable(xlsxResult), comparable(csvResult));
  });
}

test("fixtures cannot be presented as biological evidence", () => {
  assert.equal(oracle.synthetic_data, true);
  assert.equal(oracle.biological_interpretation_allowed, false);
  assert.equal(oracle.tier_enabled, false);
});
