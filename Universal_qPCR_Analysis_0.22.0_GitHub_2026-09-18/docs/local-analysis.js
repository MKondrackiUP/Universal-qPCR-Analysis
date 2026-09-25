import {
  SCIENTIFIC_ENGINE,
  alignWithGoal,
  analyzePrimaryQpcr,
  auditExactCrossGroupDuplicates,
  buildCandidateFromSummary,
  classifyChange,
  pairPrimaryTimepoints,
  sampleStandardDeviation,
  summarizePairedRows,
} from "./lib/scientific-engine.mjs";
import { assertCompatibleWorkbooks, readQpcrInput } from "./xlsx-reader.js";
import { readDelimitedTable } from "./lib/delimited-input.mjs";

const EVIDENCE_PROFILE_HEADERS = [
  "source_preparation",
  "evidence_category",
  "defined_compound_score",
  "context_specific_evidence_score",
  "mechanistic_fit_score",
  "transcriptomic_readiness_score",
  "safety_risk_score",
  "mechanistic_fit_label",
  "safety_risk_label",
  "transcriptomic_readiness_label",
];
const EVIDENCE_SCORE_RANGES = {
  defined_compound_score: [0, 2],
  context_specific_evidence_score: [0, 2],
  mechanistic_fit_score: [-2, 1],
  transcriptomic_readiness_score: [0, 2],
  safety_risk_score: [0, 3],
};
const SCREENING_REFERENCE_HEADERS = ["preparation", "reference_qualified", "reference_group"];
const MAX_EVIDENCE_PROFILE_BYTES = 1024 * 1024;
const MAX_EVIDENCE_PROFILE_ROWS = 2000;
const SOFTWARE_RELEASE = {
  name: "Universal qPCR Analysis",
  version: "0.22.0",
  release_date: "2026-09-01",
  license: "Universal qPCR Analysis Free Use and Scientific Citation License 1.0",
  authors: [{ given_names: "Marcin", family_names: "Kondracki" }],
  doi: null,
  citation_status: "software_citation_without_doi",
};

/** Convert a rectangular table into row objects keyed by its header. */
function tableToRecords(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((value) => String(value ?? "").trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text).replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); if (row.some((value) => value !== "")) rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); if (row.some((value) => value !== "")) rows.push(row); }
  if (!rows.length) return [];
  return rows.slice(1).map((values) => Object.fromEntries(rows[0].map((header, index) => [header, values[index] ?? ""])));
}

export function parseCandidateEvidenceProfileCsv(text) {
  const bytes = new TextEncoder().encode(String(text)).byteLength;
  if (bytes > MAX_EVIDENCE_PROFILE_BYTES) throw new Error("Candidate evidence profile exceeds the 1 MB local limit.");
  return validateCandidateEvidenceRows(parseCsv(text));
}

/** Apply the evidence-profile contract to already-parsed rows. */
export function validateCandidateEvidenceRows(rows) {
  if (!rows.length) throw new Error("Candidate evidence profile must contain a header and at least one data row.");
  if (rows.length > MAX_EVIDENCE_PROFILE_ROWS) throw new Error(`Candidate evidence profile exceeds ${MAX_EVIDENCE_PROFILE_ROWS} rows.`);
  const headers = Object.keys(rows[0]);
  const missingHeaders = EVIDENCE_PROFILE_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length) throw new Error(`Candidate evidence profile is missing columns: ${missingHeaders.join(", ")}.`);
  const seen = new Set();
  return rows.map((source, index) => {
    const rowNumber = index + 2;
    const row = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, String(value ?? "").trim()]));
    if (!row.source_preparation) throw new Error(`Candidate evidence profile row ${rowNumber} has no source_preparation.`);
    if (seen.has(row.source_preparation)) throw new Error(`Candidate evidence profile contains duplicate source_preparation: ${row.source_preparation}.`);
    seen.add(row.source_preparation);
    for (const field of ["evidence_category", "mechanistic_fit_label", "safety_risk_label", "transcriptomic_readiness_label"]) {
      if (!row[field]) throw new Error(`Candidate evidence profile row ${rowNumber} has an empty ${field}.`);
    }
    for (const [field, [minimum, maximum]] of Object.entries(EVIDENCE_SCORE_RANGES)) {
      const value = Number(row[field]);
      if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`Candidate evidence profile row ${rowNumber}: ${field} must be an integer between ${minimum} and ${maximum}.`);
      row[field] = value;
    }
    return row;
  });
}

