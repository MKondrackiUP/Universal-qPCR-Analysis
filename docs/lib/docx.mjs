const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const copy = {
  pl: {
    title: "Szczegółowy raport uniwersalnej analizy qPCR",
    subtitle: "Pełny raport badawczy — wyniki i uzasadnienie dla każdego preparatu",
    generated: "Wygenerowano",
    assay: "Definicja badania",
    technology: "Technologia",
    category: "Kategoria celu",
    target: "Cel molekularny",
    goal: "Oczekiwany kierunek",
    host: "Gatunek gospodarza",
    timepoints: "Punkty czasowe",
    inputSchema: "Pliki wejściowe i mapowanie kolumn",
    inputIntro: "Poniższy audyt dokumentuje, które kolumny każdego lokalnego pliku zostały użyte przez analizę. Aliasy nie zmieniają algorytmu ani wag.",
    quantityPolicy: "Zasada Qty",
    quantityPolicyValue: "Kolumna Qty/Quantity jest wymagana; aplikacja nie wylicza ilości z Ct/Cq.",
    sourceFormat: "Format źródłowy",
    textEncoding: "Kodowanie tekstu",
    worksheet: "Arkusz XLSX",
    dataRows: "Wiersze danych",
    detector: "Rozpoznany cel",
    columnMapping: "Mapowanie kolumn",
    defaultFields: "Wartości domyślne",
    missingOptional: "Brakujące pola opcjonalne",
    ignoredColumns: "Pominięte kolumny",
    importWarnings: "Ostrzeżenia importu",
    importClean: "brak",
    delimiter: "Separator",
    none: "brak",
    summary: "Podsumowanie analizy",
    preparations: "Preparaty",
    completePairs: "Kompletne pary Qty",
    contrasts: "Kontrasty podłużne",
    tiers: "Rozkład Tierów",
    methods: "Testy i zasady oceniania",
    purpose: "Cel",
    method: "Metoda",
    rule: "Reguła oceny",
    limitation: "Ograniczenie",
    ranking: "Ranking preparatów",
    validation: "Tabela walidacyjna preparatów",
    rank: "Poz.",
    preparation: "Preparat",
    canonical: "Nazwa kanoniczna",
    tier: "Tier",
    score: "Wynik zintegrowany",
    reference: "Referencja",
    reproduced: "Odtworzono",
    directionPairs: "Pary zgodne",
    primaryPairedEffect: "Główny efekt parowany",
    legacyMeanIndicator: "Historyczny wskaźnik średnich",
    audit: "Audyt danych",
    yes: "tak",
    no: "nie",
    preparationReports: "Szczegółowe raporty preparatów",
    tierRule: "Reguła i uzasadnienie Tieru",
    assessment: "Statystyczna ocena qPCR",
    decisiveRule: "Reguła rozstrzygająca qPCR",
    evidenceProfile: "Profil dowodów",
    builtInProfile: "wbudowany profil wersjonowany",
    localUserProfile: "lokalny CSV użytkownika",
    profileEntries: "pozycji",
    profileCoverage: "dopasowano",
    unprofiled: "bez profilu",
    unusedEntries: "niewykorzystane wiersze",
    notApplicable: "nie dotyczy",
    metrics: "Metryki preparatu",
    nominalPairs: "Pary nominalne",
    observed: "Zaobserwowana zmiana",
    medianRatio: "Mediana log10(T1/T0)",
    fold: "Krotność T1/T0",
    percent: "Zmiana procentowa",
    medianCt: "Mediana ΔCt",
    consistency: "Zgodność kierunku",
    tests: "Wyniki testów",
    endpoint: "Punkt końcowy",
    role: "Rola",
    n: "n",
    statistic: "W",
    p: "p",
    q: "q (FDR)",
    status: "Status",
    integrity: "Integralność danych",
    noRelations: "Nie wykryto dokładnej relacji powtórzenia z innym preparatem.",
    reviewRelations: "Wykryto relacje wymagające weryfikacji pochodzenia danych:",
    interpretationWarning: "Uwaga interpretacyjna",
    warningIncomplete: "Wynik dotyczy {complete}/{nominal} kompletnych par; {missing} brakujących par nie imputowano.",
    warningMixed: "Kierunki mieszane: {decreased} spadki i {increased} wzrosty.",
    warningConflict: "Historyczny wskaźnik średnich ({legacy}) ma kierunek sprzeczny z głównym efektem parowanym ({primary}); pozostaje wyłącznie audytem starszej reguły i nie wpływa na Tier.",
    boundaryHeading: "Zakres interpretacji",
    methodsIntro: "Poniższe zasady są częścią raportu i obowiązują jednakowo dla każdego preparatu. Tier jest wersjonowanym priorytetem walidacyjnym; nie oznacza skuteczności ani decyzji klinicznej.",
    rankingIntro: "Kolejność wynika wyłącznie z wersjonowanego wyniku zintegrowanego. Statystyczna ocena qPCR jest raportowana osobno i nie zmienia arbitralnie Tieru.",
    validationIntro: "Główny efekt jest medianą sparowanych zmian Qty T1/T0. Historyczny wskaźnik średnich służy wyłącznie do odtworzenia zamrożonej reguły, nie wpływa na główny wynik ani Tier, a brakujące pary nie są imputowane.",
    customValidationIntro: "Główny efekt jest medianą sparowanych zmian Qty T1/T0. Użyto lokalnego profilu użytkownika, więc zamrożona referencja nie ma zastosowania; historyczny wskaźnik średnich pozostaje wyłącznie opisowy.",
  },
  en: {
    title: "Detailed universal qPCR analysis report",
    subtitle: "Complete research report — result and rationale for every preparation",
    generated: "Generated",
    assay: "Assay definition",
    technology: "Technology",
    category: "Target category",
    target: "Molecular target",
    goal: "Expected direction",
    host: "Host species",
    timepoints: "Timepoints",
    inputSchema: "Input files and column mapping",
    inputIntro: "This audit documents which columns from each local file were used by the analysis. Aliases do not change the algorithm or weights.",
    quantityPolicy: "Qty rule",
    quantityPolicyValue: "The Qty/Quantity column is required; the application does not infer quantity from Ct/Cq.",
    sourceFormat: "Source format",
    textEncoding: "Text encoding",
    worksheet: "XLSX worksheet",
    dataRows: "Data rows",
    detector: "Recognized target",
    columnMapping: "Column mapping",
    defaultFields: "Default values",
    missingOptional: "Missing optional fields",
    ignoredColumns: "Ignored columns",
    importWarnings: "Import warnings",
    importClean: "none",
    delimiter: "Delimiter",
    none: "none",
    summary: "Analysis summary",
    preparations: "Preparations",
    completePairs: "Complete Qty pairs",
    contrasts: "Longitudinal contrasts",
    tiers: "Tier distribution",
    methods: "Tests and assessment rules",
    purpose: "Purpose",
    method: "Method",
    rule: "Assessment rule",
    limitation: "Limitation",
    ranking: "Preparation ranking",
    validation: "Preparation validation table",
    rank: "Rank",
    preparation: "Preparation",
    canonical: "Canonical name",
    tier: "Tier",
    score: "Integrated score",
    reference: "Reference",
    reproduced: "Reproduced",
    directionPairs: "Aligned pairs",
    primaryPairedEffect: "Primary paired effect",
    legacyMeanIndicator: "Legacy mean indicator",
    audit: "Data audit",
    yes: "yes",
    no: "no",
    preparationReports: "Detailed preparation reports",
    tierRule: "Tier rule and rationale",
    assessment: "Statistical qPCR assessment",
    decisiveRule: "Decisive qPCR rule",
    evidenceProfile: "Evidence profile",
    builtInProfile: "built-in versioned profile",
    localUserProfile: "local user CSV",
    profileEntries: "entries",
    profileCoverage: "matched",
    unprofiled: "unprofiled",
    unusedEntries: "unused rows",
    notApplicable: "not applicable",
    metrics: "Preparation metrics",
    nominalPairs: "Nominal pairs",
    observed: "Observed change",
    medianRatio: "Median log10(T1/T0)",
    fold: "T1/T0 fold change",
    percent: "Percent change",
    medianCt: "Median ΔCt",
    consistency: "Direction consistency",
    tests: "Test results",
    endpoint: "Endpoint",
    role: "Role",
    n: "n",
    statistic: "W",
    p: "p",
    q: "q (FDR)",
    status: "Status",
    integrity: "Data integrity",
    noRelations: "No exact recurrence relation with another preparation was detected.",
    reviewRelations: "Relations requiring source-data review were detected:",
    interpretationWarning: "Interpretation note",
    warningIncomplete: "The result covers {complete}/{nominal} complete pairs; {missing} missing pairs were not imputed.",
    warningMixed: "Mixed directions: {decreased} decreases and {increased} increases.",
    warningConflict: "The legacy mean indicator ({legacy}) points in the opposite direction from the primary paired effect ({primary}); it remains a legacy-rule audit only and does not affect Tier.",
    boundaryHeading: "Interpretation boundary",
    methodsIntro: "The following rules are part of this report and apply consistently to every preparation. A Tier is a versioned validation priority; it does not denote efficacy or a clinical decision.",
    rankingIntro: "Ordering is based solely on the versioned integrated score. The statistical qPCR assessment is reported separately and does not arbitrarily redefine the Tier.",
    validationIntro: "The primary effect is the median paired Qty T1/T0 change. The arithmetic-mean legacy indicator is retained only to reproduce the frozen rule, does not drive the primary result or Tier, and missing pairs are not imputed.",
    customValidationIntro: "The primary effect is the median paired Qty T1/T0 change. A local user profile is active, so the frozen reference is not applicable; the arithmetic-mean legacy indicator remains descriptive only.",
  },
};

