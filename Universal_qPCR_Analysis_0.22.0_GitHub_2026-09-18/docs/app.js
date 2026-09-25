import { applyStaticTranslations, detectLanguage, getLanguage, numberLocale, setLanguage, t, translateEnum } from "./i18n.js";
import { analyzeWorkbooksLocally } from "./local-analysis.js";
import { buildLocalAssessmentReport, downloadLocalDocx } from "./local-report.js";
import { demoFiles } from "./demo-data.js";
import { buildProjectDocument, downloadProjectDocument, readProjectFile } from "./project-file.js";
import { applyDeclaredStyles, collectApplicationElements } from "./ui-elements.js";
import {
  assessmentTone,
  displayedAlignment,
  escapeHtml,
  finiteNumber,
  hasBalancedMixedDirections,
  safeResourceUrl,
  tierNumber,
} from "./ui-helpers.js";
import { localizedErrorMessage, validationErrorViewModel } from "./validation-feedback.js";

const elements = collectApplicationElements();

let activeResult = null;
let activeReport = null;
let activeRunState = {
  status: "ready",
  messageKey: "run.ready",
  titleKey: "run.readyTitle",
  error: null,
};
setLanguage(detectLanguage(), { persist: false });
elements.language.value = getLanguage();
applyStaticTranslations();

function displayNumber(value, digits = 4) {
  if (value == null || !Number.isFinite(Number(value))) return t("common.na");
  return new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: digits }).format(Number(value));
}

function displayPercent(value, digits = 1) {
  return value == null || !Number.isFinite(Number(value))
    ? t("common.na")
    : `${displayNumber(value, digits)}%`;
}

