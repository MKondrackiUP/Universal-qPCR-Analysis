const reportCopy = {
  pl: {
    title: "Szczegółowy raport uniwersalnej analizy qPCR",
    boundary: "Analiza par qPCR do zastosowań badawczych. Wynik statystyczny i zgodność z zadeklarowanym celem nie dowodzą przyczynowości, skuteczności, rozpoznania ani walidacji klinicznej.",
  },
  en: {
    title: "Detailed universal qPCR analysis report",
    boundary: "Paired qPCR analysis for research use. Statistical results and alignment with the declared goal do not establish causality, efficacy, diagnosis or clinical validity.",
  },
};

const assessmentLabels = {
  pl: {
    confirmed_supportive: "potwierdzony wynik zgodny z celem",
    supportive_signal: "sygnał zgodny z celem",
    confirmed_contradictory: "potwierdzony wynik sprzeczny z celem",
    contradictory_signal: "sygnał sprzeczny z celem",
    no_detected_change: "brak wykrytej zmiany",
    descriptive_decreased: "opisowy spadek",
    descriptive_increased: "opisowy wzrost",
    insufficient_data: "niewystarczające dane",
  },
  en: {
    confirmed_supportive: "confirmed result aligned with goal",
    supportive_signal: "signal aligned with goal",
    confirmed_contradictory: "confirmed result opposing goal",
    contradictory_signal: "signal opposing goal",
    no_detected_change: "no detected change",
    descriptive_decreased: "descriptive decrease",
    descriptive_increased: "descriptive increase",
    insufficient_data: "insufficient data",
  },
};

const englishTierDecisions = {
  goal_opposed_qpcr_override: "The qPCR direction opposing the declared goal triggered the overriding Tier 5 rule.",
  missing_evidence_profile_override: "A complete versioned evidence profile is unavailable; Tier remains 4 until the profile is supplied.",
  definition_or_readiness_override: "Missing preparation definition or transcriptomic readiness triggered the overriding Tier 4 rule.",
  negative_mechanistic_fit_override: "Goal-aligned qPCR with negative mechanistic fit limited the classification to Tier 3.",
  no_mechanistic_or_context_support: "Goal-aligned qPCR without mechanistic or contextual support limited the classification to Tier 3.",
  tier1_thresholds_met: "The Tier 1 score threshold and the aligned-qPCR, preparation-definition and mechanistic-fit requirements were met.",
  tier2_threshold_met: "Aligned qPCR and the integrated score met the Tier 2 threshold without meeting all Tier 1 requirements.",
  tier3_threshold_met: "The integrated score met the exploratory Tier 3 threshold.",
  mixed_or_low_confidence: "Higher-tier requirements were not met; the result remains mixed or low confidence.",
};

function formattedNumber(value, language, digits = 4) {
  const numeric = value == null || value === "" ? null : Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-US", { maximumFractionDigits: digits }).format(numeric);
}