const enums = {
  pl: {
    qpcr: "qPCR", rt_qpcr: "RT-qPCR", virus: "wirus", bacterium: "bakteria", fungus: "grzyb", parasite: "pasożyt", host_gene: "gen gospodarza", other: "inny",
    decrease: "spadek", increase: "wzrost", neutral: "bez preferowanego kierunku", decreased: "spadek", increased: "wzrost", no_change: "brak zmiany", insufficient_data: "niewystarczające dane",
    primary: "główny", auxiliary_quality_control: "pomocnicza kontrola jakości", log10_quantity_ratio: "log10 ilorazu Qty", delta_ct: "ΔCt", computed: "obliczono", insufficient_nonzero_pairs: "za mało niezerowych par", not_computable: "nie można obliczyć",
    supportive: "zgodny", contradictory: "sprzeczny", contextual: "opisowy", uncertain: "niepewny", review_required: "wymaga przeglądu", no_exact_cross_group_relation_detected: "bez wykrytej relacji dokładnego powtórzenia",
  },
  en: {
    qpcr: "qPCR", rt_qpcr: "RT-qPCR", virus: "virus", bacterium: "bacterium", fungus: "fungus", parasite: "parasite", host_gene: "host gene", other: "other",
    decrease: "decrease", increase: "increase", neutral: "no preferred direction", decreased: "decrease", increased: "increase", no_change: "no change", insufficient_data: "insufficient data",
    primary: "primary", auxiliary_quality_control: "auxiliary quality control", log10_quantity_ratio: "log10 quantity ratio", delta_ct: "ΔCt", computed: "computed", insufficient_nonzero_pairs: "too few non-zero pairs", not_computable: "not computable",
    supportive: "aligned", contradictory: "opposing", contextual: "descriptive", uncertain: "uncertain", review_required: "review required", no_exact_cross_group_relation_detected: "no exact recurrence relation detected",
  },
};