/**
 * Read a user-supplied evidence profile through the shared delimited decoder.
 *
 * The decoder handles comma, semicolon and tab separators and UTF-8, UTF-16 and
 * Windows-1250 text. A profile exported from a Polish Excel, which defaults to
 * semicolons, previously failed with a misleading "missing columns" error.
 */
export async function readCandidateEvidenceProfileFile(file) {
  if (!file) return null;
  if (file.size > MAX_EVIDENCE_PROFILE_BYTES) throw new Error("Candidate evidence profile exceeds the 1 MB local limit.");
  const table = readDelimitedTable(await file.arrayBuffer());
  return validateCandidateEvidenceRows(tableToRecords(table.rows));
}

/**
 * Validate a frozen screening reference supplied by the user.
 *
 * The reconstruction compares each preparation with a benchmark decision taken
 * before this application existed. That benchmark belongs to a study, not to
 * the software, so it can be supplied alongside the evidence profile instead of
 * being shipped as a built-in table.
 */
export function validateScreeningReferenceRows(rows) {
  if (!rows.length) throw new Error("Screening reference must contain a header and at least one data row.");
  if (rows.length > MAX_EVIDENCE_PROFILE_ROWS) throw new Error(`Screening reference exceeds ${MAX_EVIDENCE_PROFILE_ROWS} rows.`);
  const missingHeaders = SCREENING_REFERENCE_HEADERS.filter((header) => !Object.keys(rows[0]).includes(header));
  if (missingHeaders.length) throw new Error(`Screening reference is missing columns: ${missingHeaders.join(", ")}.`);
  const seen = new Set();
  return rows.map((source, index) => {
    const rowNumber = index + 2;
    const row = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, String(value ?? "").trim()]));
    if (!row.preparation) throw new Error(`Screening reference row ${rowNumber} has no preparation.`);
    if (seen.has(row.preparation)) throw new Error(`Screening reference contains duplicate preparation: ${row.preparation}.`);
    seen.add(row.preparation);
    if (!/^(?:true|false)$/i.test(row.reference_qualified)) {
      throw new Error(`Screening reference row ${rowNumber}: reference_qualified must be true or false.`);
    }
    return row;
  });
}

export async function readScreeningReferenceFile(file) {
  if (!file) return null;
  if (file.size > MAX_EVIDENCE_PROFILE_BYTES) throw new Error("Screening reference exceeds the 1 MB local limit.");
  const table = readDelimitedTable(await file.arrayBuffer());
  return validateScreeningReferenceRows(tableToRecords(table.rows));
}

export function applyCandidateEvidenceProfile(profile, evidenceRows, filename, screening = null) {
  const customScreening = screening?.rows
    ? { ...profile, screeningRows: screening.rows, customScreeningReference: { filename: screening.filename, rows: screening.rows.length, source: "user_supplied_local_csv", stored_on_server: false } }
    : profile;
  if (!evidenceRows) return customScreening;
  const candidateMapRows = evidenceRows.map((row) => ({
    source_preparation: row.source_preparation,
    publication_name: row.canonical_name || row.source_preparation,
    canonical_name: row.canonical_name || row.source_preparation,
    drug_class: row.drug_class || row.evidence_category,
  }));
  return {
    ...customScreening,
    candidateMapRows,
    evidenceRows,
    // The built-in benchmark describes the built-in preparations, so it cannot
    // apply to a user profile. A benchmark supplied with that profile can.
    screeningRows: screening?.rows ?? [],
    tierSpecification: { ...profile.tierSpecification, profile_id: "local-user-evidence-profile-v1" },
    customEvidenceProfile: { filename, rows: evidenceRows.length, profile_id: "local-user-evidence-profile-v1", source: "user_supplied_local_csv", stored_on_server: false },
  };
}

async function fetched(response) {
  if (!response.ok) throw new Error(`Cannot load local analysis resource: HTTP ${response.status}.`);
  return response;
}