function methodCatalog(language, policy, tierPolicy, evidenceProfile, modules, scaling) {
  const pl = language === "pl";
  const number = (value, digits) => (Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : pl ? "niedostępne" : "unavailable");
  const datasetNote = scaling
    ? (pl
      ? ` Przesunięcie Qty (${number(scaling.qty_offset, 6)}) i skala efektu (SD median = ${number(scaling.preparation_median_sd, 4)}) pochodzą z tego zestawu preparatów, więc skalowany efekt i wynik zintegrowany porównuj wyłącznie w obrębie jednego uruchomienia.`
      : ` The Qty offset (${number(scaling.qty_offset, 6)}) and the effect scale (SD of medians = ${number(scaling.preparation_median_sd, 4)}) come from this set of preparations, so compare scaled effects and integrated scores only within one run.`)
    : "";
  const customEvidence = evidenceProfile?.source === "user_supplied_local_csv";
  const tierEnabled = modules?.tier_prioritization?.enabled !== false;
  const methods = [
    { id: "data_completeness", type: "quality_check", name: pl ? "Kompletność par" : "Pair completeness", purpose: pl ? "Sprawdza, czy preparat ma wystarczające dane do oceny kierunku." : "Checks whether a preparation has enough data for directional assessment.", method: pl ? "Zliczenie par nominalnych, kompletnych i brakujących." : "Counts nominal, complete and missing pairs.", rule: pl ? `Co najmniej ${policy.minimum_complete_pairs} kompletne pary Qty.` : `At least ${policy.minimum_complete_pairs} complete Qty pairs.`, limitation: pl ? "Nie ocenia wielkości ani istotności efektu." : "Does not assess effect size or statistical evidence." },
    { id: "quantity_effect", type: "effect_estimate", name: pl ? "Efekt ilościowy Qty" : "Quantity effect", purpose: pl ? "Określa kierunek i wielkość głównego efektu." : "Determines the direction and magnitude of the primary effect.", method: "median log10((Qty_T1 + offset)/(Qty_T0 + offset))", rule: pl ? "Wartość < 0 oznacza spadek, > 0 wzrost, = 0 brak zmiany." : "A value < 0 indicates decrease, > 0 increase, and = 0 no change.", limitation: (pl ? "Offset chroni obliczenie przy zerowych wartościach Qty; raport nie dowodzi znaczenia biologicznego." : "The offset protects calculations with zero Qty values; the report does not establish biological importance.") + datasetNote },
    { id: "quantity_signed_rank", type: "statistical_test", name: pl ? "Test Wilcoxona dla Qty" : "Wilcoxon test for Qty", purpose: pl ? "Testuje dwustronnie hipotezę o braku systematycznej zmiany Qty." : "Two-sided test of no systematic Qty change.", method: pl ? "Dokładna permutacja znaków do 20 niezerowych par; powyżej przybliżenie normalne z korektą remisów i ciągłości." : "Exact sign permutation through 20 non-zero pairs; normal approximation with tie and continuity corrections above that.", rule: pl ? `Wynik potwierdzony statystycznie, gdy q < ${policy.alpha}; FDR: ${policy.multiplicity_adjustment}.` : `Statistically confirmed when q < ${policy.alpha}; FDR: ${policy.multiplicity_adjustment}.`, limitation: pl ? "Różnice równe zero są wyłączane; test nie dowodzi znaczenia biologicznego." : "Zero differences are excluded; the test does not establish biological importance." },
    { id: "ct_quality_control", type: "quality_check", name: pl ? "Kontrola kierunku Ct" : "Ct directional check", purpose: pl ? "Sprawdza pomocniczą zgodność Ct z wynikiem Qty." : "Checks auxiliary directional concordance between Ct and Qty.", method: "ΔCt = Ct_T1 - Ct_T0", rule: pl ? "Ct jest pomocnicze i nie zmienia samodzielnie oceny głównej." : "Ct is auxiliary and cannot independently change the primary assessment.", limitation: pl ? "Znaczenie kierunku Ct zależy od konstrukcji testu i jakości krzywej wzorcowej." : "Ct direction depends on assay design and standard-curve quality." },
    { id: "ct_signed_rank", type: "statistical_test", name: pl ? "Test Wilcoxona dla Ct" : "Wilcoxon test for Ct", purpose: pl ? "Testuje pomocniczo systematyczną zmianę Ct." : "Auxiliary test of systematic Ct change.", method: pl ? "Ta sama dwustronna procedura rangowana co dla Qty." : "The same two-sided signed-rank procedure used for Qty.", rule: pl ? "Wynik raportowany z p i q, bez wpływu na werdykt oparty na Qty." : "Reported with p and q but does not drive the Qty-based verdict.", limitation: pl ? "Nie zastępuje oceny głównego punktu końcowego Qty." : "Does not replace assessment of the primary Qty endpoint." },
    { id: "direction_consistency", type: "descriptive_check", name: pl ? "Powtarzalność kierunku" : "Direction consistency", purpose: pl ? "Pokazuje, w ilu parach kierunek zgadza się z medianą preparatu." : "Shows how many pairs agree with the preparation-level median direction.", method: pl ? "Liczba par zgodnych / liczba kompletnych par Qty." : "Direction-consistent pairs / complete Qty pairs.", rule: pl ? "W zintegrowanym Tierze skaluje wiarygodność sygnału qPCR od 0,5 do 1,0." : "Within the integrated Tier it scales qPCR-signal reliability from 0.5 to 1.0.", limitation: pl ? "Nie uwzględnia wielkości poszczególnych zmian." : "Does not account for the magnitude of individual changes." },
    { id: "data_integrity", type: "quality_check", name: pl ? "Audyt dokładnych powtórzeń" : "Exact-recurrence audit", purpose: pl ? "Wykrywa identyczne wielozbiory Ct/Qty między preparatami i punktami." : "Detects identical Ct/Qty multisets across preparations and timepoints.", method: pl ? "Porównanie dokładnych sygnatur grup." : "Exact group-signature comparison.", rule: pl ? "Relacja wymaga przeglądu pochodzenia danych, lecz nie jest automatycznie usuwana." : "A relation requires source-data review but is not removed automatically.", limitation: pl ? "Powtórzenie może wynikać zarówno z błędu, jak i prawidłowego eksportu." : "A recurrence may reflect either an error or a valid export." },
    { id: "overall_assessment", type: "decision_rule", name: pl ? "Statystyczna ocena qPCR" : "Statistical qPCR assessment", purpose: pl ? "Łączy kierunek Qty, cel analizy, kompletność i q." : "Combines Qty direction, analysis goal, completeness and q.", method: pl ? "Jawna reguła kategorialna raportowana oddzielnie od Tieru." : "Explicit categorical rule reported separately from Tier.", rule: pl ? "Potwierdzony = kierunek zgodny lub sprzeczny z celem oraz q < 0,05; przy pełnych danych bez tego progu raportowany jest sygnał. Cel neutralny pozostaje opisowy." : "Confirmed = direction aligned with or opposed to goal and q < 0.05; otherwise complete data are labelled as a signal. A neutral goal remains descriptive.", limitation: pl ? "Ocena statystyczna nie zastępuje wersjonowanego profilu dowodów używanego przez Tier." : "The statistical assessment does not replace the versioned evidence profile used by Tier." },
    { id: "integrated_tier", type: "prioritization_rule", name: pl ? "Zintegrowany wynik i Tier" : "Integrated score and Tier", purpose: customEvidence ? (pl ? "Oblicza priorytet z lokalnych ocen dowodów dostarczonych przez użytkownika." : "Computes priority from local evidence scores supplied by the user.") : (pl ? "Odtwarza wersjonowaną klasyfikację priorytetu niezależnie od nazwy aplikacji." : "Reproduces the versioned priority classification independently of the application name."), method: tierPolicy?.formula ?? "", rule: pl ? "Zakresy wejść: zdefiniowanie 0–2, kontekst 0–2, mechanizm −2…1, gotowość 0–2, ryzyko 0–3. Reguły kolejno: kierunek przeciwny → Tier 5; brak profilu/zdefiniowania/gotowości → Tier 4; ograniczenie mechanistyczne → Tier 3; następnie progi 4,0 i 2,5." : "Input ranges: definition 0–2, context 0–2, mechanism −2…1, readiness 0–2, risk 0–3. Rules run in order: opposing direction → Tier 5; missing profile/definition/readiness → Tier 4; mechanistic override → Tier 3; then thresholds 4.0 and 2.5.", limitation: customEvidence ? (pl ? "Punktacja pochodzi od użytkownika i nie jest niezależnie weryfikowana przez aplikację. Tier jest priorytetem walidacyjnym, nie miarą skuteczności ani decyzją kliniczną." : "Scores are user supplied and are not independently verified by the application. Tier is a validation priority, not efficacy or a clinical decision.") : (pl ? "Tier oznacza priorytet walidacyjny, nie skuteczność ani decyzję kliniczną." : "Tier denotes validation priority, not efficacy or a clinical decision.") },
  ];
  return tierEnabled ? methods : methods.filter((method) => method.id !== "integrated_tier").map((method) => {
    if (method.id === "direction_consistency") return { ...method, rule: pl ? "Wartość opisowa; nie zmienia samodzielnie statystycznej oceny qPCR." : "Descriptive value; it does not independently change the statistical qPCR assessment." };
    if (method.id === "overall_assessment") return { ...method, limitation: pl ? "Ocena dotyczy analizowanych danych i nie dowodzi znaczenia biologicznego ani przyczynowości." : "The assessment describes the analyzed data and does not establish biological importance or causality." };
    return method;
  });
}