const tierColors = { "Tier 1": "173B57", "Tier 2": "2A8075", "Tier 3": "C28A1A", "Tier 4": "6D7B90", "Tier 5": "B3543C" };
const xmlEscape = (value) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const label = (value, language) => enums[language]?.[value] ?? String(value ?? "").replaceAll("_", " ");
const finite = (value) => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const number = (value, language, digits = 4) => finite(value) == null ? "—" : new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-US", { maximumFractionDigits: digits }).format(Number(value));
const percent = (value, language, digits = 1) => finite(value) == null ? "—" : `${number(value, language, digits)}%`;

function interpolate(template, parameters) {
  return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => parameters[name] ?? match);
}

function candidateInterpretation(candidate, report, c) {
  const item = {
    nominal_pairs: candidate.nominal_pairs,
    complete_quantity_pairs: candidate.complete_quantity_pairs,
    missing_quantity_pairs: candidate.missing_quantity_pairs,
    decreased_pairs: candidate.decreased_pairs,
    increased_pairs: candidate.increased_pairs,
    ...(candidate.screening_reconstruction ?? {}),
  };
  const codes = new Set(item.interpretation_codes ?? []);
  const messages = [];
  if (codes.has("incomplete_quantity_pairs")) messages.push(interpolate(c.warningIncomplete, { complete: item.complete_quantity_pairs, nominal: item.nominal_pairs, missing: item.missing_quantity_pairs }));
  if (codes.has("mixed_pair_directions")) messages.push(interpolate(c.warningMixed, { decreased: item.decreased_pairs, increased: item.increased_pairs }));
  if (codes.has("legacy_mean_direction_conflict")) messages.push(interpolate(c.warningConflict, {
    legacy: percent(item.legacy_mean_change_toward_goal_percent ?? item.mean_change_toward_goal_percent, report.language),
    primary: percent(item.primary_paired_change_percent ?? candidate.percent_change, report.language),
  }));
  return messages;
}