function summaryCard(value, label) {
  return `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function hasTierModule(result) {
  return result?.modules?.tier_prioritization?.enabled !== false;
}

function usesCustomEvidenceProfile(result) {
  return result.candidate_evidence_profile?.source === "user_supplied_local_csv";
}
function evidenceProfileLabel(result) {
  const profile = result.candidate_evidence_profile;
  return usesCustomEvidenceProfile(result)
    ? t("profile.customActive", { filename: profile.filename, matched: profile.matched_preparations, total: result.overview.preparations, missing: profile.unprofiled_preparations, unused: profile.unused_profile_entries })
    : t("profile.builtInActive", { matched: profile?.matched_preparations ?? 0, total: result.overview.preparations });
}

function displayedAssessment(candidate) {
  return hasBalancedMixedDirections(candidate)
    ? { tone: "descriptive", label: t("decision.balancedMixed") }
    : { tone: assessmentTone(candidate.assessment.code), label: translateEnum(candidate.assessment.code) };
}

function testEvidenceDetails(test) {
  if (test.nonzero_pairs === 0) return t("decision.zeroDifferences");
  if (test.status === "computed") return t("decision.testDetails", {
    w: displayNumber(test.statistic_w),
    p: displayNumber(test.p_value),
    status: test.significant_after_fdr ? t("visuals.afterFdr") : t("visuals.notAfterFdr"),
  });
  return translateEnum(test.status);
}

function tierExplanation(candidate) {
  return t(`tier.rule${tierNumber(candidate)}`);
}

function renderComparisonCharts(candidates) {
  const finiteEffects = candidates.map((candidate) => finiteNumber(candidate.median_log10_quantity_ratio)).filter(Number.isFinite);
  const maximumEffect = Math.max(0.1, ...finiteEffects.map(Math.abs));
  elements.effectChart.innerHTML = candidates.map((candidate) => {
    const effect = finiteNumber(candidate.median_log10_quantity_ratio);
    const finite = Number.isFinite(effect);
    const width = finite ? Math.min(50, Math.abs(effect) / maximumEffect * 50) : 0;
    const left = finite && effect < 0 ? 50 - width : 50;
    const tone = hasBalancedMixedDirections(candidate) ? "descriptive" : assessmentTone(candidate.assessment.code);
    return `<div class="comparison-row"><span class="comparison-label"><strong>${escapeHtml(candidate.preparation)}</strong><small>${escapeHtml(candidate.canonical_name)}</small></span><span class="effect-track" role="img" aria-label="${escapeHtml(candidate.preparation)}: ${displayNumber(effect)} log10"><i class="zero-line"></i><i class="effect-bar ${tone}" data-style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></i></span><strong class="comparison-value ${finite && effect < 0 ? "negative" : "positive"}">${displayNumber(effect, 3)}</strong></div>`;
  }).join("");

  applyDeclaredStyles(elements.effectChart);

  const evidence = candidates.map((candidate) => {
    const q = finiteNumber(candidate.tests.quantity_signed_rank.q_value);
    return Number.isFinite(q) && q >= 0 ? -Math.log10(Math.max(q, 1e-16)) : null;
  });
  const threshold = -Math.log10(0.05);
  const maximumEvidence = Math.max(2, threshold, ...evidence.filter(Number.isFinite));
  const thresholdPercent = threshold / maximumEvidence * 100;
  elements.evidenceChart.innerHTML = candidates.map((candidate, index) => {
    const q = finiteNumber(candidate.tests.quantity_signed_rank.q_value);
    const strength = evidence[index];
    const width = Number.isFinite(strength) ? Math.min(100, strength / maximumEvidence * 100) : 0;
    const significant = Number.isFinite(q) && q < 0.05;
    const evidenceStatus = Number.isFinite(q) ? (significant ? t("visuals.afterFdr") : t("visuals.notAfterFdr")) : t("visuals.qUnavailable");
    return `<div class="comparison-row"><span class="comparison-label"><strong>${escapeHtml(candidate.preparation)}</strong><small>${evidenceStatus}</small></span><span class="evidence-track" data-style="--threshold:${thresholdPercent.toFixed(2)}%" role="img" aria-label="${escapeHtml(candidate.preparation)}: q ${displayNumber(q)}"><i class="evidence-bar ${significant ? "significant" : ""}" data-style="width:${width.toFixed(2)}%"></i></span><strong class="comparison-value">${Number.isFinite(q) ? `q=${displayNumber(q, 3)}` : t("common.na")}</strong></div>`;
  }).join("");
  applyDeclaredStyles(elements.evidenceChart);
}

function renderCandidateTable(candidates, tierEnabled = true) {
  const rows = candidates.map((candidate) => {
    const qty = candidate.tests.quantity_signed_rank;
    const ct = candidate.tests.ct_signed_rank;
    const assessment = displayedAssessment(candidate);
    return `<tr><th scope="row"><strong>${escapeHtml(candidate.preparation)}</strong><small>${escapeHtml(candidate.canonical_name)}</small></th>${tierEnabled ? `<td><span class="tier tier-${tierNumber(candidate)}">${escapeHtml(candidate.tier)}</span></td><td>${displayNumber(candidate.integrated_score, 4)}</td>` : ""}<td>${candidate.complete_quantity_pairs}/${candidate.nominal_pairs}</td><td>${displayNumber(candidate.median_log10_quantity_ratio, 4)}</td><td>${displayNumber(candidate.fold_change, 3)}×</td><td>${displayPercent(candidate.percent_change)}</td><td>${displayNumber(qty.statistic_w)}</td><td>${displayNumber(qty.p_value)}</td><td class="${qty.significant_after_fdr ? "significant-value" : ""}">${displayNumber(qty.q_value)}</td><td>${displayNumber(candidate.median_delta_ct, 3)}</td><td>${displayNumber(ct.q_value)}</td><td>${displayPercent(Number.isFinite(candidate.direction_consistency) ? candidate.direction_consistency * 100 : null)}</td><td>${escapeHtml(translateEnum(candidate.data_integrity.status))}</td><td><span class="assessment-pill ${assessment.tone}">${escapeHtml(assessment.label)}</span></td></tr>`;
  }).join("");
  elements.candidates.innerHTML = `<table class="result-table"><thead><tr><th scope="col">${t("candidate.preparation")}</th>${tierEnabled ? `<th scope="col">Tier</th><th scope="col">${t("candidate.integratedScore")}</th>` : ""}<th scope="col">${t("candidate.pairs")}</th><th scope="col">${t("candidate.effect")}</th><th scope="col">${t("candidate.fold")}</th><th scope="col">${t("candidate.percent")}</th><th scope="col">Qty W</th><th scope="col">Qty p</th><th scope="col">Qty q</th><th scope="col">ΔCt</th><th scope="col">Ct q</th><th scope="col">${t("candidate.consistency")}</th><th scope="col">${t("candidate.integrity")}</th><th scope="col">${t("candidate.qpcrAssessment")}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function decisionBadge(value, tone = "no") {
  return `<span class="decision ${tone}">${escapeHtml(value)}</span>`;
}

function integrityAction(value) {
  return value === "Confirm against original qPCR export and treatment map" ? t("integrity.confirmAction") : translateEnum(value);
}

function interpretationMessages(item) {
  const codes = new Set(item.interpretation_codes ?? []);
  const messages = [];
  if (codes.has("incomplete_quantity_pairs")) messages.push(t("validation.warningIncomplete", { complete: item.complete_quantity_pairs, nominal: item.nominal_pairs, missing: item.missing_quantity_pairs }));
  if (codes.has("mixed_pair_directions")) messages.push(t("validation.warningMixed", { decreased: item.decreased_pairs, increased: item.increased_pairs }));
  if (codes.has("legacy_mean_direction_conflict")) messages.push(t("validation.warningConflict"));
  if (codes.has("exact_cross_group_relation")) messages.push(t("validation.warningIntegrity"));
  return messages;
}

function screeningEffectCell(item) {
  const primary = item.primary_paired_change_percent;
  const legacy = item.legacy_mean_change_toward_goal_percent ?? item.mean_change_toward_goal_percent;
  const warnings = interpretationMessages(item);
  return `<span class="paired-effect"><strong>${displayPercent(primary)}</strong><small>${escapeHtml(t("validation.legacyMean"))}: ${displayPercent(legacy)} · ${escapeHtml(t("validation.legacyRuleNote"))}</small>${warnings.map((warning) => `<small class="result-warning">${escapeHtml(warning)}</small>`).join("")}</span>`;
}

function candidateInterpretation(candidate) {
  return {
    nominal_pairs: candidate.nominal_pairs,
    complete_quantity_pairs: candidate.complete_quantity_pairs,
    missing_quantity_pairs: candidate.missing_quantity_pairs,
    decreased_pairs: candidate.decreased_pairs,
    increased_pairs: candidate.increased_pairs,
    ...(candidate.screening_reconstruction ?? {}),
  };
}

function candidateWarnings(candidate) {
  const messages = interpretationMessages(candidateInterpretation(candidate));
  return messages.length ? `<div class="result-warning-list" role="note">${messages.map((message) => `<p>${escapeHtml(message)}</p>`).join("")}</div>` : "";
}

function renderDecisionAudit(result) {
  const tierEnabled = hasTierModule(result);
  const minimumPairs = result.assessment_policy.minimum_complete_pairs;
  const sufficient = result.candidates.filter((candidate) => candidate.complete_quantity_pairs >= minimumPairs && Number.isFinite(finiteNumber(candidate.median_log10_quantity_ratio))).length;
  const aligned = result.candidates.filter((candidate) => displayedAlignment(candidate) === "supportive").length;
  const confirmed = result.candidates.filter((candidate) => ["confirmed_supportive", "confirmed_contradictory"].includes(candidate.assessment.code)).length;
  const review = result.candidates.filter((candidate) => candidate.data_integrity.status === "review_required").length;
  elements.decisionAuditSummary.innerHTML = [summaryCard(sufficient, t("decision.sufficientCount")), summaryCard(aligned, t("decision.alignedCount")), summaryCard(confirmed, t("decision.confirmedCount")), summaryCard(review, t("decision.reviewCount"))].join("");

  const rows = result.candidates.map((candidate) => {
    const qty = candidate.tests.quantity_signed_rank;
    const hasData = candidate.complete_quantity_pairs >= minimumPairs && Number.isFinite(finiteNumber(candidate.median_log10_quantity_ratio));
    const alignment = displayedAlignment(candidate);
    const assessment = displayedAssessment(candidate);
    const alignmentDetail = hasBalancedMixedDirections(candidate)
      ? `<small>${escapeHtml(t("decision.medianAlignment", { alignment: translateEnum(candidate.goal_alignment), decreased: candidate.decreased_pairs, increased: candidate.increased_pairs }))}</small>`
      : "";
    const assessmentDetail = hasBalancedMixedDirections(candidate) ? t("decision.balancedRule") : candidate.assessment.decisive_rule;
    return `<div class="validation-row tier-audit-row${tierEnabled ? "" : " tier-disabled"}" role="row"><span><strong>${escapeHtml(candidate.preparation)}</strong><small>${escapeHtml(candidate.canonical_name)}</small></span><span>${decisionBadge(hasData ? t("common.yes") : t("common.no"), hasData ? "yes" : "no")}<small>${candidate.complete_quantity_pairs}/${candidate.nominal_pairs}</small></span><span>${escapeHtml(translateEnum(candidate.observed_change))}</span><span class="goal-alignment ${escapeHtml(alignment)}">${escapeHtml(translateEnum(alignment))}${alignmentDetail}</span><span><strong>q=${displayNumber(qty.q_value)}</strong><small>${escapeHtml(testEvidenceDetails(qty))}</small></span>${tierEnabled ? `<span class="tier tier-${tierNumber(candidate)}">${escapeHtml(candidate.tier)}</span>` : ""}<span>${escapeHtml(translateEnum(candidate.data_integrity.status))}</span><span><span class="assessment-pill ${assessment.tone}">${escapeHtml(assessment.label)}</span><small>${escapeHtml(assessmentDetail)}</small></span></div>`;
  }).join("");
  elements.decisionAuditRows.innerHTML = `<div class="validation-row validation-header tier-audit-row${tierEnabled ? "" : " tier-disabled"}" role="row"><span>${t("candidate.preparation")}</span><span>${t("decision.sufficient")}</span><span>${t("decision.observed")}</span><span>${t("decision.alignment")}</span><span>Qty q</span>${tierEnabled ? `<span>${t("decision.separateTier")}</span>` : ""}<span>${t("candidate.integrity")}</span><span>${t("candidate.qpcrAssessment")}</span></div>${rows}`;
}

function renderRuleRanking(result) {
  const candidatesByName = new Map(result.candidates.map((candidate) => [candidate.preparation, candidate]));
  const ranking = result.presentation_ranking?.rows ?? result.candidates.map((candidate) => ({ rank: candidate.rank, preparation: candidate.preparation, canonical_name: candidate.canonical_name, tier: candidate.tier, score: candidate.presentation_score }));
  const finiteScores = ranking.map((item) => finiteNumber(item.score)).filter(Number.isFinite);
  const minimum = Math.min(-1, ...finiteScores);
  const maximum = Math.max(1, ...finiteScores);
  const span = maximum - minimum;
  const zeroPercent = ((0 - minimum) / span) * 100;
  const rows = ranking.map((item) => {
    const score = finiteNumber(item.score);
    const valuePercent = Number.isFinite(score) ? ((score - minimum) / span) * 100 : zeroPercent;
    const left = Math.min(zeroPercent, valuePercent);
    const width = Number.isFinite(score) ? Math.max(.6, Math.abs(valuePercent - zeroPercent)) : 0;
    const candidate = candidatesByName.get(item.preparation) ?? item;
    return `<div class="rank-row" role="row"><span class="rank-number" role="cell">${item.rank}</span><span class="candidate" role="cell"><strong>${escapeHtml(item.preparation)}</strong><span>${escapeHtml(item.canonical_name)}</span></span><span class="tier tier-${tierNumber(candidate)}" role="cell">${escapeHtml(item.tier)}</span><span class="score-track signed-score-track" data-style="--zero:${zeroPercent.toFixed(2)}%" role="cell" aria-label="${escapeHtml(t("ranking.scoreAria", { score: displayNumber(score, 3) }))}"><span class="score-bar" data-style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></span></span><span class="score-value" role="cell">${displayNumber(score, 2)}</span></div>`;
  }).join("");
  elements.ranking.innerHTML = rows;
  applyDeclaredStyles(elements.ranking);
}

function renderScreeningReconstruction(result) {
  const rows = result.screening_reconstruction?.rows ?? [];
  const customProfile = usesCustomEvidenceProfile(result);
  elements.validationDescription.textContent = t(customProfile ? "validation.customDescription" : "validation.description");
  const directionHeader = result.assay.analysis_goal === "decrease" ? t("validation.decreases") : result.assay.analysis_goal === "increase" ? t("validation.increases") : t("validation.directionalPairs");
  const body = rows.map((item) => `<div class="validation-row ${(item.interpretation_codes ?? []).length ? "validation-review" : ""} ${item.agreement === false ? "validation-disagreement" : ""}" role="row"><span><strong>${escapeHtml(item.preparation)}</strong></span><span>${item.reference_applicable ? decisionBadge(item.reference_qualified ? t("common.yes") : t("common.no"), item.reference_qualified ? "yes" : "no") : decisionBadge(t("common.na"))}</span><span>${decisionBadge(item.reconstructed_qualified ? t("common.yes") : t("common.no"), item.reconstructed_qualified ? "yes" : "no")}</span><span>${item.goal_direction_pairs}/${item.complete_quantity_pairs}<small>${item.complete_quantity_pairs}/${item.nominal_pairs}</small></span>${screeningEffectCell(item)}<span class="tier tier-${Number(String(item.tier).split(" ")[1]) || 4}">${escapeHtml(item.tier)}</span><span>${escapeHtml(t(`validation.audit.${item.data_audit_role ?? "none"}`))}</span></div>`).join("");
  elements.screeningReconstruction.innerHTML = `<div class="validation-row validation-header" role="row"><span>${t("candidate.preparation")}</span><span>${t("validation.reference")}</span><span>${t("validation.reproduced")}</span><span>${directionHeader}</span><span>${t("validation.primaryEffect")}</span><span>Tier</span><span>${t("validation.dataAudit")}</span></div>${body}`;
}

function renderAnalyticalFigures(result) {
  const definitions = [
    { suffix: "results/00_qpcr/figures/paired_log10_qty_ratio.svg", title: t("figures.qtyTitle"), caption: t("figures.qtyCaption") },
    { suffix: "results/00_qpcr/figures/paired_delta_ct.svg", title: t("figures.ctTitle"), caption: t("figures.ctCaption") },
  ];
  const figures = definitions
    .map((definition) => ({ ...definition, artifact: result.artifacts.find((artifact) => artifact.path.replaceAll("\\", "/").endsWith(definition.suffix)) }))
    .filter((item) => item.artifact)
    .map((item) => ({ ...item, url: safeResourceUrl(item.artifact.download_url) }))
    .filter((item) => item.url);
  elements.analyticalFigures.innerHTML = figures.length ? figures.map((item) => `<figure class="analytical-figure"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(t("figures.open", { title: item.title }))}"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.title)}" loading="lazy"></a><figcaption><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.caption)}</span><a href="${escapeHtml(item.url)}" download>${t("figures.downloadSvg")}</a></figcaption></figure>`).join("") : `<p class="empty-state">${t("figures.unavailable")}</p>`;
}

function renderIntegrityAudit(result) {
  const relations = result.candidates.flatMap((candidate) => candidate.data_integrity.exact_cross_group_relations.filter((relation) => relation.role === "source").map((relation) => ({ ...relation, source_preparation: candidate.preparation })));
  const affected = new Set(relations.flatMap((relation) => [relation.source_preparation, relation.related_preparation])).size;
  const records = relations.reduce((sum, relation) => sum + relation.identical_records, 0);
  elements.integritySummary.innerHTML = [summaryCard(relations.length, t("integrity.relations")), summaryCard(affected, t("integrity.affected")), summaryCard(records, t("integrity.records")), summaryCard(relations.length ? t("integrity.reviewRequired") : t("integrity.clear"), t("integrity.overallStatus"))].join("");
  if (!relations.length) {
    elements.integrityContent.innerHTML = `<p class="empty-state">${t("integrity.noRelations")}</p>`;
    return;
  }
  const rows = relations.map((relation) => `<tr><th scope="row">${escapeHtml(relation.source_preparation)}</th><td>${escapeHtml(relation.source_term)}</td><td>${escapeHtml(relation.related_preparation)}</td><td>${escapeHtml(relation.target_term)}</td><td>${relation.identical_records}</td><td>${escapeHtml(translateEnum(relation.status))}</td><td>${escapeHtml(integrityAction(relation.required_action))}</td></tr>`).join("");
  elements.integrityContent.innerHTML = `<div class="integrity-table"><table><thead><tr><th scope="col">${t("integrity.sourcePreparation")}</th><th scope="col">${t("integrity.sourceTerm")}</th><th scope="col">${t("integrity.relatedPreparation")}</th><th scope="col">${t("integrity.targetTerm")}</th><th scope="col">${t("integrity.identicalRecords")}</th><th scope="col">${t("integrity.status")}</th><th scope="col">${t("integrity.action")}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderInputSchema(result) {
  const files = result.input_schema?.files ?? [];
  const formats = [...new Set(files.map((file) => file.source_format?.toUpperCase()).filter(Boolean))];
  const aliasFiles = files.filter((file) => file.mapping_mode === "aliases").length;
  const defaultedFields = files.reduce((sum, file) => sum + (file.defaulted_fields?.length ?? 0), 0);
  const warningFiles = files.filter((file) => (file.warnings?.length ?? 0) > 0).length;
  elements.inputSchemaSummary.innerHTML = [
    summaryCard(escapeHtml(formats.join(" + ") || t("common.na")), t("input.formats")),
    summaryCard(files.length, t("input.files")),
    summaryCard(aliasFiles, t("input.aliasFiles")),
    summaryCard(files.reduce((sum, file) => sum + file.data_rows, 0), t("input.rows")),
    summaryCard(defaultedFields, t("input.defaults")),
    summaryCard(warningFiles, t("input.warningFiles")),
  ].join("");
  const fieldOrder = ["preparation", "sample_name", "detector", "task", "ct", "qty", "sex", "well", "stddev_ct"];
  elements.inputSchemaFiles.innerHTML = files.map((file) => {
    const mapping = fieldOrder.map((field) => {
      const actual = file.column_mapping?.[field];
      const origin = file.mapping_origins?.[field];
      if (actual) return `<span class="mapping-chip ${origin === "alias" ? "alias" : "canonical"}"><strong>${escapeHtml(actual)}</strong><i>→</i>${escapeHtml(t(`input.field.${field}`))}</span>`;
      if ((file.defaulted_fields ?? []).includes(field)) return `<span class="mapping-chip default"><strong>${escapeHtml(t(`input.field.${field}`))}</strong><i>→</i>${escapeHtml(t("input.defaultUnknown"))}</span>`;
      return `<span class="mapping-chip optional"><strong>${escapeHtml(t(`input.field.${field}`))}</strong><i>→</i>${escapeHtml(t("input.optionalMissing"))}</span>`;
    }).join("");
    const ignored = file.unmapped_headers?.length ? `<p class="mapping-note"><strong>${t("input.ignored")}:</strong> ${escapeHtml(file.unmapped_headers.join(", "))}</p>` : `<p class="mapping-note">${t("input.noIgnored")}</p>`;
    const warningParameters = {
      qty: file.missing_qty_values ?? 0,
      ct: file.missing_ct_values ?? 0,
      zero: file.zero_qty_values ?? 0,
      groups: file.duplicate_observation_groups ?? 0,
      rows: file.duplicate_observation_rows ?? 0,
      tasks: file.blank_task_rows ?? 0,
      headers: file.unmapped_headers?.length ?? 0,
    };
    const quality = (file.warnings?.length ?? 0)
      ? file.warnings.map((code) => `<span class="quality-chip">${escapeHtml(t(`input.warning.${code}`, warningParameters, code))}</span>`).join("")
      : `<span class="quality-chip clean">${escapeHtml(t("input.qualityClean"))}</span>`;
    const formatDetails = [file.source_format?.toUpperCase(), file.delimiter ? translateEnum(file.delimiter) : null, file.encoding, file.worksheet ? t("input.worksheet", { name: file.worksheet }) : null].filter(Boolean).join(" · ");
    return `<article class="input-schema-card"><header><span><strong>${escapeHtml(file.term)} · ${escapeHtml(file.source_filename)}</strong><small>${file.data_rows} ${t("input.dataRows")} · ${escapeHtml(file.detector)}</small></span><span class="format-badge">${escapeHtml(formatDetails)}</span></header><div class="mapping-chips">${mapping}</div><div class="input-quality" aria-label="${escapeHtml(t("input.quality"))}">${quality}</div>${ignored}</article>`;
  }).join("");
}

function renderEffectScaling(result) {
  const scaling = result.effect_scaling;
  if (!scaling) {
    elements.effectScalingSummary.innerHTML = "";
    elements.effectScalingNote.innerHTML = "";
    elements.effectScalingNote.hidden = true;
    return;
  }
  const total = scaling.scaled_preparations + scaling.unscaled_preparations;
  elements.effectScalingSummary.innerHTML = [
    summaryCard(displayNumber(scaling.qty_offset, 6), t("scaling.offset")),
    summaryCard(displayNumber(scaling.preparation_median_sd, 4), t("scaling.sd")),
    summaryCard(`${scaling.scaled_preparations}/${total}`, t("scaling.scaled")),
  ].join("");
  const notes = [t("scaling.datasetWarning")];
  if (!Number.isFinite(finiteNumber(scaling.preparation_median_sd))) notes.push(t("scaling.noScale"));
  if (hasTierModule(result)) notes.push(t("scaling.tierRelative"));
  elements.effectScalingNote.innerHTML = notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("");
  elements.effectScalingNote.hidden = false;
}

function buildTrajectorySeries(result) {
  const terms = result.longitudinal.timepoints.map((item) => item.term);
  const byPreparation = new Map(result.candidates.map((candidate) => [candidate.preparation, { preparation: candidate.preparation, canonical_name: candidate.canonical_name, values: new Map([["T0", 0]]) }]));
  for (const contrast of result.longitudinal.contrasts.filter((item) => item.from_term === "T0")) {
    for (const candidate of contrast.candidates) {
      if (!byPreparation.has(candidate.preparation)) byPreparation.set(candidate.preparation, { preparation: candidate.preparation, canonical_name: candidate.canonical_name, values: new Map([["T0", 0]]) });
      byPreparation.get(candidate.preparation).values.set(contrast.to_term, candidate.median_log10_quantity_ratio);
    }
  }
  return [...byPreparation.values()].map((item) => ({ ...item, points: terms.map((term) => ({ term, value: item.values.get(term) ?? null })) }));
}

function trajectorySvg(series) {
  const width = 280;
  const height = 118;
  const left = 18;
  const right = 12;
  const top = 12;
  const bottom = 24;
  const finite = series.points.map((point) => finiteNumber(point.value)).filter(Number.isFinite);
  const maximum = Math.max(0.1, ...finite.map(Math.abs));
  const x = (index) => left + (series.points.length === 1 ? 0 : index * (width - left - right) / (series.points.length - 1));
  const y = (value) => top + (maximum - value) / (2 * maximum) * (height - top - bottom);
  const segments = [];
  for (let index = 1; index < series.points.length; index += 1) {
    const previous = finiteNumber(series.points[index - 1].value);
    const current = finiteNumber(series.points[index].value);
    if (Number.isFinite(previous) && Number.isFinite(current)) segments.push(`<line x1="${x(index - 1)}" y1="${y(previous)}" x2="${x(index)}" y2="${y(current)}"></line>`);
  }
  const points = series.points.map((point, index) => {
    const value = finiteNumber(point.value);
    return Number.isFinite(value)
      ? `<circle cx="${x(index)}" cy="${y(value)}" r="3.5"><title>${escapeHtml(point.term)}: ${displayNumber(value, 3)}</title></circle>`
      : "";
  }).join("");
  const labels = series.points.map((point, index) => `<text x="${x(index)}" y="${height - 5}" text-anchor="middle">${escapeHtml(point.term)}</text>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t("trajectory.aria", { preparation: series.preparation }))}"><line class="trajectory-zero" x1="${left}" y1="${y(0)}" x2="${width - right}" y2="${y(0)}"></line><g class="trajectory-line">${segments.join("")}${points}</g><g class="trajectory-labels">${labels}</g></svg>`;
}