function hasBalancedMixedDirections(candidate) {
  return candidate.complete_quantity_pairs > 0
    && candidate.decreased_pairs > 0
    && candidate.increased_pairs > 0
    && candidate.decreased_pairs === candidate.increased_pairs;
}

function localizeCandidates(candidates, language) {
  return candidates.map((candidate) => {
    const test = candidate.tests.quantity_signed_rank;
    const q = test.q_value ?? test.p_value;
    const evidence = q == null ? (language === "pl" ? "test nie dostarczył wartości q" : "the test did not provide a q-value") : `q=${formattedNumber(q, language)}`;
    let label = assessmentLabels[language][candidate.assessment.code] ?? String(candidate.assessment.code).replaceAll("_", " ");
    let explanation = language === "pl"
      ? `${label}: mediana log10(T1/T0)=${formattedNumber(candidate.median_log10_quantity_ratio, language)}, ${evidence}.`
      : `${label}: median log10(T1/T0)=${formattedNumber(candidate.median_log10_quantity_ratio, language)}, ${evidence}.`;
    if (test.nonzero_pairs === 0) {
      label = language === "pl" ? "brak wykrytej zmiany" : "no detected change";
      explanation = language === "pl"
        ? `${candidate.complete_quantity_pairs} kompletne pary miały różnicę Qty równą zero. Po wymaganym wyłączeniu remisów test Wilcoxona ma n=0; p i q nie mają zastosowania.`
        : `${candidate.complete_quantity_pairs} complete pairs had zero Qty differences. After the required exclusion of ties, the Wilcoxon test has n=0; p and q are not applicable.`;
    } else if (hasBalancedMixedDirections(candidate)) {
      label = language === "pl" ? "kierunek mieszany — brak spójnego sygnału" : "mixed direction — no consistent signal";
      explanation = language === "pl"
        ? `Mediana log10(T1/T0)=${formattedNumber(candidate.median_log10_quantity_ratio, language)} wskazuje opisowy spadek, ale pary dzielą się równo: ${candidate.decreased_pairs} spadki i ${candidate.increased_pairs} wzrosty. W=${formattedNumber(test.statistic_w, language)}, p=${formattedNumber(test.p_value, language)}, q=${formattedNumber(test.q_value, language)}.`
        : `Median log10(T1/T0)=${formattedNumber(candidate.median_log10_quantity_ratio, language)} indicates a descriptive decrease, but pairs split evenly: ${candidate.decreased_pairs} decreases and ${candidate.increased_pairs} increases. W=${formattedNumber(test.statistic_w, language)}, p=${formattedNumber(test.p_value, language)}, q=${formattedNumber(test.q_value, language)}.`;
    }
    return {
      ...candidate,
      display_goal_alignment: hasBalancedMixedDirections(candidate) ? "uncertain" : candidate.goal_alignment,
      assessment: { ...candidate.assessment, label, explanation },
      tier_decision: { ...candidate.tier_decision, explanation: language === "en" ? (englishTierDecisions[candidate.tier_decision.code] ?? candidate.tier_decision.explanation) : candidate.tier_decision.explanation },
    };
  });
}