function run(text, options = {}) {
  const properties = [
    options.bold ? "<w:b/>" : "",
    options.italic ? "<w:i/>" : "",
    options.color ? `<w:color w:val="${options.color}"/>` : "",
    options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : "",
  ].join("");
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function paragraph(content = "", options = {}) {
  const properties = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : "",
    options.keepNext ? "<w:keepNext/>" : "",
    options.pageBreakBefore ? "<w:pageBreakBefore/>" : "",
    options.border ? `<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="${options.border}"/></w:pBdr>` : "",
    options.shading ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.shading}"/>` : "",
    options.before != null || options.after != null ? `<w:spacing${options.before != null ? ` w:before="${options.before}"` : ""}${options.after != null ? ` w:after="${options.after}"` : ""}/>` : "",
    options.align ? `<w:jc w:val="${options.align}"/>` : "",
  ].join("");
  const body = Array.isArray(content) ? content.join("") : run(content, options.run);
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ""}${body}</w:p>`;
}

function pageBreak() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function cell(content, options = {}) {
  const paragraphs = Array.isArray(content) ? content.join("") : paragraph(content, { run: { bold: options.bold, color: options.textColor, size: options.size } });
  const properties = [
    options.width ? `<w:tcW w:w="${options.width}" w:type="dxa"/>` : "",
    options.shading ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.shading}"/>` : "",
    options.vAlign ? `<w:vAlign w:val="${options.vAlign}"/>` : "",
  ].join("");
  return `<w:tc><w:tcPr>${properties}</w:tcPr>${paragraphs || paragraph("")}</w:tc>`;
}

function row(cells, options = {}) {
  return `<w:tr>${options.header ? '<w:trPr><w:tblHeader/></w:trPr>' : ""}${cells.join("")}</w:tr>`;
}