function clearError() {
  elements.error.hidden = true;
  elements.error.textContent = "";
  elements.timepointInputs.querySelectorAll(".timepoint-row").forEach((row) => row.classList.remove("has-error"));
  elements.targetName.removeAttribute("aria-invalid");
}
function showError(error) {
  const feedback = validationErrorViewModel(error, t);
  elements.error.innerHTML = `<div class="error-heading"><strong>${escapeHtml(t(feedback.titleKey))}</strong>${feedback.code ? `<span class="error-code">${escapeHtml(feedback.code)}</span>` : ""}</div><p class="error-message">${escapeHtml(feedback.message)}</p>${feedback.context ? `<p class="error-context">${escapeHtml(feedback.context)}</p>` : ""}${feedback.items.length ? `<ul class="error-details">${feedback.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}${feedback.hint ? `<p class="error-hint"><strong>${escapeHtml(t("error.hintLabel"))}</strong> ${escapeHtml(feedback.hint)}</p>` : ""}`;
  elements.error.hidden = false;
  if (feedback.term) elements.timepointInputs.querySelector(`[data-term="${CSS.escape(feedback.term)}"]`)?.classList.add("has-error");
  elements.error.focus({ preventScroll: true });
  elements.error.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function setBusy(busy) {
  elements.analyze.disabled = busy;
  elements.candidateEvidenceProfile.disabled = busy;
  elements.screeningReferenceProfile.disabled = busy;
  elements.addTimepoint.disabled = busy || elements.timepointInputs.children.length >= 5;
  elements.generateReport.disabled = busy || !activeResult;
}

function renderRunState() {
  const progressByStatus = { completed: "100%", running: "65%", queued: "25%" };
  elements.runStatus.textContent = translateEnum(activeRunState.status);
  elements.runStatus.className = `status ${activeRunState.status}`;
  elements.runMessage.textContent = activeRunState.error
    ? localizedErrorMessage(activeRunState.error, t)
    : t(activeRunState.messageKey);
  elements.runTitle.textContent = t(activeRunState.titleKey);
  elements.progress.style.width = progressByStatus[activeRunState.status] ?? "0";
}

function setRunState(status, messageKey, titleKey) {
  activeRunState = { status, messageKey, titleKey, error: null };
  renderRunState();
}

function setRunError(error) {
  activeRunState = { status: "failed", messageKey: null, titleKey: "run.failedTitle", error };
  renderRunState();
}

function updateTimepointControls() {
  const rows = [...elements.timepointInputs.querySelectorAll(".timepoint-row")];
  rows.forEach((row, index) => {
    const labels = row.querySelectorAll("label > span");
    if (labels[0]) labels[0].textContent = t("time.workbook");
    if (labels[1]) labels[1].textContent = t("time.value");
    const remove = row.querySelector("[data-role='remove']");
    if (remove) { remove.disabled = index !== rows.length - 1; remove.textContent = t("time.remove"); remove.setAttribute("aria-label", t("time.removeAria", { term: row.dataset.term })); }
  });
  elements.addTimepoint.disabled = rows.length >= 5 || elements.analyze.disabled;
  elements.addTimepoint.textContent = rows.length >= 5 ? t("time.maximum") : t("time.add", { term: `T${rows.length}` });
  updateFileSelectionStatuses();
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
}

function updateFileSelectionStatuses() {
  const rows = [...elements.timepointInputs.querySelectorAll(".timepoint-row")];
  let selected = 0;
  let invalid = 0;
  for (const row of rows) {
    const input = row.querySelector("[data-role='workbook']");
    const status = row.querySelector("[data-role='file-status']");
    const file = input.files[0];
    row.classList.remove("file-error");
    status.className = "file-selection-status";
    if (!file) { status.textContent = t("time.noFile"); continue; }
    selected += 1;
    const extension = file.name.includes(".") ? file.name.split(".").at(-1).toLowerCase() : "";
    if (!["xlsx", "csv", "tsv"].includes(extension)) {
      invalid += 1; row.classList.add("file-error"); status.classList.add("warning"); status.textContent = t("time.unsupportedFile", { name: file.name });
    } else if (file.size > 5 * 1024 * 1024) {
      invalid += 1; row.classList.add("file-error"); status.classList.add("warning"); status.textContent = t("time.largeFile", { name: file.name, size: formatFileSize(file.size) });
    } else {
      status.classList.add("ready"); status.textContent = t("time.selectedFile", { name: file.name, size: formatFileSize(file.size), format: extension.toUpperCase() });
    }
  }
  elements.inputReadiness.className = `input-readiness ${invalid ? "warning" : selected === rows.length ? "ready" : ""}`;
  elements.inputReadiness.textContent = invalid
    ? t("time.readinessInvalid", { invalid })
    : selected === rows.length ? t("time.readinessReady", { selected }) : t("time.readinessPending", { selected, required: rows.length });
}

function addTimepointRow() {
  const index = elements.timepointInputs.querySelectorAll(".timepoint-row").length;
  if (index >= 5) return;
  const previousTime = Number(elements.timepointInputs.lastElementChild.querySelector("[data-role='time']").value);
  const row = document.createElement("div");
  row.className = "timepoint-row"; row.dataset.term = `T${index}`;
  row.innerHTML = `<strong>T${index}</strong><label><span>${t("time.workbook")}</span><input data-role="workbook" type="file" accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"><small data-role="file-status" class="file-selection-status">${t("time.noFile")}</small></label><label><span>${t("time.value")}</span><input data-role="time" type="number" step="any" value="${Number.isFinite(previousTime) ? previousTime + 1 : index}"></label><button data-role="remove" type="button" class="remove-timepoint">${t("time.remove")}</button>`;
  row.querySelector("[data-role='remove']").addEventListener("click", () => { row.remove(); updateTimepointControls(); });
  elements.timepointInputs.append(row); updateTimepointControls();
}