export async function loadLocalScientificProfile(fetchImplementation = fetch) {
  const paths = {
    analysisSpecification: "./config/qpcr_analysis_specification_v2.json",
    tierSpecification: "./config/universal_tier_specification_v1.json",
    candidateMapRows: "./config/universal_candidate_map_v1.csv",
    evidenceRows: "./config/universal_candidate_evidence_v1.csv",
    screeningRows: "./config/universal_screening_reference_v1.csv",
  };
  const [analysis, tier, candidateMap, evidence, screening] = await Promise.all(Object.values(paths).map((url) => fetchImplementation(url).then(fetched).then((response) => response.text())));
  return {
    analysisSpecification: JSON.parse(analysis),
    tierSpecification: JSON.parse(tier),
    candidateMapRows: parseCsv(candidateMap),
    evidenceRows: parseCsv(evidence),
    screeningRows: parseCsv(screening),
  };
}

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!finite.length) return null;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
}

export function pairedPlotSvg(pairedRows, property, { title, axisLabel }) {
  const groups = new Map();
  for (const row of pairedRows) {
    const value = Number(row[property]);
    if (!Number.isFinite(value)) continue;
    if (!groups.has(row.preparation)) groups.set(row.preparation, []);
    groups.get(row.preparation).push(value);
  }
  const data = [...groups].map(([preparation, values]) => ({ preparation, values, median: median(values) })).sort((left, right) => left.median - right.median);
  const all = data.flatMap((item) => item.values);
  let minimum = Math.min(0, ...all);
  let maximum = Math.max(0, ...all);
  if (minimum === maximum) { minimum -= 1; maximum += 1; }
  const padding = (maximum - minimum) * 0.08;
  minimum -= padding; maximum += padding;
  const width = 1100; const rowHeight = 28; const top = 70; const bottom = 75; const left = 310; const right = 45;
  const height = Math.max(430, top + bottom + (data.length * rowHeight));
  const x = (value) => left + ((value - minimum) / (maximum - minimum)) * (width - left - right);
  const lines = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`, `<rect width="100%" height="100%" fill="#fff"/>`, `<text x="${left}" y="30" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#17324d">${escapeXml(title)}</text>`, `<text x="${left}" y="52" font-family="Arial,sans-serif" font-size="12" fill="#687386">${escapeXml(axisLabel)}</text>`];
  const zero = x(0);
  lines.push(`<line x1="${zero}" y1="${top - 10}" x2="${zero}" y2="${height - bottom + 10}" stroke="#17324d" stroke-width="1.2"/>`);
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = minimum + ((maximum - minimum) * tick / 4);
    const position = x(value);
    lines.push(`<line x1="${position}" y1="${top - 10}" x2="${position}" y2="${height - bottom + 10}" stroke="#d6e2dd"/>`, `<text x="${position}" y="${height - 35}" font-family="Arial,sans-serif" font-size="11" fill="#687386" text-anchor="middle">${value.toFixed(2)}</text>`);
  }
  data.forEach((item, index) => {
    const y = top + (index * rowHeight);
    lines.push(`<text x="18" y="${y + 5}" font-family="Arial,sans-serif" font-size="12" fill="#17324d">${escapeXml(item.preparation)}</text>`, `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#edf3f0"/>`);
    item.values.forEach((value, valueIndex) => lines.push(`<circle cx="${x(value)}" cy="${y + (((valueIndex % 5) - 2) * 2.2)}" r="3.4" fill="#2a7f75" opacity=".55"/>`));
    lines.push(`<circle cx="${x(item.median)}" cy="${y}" r="5.7" fill="#17324d"/>`);
  });
  lines.push(`<text x="${left}" y="${height - 13}" font-family="Arial,sans-serif" font-size="11" fill="#687386">Small circles: paired observations; dark circle: preparation median; vertical line: no change.</text>`, "</svg>");
  return lines.join("\n");
}

function svgArtifact(path, svg) {
  return { path, bytes: new TextEncoder().encode(svg).byteLength, media_type: "image/svg+xml", download_url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, local: true };
}