function table(rows, widths = []) {
  const grid = widths.length ? `<w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>` : "";
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="C9D8D3"/><w:left w:val="single" w:sz="4" w:color="C9D8D3"/><w:bottom w:val="single" w:sz="4" w:color="C9D8D3"/><w:right w:val="single" w:sz="4" w:color="C9D8D3"/><w:insideH w:val="single" w:sz="3" w:color="DCE6E2"/><w:insideV w:val="single" w:sz="3" w:color="DCE6E2"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>${grid}${rows.join("")}</w:tbl>`;
}

function headerRow(labels, widths) {
  return row(labels.map((text, index) => cell(text, { width: widths[index], bold: true, shading: "173B57", textColor: "FFFFFF", size: 18, vAlign: "center" })), { header: true });
}

function keyValueTable(entries) {
  const widths = [2800, 6500];
  return table(entries.map(([key, value], index) => row([
    cell(key, { width: widths[0], bold: true, shading: index % 2 ? "EEF5F2" : "E5F0EC" }),
    cell(value ?? "—", { width: widths[1], shading: index % 2 ? "FAFCFB" : "FFFFFF" }),
  ])), widths);
}

function methodSection(method, c) {
  return [
    paragraph(method.name, { style: "Heading3", keepNext: true }),
    keyValueTable([
      [c.purpose, method.purpose],
      [c.method, method.method],
      [c.rule, method.rule],
      [c.limitation, method.limitation],
    ]),
    paragraph("", { after: 80 }),
  ].join("");
}

function rankingTable(report, c) {
  const widths = [600, 2600, 2500, 1100, 1600];
  const rows = [headerRow([c.rank, c.preparation, c.canonical, c.tier, c.score], widths)];
  for (const item of report.presentation_ranking?.rows ?? []) {
    const candidate = report.candidates.find((entry) => entry.preparation === item.preparation);
    const shade = Number(item.rank) % 2 ? "FFFFFF" : "F5F9F7";
    rows.push(row([
      cell(item.rank, { width: widths[0], shading: shade }),
      cell(item.preparation, { width: widths[1], bold: true, shading: shade }),
      cell(item.canonical_name ?? candidate?.canonical_name ?? "—", { width: widths[2], shading: shade }),
      cell(item.tier, { width: widths[3], bold: true, shading: tierColors[item.tier] ?? "6D7B90", textColor: "FFFFFF" }),
      cell(number(item.score, report.language, 2), { width: widths[4], shading: shade }),
    ]));
  }
  return table(rows, widths);
}

function validationTable(report, c) {
  const widths = [2100, 1050, 1050, 1200, 1850, 950, 1200];
  const rows = [headerRow([c.preparation, c.reference, c.reproduced, c.directionPairs, c.primaryPairedEffect, c.tier, c.audit], widths)];
  for (const item of report.screening_reconstruction?.rows ?? []) {
    const shade = Number(item.rank ?? 0) % 2 ? "FFFFFF" : "F5F9F7";
    rows.push(row([
      cell(item.preparation, { width: widths[0], bold: true, shading: shade }),
      cell(item.reference_applicable ? (item.reference_qualified ? c.yes : c.no) : c.notApplicable, { width: widths[1], shading: shade }),
      cell(item.reconstructed_qualified ? c.yes : c.no, { width: widths[2], shading: shade }),
      cell(`${item.goal_direction_pairs}/${item.complete_quantity_pairs}`, { width: widths[3], shading: shade }),
      cell(`${percent(item.primary_paired_change_percent, report.language)}; ${c.legacyMeanIndicator}: ${percent(item.legacy_mean_change_toward_goal_percent ?? item.mean_change_toward_goal_percent, report.language)}`, { width: widths[4], shading: shade }),
      cell(item.tier, { width: widths[5], bold: true, shading: tierColors[item.tier] ?? "6D7B90", textColor: "FFFFFF" }),
      cell(item.data_audit_role === "none" ? (report.language === "pl" ? "brak" : "none") : item.data_audit_role, { width: widths[6], shading: shade }),
    ]));
  }
  return table(rows, widths);
}

function testsTable(candidate, report, c) {
  const widths = [1300, 1450, 500, 700, 700, 700, 3250, 1100];
  const rows = [headerRow([c.endpoint, c.role, c.n, c.statistic, c.p, c.q, c.method, c.status], widths)];
  for (const test of Object.values(candidate.tests ?? {})) {
    rows.push(row([
      cell(label(test.endpoint, report.language), { width: widths[0], bold: true }),
      cell(label(test.role, report.language), { width: widths[1] }),
      cell(test.nonzero_pairs, { width: widths[2] }),
      cell(number(test.statistic_w, report.language), { width: widths[3] }),
      cell(number(test.p_value, report.language), { width: widths[4] }),
      cell(number(test.q_value, report.language), { width: widths[5] }),
      cell(test.method, { width: widths[6] }),
      cell(label(test.status, report.language), { width: widths[7] }),
    ]));
  }
  return table(rows, widths);
}

function candidateSection(candidate, report, c, index) {
  const tierEnabled = report.modules?.tier_prioritization?.enabled !== false;
  const relations = candidate.data_integrity?.exact_cross_group_relations ?? [];
  const tierColor = tierColors[candidate.tier] ?? "6D7B90";
  const consistency = Number.isFinite(candidate.direction_consistency) ? candidate.direction_consistency * 100 : null;
  const components = candidate.integrated_components ?? {};
  const componentText = Object.entries(components).map(([key, value]) => `${label(key, report.language)}=${number(value, report.language, 3)}`).join("; ");
  const relationParagraphs = relations.length
    ? [paragraph(c.reviewRelations, { run: { bold: true, color: "9D332F" } }), ...relations.map((relation) => paragraph(`• ${relation.source_term} → ${relation.target_term}: ${relation.related_preparation}; ${relation.identical_records} ${report.language === "pl" ? "identycznych rekordów" : "identical records"}; ${relation.status}.`))]
    : [paragraph(c.noRelations)];
  const interpretationParagraphs = candidateInterpretation(candidate, report, c).map((message) => paragraph([run(`${c.interpretationWarning}: `, { bold: true, color: "8A5B08" }), run(message)], { shading: "FFF3DC", border: "C18A1B", before: 80, after: 80 }));
  return [
    index > 0 ? pageBreak() : "",
    paragraph(`${candidate.rank}. ${candidate.preparation}`, { style: "Heading1", keepNext: true }),
    paragraph([
      run(candidate.canonical_name ?? "—", { italic: true, color: "526761", size: 20 }),
      ...(tierEnabled ? [run(`    ${candidate.tier}`, { bold: true, color: tierColor, size: 22 }), run(`    S=${number(candidate.integrated_score, report.language, 2)}`, { bold: true, color: "173B57", size: 22 })] : []),
    ], { after: 160 }),
    ...(tierEnabled ? [
      paragraph(c.tierRule, { style: "Heading2", keepNext: true }),
      paragraph(candidate.tier_decision?.explanation ?? "—", { shading: "FFF3DC", border: tierColor, before: 100, after: 100 }),
      paragraph(`${report.language === "pl" ? "Kod reguły" : "Rule code"}: ${candidate.tier_decision?.code ?? "—"}; ${c.evidenceProfile}: ${candidate.evidence_profile?.id ?? "—"} (${candidate.evidence_profile?.available ? c.yes : c.no}).`),
      componentText ? paragraph(`${report.language === "pl" ? "Składniki wyniku" : "Score components"}: ${componentText}.`, { run: { color: "526761", size: 18 } }) : "",
    ] : [paragraph(report.language === "pl" ? "Moduł Tier nie był włączony; karta przedstawia wyłącznie wynik analizy qPCR." : "The Tier module was not enabled; this record contains qPCR analysis results only.", { shading: "EAF3F8", border: "245F8F", before: 100, after: 100 })]),
    paragraph(c.assessment, { style: "Heading2", keepNext: true }),
    paragraph([run(`${candidate.assessment?.label ?? "—"}. `, { bold: true }), run(candidate.assessment?.explanation ?? "—")]),
    paragraph([run(`${c.decisiveRule}: `, { bold: true }), run(candidate.assessment?.decisive_rule ?? "—", { color: "245F8F" })]),
    ...interpretationParagraphs,
    paragraph(c.metrics, { style: "Heading2", keepNext: true }),
    keyValueTable([
      [c.nominalPairs, String(candidate.nominal_pairs ?? "—")],
      [c.completePairs, `${candidate.complete_quantity_pairs ?? "—"}/${candidate.nominal_pairs ?? "—"}`],
      [c.observed, label(candidate.observed_change, report.language)],
      [c.medianRatio, number(candidate.median_log10_quantity_ratio, report.language)],
      [c.fold, number(candidate.fold_change, report.language, 3)],
      [c.percent, percent(candidate.percent_change, report.language)],
      [c.medianCt, number(candidate.median_delta_ct, report.language, 3)],
      [c.consistency, `${candidate.direction_consistent_pairs ?? "—"}/${candidate.complete_quantity_pairs ?? "—"} (${percent(consistency, report.language)})`],
    ]),
    paragraph(c.tests, { style: "Heading2", keepNext: true }),
    testsTable(candidate, report, c),
    paragraph(c.integrity, { style: "Heading2", keepNext: true }),
    ...relationParagraphs,
  ].join("");
}

function inputSchemaSection(report, c) {
  const schema = report.input_schema;
  if (!schema) return "";
  const files = schema.files ?? [];
  const fileSections = files.map((file) => {
    const mapping = Object.entries(file.column_mapping ?? {}).map(([field, source]) => {
      const origin = file.mapping_origins?.[field] === "alias" ? (report.language === "pl" ? "alias" : "alias") : (report.language === "pl" ? "kanoniczna" : "canonical");
      return `${source} → ${field} (${origin})`;
    }).join("; ") || c.none;
    const values = (items) => items?.length ? items.join(", ") : c.none;
    const warningLabels = report.language === "pl" ? {
      missing_qty_values: `brak Qty: ${file.missing_qty_values ?? 0}`,
      missing_ct_values: `brak Ct/Cq: ${file.missing_ct_values ?? 0}`,
      zero_qty_values: `Qty = 0: ${file.zero_qty_values ?? 0}`,
      duplicate_observations: `powtórzone obserwacje: ${file.duplicate_observation_groups ?? 0} grup / ${file.duplicate_observation_rows ?? 0} wierszy`,
      blank_tasks_defaulted: `puste Task ustawione jako Unknown: ${file.blank_task_rows ?? 0}`,
      unmapped_headers: `pominięte kolumny: ${file.unmapped_headers?.length ?? 0}`,
    } : {
      missing_qty_values: `missing Qty: ${file.missing_qty_values ?? 0}`,
      missing_ct_values: `missing Ct/Cq: ${file.missing_ct_values ?? 0}`,
      zero_qty_values: `Qty = 0: ${file.zero_qty_values ?? 0}`,
      duplicate_observations: `repeated observations: ${file.duplicate_observation_groups ?? 0} groups / ${file.duplicate_observation_rows ?? 0} rows`,
      blank_tasks_defaulted: `blank Task defaulted to Unknown: ${file.blank_task_rows ?? 0}`,
      unmapped_headers: `ignored columns: ${file.unmapped_headers?.length ?? 0}`,
    };
    const warnings = file.warnings?.length ? file.warnings.map((code) => warningLabels[code] ?? code).join("; ") : c.importClean;
    return [
      paragraph(`${file.term} · ${file.source_filename}`, { style: "Heading2", keepNext: true }),
      keyValueTable([
        [c.sourceFormat, String(file.source_format ?? "—").toUpperCase()],
        ...(file.encoding ? [[c.textEncoding, file.encoding]] : []),
        ...(file.worksheet ? [[c.worksheet, file.worksheet]] : []),
        ...(file.delimiter ? [[c.delimiter, file.delimiter]] : []),
        [c.dataRows, String(file.data_rows ?? 0)],
        [c.detector, file.detector ?? "—"],
        [c.columnMapping, mapping],
        [c.defaultFields, values(file.defaulted_fields)],
        [c.missingOptional, values(file.missing_optional_fields)],
        [c.ignoredColumns, values(file.unmapped_headers)],
        [c.importWarnings, warnings],
      ]),
    ].join("");
  }).join("");
  return [
    paragraph(c.inputSchema, { style: "Heading1", keepNext: true }),
    paragraph(c.inputIntro, { shading: "EAF3F8", before: 80, after: 120 }),
    paragraph([run(`${c.quantityPolicy}: `, { bold: true }), run(c.quantityPolicyValue)]),
    fileSections || paragraph(c.none),
  ].join("");
}

function documentXml(report) {
  const c = copy[report.language] ?? copy.pl;
  const tierEnabled = report.modules?.tier_prioritization?.enabled !== false;
  const tierCounts = report.overview?.tier_counts ?? {};
  const tierSummary = [1, 2, 3, 4, 5].map((tier) => `Tier ${tier}: ${tierCounts[`tier_${tier}`] ?? 0}`).join(" · ");
  const evidenceProfile = report.candidate_evidence_profile ?? {};
  const evidenceProfileText = evidenceProfile.source === "user_supplied_local_csv"
    ? `${c.localUserProfile}: ${evidenceProfile.filename ?? "—"} · ${evidenceProfile.rows ?? 0} ${c.profileEntries} · ${c.profileCoverage} ${evidenceProfile.matched_preparations ?? 0}/${report.overview?.preparations ?? 0} · ${c.unprofiled} ${evidenceProfile.unprofiled_preparations ?? 0} · ${c.unusedEntries} ${evidenceProfile.unused_profile_entries ?? 0}`
    : `${c.builtInProfile} · ${evidenceProfile.rows ?? 0} ${c.profileEntries} · ${c.profileCoverage} ${evidenceProfile.matched_preparations ?? 0}/${report.overview?.preparations ?? 0}`;
  const assayEntries = [
    [c.technology, label(report.assay?.technology, report.language)],
    [c.category, label(report.assay?.target_category, report.language)],
    [c.target, report.assay?.target_name ?? "—"],
    [c.goal, label(report.assay?.analysis_goal, report.language)],
    ...(report.assay?.host_species ? [[c.host, report.assay.host_species]] : []),
    [c.timepoints, (report.overview?.timepoint_terms ?? []).join(" → ")],
    ...(tierEnabled ? [[c.evidenceProfile, evidenceProfileText]] : []),
  ];
  const softwareName = report.software?.name ?? "Universal qPCR Analysis";
  const softwareVersion = report.software?.version ?? "0.22.0";
  const citationHeading = report.language === "pl" ? "Oprogramowanie i cytowanie" : "Software and citation";
  const moduleNotice = tierEnabled
    ? (report.language === "pl" ? "Wykonano analizę qPCR oraz opcjonalną priorytetyzację Tier." : "qPCR analysis and optional Tier prioritization were performed.")
    : (report.language === "pl" ? "Wykonano wyłącznie analizę qPCR. Priorytetyzacja Tier nie była włączona." : "Only qPCR analysis was performed. Tier prioritization was not enabled.");
  const body = [
    paragraph(report.title || c.title, { style: "Title", align: "center", after: 80 }),
    paragraph(c.subtitle, { style: "Subtitle", align: "center", after: 220 }),
    paragraph(`${c.generated}: ${report.generated_at}`, { align: "center", run: { color: "526761", size: 18 }, after: 260 }),
    paragraph(citationHeading, { style: "Heading2", keepNext: true }),
    keyValueTable([
      [report.language === "pl" ? "Program" : "Software", `${softwareName} ${softwareVersion}`],
      [report.language === "pl" ? "Licencja" : "License", report.software?.license ?? "Universal qPCR Analysis Free Use and Scientific Citation License 1.0"],
      [report.language === "pl" ? "Aktywne moduły" : "Active modules", moduleNotice],
      [report.language === "pl" ? "Cytowanie" : "Citation", report.citation?.text ?? "—"],
    ]),
    paragraph(c.boundaryHeading, { style: "Heading2", keepNext: true }),
    paragraph(report.interpretation_boundary, { shading: "EAF6F1", border: "2A8075", before: 100, after: 180 }),
    paragraph(c.assay, { style: "Heading1", keepNext: true }),
    keyValueTable(assayEntries),
    inputSchemaSection(report, c),
    paragraph(c.summary, { style: "Heading1", keepNext: true }),
    keyValueTable([
      [c.preparations, String(report.overview?.preparations ?? report.candidates?.length ?? 0)],
      [c.completePairs, String(report.overview?.complete_quantity_pairs ?? "—")],
      [c.contrasts, String(report.longitudinal?.contrasts?.length ?? 0)],
      ...(tierEnabled ? [[c.tiers, tierSummary]] : []),
    ]),
    paragraph(c.methods, { style: "Heading1", keepNext: true }),
    paragraph(c.methodsIntro, { shading: "EEF5F2", before: 80, after: 160 }),
    ...(report.method_catalog ?? []).map((method) => methodSection(method, c)),
    ...(tierEnabled ? [
      pageBreak(),
      paragraph(c.ranking, { style: "Heading1", keepNext: true }),
      paragraph(c.rankingIntro, { after: 160 }),
      rankingTable(report, c),
      pageBreak(),
      paragraph(c.validation, { style: "Heading1", keepNext: true }),
      paragraph(evidenceProfile.source === "user_supplied_local_csv" ? c.customValidationIntro : c.validationIntro, { after: 160 }),
      validationTable(report, c),
    ] : []),
    pageBreak(),
    paragraph(c.preparationReports, { style: "Heading1", keepNext: true }),
    paragraph(report.language === "pl" ? `Poniżej znajduje się ${report.candidates?.length ?? 0} kompletnych kart — po jednej dla każdego preparatu.` : `The following section contains ${report.candidates?.length ?? 0} complete records — one for every preparation.`, { after: 200 }),
    ...(report.candidates ?? []).map((candidate, index) => candidateSection(candidate, report, c, index)),
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="850" w:header="567" w:footer="567" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`,
  ].join("");
  return `${XML_HEADER}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`;
}