function renderArtifacts(result) {
  const rows = result.artifacts
    .map((artifact) => ({ ...artifact, url: safeResourceUrl(artifact.download_url) }))
    .filter((artifact) => artifact.url);
  elements.artifacts.innerHTML = rows.map((artifact) => `<div class="artifact"><a href="${escapeHtml(artifact.url)}">${escapeHtml(artifact.path)}</a><small>${(artifact.bytes / 1024).toFixed(1)} KB</small></div>`).join("");
}

function renderLongitudinal(result) {
  const longitudinal = result.longitudinal;
  elements.longitudinalSummary.innerHTML = [summaryCard(escapeHtml(longitudinal.timepoints.map((item) => item.term).join(" → ")), t("summary.timepoints")), summaryCard(longitudinal.contrasts.length, t("summary.contrasts")), summaryCard(longitudinal.pairing.complete_all_terms, t("summary.completeAll")), summaryCard(longitudinal.pairing.incomplete_terms, t("summary.incomplete"))].join("");
  const trajectoryByPreparation = new Map(longitudinal.trajectories.map((item) => [item.preparation, item]));
  const trajectoryCards = buildTrajectorySeries(result).map((series) => {
    const classification = trajectoryByPreparation.get(series.preparation)?.classification;
    return `<article class="trajectory-card"><header><span><strong>${escapeHtml(series.preparation)}</strong><small>${escapeHtml(series.canonical_name)}</small></span>${classification ? `<span class="trajectory-class">${escapeHtml(translateEnum(classification))}</span>` : ""}</header>${trajectorySvg(series)}</article>`;
  }).join("");
  const contrastPanels = longitudinal.contrasts.map((contrast) => `<details class="contrast-panel"><summary><strong>${escapeHtml(contrast.to_term)} vs ${escapeHtml(contrast.from_term)}</strong><span>${contrast.candidates.length} ${t("summary.preparations")}</span></summary><div class="contrast-table"><table><thead><tr><th>${t("candidate.preparation")}</th><th>${t("candidate.pairs")}</th><th>${t("candidate.effect")}</th><th>p</th><th>${t("candidate.q")}</th><th>${t("candidate.assessment")}</th></tr></thead><tbody>${contrast.candidates.map((candidate) => `<tr><th scope="row">${escapeHtml(candidate.preparation)}</th><td>${candidate.complete_quantity_pairs}</td><td>${displayNumber(candidate.median_log10_quantity_ratio)}</td><td>${displayNumber(candidate.tests.quantity_signed_rank.p_value)}</td><td>${displayNumber(candidate.tests.quantity_signed_rank.q_value)}</td><td>${escapeHtml(translateEnum(candidate.assessment.code))}</td></tr>`).join("")}</tbody></table></div></details>`).join("");
  elements.longitudinalContent.innerHTML = `<h3>${t("trajectory.title")}</h3><p class="section-note">${t("trajectory.description")}</p><div class="trajectory-grid">${trajectoryCards}</div>${!longitudinal.extended ? `<p class="longitudinal-note">${t("longitudinal.twoPoints")}</p>` : ""}<h3>${t("trajectory.contrastTables")}</h3><div class="contrast-list">${contrastPanels}</div>`;
}