function presentationRows(candidates) {
  return candidates.map((candidate, index) => ({ rank: index + 1, preparation: candidate.preparation, canonical_name: candidate.canonical_name, tier: candidate.tier, score: candidate.presentation_score }));
}

function screeningRows(candidates) {
  return candidates.map((candidate, index) => ({ rank: index + 1, preparation: candidate.preparation, canonical_name: candidate.canonical_name, tier: candidate.tier, complete_quantity_pairs: candidate.complete_quantity_pairs, nominal_pairs: candidate.nominal_pairs, ...candidate.screening_reconstruction }));
}

function longitudinalContrastDefinitions(timepoints) {
  const definitions = [];
  for (let toOrder = 1; toOrder < timepoints.length; toOrder += 1) {
    const toTerm = timepoints[toOrder].term;
    definitions.push({ contrast_id: `T0_to_${toTerm}`, contrast_type: toOrder === 1 ? "primary_baseline_and_adjacent" : "baseline", from_term: "T0", to_term: toTerm, from_order: 0, to_order: toOrder });
    if (toOrder > 1) {
      const fromTerm = timepoints[toOrder - 1].term;
      definitions.push({ contrast_id: `${fromTerm}_to_${toTerm}`, contrast_type: "adjacent", from_term: fromTerm, to_term: toTerm, from_order: toOrder - 1, to_order: toOrder });
    }
  }
  return definitions;
}

function buildLongitudinalContrasts(longRows, timepoints, profile, assay) {
  return longitudinalContrastDefinitions(timepoints).map((definition) => {
    const specification = {
      ...profile.analysisSpecification,
      analysis_population: { ...profile.analysisSpecification.analysis_population, required_timepoints: [definition.from_term, definition.to_term] },
    };
    const paired = pairPrimaryTimepoints(longRows, profile.candidateMapRows, specification);
    const candidates = summarizePairedRows(paired.paired_rows, specification).map((row) => buildCandidateFromSummary(row, {
      assay,
      contrast: `${definition.to_term}_vs_${definition.from_term}`,
      minimumCompletePairs: Number(specification.qpcr?.minimum_complete_pairs_for_direction ?? 3),
      alpha: Number(specification.statistical_tests?.multiplicity?.alpha ?? 0.05),
    })).sort((left, right) => left.preparation.localeCompare(right.preparation));
    return { ...definition, candidates };
  });
}

function longitudinalPairing(longRows, timepoints) {
  const expected = timepoints.map((item) => item.term);
  const pairs = new Map();
  for (const row of longRows) {
    const key = JSON.stringify([row.preparation, row.sex ?? "", row.sample_name]);
    if (!pairs.has(key)) pairs.set(key, new Set());
    pairs.get(key).add(row.term);
  }
  let completeAllTerms = 0;
  for (const present of pairs.values()) if (expected.every((term) => present.has(term))) completeAllTerms += 1;
  return { assessed_pairs: pairs.size, complete_all_terms: completeAllTerms, incomplete_terms: pairs.size - completeAllTerms };
}

function trajectoryDirection(candidate) {
  if (candidate.observed_change === "decreased") return "favourable";
  if (candidate.observed_change === "increased") return "unfavourable";
  return "uncertain";
}