export function buildGenericAssessmentReportModel(result, options = {}) {
  const language = options.language === "en" ? "en" : "pl";
  const modules = result.modules ?? { qpcr: { enabled: true }, tier_prioritization: { enabled: true } };
  const software = result.software ?? { name: "Universal qPCR Analysis", version: "0.22.0", license: "Universal qPCR Analysis Free Use and Scientific Citation License 1.0", authors: [{ given_names: "Marcin", family_names: "Kondracki" }], doi: null };
  const citation = language === "pl"
    ? `Kondracki, M. (2026). Universal qPCR Analysis (wersja ${software.version}) [oprogramowanie]. DOI oczekuje na nadanie.`
    : `Kondracki, M. (2026). Universal qPCR Analysis (Version ${software.version}) [Computer software].`;
  return {
    report_schema_version: "3.0",
    report_type: "universal_qpcr",
    language,
    title: reportCopy[language].title,
    generated_at: options.generatedAt ?? new Date().toISOString(),
    run_id: options.runId ?? result.run_id,
    source: options.source ?? result.source,
    interpretation_boundary: reportCopy[language].boundary,
    software,
    citation: { required_for_scholarly_outputs: true, provisional: !software.doi, text: citation, doi: software.doi ?? null },
    modules,
    assay: result.assay,
    input_schema: result.input_schema,
    assessment_policy: result.assessment_policy,
    tier_policy: result.tier_policy ?? null,
    candidate_evidence_profile: result.candidate_evidence_profile,
    preparation_ordering: result.preparation_ordering,
    presentation_ranking: result.presentation_ranking,
    screening_reconstruction: result.screening_reconstruction,
    effect_scaling: result.effect_scaling ?? null,
    method_catalog: methodCatalog(language, result.assessment_policy, result.tier_policy, result.candidate_evidence_profile, modules, result.effect_scaling),
    overview: result.overview,
    candidates: localizeCandidates(result.candidates, language),
    longitudinal: result.longitudinal,
    figures: (result.artifacts ?? []).filter((artifact) => ["paired_log10_qty_ratio.svg", "paired_delta_ct.svg"].some((suffix) => artifact.path.replaceAll("\\", "/").endsWith(suffix))),
    downloads: options.downloads ?? {},
  };
}