function renderResult(result) {
  activeResult = result; activeReport = null; elements.results.hidden = false; elements.reportView.hidden = true; elements.generateReport.disabled = false;
  const tierEnabled = hasTierModule(result);
  elements.banner.textContent = t("result.banner", { target: result.assay.target_name, modules: t(tierEnabled ? "module.withTier" : "module.qpcrOnly") });
  elements.tierSections.forEach((section) => { section.hidden = !tierEnabled; });
  elements.guideTierStep.hidden = !tierEnabled;
  elements.saveProject.disabled = false;
  const overview = result.overview;
  elements.summary.innerHTML = [summaryCard(overview.preparations, t("summary.preparations")), summaryCard(overview.complete_quantity_pairs, t("summary.qtyPairs")), summaryCard(overview.complete_ct_pairs, t("summary.ctPairs")), summaryCard(overview.timepoint_terms.join(" → "), t("summary.timepoints")), summaryCard(overview.assessment_counts.confirmed_supportive ?? 0, t("summary.confirmedSupportive")), summaryCard(overview.integrity_relations, t("summary.integrity"))].join("");
  elements.assaySummary.innerHTML = [summaryCard(escapeHtml(result.assay.target_name), t("assay.targetName")), summaryCard(translateEnum(result.assay.technology), t("assay.technology")), summaryCard(translateEnum(result.assay.target_category), t("assay.category")), summaryCard(translateEnum(result.assay.analysis_goal), t("assay.goal")), ...(tierEnabled ? [summaryCard(escapeHtml(evidenceProfileLabel(result)), t("profile.summary"))] : [summaryCard(t("module.qpcrOnly"), t("module.title"))])].join("");
  renderInputSchema(result);
  renderEffectScaling(result);
  renderDecisionAudit(result);
  if (tierEnabled) {
    renderRuleRanking(result);
    renderScreeningReconstruction(result);
  }
  renderComparisonCharts(result.candidates);
  renderCandidateTable(result.candidates, tierEnabled);
  renderAnalyticalFigures(result);
  renderLongitudinal(result);
  renderIntegrityAudit(result);
  renderArtifacts(result);
  elements.reportStatus.textContent = result.local_execution ? t("report.localReady") : t("report.ready");
  elements.generateReport.textContent = t("report.generate");
}