function buildTrajectories(contrasts, timepoints, primaryCandidates, assay) {
  const baseline = contrasts.filter((contrast) => contrast.from_term === "T0").sort((left, right) => left.to_order - right.to_order);
  const candidateNames = new Map(primaryCandidates.map((candidate) => [candidate.preparation, candidate.canonical_name]));
  return primaryCandidates.map((primary) => {
    const candidates = baseline.map((contrast) => contrast.candidates.find((candidate) => candidate.preparation === primary.preparation)).filter(Boolean);
    const directions = candidates.map(trajectoryDirection);
    const firstDirection = directions[0] ?? "uncertain";
    const finalDirection = directions.at(-1) ?? "uncertain";
    const favourable = directions.filter((direction) => direction === "favourable").length;
    const unfavourable = directions.filter((direction) => direction === "unfavourable").length;
    const uncertain = directions.filter((direction) => direction === "uncertain").length;
    let classification = "unstable_mixed";
    if (timepoints.length === 2) classification = "two_timepoint_only";
    else if (directions.length > 0 && uncertain === directions.length) classification = "insufficient_data";
    else if (directions.length > 0 && favourable === directions.length) classification = "sustained_favourable";
    else if (firstDirection === "favourable" && finalDirection === "favourable") classification = "favourable_with_variation";
    else if (firstDirection !== "favourable" && finalDirection === "favourable") classification = "delayed_favourable";
    else if (firstDirection === "favourable" && finalDirection === "unfavourable") classification = "rebound_unfavourable";
    else if (firstDirection === "favourable" && finalDirection !== "favourable") classification = "transient_favourable";
    else if (directions.length > 0 && unfavourable === directions.length) classification = "sustained_unfavourable";
    const final = candidates.at(-1);
    const observedChange = classifyChange(final?.median_log10_quantity_ratio);
    return {
      preparation: primary.preparation,
      canonical_name: candidateNames.get(primary.preparation) ?? primary.preparation,
      timepoint_count: timepoints.length,
      final_term: timepoints.at(-1).term,
      final_median_log10_quantity_ratio: final?.median_log10_quantity_ratio ?? null,
      observed_change: observedChange,
      goal_alignment: alignWithGoal(observedChange, assay.analysis_goal),
      classification,
    };
  }).sort((left, right) => left.preparation.localeCompare(right.preparation));
}

/**
 * Describe the two quantities the primary effect depends on beyond the pair itself.
 *
 * The Qty offset is half the smallest positive Qty in the submitted set, and the
 * effect scale is the sample standard deviation of preparation medians in that
 * same set. Both therefore move when preparations are added or removed, so they
 * are reported next to the result instead of staying implicit.
 */
function effectScaling(primary, analysisSpecification) {
  const medians = primary.summary_rows.map((row) => row.median_log10_qty_ratio);
  const sd = sampleStandardDeviation(medians);
  const scaled = primary.summary_rows.filter((row) => Number.isFinite(row.qpcr_primary_effect_scaled)).length;
  return {
    qty_offset: primary.qty_offset,
    qty_offset_rule: analysisSpecification.qpcr?.qty_offset_rule ?? "half_minimum_positive_qty_across_all_supplied_timepoints",
    effect_scale_rule: analysisSpecification.qpcr?.effect_scaling ?? "negative_median_log10_qty_ratio_divided_by_sample_sd_of_preparation_medians",
    preparation_median_sd: sd,
    scaled_preparations: scaled,
    unscaled_preparations: primary.summary_rows.length - scaled,
    dataset_dependent: true,
    comparable_across_runs: false,
    interpretation: "The Qty offset and the effect scale are both derived from the submitted set of preparations. Adding or removing a preparation changes the scaled effect, and therefore the integrated score, of every other preparation. Compare scaled effects, integrated scores and Tier only within one run.",
  };
}

const TIER_CANDIDATE_FIELDS = ["tier", "tier_decision", "integrated_score", "integrated_components", "evidence_profile", "presentation_score", "presentation_score_basis"];

function withoutFields(source, fields) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !fields.includes(key)));
}

/**
 * Remove Tier results from a run that did not request Tier prioritization.
 *
 * The module flag alone was not enough. A disabled run still exported tier,
 * tier_decision and integrated scores into the JSON report and the project
 * file, while the same result declared that Tier "must not be interpreted".
 * Anything a reader could mistake for a Tier verdict is dropped instead.
 */
function withoutTierResults(result) {
  const stripCandidate = (candidate) => withoutFields(candidate, TIER_CANDIDATE_FIELDS);
  const screening = result.screening_reconstruction;
  return {
    ...withoutFields(result, ["tier_policy", "presentation_ranking", "preparation_ordering", "candidate_evidence_profile"]),
    overview: withoutFields(result.overview, ["tier_counts"]),
    candidates: result.candidates.map(stripCandidate),
    screening_reconstruction: screening ? { ...screening, rows: screening.rows.map((row) => withoutFields(row, ["tier"])) } : screening,
    longitudinal: {
      ...result.longitudinal,
      contrasts: result.longitudinal.contrasts.map((contrast) => ({ ...contrast, candidates: contrast.candidates.map(stripCandidate) })),
    },
  };
}

