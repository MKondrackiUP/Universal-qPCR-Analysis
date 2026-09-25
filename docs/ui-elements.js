import { parseStyleDeclarations } from "./ui-helpers.js";

function requiredElement(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Application element not found: ${selector}`);
  return element;
}

/**
 * Resolve the DOM contract once during application startup.
 *
 * Keeping selectors here makes missing HTML elements fail early and prevents
 * rendering code from being mixed with document lookup details.
 */
export function collectApplicationElements(root = document) {
  const get = (selector) => requiredElement(root, selector);
  return {
    newProject: get("#new-project-button"),
    openProject: get("#open-project-button"),
    openProjectFile: get("#open-project-file"),
    saveProject: get("#save-project-button"),
    demoBasic: get("#demo-basic-button"),
    demoTier: get("#demo-tier-button"),
    quickGuide: get("#quick-guide"),
    closeGuide: get("#close-guide-button"),
    guideTierStep: get("#guide-tier-step"),
    copyCitation: get("#copy-citation-button"),
    citationText: get("#citation-text"),
    language: get("#language-select"),
    assayTechnology: get("#assay-technology"),
    targetCategory: get("#target-category"),
    targetName: get("#target-name"),
    analysisGoal: get("#analysis-goal"),
    hostSpecies: get("#host-species"),
    candidateEvidenceProfile: get("#candidate-evidence-profile"),
    screeningReferenceProfile: get("#screening-reference-profile"),
    timeUnit: get("#time-unit"),
    timepointInputs: get("#timepoint-inputs"),
    inputReadiness: get("#input-readiness"),
    addTimepoint: get("#add-timepoint-button"),
    analyze: get("#analyze-button"),
    runTitle: get("#run-title"),
    runStatus: get("#run-status"),
    runMessage: get("#run-message"),
    progress: get("#progress-bar"),
    results: get("#results"),
    banner: get("#result-banner"),
    summary: get("#summary-cards"),
    tierEnabled: get("#tier-enabled"),
    tierOptions: get("#tier-module-options"),
    tierSections: [...root.querySelectorAll("[data-tier-section]")],
    inputSchemaSummary: get("#input-schema-summary"),
    inputSchemaFiles: get("#input-schema-files"),
    effectScalingSummary: get("#effect-scaling-summary"),
    effectScalingNote: get("#effect-scaling-note"),
    decisionAuditSummary: get("#decision-audit-summary"),
    decisionAuditRows: get("#decision-audit-rows"),
    ranking: get("#ranking"),
    screeningReconstruction: get("#screening-reconstruction"),
    validationDescription: get("#validation-description"),
    assaySummary: get("#assay-summary"),
    effectChart: get("#effect-chart"),
    evidenceChart: get("#evidence-chart"),
    candidates: get("#candidate-results"),
    analyticalFigures: get("#analytical-figures"),
    generateReport: get("#generate-report-button"),
    reportStatus: get("#report-status"),
    reportView: get("#report-view"),
    reportDownloads: get("#report-downloads"),
    reportSummary: get("#report-summary"),
    reportPresentation: get("#report-presentation"),
    reportMethods: get("#report-methods"),
    reportCandidates: get("#report-candidates"),
    longitudinalSummary: get("#longitudinal-summary"),
    longitudinalContent: get("#longitudinal-content"),
    integritySummary: get("#integrity-summary"),
    integrityContent: get("#integrity-content"),
    artifacts: get("#artifacts"),
    error: get("#error-panel"),
  };
}

/**
 * Apply `data-style` declarations through the CSSOM.
 *
 * Inline `style` attributes are blocked by the deployed Content-Security-Policy
 * (`style-src 'self'`), while CSSOM writes are not. Every generated fragment
 * that needs computed geometry declares it in `data-style` and is passed here
 * after insertion.
 */
export function applyDeclaredStyles(root) {
  if (!root) return root;
  for (const element of root.querySelectorAll("[data-style]")) {
    for (const [property, value] of parseStyleDeclarations(element.dataset.style)) {
      element.style.setProperty(property, value);
    }
    element.removeAttribute("data-style");
  }
  return root;
}