function renderReportPresentation(report) {
  if (!hasTierModule(report)) {
    elements.reportPresentation.innerHTML = "";
    elements.reportPresentation.hidden = true;
    return;
  }
  elements.reportPresentation.hidden = false;
  const ranking = report.presentation_ranking?.rows ?? [];
  const finiteScores = ranking.map((item) => finiteNumber(item.score)).filter(Number.isFinite);
  const minimum = Math.min(-1, ...finiteScores);
  const maximum = Math.max(1, ...finiteScores);
  const span = maximum - minimum;
  const zeroPercent = ((0 - minimum) / span) * 100;
  const rankingRows = ranking.map((item) => {
    const score = finiteNumber(item.score);
    const valuePercent = Number.isFinite(score) ? ((score - minimum) / span) * 100 : zeroPercent;
    const left = Math.min(zeroPercent, valuePercent);
    const width = Number.isFinite(score) ? Math.max(.6, Math.abs(valuePercent - zeroPercent)) : 0;
    return `<div class="rank-row" role="row"><span class="rank-number" role="cell">${item.rank}</span><span class="candidate" role="cell"><strong>${escapeHtml(item.preparation)}</strong><span>${escapeHtml(item.canonical_name)}</span></span><span class="tier tier-${Number(String(item.tier).split(" ")[1]) || 4}" role="cell">${escapeHtml(item.tier)}</span><span class="score-track signed-score-track" data-style="--zero:${zeroPercent.toFixed(2)}%" role="cell"><span class="score-bar" data-style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></span></span><span class="score-value" role="cell">${displayNumber(score, 2)}</span></div>`;
  }).join("");
  const directionHeader = report.assay.analysis_goal === "decrease" ? t("validation.decreases") : report.assay.analysis_goal === "increase" ? t("validation.increases") : t("validation.directionalPairs");
  const validationRows = (report.screening_reconstruction?.rows ?? []).map((item) => `<div class="validation-row ${(item.interpretation_codes ?? []).length ? "validation-review" : ""} ${item.agreement === false ? "validation-disagreement" : ""}" role="row"><span><strong>${escapeHtml(item.preparation)}</strong></span><span>${item.reference_applicable ? decisionBadge(item.reference_qualified ? t("common.yes") : t("common.no"), item.reference_qualified ? "yes" : "no") : decisionBadge(t("common.na"))}</span><span>${decisionBadge(item.reconstructed_qualified ? t("common.yes") : t("common.no"), item.reconstructed_qualified ? "yes" : "no")}</span><span>${item.goal_direction_pairs}/${item.complete_quantity_pairs}<small>${item.complete_quantity_pairs}/${item.nominal_pairs}</small></span>${screeningEffectCell(item)}<span class="tier tier-${Number(String(item.tier).split(" ")[1]) || 4}">${escapeHtml(item.tier)}</span><span>${escapeHtml(t(`validation.audit.${item.data_audit_role ?? "none"}`))}</span></div>`).join("");
  const validationDescription = report.candidate_evidence_profile?.source === "user_supplied_local_csv" ? t("validation.customDescription") : t("validation.description");
  elements.reportPresentation.innerHTML = `<section class="presentation-panel"><div class="section-heading"><div><p class="eyebrow">${t("ranking.eyebrow")}</p><h3>${t("ranking.title")}</h3></div><p>${t("ranking.description")}</p></div><div class="ranking">${rankingRows}</div></section><section class="presentation-panel"><div class="section-heading"><div><p class="eyebrow">${t("validation.eyebrow")}</p><h3>${t("validation.title")}</h3></div><p>${validationDescription}</p></div><div class="validation-table"><div class="validation-row validation-header" role="row"><span>${t("candidate.preparation")}</span><span>${t("validation.reference")}</span><span>${t("validation.reproduced")}</span><span>${directionHeader}</span><span>${t("validation.primaryEffect")}</span><span>Tier</span><span>${t("validation.dataAudit")}</span></div>${validationRows}</div></section>`;
  applyDeclaredStyles(elements.reportPresentation);
}