export function buildLocalPrimaryResult({ longRows, profile, assay, timepoints, inputFiles = [], tierEnabled = true }) {
  const integrityRows = auditExactCrossGroupDuplicates(longRows);
  const primary = analyzePrimaryQpcr({ longRows, ...profile, integrityRows, assay });
  const candidates = primary.candidates;
  const assessmentCodes = ["confirmed_supportive", "supportive_signal", "no_detected_change", "insufficient_data", "contradictory_signal", "confirmed_contradictory", "descriptive_decreased", "descriptive_increased"];
  const qtySvg = pairedPlotSvg(primary.paired_rows, "log10_qty_ratio", { title: "Paired qPCR quantity change by preparation", axisLabel: "log10 quantity ratio (T1 / T0); negative values indicate lower quantity at T1" });
  const ctSvg = pairedPlotSvg(primary.paired_rows, "delta_ct", { title: "Paired qPCR Ct change by preparation", axisLabel: "Delta Ct (T1 - T0); positive values indicate higher Ct at T1" });
  const artifacts = [svgArtifact("results/00_qpcr/figures/paired_log10_qty_ratio.svg", qtySvg), svgArtifact("results/00_qpcr/figures/paired_delta_ct.svg", ctSvg)];
  const contrasts = buildLongitudinalContrasts(longRows, timepoints, profile, assay);
  const trajectories = buildTrajectories(contrasts, timepoints, candidates, assay);
  const localId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const candidateNames = new Set(candidates.map((candidate) => candidate.preparation));
  const profiledNames = new Set(candidates.filter((candidate) => candidate.evidence_profile.available).map((candidate) => candidate.preparation));
  const candidateEvidenceProfile = {
    ...(profile.customEvidenceProfile ?? { filename: "built-in", rows: profile.evidenceRows.length, profile_id: profile.tierSpecification.profile_id, source: "built_in_versioned_profile", stored_on_server: false }),
    matched_preparations: profiledNames.size,
    unprofiled_preparations: candidates.length - profiledNames.size,
    unused_profile_entries: profile.evidenceRows.filter((row) => !candidateNames.has(row.source_preparation)).length,
    unprofiled_preparation_names: candidates.filter((candidate) => !profiledNames.has(candidate.preparation)).map((candidate) => candidate.preparation),
    unused_profile_entry_names: profile.evidenceRows.filter((row) => !candidateNames.has(row.source_preparation)).map((row) => row.source_preparation),
  };
  const result = {
    run_id: `local-${localId}`,
    source: "browser_local_analysis",
    analysis_type: "universal_qpcr",
    software: SOFTWARE_RELEASE,
    modules: {
      qpcr: { enabled: true, role: "primary_statistical_analysis" },
      tier_prioritization: {
        enabled: Boolean(tierEnabled),
        role: "optional_research_prioritization",
        profile_mode: profile.customEvidenceProfile ? "user_supplied" : "built_in_reference",
        interpretation: tierEnabled ? "Tier is an optional validation-priority result separate from qPCR statistics." : "Tier prioritization was not requested and must not be interpreted for this run.",
      },
    },
    screening_reference: profile.customScreeningReference ?? { filename: "built-in", rows: profile.screeningRows.length, source: "built_in_versioned_reference", stored_on_server: false },
    effect_scaling: effectScaling(primary, profile.analysisSpecification),
    analysis_specification_version: profile.analysisSpecification.specification_version,
    longitudinal_specification_version: "3.0.0",
    scientific_engine: { ...SCIENTIFIC_ENGINE, primary_calculation_source: "browser_memory_normalized_long_records", legacy_summary_used_for_primary_result: false, qty_offset: primary.qty_offset, duplicate_term_groups_averaged: primary.duplicate_term_groups },
    local_execution: { mode: "browser_memory_only", workbook_upload_performed: false, server_run_created: false, server_storage_used: false },
    input_schema: {
      accepted_formats: ["xlsx", "csv", "tsv"],
      primary_quantity_policy: "Qty/Quantity column required; no quantity is inferred from Ct/Cq",
      files: inputFiles,
    },
    assay,
    interpretation_boundary: "Paired qPCR analysis for research use. Statistical association and goal alignment do not establish causality, efficacy, diagnosis or clinical validity.",
    assessment_policy: { minimum_complete_pairs: 3, alpha: 0.05, multiplicity_adjustment: "Benjamini-Hochberg within each endpoint and contrast", primary_endpoint: "log10_quantity_ratio", auxiliary_endpoint: "delta_ct", decision_uses: "quantity FDR q-value and observed direction; this statistical assessment is reported separately from Tier" },
    tier_policy: { specification_version: profile.tierSpecification.specification_version, profile_id: profile.tierSpecification.profile_id, formula: profile.tierSpecification.integrated_model.formula, weights: profile.tierSpecification.integrated_model.weights, rules: profile.tierSpecification.tier_rules, interpretation: profile.tierSpecification.interpretation, unknown_preparation_rule: "Tier 4 until a complete versioned evidence profile is supplied" },
    candidate_evidence_profile: candidateEvidenceProfile,
    preparation_ordering: { type: profile.customEvidenceProfile ? "user_profile_integrated_evidence_score" : "versioned_integrated_evidence_score", primary_key: "descending integrated evidence score", secondary_key: "preparation name", interpretation: "Tier 1-5 and integrated ordering are research prioritization outputs within this run, not clinical classifications and not comparable between runs." },
    presentation_ranking: { metric: "versioned_integrated_evidence_score", positive_direction: "higher integrated prioritization after the safety-risk penalty", zero: "zero net integrated evidence score", score_model: "unweighted_additive_evidence_tally", score_model_note: "Component weights are all 1.0; the ordering is a transparent additive tally, not a formally elicited multi-criteria decision analysis.", rows: presentationRows(candidates) },
    screening_reconstruction: { reference_rule: profile.customScreeningReference ? "frozen screening benchmark supplied by the user alongside the analysis" : profile.customEvidenceProfile ? "not applicable to a user-supplied evidence profile without a supplied benchmark" : "versioned frozen screening benchmark for the configured preparation profile", reconstruction_rule: "six complete Qty pairs, all aligned with the declared goal, and complete-pair arithmetic-mean Qty change toward the goal strictly above 20 percent", primary_display_metric: "paired median log10 Qty ratio converted to T1/T0 percent change", legacy_metric_role: "arithmetic-mean Qty change is retained only to reproduce the frozen screening rule and never drives the primary qPCR effect or Tier", interpretation: profile.customScreeningReference ? "Computational comparison with a benchmark supplied by the user; not independent biological validation." : profile.customEvidenceProfile ? "No frozen screening reference is mixed into a user-supplied profile; reconstruction is descriptive only." : "Computational comparison with a frozen benchmark; not independent biological validation.", mean_change_threshold_percent: 20, rows: screeningRows(candidates) },
    overview: {
      long_records: longRows.length,
      preparations: candidates.length,
      nominal_pair_records: candidates.reduce((sum, row) => sum + row.nominal_pairs, 0),
      complete_ct_pairs: candidates.reduce((sum, row) => sum + row.complete_ct_pairs, 0),
      complete_quantity_pairs: candidates.reduce((sum, row) => sum + row.complete_quantity_pairs, 0),
      timepoint_count: timepoints.length,
      timepoint_terms: timepoints.map((item) => item.term),
      assessment_counts: Object.fromEntries(assessmentCodes.map((code) => [code, candidates.filter((candidate) => candidate.assessment.code === code).length])),
      tier_counts: Object.fromEntries([1, 2, 3, 4, 5].map((tier) => [`tier_${tier}`, candidates.filter((candidate) => candidate.tier === `Tier ${tier}`).length])),
      integrity_relations: integrityRows.length,
    },
    candidates,
    longitudinal: {
      available: true,
      extended: timepoints.length > 2,
      timepoints: timepoints.map((item, index) => ({ term: item.term, order: index, time_value: item.time_value, time_unit: item.time_unit, source_filename: item.source_filename, data_rows: longRows.filter((row) => row.term === item.term).length })),
      contrasts,
      trajectories,
      pairing: longitudinalPairing(longRows, timepoints),
      interpretation: timepoints.length === 2 ? "T0/T1 primary comparison calculated locally in browser memory." : "Baseline and adjacent T0–T4 contrasts calculated locally in browser memory without changing the prespecified T1/T0 Tier result.",
    },
    report: { status: "local_docx_available", formats: { docx: "browser_memory_only", json: "browser_memory_only" } },
    artifacts,
    project_source: {
      normalized_records: longRows,
      timepoints,
      input_files: inputFiles,
      custom_evidence_rows: profile.customEvidenceProfile ? profile.evidenceRows : null,
      custom_evidence_filename: profile.customEvidenceProfile?.filename ?? null,
    },
  };
  return tierEnabled ? result : withoutTierResults(result);
}

