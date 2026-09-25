import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { buildLocalPrimaryResult, loadLocalScientificProfile } from "../docs/local-analysis.js";
import { translations } from "../docs/i18n.js";

const root = path.resolve(import.meta.dirname, "..");

/** Serve the shipped configuration from disk so the test uses the real profile. */
async function fileFetch(url) {
  const text = await readFile(path.resolve(root, "docs", url.replace(/^\.\//, "")), "utf8");
  return { ok: true, text: async () => text };
}

function pairs(preparation, count, factor) {
  const rows = [];
  for (let index = 1; index <= count; index += 1) {
    const sample = `${preparation}-${index}`;
    rows.push({ term: "T0", preparation, sample_name: sample, ct: 25, qty: 100 });
    rows.push({ term: "T1", preparation, sample_name: sample, ct: 26, qty: 100 * factor });
  }
  return rows;
}

const assay = { technology: "qpcr", target_category: "pathogen", target_name: "Synthetic target", analysis_goal: "decrease" };
const timepoints = [{ term: "T0", time_value: 0 }, { term: "T1", time_value: 1 }];

async function analyze(longRows, tierEnabled = true) {
  const profile = await loadLocalScientificProfile(fileFetch);
  return buildLocalPrimaryResult({ longRows, profile, assay, timepoints, tierEnabled });
}

test("the result reports the offset and effect scale it actually used", async () => {
  const result = await analyze([...pairs("P1", 6, 0.5), ...pairs("P2", 6, 0.9)]);
  const scaling = result.effect_scaling;
  assert.equal(scaling.qty_offset, 25);
  assert.ok(Number.isFinite(scaling.preparation_median_sd));
  assert.equal(scaling.scaled_preparations, 2);
  assert.equal(scaling.unscaled_preparations, 0);
  assert.equal(scaling.dataset_dependent, true);
  assert.equal(scaling.comparable_across_runs, false);
});

test("adding a preparation changes the scaled effect of the others", async () => {
  // Documented behaviour, not a defect to be silently altered: both the Qty
  // offset and the effect scale are derived from the submitted set. The
  // application discloses them for exactly this reason.
  const smaller = await analyze([...pairs("P1", 6, 0.5), ...pairs("P2", 6, 0.9)]);
  const larger = await analyze([...pairs("P1", 6, 0.5), ...pairs("P2", 6, 0.9), ...pairs("P3", 6, 0.02)]);
  const scaledFor = (result) => result.candidates.find((candidate) => candidate.preparation === "P1").integrated_components.qpcr_effect;
  assert.notEqual(smaller.effect_scaling.qty_offset, larger.effect_scaling.qty_offset);
  assert.notEqual(scaledFor(smaller), scaledFor(larger));
});

test("a single preparation reports that no effect scale was available", async () => {
  const result = await analyze(pairs("P1", 6, 0.5));
  assert.equal(result.effect_scaling.preparation_median_sd, null);
  assert.equal(result.effect_scaling.scaled_preparations, 0);
  assert.equal(result.effect_scaling.unscaled_preparations, 1);
  assert.equal(result.candidates[0].integrated_components.qpcr_effect, 0);
});

test("both interface languages define exactly the same keys", () => {
  const pl = Object.keys(translations.pl).sort();
  const en = Object.keys(translations.en).sort();
  assert.deepEqual(pl.filter((key) => !(key in translations.en)), []);
  assert.deepEqual(en.filter((key) => !(key in translations.pl)), []);
  assert.deepEqual(pl, en);
});

const TIER_FIELDS = ["tier", "tier_decision", "integrated_score", "integrated_components", "evidence_profile", "presentation_score", "presentation_score_basis"];

test("a run without Tier prioritization exports no Tier results", async () => {
  // The module flag alone left tier verdicts in the JSON report and the
  // project file, in a result that declares Tier must not be interpreted.
  const result = await analyze([...pairs("P1", 6, 0.5), ...pairs("P2", 6, 0.9)], false);
  assert.equal(result.modules.tier_prioritization.enabled, false);
  for (const candidate of result.candidates) {
    assert.deepEqual(Object.keys(candidate).filter((key) => TIER_FIELDS.includes(key)), []);
  }
  assert.equal("tier_counts" in result.overview, false);
  assert.equal("tier_policy" in result, false);
  assert.equal("presentation_ranking" in result, false);
  assert.equal("candidate_evidence_profile" in result, false);
  assert.deepEqual(result.screening_reconstruction.rows.filter((row) => "tier" in row), []);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /"tier"|"tier_decision"|"integrated_score"/);
});

test("a run with Tier prioritization still exports its verdicts", async () => {
  const result = await analyze([...pairs("P1", 6, 0.5), ...pairs("P2", 6, 0.9)], true);
  for (const candidate of result.candidates) {
    assert.match(String(candidate.tier), /^Tier [1-5]$/);
    assert.ok(candidate.tier_decision.code);
  }
  assert.ok(result.tier_policy.profile_id);
  assert.ok(result.overview.tier_counts);
});

test("a contrast computed without a Tier specification reports no Tier", async () => {
  // These candidates used to carry a fabricated "Tier 4" that reached the
  // exported JSON as if it were a real classification.
  const result = await analyze([...pairs("P1", 6, 0.5), ...pairs("P2", 6, 0.9)], true);
  const contrast = result.longitudinal.contrasts[0];
  assert.ok(contrast.candidates.length > 0);
  for (const candidate of contrast.candidates) {
    assert.equal(candidate.tier, null);
    assert.equal(candidate.tier_decision.code, "integrated_profile_unavailable");
  }
});