function renderReport(report) {
  activeReport = report; elements.reportView.hidden = false; elements.reportStatus.textContent = t("report.generated", { methods: report.method_catalog.length, preparations: report.candidates.length });
  const tierEnabled = hasTierModule(report);
  const downloadLabels = { docx: t("report.downloadDocx"), html: t("report.openHtml"), markdown: t("report.downloadMarkdown"), json: t("report.downloadJson") };
  elements.reportDownloads.innerHTML = ["docx", "html", "markdown", "json"].filter((format) => report.downloads?.[format]).map((format) => {
    const primary = format === "docx" ? " primary" : "";
    const target = format === "html" ? ' target="_blank" rel="noopener"' : "";
    const filename = report.download_filenames?.[format] ? ` download="${escapeHtml(report.download_filenames[format])}"` : format === "docx" || format === "markdown" || format === "json" ? " download" : "";
    return `<a class="report-download${primary}" href="${escapeHtml(report.downloads[format])}"${filename}${target}>${downloadLabels[format]}</a>`;
  }).join("");
  elements.reportSummary.innerHTML = [summaryCard(report.overview.preparations, t("summary.preparations")), ...(tierEnabled ? [summaryCard(report.overview.tier_counts?.tier_1 ?? 0, "Tier 1"), summaryCard(report.overview.tier_counts?.tier_2 ?? 0, "Tier 2")] : [summaryCard(t("module.qpcrOnly"), t("module.title"))]), summaryCard(report.assessment_policy.alpha, "α"), summaryCard("Benjamini–Hochberg", "FDR")].join("");
  renderReportPresentation(report);
  elements.reportMethods.innerHTML = report.method_catalog.map((method) => `<article class="report-mechanism"><span class="mechanism-type">${escapeHtml(method.type)}</span><h4>${escapeHtml(method.name)}</h4><p><strong>${t("report.purpose")}</strong> ${escapeHtml(method.purpose)}</p><p><strong>${t("report.method")}</strong> ${escapeHtml(method.method)}</p><p><strong>${t("report.rule")}</strong> ${escapeHtml(method.rule)}</p><p class="mechanism-limitation"><strong>${t("report.limitation")}</strong> ${escapeHtml(method.limitation)}</p></article>`).join("");
  elements.reportCandidates.innerHTML = report.candidates.map((candidate) => {
    const qty = candidate.tests.quantity_signed_rank;
    const ct = candidate.tests.ct_signed_rank;
    const tone = hasBalancedMixedDirections(candidate) ? "descriptive" : assessmentTone(candidate.assessment.code);
    const relations = candidate.data_integrity.exact_cross_group_relations.length
      ? `<ul class="integrity-relations">${candidate.data_integrity.exact_cross_group_relations.map((relation) => `<li><strong>${escapeHtml(relation.source_term)} → ${escapeHtml(relation.target_term)}</strong>: ${escapeHtml(relation.related_preparation)} · ${relation.identical_records} ${t("report.identicalRecords")} · ${escapeHtml(integrityAction(relation.required_action))}</li>`).join("")}</ul>`
      : `<p>${t("integrity.noRelations")}</p>`;
    const tierSummary = tierEnabled ? `<span class="tier tier-${tierNumber(candidate)}">${escapeHtml(candidate.tier)}</span><span class="report-score">S=${displayNumber(candidate.integrated_score, 2)}</span>` : "";
    const tierDetail = tierEnabled ? `<div class="tier-explanation"><strong>${t("report.tierRule")}</strong> <code>${escapeHtml(candidate.tier_decision.code)}</code> — ${escapeHtml(candidate.tier_decision.explanation ?? tierExplanation(candidate))}</div><p><strong>${t("candidate.integratedScore")}:</strong> ${displayNumber(candidate.integrated_score, 4)} · <strong>${t("report.evidenceProfile")}:</strong> ${escapeHtml(candidate.evidence_profile.id)} (${candidate.evidence_profile.available ? t("common.yes") : t("common.no")})</p>` : "";
    return `<details class="candidate-report${tierEnabled ? "" : " qpcr-only"}"><summary><span class="report-rank">${candidate.rank}</span><span><strong>${escapeHtml(candidate.preparation)}</strong><small>${escapeHtml(candidate.canonical_name)}</small></span>${tierSummary}</summary><div class="candidate-report-body"><p><span class="assessment-pill ${tone}">${escapeHtml(candidate.assessment.label)}</span> · ${escapeHtml(candidate.assessment.explanation)}</p>${tierDetail}${candidateWarnings(candidate)}<div class="candidate-detail-grid"><section><h5>${t("report.completeness")}</h5><p><strong>${candidate.complete_quantity_pairs}/${candidate.nominal_pairs}</strong> ${t("report.completeQtyPairs")}</p><p>${t("report.missingQtyPairs")}: ${candidate.missing_quantity_pairs}</p><p>${t("report.nonzeroQtyPairs")}: ${qty.nonzero_pairs}</p></section><section><h5>${t("report.qtyEffect")}</h5><p>${t("report.observed")}: <strong>${escapeHtml(translateEnum(candidate.observed_change))}</strong></p><p>log10(T1/T0): <strong>${displayNumber(candidate.median_log10_quantity_ratio)}</strong></p><p>${t("candidate.fold")}: ${displayNumber(candidate.fold_change, 3)}× · ${displayPercent(candidate.percent_change)}</p></section><section><h5>${t("report.qtyTest")}</h5><p>W=${displayNumber(qty.statistic_w)} · p=${displayNumber(qty.p_value)} · q=${displayNumber(qty.q_value)}</p><p>${t("report.status")}: ${escapeHtml(translateEnum(qty.status))}</p><small>${escapeHtml(qty.method)}</small><small>H0: ${escapeHtml(translateEnum(qty.null_hypothesis))}</small></section><section><h5>${t("report.ctControl")}</h5><p>ΔCt=${displayNumber(candidate.median_delta_ct, 3)}</p><p>W=${displayNumber(ct.statistic_w)} · p=${displayNumber(ct.p_value)} · q=${displayNumber(ct.q_value)}</p><p>${t("report.status")}: ${escapeHtml(translateEnum(ct.status))}</p><small>${escapeHtml(ct.method)}</small><small>H0: ${escapeHtml(translateEnum(ct.null_hypothesis))}</small></section></div><div class="candidate-assessment-grid"><section><h5>${t("report.goalAssessment")}</h5><p>${t("report.goal")}: ${escapeHtml(translateEnum(report.assay.analysis_goal))}. ${t("report.alignment")}: <strong>${escapeHtml(translateEnum(displayedAlignment(candidate)))}</strong>.</p><p><strong>${t("report.rule")}</strong> <code>${escapeHtml(candidate.assessment.decisive_rule)}</code></p></section><section><h5>${t("candidate.consistency")}</h5><p>${candidate.direction_consistent_pairs}/${candidate.complete_quantity_pairs} · ${displayPercent(Number.isFinite(candidate.direction_consistency) ? candidate.direction_consistency * 100 : null)}</p></section><section><h5>${t("candidate.integrity")}</h5><p><strong>${escapeHtml(translateEnum(candidate.data_integrity.status))}</strong></p>${relations}</section></div></div></details>`;
  }).join("");
}

function syncTierControls() {
  elements.tierOptions.hidden = !elements.tierEnabled.checked;
  if (!elements.tierEnabled.checked) elements.candidateEvidenceProfile.value = "";
  if (!elements.tierEnabled.checked) elements.screeningReferenceProfile.value = "";
}

function resetAnalysis() {
  clearError();
  activeResult = null;
  activeReport = null;
  elements.results.hidden = true;
  elements.quickGuide.hidden = true;
  elements.saveProject.disabled = true;
  elements.reportView.hidden = true;
  elements.targetName.value = "";
  elements.hostSpecies.value = "";
  elements.tierEnabled.checked = true;
  elements.candidateEvidenceProfile.value = "";
  elements.screeningReferenceProfile.value = "";
  while (elements.timepointInputs.children.length > 2) elements.timepointInputs.lastElementChild.remove();
  [...elements.timepointInputs.querySelectorAll("[data-role='workbook']")].forEach((input) => { input.value = ""; });
  [...elements.timepointInputs.querySelectorAll("[data-role='time']")].forEach((input, index) => { input.value = String(index); });
  syncTierControls();
  updateTimepointControls();
  setRunState("ready", "run.ready", "run.readyTitle");
}