function stylesXml() {
  return `${XML_HEADER}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos"/><w:color w:val="173B57"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="pl-PL"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:color w:val="173B57"/><w:sz w:val="42"/><w:szCs w:val="42"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:i/><w:color w:val="526761"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="173B57"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2A8075"/><w:sz w:val="25"/><w:szCs w:val="25"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="180" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="245F8F"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style></w:styles>`;
}

function contentTypesXml() {
  return `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function relationshipsXml() {
  return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function documentRelationshipsXml() {
  return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function coreXml(report) {
  const generated = Number.isFinite(Date.parse(report.generated_at)) ? new Date(report.generated_at).toISOString() : new Date().toISOString();
  const creator = (report.software?.authors ?? []).map((author) => `${author.given_names ?? ""} ${author.family_names ?? ""}`.trim()).filter(Boolean).join(", ") || "Universal qPCR Analysis";
  return `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(report.title)}</dc:title><dc:subject>Universal qPCR analysis</dc:subject><dc:creator>${xmlEscape(creator)}</dc:creator><cp:lastModifiedBy>Universal qPCR Analysis</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${generated}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${generated}</dcterms:modified></cp:coreProperties>`;
}

function appXml(report) {
  const pages = (report.candidates?.length ?? 0) + 5;
  return `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Template>Normal.dotm</Template><TotalTime>0</TotalTime><Pages>${pages}</Pages><Words>0</Words><Characters>0</Characters><Application>Universal qPCR Analysis</Application><DocSecurity>0</DocSecurity><Lines>0</Lines><Paragraphs>0</Paragraphs><ScaleCrop>false</ScaleCrop><Company></Company><LinksUpToDate>false</LinksUpToDate><CharactersWithSpaces>0</CharactersWithSpaces><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0000</AppVersion></Properties>`;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(value) {
  const date = Number.isFinite(Date.parse(value)) ? new Date(value) : new Date();
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time: ((date.getUTCHours() & 0x1f) << 11) | ((date.getUTCMinutes() & 0x3f) << 5) | ((Math.floor(date.getUTCSeconds() / 2)) & 0x1f),
    date: (((year - 1980) & 0x7f) << 9) | (((date.getUTCMonth() + 1) & 0x0f) << 5) | (date.getUTCDate() & 0x1f),
  };
}

const textEncoder = new TextEncoder();

function bytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return textEncoder.encode(String(value));
}

function allocate(length) {
  const value = new Uint8Array(length);
  return { value, view: new DataView(value.buffer) };
}

function concatenate(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function zip(entries, generatedAt) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const timestamp = dosDateTime(generatedAt);
  for (const entry of entries) {
    const name = bytes(entry.name);
    const data = bytes(entry.data);
    const crc = crc32(data);
    const local = allocate(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint16(8, 0, true);
    local.view.setUint16(10, timestamp.time, true);
    local.view.setUint16(12, timestamp.date, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, name.length, true);
    local.view.setUint16(28, 0, true);
    localParts.push(local.value, name, data);

    const central = allocate(46);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x0800, true);
    central.view.setUint16(10, 0, true);
    central.view.setUint16(12, timestamp.time, true);
    central.view.setUint16(14, timestamp.date, true);
    central.view.setUint32(16, crc, true);
    central.view.setUint32(20, data.length, true);
    central.view.setUint32(24, data.length, true);
    central.view.setUint16(28, name.length, true);
    central.view.setUint16(30, 0, true);
    central.view.setUint16(32, 0, true);
    central.view.setUint16(34, 0, true);
    central.view.setUint16(36, 0, true);
    central.view.setUint32(38, 0, true);
    central.view.setUint32(42, offset, true);
    centralParts.push(central.value, name);
    offset += local.value.length + name.length + data.length;
  }
  const centralDirectory = concatenate(centralParts);
  const end = allocate(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(4, 0, true);
  end.view.setUint16(6, 0, true);
  end.view.setUint16(8, entries.length, true);
  end.view.setUint16(10, entries.length, true);
  end.view.setUint32(12, centralDirectory.length, true);
  end.view.setUint32(16, offset, true);
  end.view.setUint16(20, 0, true);
  return concatenate([...localParts, centralDirectory, end.value]);
}

export function renderGenericAssessmentDocx(report) {
  return zip([
    { name: "[Content_Types].xml", data: contentTypesXml() },
    { name: "_rels/.rels", data: relationshipsXml() },
    { name: "docProps/core.xml", data: coreXml(report) },
    { name: "docProps/app.xml", data: appXml(report) },
    { name: "word/document.xml", data: documentXml(report) },
    { name: "word/styles.xml", data: stylesXml() },
    { name: "word/_rels/document.xml.rels", data: documentRelationshipsXml() },
  ], report.generated_at);
}
