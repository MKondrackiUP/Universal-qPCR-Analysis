/**
 * Pure, deterministic scientific engine for paired qPCR analyses.
 *
 * This module deliberately has no filesystem, HTTP, process or DOM access.  It
 * accepts plain JavaScript values and returns plain JavaScript values, so the
 * same calculation can be used by Node.js now and by an in-browser adapter in
 * a later iteration.
 */

export const SCIENTIFIC_ENGINE = Object.freeze({
  id: "universal-qpcr-scientific-engine",
  version: "1.0.0",
  input_schema_version: "1.0.0",
  deterministic: true,
});

const DEFAULT_MINIMUM_COMPLETE_PAIRS = 3;
const DEFAULT_ALPHA = 0.05;

export function toNumber(value) {
  if (value === "" || value == null || !Number.isFinite(Number(value))) return null;
  return Number(value);
}

function toBoolean(value) {
  return value === true || String(value).trim().toLowerCase() === "true";
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function meanFinite(values) {
  const finite = values.map(toNumber).filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

export function medianFinite(values) {
  const finite = values.map(toNumber).filter(Number.isFinite).sort((left, right) => left - right);
  if (!finite.length) return null;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
}

export function sampleStandardDeviation(values) {
  const finite = values.map(toNumber).filter(Number.isFinite);
  if (finite.length < 2) return null;
  const average = meanFinite(finite);
  const sumSquares = finite.reduce((sum, value) => sum + ((value - average) ** 2), 0);
  return Math.sqrt(sumSquares / (finite.length - 1));
}

function erf(value) {
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + (p * absolute));
  const y = 1 - ((((((a5 * t) + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absolute * absolute));
  return sign * y;
}

function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

export function wilcoxonSignedRank(differences, { minimumNonzeroPairs = 3, exactMaximum = 20 } = {}) {
  const values = differences.map(toNumber).filter(Number.isFinite).filter((value) => Math.abs(value) > 0);
  const n = values.length;
  if (n < minimumNonzeroPairs) {
    return { n, statistic: null, w_plus: null, p_value: null, method: "insufficient_nonzero_pairs" };
  }

  const sorted = values.map((value, index) => ({ index, value: Math.abs(value) }))
    .sort((left, right) => left.value - right.value || left.index - right.index);
  const ranks = Array(n).fill(0);
  const tieSizes = [];
  for (let start = 0; start < n;) {
    let end = start;
    while (end + 1 < n && sorted[end + 1].value === sorted[start].value) end += 1;
    const rank = ((start + 1) + (end + 1)) / 2;
    for (let index = start; index <= end; index += 1) ranks[sorted[index].index] = rank;
    tieSizes.push(end - start + 1);
    start = end + 1;
  }

  const wPlus = values.reduce((sum, value, index) => sum + (value > 0 ? ranks[index] : 0), 0);
  const rankTotal = n * (n + 1) / 2;
  const statistic = Math.min(wPlus, rankTotal - wPlus);
  const expected = rankTotal / 2;
  if (n <= exactMaximum) {
    const observedDistance = Math.abs(wPlus - expected);
    const assignments = 2 ** n;
    let extreme = 0;
    for (let mask = 0; mask < assignments; mask += 1) {
      let permutedWPlus = 0;
      for (let index = 0; index < n; index += 1) {
        if ((mask & (1 << index)) !== 0) permutedWPlus += ranks[index];
      }
      if (Math.abs(permutedWPlus - expected) + 1e-12 >= observedDistance) extreme += 1;
    }
    return { n, statistic, w_plus: wPlus, p_value: extreme / assignments, method: "exact_sign_permutation_two_sided" };
  }

  let variance = n * (n + 1) * ((2 * n) + 1) / 24;
  for (const tie of tieSizes) if (tie > 1) variance -= ((tie ** 3) - tie) / 48;
  if (variance <= 0) return { n, statistic, w_plus: wPlus, p_value: null, method: "undefined_zero_variance" };
  const continuity = wPlus > expected ? -0.5 : wPlus < expected ? 0.5 : 0;
  const z = (wPlus - expected + continuity) / Math.sqrt(variance);
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return {
    n,
    statistic,
    w_plus: wPlus,
    p_value: Math.min(1, Math.max(0, pValue)),
    method: "normal_approximation_tie_and_continuity_corrected_two_sided",
  };
}

export function benjaminiHochberg(rows, pColumn, qColumn) {
  const output = rows.map((row) => ({ ...row }));
  const eligible = output.filter((row) => Number.isFinite(toNumber(row[pColumn])))
    .sort((left, right) => toNumber(left[pColumn]) - toNumber(right[pColumn]));
  let running = 1;
  for (let index = eligible.length - 1; index >= 0; index -= 1) {
    const candidate = Math.min(1, toNumber(eligible[index][pColumn]) * eligible.length / (index + 1));
    running = Math.min(running, candidate);
    eligible[index][qColumn] = running;
  }
  for (const row of output) if (!Number.isFinite(toNumber(row[pColumn]))) row[qColumn] = null;
  return output;
}

function firstPresent(values) {
  return values.find((value) => value != null && String(value).trim() !== "") ?? null;
}

function normalizedLongRow(row) {
  return {
    ...row,
    term: String(row.term ?? "").trim(),
    preparation: String(row.preparation ?? "").trim().replace(/\s+/g, " "),
    sex: row.sex == null || String(row.sex).trim() === "" ? null : String(row.sex).trim(),
    sample_name: String(row.sample_name ?? "").trim(),
    ct: toNumber(row.ct),
    qty: toNumber(row.qty),
    ct_undetermined: toBoolean(row.ct_undetermined),
  };
}

function mapCandidates(candidateMapRows) {
  return new Map(candidateMapRows.map((row) => [row.source_preparation, row]));
}

export function pairPrimaryTimepoints(longRows, candidateMapRows = [], analysisSpecification = {}) {
  const rows = longRows.map(normalizedLongRow).filter((row) => row.preparation && row.sample_name);
  const qpcr = analysisSpecification.qpcr ?? {};
  const required = analysisSpecification.analysis_population?.required_timepoints ?? ["T0", "T1"];
  const [t0Term, t1Term] = required;
  if (!t0Term || !t1Term) throw new Error("The analysis specification must define two required primary timepoints.");
  const positives = rows.map((row) => row.qty).filter(Number.isFinite).filter((value) => value > 0).sort((left, right) => left - right);
  const qtyOffset = positives.length ? positives[0] / 2 : Number(qpcr.fallback_qty_offset ?? 0.001);
  const groups = new Map();
  for (const row of rows.filter((item) => item.term === t0Term || item.term === t1Term)) {
    const key = JSON.stringify([row.preparation, row.sex ?? "", row.sample_name, row.term]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const pivots = new Map();
  let duplicateTermGroups = 0;
  for (const group of groups.values()) {
    const first = group[0];
    const baseKey = JSON.stringify([first.preparation, first.sex ?? "", first.sample_name]);
    if (!pivots.has(baseKey)) {
      pivots.set(baseKey, { preparation: first.preparation, sex: first.sex, sample_name: first.sample_name });
    }
    if (group.length > 1) duplicateTermGroups += 1;
    const pivot = pivots.get(baseKey);
    pivot[`ct_${first.term}`] = meanFinite(group.map((row) => row.ct));
    pivot[`qty_${first.term}`] = meanFinite(group.map((row) => row.qty));
    pivot[`ct_undetermined_${first.term}`] = group.some((row) => row.ct_undetermined);
  }

  const candidateMap = mapCandidates(candidateMapRows);
  const pairedRows = [...pivots.values()].map((pivot) => {
    const ctT0 = toNumber(pivot[`ct_${t0Term}`]);
    const ctT1 = toNumber(pivot[`ct_${t1Term}`]);
    const qtyT0 = toNumber(pivot[`qty_${t0Term}`]);
    const qtyT1 = toNumber(pivot[`qty_${t1Term}`]);
    const deltaCt = Number.isFinite(ctT0) && Number.isFinite(ctT1) ? ctT1 - ctT0 : null;
    const log10QtyRatio = Number.isFinite(qtyT0) && Number.isFinite(qtyT1)
      ? Math.log10((qtyT1 + qtyOffset) / (qtyT0 + qtyOffset)) : null;
    const ctDirection = !Number.isFinite(deltaCt) ? "missing" : deltaCt > 0 ? "favourable_increased_ct" : deltaCt < 0 ? "unfavourable_decreased_ct" : "no_change";
    const qtyDirection = !Number.isFinite(log10QtyRatio) ? "missing" : log10QtyRatio < 0 ? "favourable_decreased_qty" : log10QtyRatio > 0 ? "unfavourable_increased_qty" : "no_change";
    const directionAgreement = ctDirection === "favourable_increased_ct" && qtyDirection === "favourable_decreased_qty"
      ? "both_favourable"
      : ctDirection === "unfavourable_decreased_ct" && qtyDirection === "unfavourable_increased_qty"
        ? "both_unfavourable"
        : ctDirection === "missing" || qtyDirection === "missing" ? "incomplete" : "mixed_or_neutral";
    const metadata = candidateMap.get(pivot.preparation) ?? {};
    return {
      preparation: pivot.preparation,
      publication_name: metadata.publication_name ?? null,
      canonical_name: metadata.canonical_name ?? null,
      drug_class: metadata.drug_class ?? null,
      expected_current_project_match: metadata.expected_current_project_match ?? null,
      primary_role: metadata.primary_role ?? null,
      notes: metadata.notes ?? null,
      sex: pivot.sex,
      sample_name: pivot.sample_name,
      [`ct_${t0Term}`]: ctT0,
      [`qty_${t0Term}`]: qtyT0,
      [`ct_undetermined_${t0Term}`]: pivot[`ct_undetermined_${t0Term}`] ?? null,
      [`ct_${t1Term}`]: ctT1,
      [`qty_${t1Term}`]: qtyT1,
      [`ct_undetermined_${t1Term}`]: pivot[`ct_undetermined_${t1Term}`] ?? null,
      delta_ct: deltaCt,
      log10_qty_ratio: log10QtyRatio,
      ct_direction: ctDirection,
      qty_direction: qtyDirection,
      direction_agreement: directionAgreement,
    };
  }).sort((left, right) => left.preparation.localeCompare(right.preparation) || left.sample_name.localeCompare(right.sample_name));
  return { paired_rows: pairedRows, qty_offset: qtyOffset, duplicate_term_groups: duplicateTermGroups };
}

export function summarizePairedRows(pairedRows, analysisSpecification = {}) {
  const qpcr = analysisSpecification.qpcr ?? {};
  const tests = analysisSpecification.statistical_tests?.signed_rank ?? {};
  const minimumCompletePairs = Number(qpcr.minimum_complete_pairs_for_direction ?? DEFAULT_MINIMUM_COMPLETE_PAIRS);
  const effectMinimum = Number(qpcr.effect_component_min ?? -2);
  const effectMaximum = Number(qpcr.effect_component_max ?? 2);
  const groups = new Map();
  for (const row of pairedRows) {
    if (!groups.has(row.preparation)) groups.set(row.preparation, []);
    groups.get(row.preparation).push(row);
  }
  let summaries = [...groups].map(([preparation, rows]) => {
    const deltaValues = rows.map((row) => toNumber(row.delta_ct));
    const ratioValues = rows.map((row) => toNumber(row.log10_qty_ratio));
    const quantityValues = ratioValues.filter(Number.isFinite);
    const nQuantity = quantityValues.length;
    const nQuantityFavourable = quantityValues.filter((value) => value < 0).length;
    const nQuantityUnfavourable = quantityValues.filter((value) => value > 0).length;
    const bothFavourable = rows.filter((row) => row.direction_agreement === "both_favourable").length;
    const bothUnfavourable = rows.filter((row) => row.direction_agreement === "both_unfavourable").length;
    const completeCtQty = rows.filter((row) => row.direction_agreement !== "incomplete").length;
    const medianRatio = medianFinite(ratioValues);
    const evidenceDirection = nQuantity < minimumCompletePairs || !Number.isFinite(medianRatio) || medianRatio === 0
      ? "qPCR_trend_mixed_or_uncertain" : medianRatio < 0 ? "qPCR_trend_favourable" : "qPCR_trend_unfavourable";
    const directionConsistency = nQuantity === 0 ? null
      : evidenceDirection === "qPCR_trend_favourable" ? nQuantityFavourable / nQuantity
        : evidenceDirection === "qPCR_trend_unfavourable" ? nQuantityUnfavourable / nQuantity : 0;
    const signedRankOptions = {
      minimumNonzeroPairs: Number(tests.minimum_nonzero_pairs ?? DEFAULT_MINIMUM_COMPLETE_PAIRS),
      exactMaximum: Number(tests.exact_sign_permutation_max_nonzero_pairs ?? 20),
    };
    const quantityTest = wilcoxonSignedRank(ratioValues, signedRankOptions);
    const ctTest = wilcoxonSignedRank(deltaValues, signedRankOptions);
    return {
      preparation,
      publication_name: firstPresent(rows.map((row) => row.publication_name)),
      canonical_name: firstPresent(rows.map((row) => row.canonical_name)),
      drug_class: firstPresent(rows.map((row) => row.drug_class)),
      n_pairs: rows.length,
      n_ct_pairs: deltaValues.filter(Number.isFinite).length,
      n_qty_pairs: nQuantity,
      median_delta_ct: medianFinite(deltaValues),
      mean_delta_ct: meanFinite(deltaValues),
      median_log10_qty_ratio: medianRatio,
      mean_log10_qty_ratio: meanFinite(ratioValues),
      n_both_favourable: bothFavourable,
      n_both_unfavourable: bothUnfavourable,
      fraction_both_favourable: rows.length ? bothFavourable / rows.length : null,
      n_qty_favourable: nQuantityFavourable,
      n_qty_unfavourable: nQuantityUnfavourable,
      fraction_qty_favourable: nQuantity ? nQuantityFavourable / nQuantity : null,
      fraction_qty_direction_consistent: directionConsistency,
      fraction_ct_qty_concordant: completeCtQty ? (bothFavourable + bothUnfavourable) / completeCtQty : null,
      wilcox_n_ct: ctTest.n,
      wilcox_w_ct: ctTest.statistic,
      wilcox_p_ct: ctTest.p_value,
      wilcox_method_ct: ctTest.method,
      wilcox_n_log10_qty: quantityTest.n,
      wilcox_w_log10_qty: quantityTest.statistic,
      wilcox_p_log10_qty: quantityTest.p_value,
      wilcox_method_log10_qty: quantityTest.method,
      evidence_direction: evidenceDirection,
      primary_qpcr_endpoint: "log10_qty_ratio",
      qpcr_primary_effect_scaled: null,
      qpcr_rank_score: null,
    };
  });

  const sd = sampleStandardDeviation(summaries.map((row) => row.median_log10_qty_ratio));
  summaries = summaries.map((row) => {
    if (!Number.isFinite(row.median_log10_qty_ratio) || row.n_qty_pairs < minimumCompletePairs || !Number.isFinite(sd) || sd <= 0) return row;
    const scaled = clamp(-row.median_log10_qty_ratio / sd, effectMinimum, effectMaximum);
    return { ...row, qpcr_primary_effect_scaled: scaled, qpcr_rank_score: scaled };
  });
  summaries = benjaminiHochberg(summaries, "wilcox_p_log10_qty", "wilcox_fdr_log10_qty");
  summaries = benjaminiHochberg(summaries, "wilcox_p_ct", "wilcox_fdr_ct");
  return summaries.sort((left, right) => (right.qpcr_rank_score ?? -Infinity) - (left.qpcr_rank_score ?? -Infinity) || left.preparation.localeCompare(right.preparation));
}

export function classifyChange(value) {
  if (!Number.isFinite(value)) return "insufficient_data";
  if (value < 0) return "decreased";
  if (value > 0) return "increased";
  return "no_change";
}

/** The analysis goals the assessment and Tier rules are defined for. */
export const ANALYSIS_GOALS = Object.freeze(["decrease", "increase", "neutral"]);

export function assertSupportedGoal(goal) {
  if (!ANALYSIS_GOALS.includes(goal)) {
    // Without this guard an unrecognised goal makes every direction look
    // opposed, which silently drives the whole set to the Tier 5 override.
    throw new Error(`Unsupported analysis goal: ${goal ?? "missing"}. Expected one of ${ANALYSIS_GOALS.join(", ")}.`);
  }
  return goal;
}

export function alignWithGoal(observedChange, goal) {
  assertSupportedGoal(goal);
  if (observedChange === "insufficient_data") return "uncertain";
  if (goal === "neutral") return "contextual";
  if (observedChange === "no_change") return "uncertain";
  return observedChange === `${goal}d` ? "supportive" : "contradictory";
}

export function integrityByPreparation(rows) {
  const map = new Map();
  const add = (preparation, role, row) => {
    if (!map.has(preparation)) map.set(preparation, []);
    map.get(preparation).push({
      role,
      related_preparation: role === "source" ? row.target_preparation : row.source_preparation,
      source_term: row.source_term,
      target_term: row.target_term,
      identical_records: Number(row.n_identical_records),
      status: row.status,
      required_action: row.required_action,
    });
  };
  for (const row of rows) {
    add(row.source_preparation, "source", row);
    add(row.target_preparation, "target", row);
  }
  return map;
}

/** Detect exact Ct/Qty multisets repeated by distinct timepoint/preparation groups. */
export function auditExactCrossGroupDuplicates(longRows) {
  const groups = new Map();
  for (const source of longRows) {
    const row = normalizedLongRow(source);
    const key = JSON.stringify([row.term, row.preparation]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const signatures = [...groups.values()].map((rows) => ({
    term: rows[0].term,
    preparation: rows[0].preparation,
    n_records: rows.length,
    signature: rows.map((row) => `${Number.isFinite(row.ct) ? row.ct : "<missing>"}|${Number.isFinite(row.qty) ? row.qty : "<missing>"}|${String(row.ct_undetermined).toLowerCase()}`).sort().join("\u001f"),
  }));
  const bySignature = new Map();
  for (const item of signatures) {
    if (!bySignature.has(item.signature)) bySignature.set(item.signature, []);
    bySignature.get(item.signature).push(item);
  }
  const findings = [];
  for (const members of bySignature.values()) {
    if (members.length < 2) continue;
    members.sort((left, right) => left.term.localeCompare(right.term) || left.preparation.localeCompare(right.preparation));
    for (let left = 0; left < members.length; left += 1) {
      for (let right = left + 1; right < members.length; right += 1) {
        findings.push({
          source_term: members[left].term,
          source_preparation: members[left].preparation,
          target_term: members[right].term,
          target_preparation: members[right].preparation,
          n_identical_records: Math.min(members[left].n_records, members[right].n_records),
          status: "unresolved",
          required_action: "Confirm against original qPCR export and treatment map",
        });
      }
    }
  }
  return findings.sort((left, right) => left.source_term.localeCompare(right.source_term)
    || left.source_preparation.localeCompare(right.source_preparation)
    || left.target_term.localeCompare(right.target_term)
    || left.target_preparation.localeCompare(right.target_preparation));
}

function statisticalTest(row, endpoint, { alpha = DEFAULT_ALPHA, minimumCompletePairs = DEFAULT_MINIMUM_COMPLETE_PAIRS } = {}) {
  const quantity = endpoint === "quantity";
  const complete = Number(quantity ? row.n_qty_pairs : row.n_ct_pairs);
  const nonzero = Number(quantity ? (row.wilcox_n_log10_qty ?? row.n_qty_pairs) : (row.wilcox_n_ct ?? row.n_ct_pairs));
  const statistic = toNumber(quantity ? row.wilcox_w_log10_qty : row.wilcox_w_ct);
  const pValue = toNumber(quantity ? row.wilcox_p_log10_qty : row.wilcox_p_ct);
  const qValue = toNumber(quantity ? row.wilcox_fdr_log10_qty : row.wilcox_fdr_ct);
  const method = quantity ? row.wilcox_method_log10_qty : row.wilcox_method_ct;
  const effectiveQ = qValue ?? pValue;
  return {
    id: quantity ? "quantity_signed_rank" : "ct_signed_rank",
    name: "Wilcoxon signed-rank test",
    endpoint: quantity ? "log10_quantity_ratio" : "delta_ct",
    role: quantity ? "primary" : "auxiliary_quality_control",
    contrast: "T1_vs_T0",
    null_hypothesis: "paired_difference_distribution_is_centered_at_zero",
    alternative: "two_sided",
    complete_pairs: Number.isFinite(complete) ? complete : 0,
    nonzero_pairs: Number.isFinite(nonzero) ? nonzero : 0,
    statistic_w: statistic,
    p_value: pValue,
    q_value: qValue,
    alpha,
    multiplicity_adjustment: "Benjamini-Hochberg within endpoint and contrast",
    method: method || (pValue == null ? "not_computed" : "legacy_method_not_recorded"),
    status: pValue == null ? (nonzero < minimumCompletePairs ? "insufficient_nonzero_pairs" : "not_computable") : "computed",
    significant_after_fdr: effectiveQ == null ? null : effectiveQ < alpha,
  };
}

function assessmentFor(candidate, goal, minimumCompletePairs) {
  if (candidate.complete_quantity_pairs < minimumCompletePairs || !Number.isFinite(candidate.median_log10_quantity_ratio)) {
    return { code: "insufficient_data", decisive_rule: "complete_quantity_pairs_below_3_or_primary_effect_unavailable" };
  }
  if (candidate.observed_change === "no_change") return { code: "no_detected_change", decisive_rule: "median_log10_quantity_ratio_equal_zero" };
  if (goal === "neutral") return { code: `descriptive_${candidate.observed_change}`, decisive_rule: "neutral_goal_uses_descriptive_direction_only" };
  const aligned = candidate.goal_alignment === "supportive";
  const confirmed = candidate.tests.quantity_signed_rank.significant_after_fdr === true;
  return {
    code: aligned ? (confirmed ? "confirmed_supportive" : "supportive_signal") : (confirmed ? "confirmed_contradictory" : "contradictory_signal"),
    decisive_rule: `${aligned ? "direction_matches_goal" : "direction_opposes_goal"}_and_${confirmed ? "quantity_q_below_0.05" : "quantity_q_not_below_0.05"}`,
  };
}

export function integratedTier(candidate, summaryRow, assay, evidenceRow, specification) {
  const ranges = specification.integrated_model.ranges;
  const weights = specification.integrated_model.weights;
  const rules = specification.tier_rules;
  const profileAvailable = Boolean(evidenceRow);
  const score = (name) => profileAvailable ? toNumber(evidenceRow[name]) ?? 0 : 0;
  const definedCompound = clamp(score("defined_compound_score"), ...ranges.defined_compound);
  const contextSpecificEvidence = clamp(score("context_specific_evidence_score"), ...ranges.context_specific_evidence);
  const mechanisticFit = clamp(score("mechanistic_fit_score"), ...ranges.mechanistic_fit);
  const transcriptomicReadiness = clamp(score("transcriptomic_readiness_score"), ...ranges.transcriptomic_readiness);
  const safetyRisk = clamp(score("safety_risk_score"), ...ranges.safety_risk);
  const rawScaledEffect = toNumber(summaryRow.qpcr_primary_effect_scaled) ?? 0;
  const goalOrientedScaledEffect = assay.analysis_goal === "increase" ? -rawScaledEffect : assay.analysis_goal === "neutral" ? Math.abs(rawScaledEffect) : rawScaledEffect;
  const effectComponent = clamp(goalOrientedScaledEffect, specification.qpcr.effect_component_min, specification.qpcr.effect_component_max);
  const consistency = clamp(toNumber(summaryRow.fraction_qty_direction_consistent) ?? 0, 0, 1);
  const reliability = specification.qpcr.reliability_floor + ((1 - specification.qpcr.reliability_floor) * consistency);
  const qpcrSignal = effectComponent * reliability;
  const integratedScore = (weights.qpcr_signal * qpcrSignal) + (weights.defined_compound * definedCompound)
    + (weights.context_specific_evidence * contextSpecificEvidence) + (weights.mechanistic_fit * mechanisticFit)
    + (weights.transcriptomic_readiness * transcriptomicReadiness) - (weights.safety_risk * safetyRisk);
  const aligned = candidate.goal_alignment === "supportive";
  const opposed = candidate.goal_alignment === "contradictory";
  let decision;
  if (rules.goal_opposed_qpcr_forces_tier5 && opposed) decision = { tier: "Tier 5", code: "goal_opposed_qpcr_override", explanation: "Kierunek qPCR przeciwny do zadeklarowanego celu uruchomił nadrzędną regułę Tier 5." };
  else if (rules.missing_evidence_profile_forces_tier4 && !profileAvailable) decision = { tier: "Tier 4", code: "missing_evidence_profile_override", explanation: "Brak wersjonowanego profilu dowodów uniemożliwia obliczenie pełnego priorytetu; wynik pozostaje w Tier 4 do uzupełnienia profilu." };
  else if (rules.undefined_or_not_transcriptomic_ready_forces_tier4 && (definedCompound === 0 || transcriptomicReadiness === 0)) decision = { tier: "Tier 4", code: "definition_or_readiness_override", explanation: "Brak jednoznacznie zdefiniowanego preparatu albo gotowości transkryptomicznej uruchomił nadrzędną regułę Tier 4." };
  else if (rules.negative_mechanistic_fit_forces_exploratory_tier3 && aligned && mechanisticFit < 0) decision = { tier: "Tier 3", code: "negative_mechanistic_fit_override", explanation: "Zgodny kierunek qPCR przy ujemnym dopasowaniu mechanistycznym ograniczył klasyfikację do Tier 3." };
  else if (rules.zero_mechanistic_and_context_support_forces_tier3 && aligned && mechanisticFit === 0 && contextSpecificEvidence === 0) decision = { tier: "Tier 3", code: "no_mechanistic_or_context_support", explanation: "Zgodny kierunek qPCR bez wsparcia mechanistycznego i kontekstowego ograniczył klasyfikację do Tier 3." };
  else if (aligned && integratedScore >= rules.tier1_min_score && mechanisticFit >= rules.tier1_min_mechanistic_fit_score && definedCompound >= rules.tier1_min_defined_compound_score) decision = { tier: "Tier 1", code: "tier1_thresholds_met", explanation: "Spełniono próg wyniku Tier 1 oraz wymagania zgodnego qPCR, zdefiniowania preparatu i dopasowania mechanistycznego." };
  else if (aligned && integratedScore >= rules.tier2_min_score) decision = { tier: "Tier 2", code: "tier2_threshold_met", explanation: "Zgodny kierunek qPCR i wynik zintegrowany spełniły próg Tier 2, ale nie komplet wymagań Tier 1." };
  else if (integratedScore >= rules.tier3_min_score) decision = { tier: "Tier 3", code: "tier3_threshold_met", explanation: "Wynik zintegrowany spełnił próg eksploracyjnego Tier 3." };
  else decision = { tier: "Tier 4", code: "mixed_or_low_confidence", explanation: "Nie spełniono progów wyższych Tier; wynik pozostaje mieszany albo ma niską pewność." };
  return {
    ...decision,
    basis: "versioned_integrated_evidence_profile",
    profile_id: specification.profile_id,
    profile_available: profileAvailable,
    score_model: "unweighted_additive_evidence_tally",
    score_model_note: "Every component weight is 1.0. The integrated score is a transparent additive tally of versioned evidence judgements, not a formally elicited multi-criteria decision analysis.",
    integrated_score: integratedScore,
    components: { qpcr_effect: effectComponent, qpcr_direction_consistency: consistency, qpcr_reliability: reliability, qpcr_signal: qpcrSignal, defined_compound: definedCompound, context_specific_evidence: contextSpecificEvidence, mechanistic_fit: mechanisticFit, transcriptomic_readiness: transcriptomicReadiness, safety_risk: safetyRisk },
    labels: profileAvailable ? { evidence_category: evidenceRow.evidence_category, mechanistic_fit: evidenceRow.mechanistic_fit_label, safety_risk: evidenceRow.safety_risk_label, transcriptomic_readiness: evidenceRow.transcriptomic_readiness_label } : null,
  };
}

function quantityMeansByPreparation(rows, terms = ["T0", "T1"]) {
  const [t0, t1] = terms;
  const groups = new Map();
  for (const row of rows) {
    const left = toNumber(row[`qty_${t0}`]);
    const right = toNumber(row[`qty_${t1}`]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
    if (!groups.has(row.preparation)) groups.set(row.preparation, { left: [], right: [] });
    groups.get(row.preparation).left.push(left);
    groups.get(row.preparation).right.push(right);
  }
  return new Map([...groups].map(([preparation, values]) => [preparation, { mean_t0: meanFinite(values.left), mean_t1: meanFinite(values.right) }]));
}

function screeningReconstruction(candidate, goal, quantityMeans = {}, referenceRow = null) {
  const meanT0 = toNumber(quantityMeans.mean_t0);
  const meanT1 = toNumber(quantityMeans.mean_t1);
  const rawMeanChangePercent = Number.isFinite(meanT0) && Number.isFinite(meanT1) && meanT0 !== 0 ? ((meanT1 - meanT0) / meanT0) * 100 : null;
  const directionalMeanChange = !Number.isFinite(rawMeanChangePercent) ? null : goal === "decrease" ? -rawMeanChangePercent : goal === "increase" ? rawMeanChangePercent : Math.abs(rawMeanChangePercent);
  const towardGoal = Object.is(directionalMeanChange, -0) ? 0 : directionalMeanChange;
  const primaryPairedChangePercent = toNumber(candidate.percent_change);
  const directionalPrimaryChange = !Number.isFinite(primaryPairedChangePercent) ? null
    : goal === "decrease" ? -primaryPairedChangePercent
      : goal === "increase" ? primaryPairedChangePercent : Math.abs(primaryPairedChangePercent);
  const primaryChangeTowardGoalPercent = Object.is(directionalPrimaryChange, -0) ? 0 : directionalPrimaryChange;
  const missingPairs = Math.max(0, Number(candidate.nominal_pairs) - Number(candidate.complete_quantity_pairs));
  const mixedPairDirections = Number(candidate.decreased_pairs) > 0 && Number(candidate.increased_pairs) > 0;
  const legacyMeanDirectionConflictsWithPrimary = Number.isFinite(towardGoal) && Number.isFinite(primaryChangeTowardGoalPercent)
    && Math.sign(towardGoal) !== 0 && Math.sign(primaryChangeTowardGoalPercent) !== 0
    && Math.sign(towardGoal) !== Math.sign(primaryChangeTowardGoalPercent);
  const interpretationCodes = [];
  if (missingPairs > 0) interpretationCodes.push("incomplete_quantity_pairs");
  if (mixedPairDirections) interpretationCodes.push("mixed_pair_directions");
  if (legacyMeanDirectionConflictsWithPrimary) interpretationCodes.push("legacy_mean_direction_conflict");
  if (candidate.data_integrity.status === "review_required") interpretationCodes.push("exact_cross_group_relation");
  const goalPairs = goal === "decrease" ? candidate.decreased_pairs : goal === "increase" ? candidate.increased_pairs : candidate.direction_consistent_pairs;
  const referenceApplicable = goal === "decrease" && Boolean(referenceRow);
  const referenceQualified = referenceApplicable && toBoolean(referenceRow.reference_qualified);
  const reconstructedQualified = candidate.complete_quantity_pairs === 6 && candidate.complete_quantity_pairs === candidate.nominal_pairs
    && goalPairs === candidate.complete_quantity_pairs && Number.isFinite(towardGoal) && towardGoal > 20;
  return {
    reference_qualified: referenceQualified,
    reference_applicable: referenceApplicable,
    reference_group: referenceRow?.reference_group ?? null,
    reconstructed_qualified: reconstructedQualified,
    agreement: referenceApplicable ? referenceQualified === reconstructedQualified : null,
    goal_direction_pairs: goalPairs,
    decreased_pairs: Number(candidate.decreased_pairs),
    increased_pairs: Number(candidate.increased_pairs),
    missing_quantity_pairs: missingPairs,
    primary_paired_change_percent: primaryPairedChangePercent,
    primary_change_toward_goal_percent: primaryChangeTowardGoalPercent,
    mean_t0_quantity: meanT0,
    mean_t1_quantity: meanT1,
    mean_change_percent: rawMeanChangePercent,
    mean_change_toward_goal_percent: towardGoal,
    legacy_mean_change_toward_goal_percent: towardGoal,
    legacy_mean_direction_conflicts_with_primary: legacyMeanDirectionConflictsWithPrimary,
    mixed_pair_directions: mixedPairDirections,
    interpretation_codes: interpretationCodes,
    data_audit_role: candidate.data_integrity.exact_cross_group_relations.some((relation) => relation.role === "source") ? "source"
      : candidate.data_integrity.exact_cross_group_relations.some((relation) => relation.role === "target") ? "target" : "none",
  };
}

export function buildCandidateFromSummary(row, {
  assay,
  contrast = "T1_vs_T0",
  integrityMap = new Map(),
  quantityMeans = {},
  tierSpecification = null,
  evidenceRow = null,
  screeningRow = null,
  minimumCompletePairs = DEFAULT_MINIMUM_COMPLETE_PAIRS,
  alpha = DEFAULT_ALPHA,
} = {}) {
  const medianLogRatio = toNumber(row.median_log10_qty_ratio);
  const foldChange = Number.isFinite(medianLogRatio) ? 10 ** medianLogRatio : null;
  const observedChange = classifyChange(medianLogRatio);
  const completePairs = Number(row.n_qty_pairs);
  const decreasedPairs = Number(row.n_qty_favourable);
  const increasedPairs = Number(row.n_qty_unfavourable);
  const directionConsistentPairs = observedChange === "decreased" ? decreasedPairs : observedChange === "increased" ? increasedPairs : 0;
  const quantityTest = statisticalTest(row, "quantity", { alpha, minimumCompletePairs });
  const ctTest = statisticalTest(row, "ct", { alpha, minimumCompletePairs });
  quantityTest.contrast = contrast;
  ctTest.contrast = contrast;
  const nominalPairs = Number(row.n_pairs ?? row.n_nominal_pairs);
  const candidate = {
    preparation: row.preparation,
    canonical_name: row.canonical_name || row.preparation,
    nominal_pairs: nominalPairs,
    complete_ct_pairs: Number(row.n_ct_pairs),
    complete_quantity_pairs: completePairs,
    missing_quantity_pairs: Math.max(0, nominalPairs - completePairs),
    median_delta_ct: toNumber(row.median_delta_ct),
    mean_delta_ct: toNumber(row.mean_delta_ct),
    median_log10_quantity_ratio: medianLogRatio,
    mean_log10_quantity_ratio: toNumber(row.mean_log10_qty_ratio),
    fold_change: foldChange,
    percent_change: Number.isFinite(foldChange) ? (foldChange - 1) * 100 : null,
    observed_change: observedChange,
    goal_alignment: alignWithGoal(observedChange, assay.analysis_goal),
    decreased_pairs: Number.isFinite(decreasedPairs) ? decreasedPairs : 0,
    increased_pairs: Number.isFinite(increasedPairs) ? increasedPairs : 0,
    direction_consistent_pairs: directionConsistentPairs,
    direction_consistency: completePairs > 0 && observedChange !== "no_change" ? directionConsistentPairs / completePairs : null,
    ct_quantity_concordance: toNumber(row.fraction_ct_qty_concordant),
    tests: { quantity_signed_rank: quantityTest, ct_signed_rank: ctTest },
    data_integrity: { exact_cross_group_relations: integrityMap.get(row.preparation) ?? [], status: integrityMap.has(row.preparation) ? "review_required" : "no_exact_cross_group_relation_detected" },
  };
  candidate.assessment = assessmentFor(candidate, assay.analysis_goal, minimumCompletePairs);
  const tierDecision = tierSpecification ? integratedTier(candidate, row, assay, evidenceRow, tierSpecification)
    : { tier: null, code: "integrated_profile_unavailable", explanation: "Brak profilu oceny zintegrowanej; dla tego kontrastu Tier nie jest wyznaczany.", basis: "unavailable", profile_available: false, score_model: "unweighted_additive_evidence_tally", integrated_score: null, components: null, labels: null };
  candidate.tier = tierDecision.tier;
  candidate.tier_decision = tierDecision;
  candidate.integrated_score = tierDecision.integrated_score;
  candidate.integrated_components = tierDecision.components;
  candidate.evidence_profile = { id: tierDecision.profile_id ?? tierSpecification?.profile_id ?? null, available: tierDecision.profile_available, labels: tierDecision.labels };
  candidate.presentation_score = candidate.integrated_score;
  candidate.presentation_score_basis = "versioned_integrated_evidence_score";
  candidate.screening_reconstruction = screeningReconstruction(candidate, assay.analysis_goal, quantityMeans, screeningRow);
  return candidate;
}

export function analyzePrimaryQpcr({
  longRows,
  candidateMapRows = [],
  analysisSpecification,
  tierSpecification,
  evidenceRows = [],
  screeningRows = [],
  integrityRows = [],
  assay,
}) {
  const paired = pairPrimaryTimepoints(longRows, candidateMapRows, analysisSpecification);
  const summaryRows = summarizePairedRows(paired.paired_rows, analysisSpecification);
  const evidence = new Map(evidenceRows.map((row) => [row.source_preparation, row]));
  const screening = new Map(screeningRows.map((row) => [row.preparation, row]));
  const integrityMap = integrityByPreparation(integrityRows);
  const terms = analysisSpecification.analysis_population?.required_timepoints ?? ["T0", "T1"];
  const means = quantityMeansByPreparation(paired.paired_rows, terms);
  const minimumCompletePairs = Number(analysisSpecification.qpcr?.minimum_complete_pairs_for_direction ?? DEFAULT_MINIMUM_COMPLETE_PAIRS);
  const alpha = Number(analysisSpecification.statistical_tests?.multiplicity?.alpha ?? DEFAULT_ALPHA);
  const candidates = summaryRows.map((row) => buildCandidateFromSummary(row, {
    assay,
    integrityMap,
    quantityMeans: means.get(row.preparation),
    tierSpecification,
    evidenceRow: evidence.get(row.preparation) ?? null,
    screeningRow: screening.get(row.preparation) ?? null,
    minimumCompletePairs,
    alpha,
  })).sort((left, right) => (right.integrated_score ?? -Infinity) - (left.integrated_score ?? -Infinity) || left.preparation.localeCompare(right.preparation));
  candidates.forEach((candidate, index) => { candidate.rank = index + 1; });
  return {
    engine: { ...SCIENTIFIC_ENGINE },
    qty_offset: paired.qty_offset,
    duplicate_term_groups: paired.duplicate_term_groups,
    paired_rows: paired.paired_rows,
    summary_rows: summaryRows,
    candidates,
  };
}