function restoreForm(result) {
  elements.assayTechnology.value = result.assay.technology;
  elements.targetCategory.value = result.assay.target_category;
  elements.targetName.value = result.assay.target_name;
  elements.analysisGoal.value = result.assay.analysis_goal;
  elements.hostSpecies.value = result.assay.host_species ?? "";
  elements.tierEnabled.checked = hasTierModule(result);
  syncTierControls();
}

async function runDemo(tiers) {
  clearError();
  setBusy(true);
  elements.results.hidden = true;
  try {
    const demo = demoFiles({ tiers });
    restoreForm({ assay: demo.assay, modules: { tier_prioritization: { enabled: tiers } } });
    elements.timeUnit.value = demo.time_unit;
    setRunState("running", "demo.running", "run.localTitle");
    const result = await analyzeWorkbooksLocally({ selections: demo.selections, assay: demo.assay, timeUnit: demo.time_unit, candidateEvidenceFile: demo.candidateEvidenceFile, tierEnabled: tiers });
    result.demo = { id: demo.id, synthetic: true, biological_interpretation_permitted: false };
    renderResult(result);
    elements.quickGuide.hidden = false;
    setRunState("completed", "demo.completed", "run.completedTitle");
    elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showError(error);
    setRunError(error);
  } finally {
    setBusy(false);
    updateTimepointControls();
  }
}

function handleTimepointChange(event) {
  if (event.target.matches("[data-role='workbook'], [data-role='time']")) {
    clearError();
    updateTimepointControls();
  }
}

async function openSelectedProject() {
  clearError();
  try {
    const { result } = await readProjectFile(elements.openProjectFile.files[0]);
    restoreForm(result);
    renderResult(result);
    setRunState("completed", "project.opened", "run.completedTitle");
  } catch (error) {
    showError(error);
    setRunError(error);
  } finally {
    elements.openProjectFile.value = "";
  }
}

function saveActiveProject() {
  if (!activeResult) return;
  if (!window.confirm(t("project.privacyWarning"))) return;
  const project = buildProjectDocument(activeResult, { language: getLanguage() });
  downloadProjectDocument(project, activeResult.assay.target_name);
  setRunState("completed", "project.saved", "run.completedTitle");
}

async function copyCitation() {
  const citation = elements.citationText.textContent;
  try {
    await navigator.clipboard.writeText(citation);
  } catch {
    const area = document.createElement("textarea");
    area.value = citation;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  elements.copyCitation.textContent = t("citation.copied");
  setTimeout(() => { elements.copyCitation.textContent = t("citation.copy"); }, 1600);
}

function collectAnalysisSelections() {
  const rows = [...elements.timepointInputs.querySelectorAll(".timepoint-row")];
  const selections = rows.map((row, index) => ({
    term: `T${index}`,
    file: row.querySelector("[data-role='workbook']").files[0],
    timeValue: Number(row.querySelector("[data-role='time']").value),
  }));
  return { rows, selections };
}

function validateAnalysisForm(rows, selections) {
  const missingSelections = selections.filter((item) => !item.file);
  if (missingSelections.length) {
    for (const item of missingSelections) {
      elements.timepointInputs.querySelector(`[data-term="${item.term}"]`)?.classList.add("has-error");
    }
    showError(new Error(t("error.selectFiles", { terms: missingSelections.map((item) => item.term).join(", ") })));
    return false;
  }
  if (!elements.targetName.value.trim()) {
    elements.targetName.setAttribute("aria-invalid", "true");
    showError(new Error(t("error.targetRequired")));
    return false;
  }
  const hasInvalidTime = selections.some((item) => !Number.isFinite(item.timeValue));
  const hasNonIncreasingTime = selections.some(
    (item, index) => index > 0 && item.timeValue <= selections[index - 1].timeValue,
  );
  if (hasInvalidTime || hasNonIncreasingTime) {
    rows.forEach((row) => row.classList.add("has-error"));
    showError(new Error(t("error.timeSequence")));
    return false;
  }
  return true;
}

function collectAssayMetadata() {
  return {
    technology: elements.assayTechnology.value,
    target_category: elements.targetCategory.value,
    target_name: elements.targetName.value.trim(),
    analysis_goal: elements.analysisGoal.value,
    host_species: elements.hostSpecies.value.trim() || null,
  };
}

async function analyzeSelectedWorkbooks() {
  clearError();
  const { rows, selections } = collectAnalysisSelections();
  if (!validateAnalysisForm(rows, selections)) return;

  setBusy(true);
  elements.results.hidden = true;
  try {
    setRunState("running", "run.localReading", "run.localTitle");
    const candidateEvidenceFile = elements.candidateEvidenceProfile.files[0] ?? null;
    const screeningReferenceFile = elements.screeningReferenceProfile.files[0] ?? null;
    const result = await analyzeWorkbooksLocally({
      selections,
      assay: collectAssayMetadata(),
      timeUnit: elements.timeUnit.value,
      candidateEvidenceFile,
      screeningReferenceFile,
      tierEnabled: elements.tierEnabled.checked,
    });
    setRunState("completed", "run.localCompleted", "run.completedTitle");
    renderResult(result);
  } catch (error) {
    showError(error);
    setRunError(error);
  } finally {
    setBusy(false);
    updateTimepointControls();
  }
}

function generateCurrentReport() {
  clearError();
  if (!activeResult) return;
  elements.generateReport.disabled = true;
  elements.reportStatus.textContent = t("report.generating");
  try {
    const report = buildLocalAssessmentReport(activeResult, getLanguage());
    renderReport(report);
    elements.generateReport.textContent = t("report.regenerate");
    downloadLocalDocx(report);
  } catch (error) {
    showError(error);
    elements.reportStatus.textContent = t("report.failed");
  } finally {
    elements.generateReport.disabled = false;
  }
}

function applySelectedLanguage() {
  const reportToRestore = activeReport;
  setLanguage(elements.language.value);
  applyStaticTranslations();
  updateTimepointControls();
  if (activeResult) renderResult(activeResult);
  if (reportToRestore) renderReport(reportToRestore);
  renderRunState();
}

function registerEventHandlers() {
  elements.addTimepoint.addEventListener("click", addTimepointRow);
  elements.timepointInputs.addEventListener("change", handleTimepointChange);
  elements.targetName.addEventListener("input", () => elements.targetName.removeAttribute("aria-invalid"));
  elements.tierEnabled.addEventListener("change", syncTierControls);
  elements.newProject.addEventListener("click", resetAnalysis);
  elements.openProject.addEventListener("click", () => elements.openProjectFile.click());
  elements.openProjectFile.addEventListener("change", openSelectedProject);
  elements.saveProject.addEventListener("click", saveActiveProject);
  elements.demoBasic.addEventListener("click", () => runDemo(false));
  elements.demoTier.addEventListener("click", () => runDemo(true));
  elements.closeGuide.addEventListener("click", () => { elements.quickGuide.hidden = true; });
  elements.copyCitation.addEventListener("click", copyCitation);
  elements.analyze.addEventListener("click", analyzeSelectedWorkbooks);
  elements.generateReport.addEventListener("click", generateCurrentReport);
  elements.language.addEventListener("change", applySelectedLanguage);
}

registerEventHandlers();
syncTierControls();
updateTimepointControls();
renderRunState();
