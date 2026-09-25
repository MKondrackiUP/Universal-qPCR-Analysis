import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WorkbookValidationError,
  buildValidatedRows,
  detectDecimalMark,
  normalizeNumericText,
  resolveSex,
} from "../docs/lib/workbook-validation.mjs";
import { ANALYSIS_GOALS, alignWithGoal } from "../docs/lib/scientific-engine.mjs";
import { readCandidateEvidenceProfileFile } from "../docs/local-analysis.js";

const HEADER = ["Preparation", "Sample Name", "Detector", "Task", "Ct", "Qty", "Sex"];
const sheet = (...rows) => [HEADER, ...rows];

function validated(rows) {
  return buildValidatedRows(rows, "T0", "fixture.csv", "csv");
}

function rejected(rows) {
  try {
    validated(rows);
  } catch (error) {
    assert.ok(error instanceof WorkbookValidationError);
    return error;
  }
  return assert.fail("The input was accepted although it should have been rejected.");
}

test("the decimal mark is decided once per file from unambiguous evidence", () => {
  assert.equal(detectDecimalMark(["25.1", "1,234"]), ".");
  assert.equal(detectDecimalMark(["25,1", "1,234"]), ",");
  assert.equal(detectDecimalMark(["1,234", "5,678"]), null);
  assert.equal(detectDecimalMark(["1234", ""]), null);
});

test("a grouping comma never becomes a decimal comma", () => {
  assert.deepEqual(normalizeNumericText("1,234", "."), { text: "1234", ambiguous: false });
  assert.deepEqual(normalizeNumericText("1,234", ","), { text: "1.234", ambiguous: false });
  assert.deepEqual(normalizeNumericText("1,234", null), { text: "1,234", ambiguous: true });
  assert.deepEqual(normalizeNumericText("1 234", null), { text: "1234", ambiguous: false });
  assert.deepEqual(normalizeNumericText("1,234.56", null), { text: "1234.56", ambiguous: false });
  assert.deepEqual(normalizeNumericText("25,1", null), { text: "25.1", ambiguous: false });
});

test("an English thousands separator is not read as a Polish decimal comma", () => {
  const workbook = validated(sheet(
    ["A", "S1", "TGT", "Unknown", "25.1", "1,234", "F"],
    ["A", "S2", "TGT", "Unknown", "25.2", "1 234", "F"],
    ["A", "S3", "TGT", "Unknown", "25.3", "1234", "F"],
  ));
  assert.equal(workbook.validation.decimal_mark, ".");
  assert.deepEqual(workbook.rows.map((row) => row.qty), [1234, 1234, 1234]);
});

test("a Polish decimal comma is preserved when the file uses one", () => {
  const workbook = validated(sheet(
    ["A", "S1", "TGT", "Unknown", "25,1", "1,234", "F"],
    ["A", "S2", "TGT", "Unknown", "25,2", "9,875", "F"],
  ));
  assert.equal(workbook.validation.decimal_mark, ",");
  assert.deepEqual(workbook.rows.map((row) => row.qty), [1.234, 9.875]);
});

test("an undecidable separator is rejected instead of silently guessed", () => {
  const error = rejected(sheet(
    ["A", "S1", "TGT", "Unknown", "25", "1,234", "F"],
    ["A", "S2", "TGT", "Unknown", "26", "5,678", "F"],
  ));
  assert.equal(error.code, "INVALID_NUMERIC_VALUES");
  assert.equal(error.details.issues[0].field, "qty");
  assert.equal(error.details.issues[0].reason, "ambiguous_decimal_separator");
});

test("a declared Sex column outranks the sample-name prefix", () => {
  assert.equal(resolveSex("Mouse-7", "F"), "female");
  assert.equal(resolveSex("Fish-3", "M"), "male");
  assert.equal(resolveSex("S01", "female"), "female");
  assert.equal(resolveSex("S02", "2"), "female");
});

test("the sample-name prefix stays a fallback and never invents a declared value", () => {
  assert.equal(resolveSex("M1", ""), "male");
  assert.equal(resolveSex("F1", ""), "female");
  assert.equal(resolveSex("S01", ""), null);
  assert.equal(resolveSex("Mouse-7", "unspecified"), null);
});

test("pairing keys follow the declared sex, not the sample name", () => {
  const workbook = validated(sheet(
    ["A", "Mouse-7", "TGT", "Unknown", "25.1", "100", "F"],
    ["A", "Fish-3", "TGT", "Unknown", "25.2", "100", "M"],
  ));
  assert.deepEqual(workbook.rows.map((row) => row.sex), ["female", "male"]);
});

test("an unsupported analysis goal is refused rather than treated as opposition", () => {
  // A goal the rules are not defined for used to make every direction look
  // opposed, which silently drove the whole set to the Tier 5 override.
  assert.deepEqual([...ANALYSIS_GOALS], ["decrease", "increase", "neutral"]);
  assert.equal(alignWithGoal("decreased", "decrease"), "supportive");
  assert.equal(alignWithGoal("decreased", "increase"), "contradictory");
  assert.equal(alignWithGoal("decreased", "neutral"), "contextual");
  assert.throws(() => alignWithGoal("decreased", "reduce"), /Unsupported analysis goal/);
  assert.throws(() => alignWithGoal("decreased", undefined), /Unsupported analysis goal/);
});

test("an evidence profile exported with semicolons is accepted", async () => {
  // Excel in a Polish locale writes semicolon-separated CSV by default; the
  // profile now goes through the same decoder as the qPCR input.
  const header = ["source_preparation", "evidence_category", "defined_compound_score", "context_specific_evidence_score",
    "mechanistic_fit_score", "transcriptomic_readiness_score", "safety_risk_score", "mechanistic_fit_label",
    "safety_risk_label", "transcriptomic_readiness_label"];
  const text = `${header.join(";")}\nPreparat A;przyklad;2;1;1;2;0;wspierajace;niskie;bezposrednie\n`;
  const rows = await readCandidateEvidenceProfileFile(new File([text], "profil.csv", { type: "text/csv" }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_preparation, "Preparat A");
  assert.equal(rows[0].defined_compound_score, 2);
  assert.equal(rows[0].safety_risk_score, 0);
});

test("a comma-separated evidence profile keeps working", async () => {
  const text = "source_preparation,evidence_category,defined_compound_score,context_specific_evidence_score,mechanistic_fit_score,transcriptomic_readiness_score,safety_risk_score,mechanistic_fit_label,safety_risk_label,transcriptomic_readiness_label\nPreparation A,example,1,1,0,1,1,unknown,moderate,limited\n";
  const rows = await readCandidateEvidenceProfileFile(new File([text], "profile.csv", { type: "text/csv" }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].mechanistic_fit_score, 0);
});
