import { ANALYSIS_GOALS } from "./lib/scientific-engine.mjs";
import { safeResourceUrl } from "./ui-helpers.js";

export const PROJECT_SCHEMA = "universal-qpcr-project";
export const PROJECT_SCHEMA_VERSION = "1.0";
export const PROJECT_EXTENSION = ".qpcrproj";

const MAX_PROJECT_BYTES = 25 * 1024 * 1024;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeFilename(value) {
  const normalized = String(value ?? "analysis")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "analysis";
}

export function buildProjectDocument(result, { language = "pl", createdAt = new Date().toISOString() } = {}) {
  if (!result || result.analysis_type !== "universal_qpcr" || !Array.isArray(result.candidates)) {
    throw new Error("Only a completed universal qPCR result can be saved as a project.");
  }
  const snapshot = cloneJson(result);
  const source = cloneJson(snapshot.project_source ?? {});
  delete snapshot.project_source;
  if (snapshot.report?.downloads) delete snapshot.report.downloads;
  return {
    schema: PROJECT_SCHEMA,
    schema_version: PROJECT_SCHEMA_VERSION,
    created_at: createdAt,
    language: language === "en" ? "en" : "pl",
    software: cloneJson(result.software ?? { name: "Universal qPCR Analysis", version: "0.22.0" }),
    modules: cloneJson(result.modules ?? { qpcr: { enabled: true }, tier_prioritization: { enabled: true } }),
    privacy: {
      local_file_only: true,
      contains_normalized_input_records: Array.isArray(source.normalized_records),
      warning: "This project may contain sample identifiers and qPCR measurements. Store and share it according to the research data policy applicable to the study.",
    },
    source,
    result: snapshot,
  };
}

export function serializeProjectDocument(project) {
  validateProjectDocument(project);
  return `${JSON.stringify(project, null, 2)}\n`;
}

const MAX_PROJECT_CANDIDATES = 5000;
const MAX_PROJECT_ARTIFACTS = 100;

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Check a project file against the shape the application renders.
 *
 * A project is untrusted input: it is a plain JSON file the user may have
 * edited or received from someone else, and its contents are rendered and
 * re-exported. Escaping alone does not cover a `javascript:` artifact URL or a
 * goal value the scientific rules are not defined for, so both are rejected
 * here rather than deeper in the workflow.
 */
export function validateProjectDocument(project) {
  if (!plainObject(project)) throw new Error("The project file must contain one JSON object.");
  if (project.schema !== PROJECT_SCHEMA) throw new Error("This is not a Universal qPCR Analysis project file.");
  if (project.schema_version !== PROJECT_SCHEMA_VERSION) throw new Error(`Unsupported project schema version: ${project.schema_version ?? "missing"}.`);
  const result = project.result;
  if (!plainObject(result) || result.analysis_type !== "universal_qpcr") throw new Error("The project does not contain a universal qPCR result.");
  if (!Array.isArray(result.candidates) || result.candidates.length === 0) throw new Error("The project contains no preparation results.");
  if (result.candidates.length > MAX_PROJECT_CANDIDATES) throw new Error(`The project exceeds ${MAX_PROJECT_CANDIDATES} preparation results.`);
  for (const candidate of result.candidates) {
    if (!plainObject(candidate) || typeof candidate.preparation !== "string" || !candidate.preparation.trim()) {
      throw new Error("Every preparation result must be an object with a preparation name.");
    }
    if (!plainObject(candidate.tests) || !plainObject(candidate.tests.quantity_signed_rank)) {
      throw new Error(`Preparation ${candidate.preparation} has no quantity test result.`);
    }
  }
  if (!plainObject(result.assay) || typeof result.assay.target_name !== "string" || !result.assay.target_name.trim()) {
    throw new Error("The project is missing the assay target name.");
  }
  if (!ANALYSIS_GOALS.includes(result.assay.analysis_goal)) {
    throw new Error(`The project declares an unsupported analysis goal: ${result.assay.analysis_goal ?? "missing"}.`);
  }
  if (!plainObject(result.overview) || !Array.isArray(result.overview.timepoint_terms)) throw new Error("The project is missing its analysis overview.");
  if (result.artifacts !== undefined) {
    if (!Array.isArray(result.artifacts) || result.artifacts.length > MAX_PROJECT_ARTIFACTS) throw new Error("The project artifact list is not usable.");
    for (const artifact of result.artifacts) {
      if (!plainObject(artifact) || typeof artifact.path !== "string") throw new Error("Every project artifact must be an object with a path.");
      if (artifact.download_url !== undefined && !safeResourceUrl(artifact.download_url)) {
        throw new Error(`Project artifact ${artifact.path} uses an unsupported resource address.`);
      }
    }
  }
  if (result.modules !== undefined && !plainObject(result.modules)) throw new Error("The project module record is not usable.");
  if (project.source?.normalized_records && !Array.isArray(project.source.normalized_records)) throw new Error("Normalized project records must be an array.");
  return project;
}

export function parseProjectText(text) {
  const bytes = new TextEncoder().encode(String(text ?? "")).byteLength;
  if (bytes > MAX_PROJECT_BYTES) throw new Error("The project file exceeds the 25 MB local safety limit.");
  let project;
  try { project = JSON.parse(text); }
  catch { throw new Error("The selected project is not valid JSON."); }
  validateProjectDocument(project);
  const result = cloneJson(project.result);
  result.project_source = cloneJson(project.source ?? {});
  result.modules = cloneJson(project.modules ?? result.modules);
  result.software = cloneJson(project.software ?? result.software);
  result.project_restored = { restored_at: new Date().toISOString(), project_created_at: project.created_at ?? null };
  return { project, result };
}

export async function readProjectFile(file) {
  if (!file) throw new Error("Select a .qpcrproj file.");
  if (Number(file.size) > MAX_PROJECT_BYTES) throw new Error("The project file exceeds the 25 MB local safety limit.");
  return parseProjectText(await file.text());
}

export function downloadProjectDocument(project, targetName = "analysis") {
  const content = serializeProjectDocument(project);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(targetName)}${PROJECT_EXTENSION}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