async function inputBuffer(input) {
  if (input instanceof ArrayBuffer) return input;
  if (ArrayBuffer.isView(input)) return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  return input.arrayBuffer();
}

async function sha256Hex(arrayBuffer) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", arrayBuffer));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function analyzeWorkbooksLocally({ selections, assay, timeUnit, profile = null, candidateEvidenceFile = null, screeningReferenceFile = null, tierEnabled = true }) {
  if (selections.length < 2 || selections.length > 5) throw new Error("Browser-local analysis requires contiguous T0–T4 input with two to five timepoints.");
  const loadedProfile = profile ?? await loadLocalScientificProfile();
  const activeEvidenceFile = tierEnabled ? candidateEvidenceFile : null;
  const activeScreeningFile = tierEnabled ? screeningReferenceFile : null;
  const customEvidenceRows = await readCandidateEvidenceProfileFile(activeEvidenceFile);
  const customScreeningRows = await readScreeningReferenceFile(activeScreeningFile);
  const activeProfile = applyCandidateEvidenceProfile(
    loadedProfile,
    customEvidenceRows,
    activeEvidenceFile?.name ?? null,
    customScreeningRows ? { rows: customScreeningRows, filename: activeScreeningFile?.name ?? null } : null,
  );
  const buffers = await Promise.all(selections.map((item) => inputBuffer(item.file)));
  const [workbooks, hashes] = await Promise.all([
    Promise.all(selections.map(async (item, index) => {
      try {
        return await readQpcrInput(buffers[index], item.term, item.file.name);
      } catch (error) {
        error.details = { ...(error.details ?? {}), filename: item.file.name, term: item.term };
        throw error;
      }
    })),
    Promise.all(buffers.map(sha256Hex)),
  ]);
  assertCompatibleWorkbooks(workbooks);
  const longRows = workbooks.flatMap((workbook) => workbook.rows);
  return buildLocalPrimaryResult({
    longRows,
    profile: activeProfile,
    assay,
    tierEnabled,
    timepoints: selections.map((item) => ({ term: item.term, time_value: item.timeValue, time_unit: timeUnit, source_filename: item.file.name })),
    inputFiles: workbooks.map((workbook, index) => ({
      term: selections[index].term,
      source_filename: selections[index].file.name,
      sha256: hashes[index],
      source_format: workbook.validation.source_format,
      data_rows: workbook.validation.data_rows,
      detector: workbook.validation.detectors[0],
      column_mapping: workbook.validation.column_mapping,
      mapping_origins: workbook.validation.mapping_origins,
      mapping_mode: workbook.validation.mapping_mode,
      defaulted_fields: workbook.validation.defaulted_fields,
      missing_optional_fields: workbook.validation.missing_optional_fields,
      unmapped_headers: workbook.validation.unmapped_headers,
      delimiter: workbook.validation.delimiter ?? null,
      encoding: workbook.validation.encoding ?? null,
      worksheet: workbook.validation.worksheet ?? null,
      source_rows: workbook.validation.source_rows,
      missing_qty_values: workbook.validation.missing_qty_values,
      missing_ct_values: workbook.validation.missing_ct_values,
      zero_qty_values: workbook.validation.zero_qty_values,
      blank_task_rows: workbook.validation.blank_task_rows,
      duplicate_observation_groups: workbook.validation.duplicate_observation_groups,
      duplicate_observation_rows: workbook.validation.duplicate_observation_rows,
      warnings: workbook.validation.warnings,
    })),
  });
}

