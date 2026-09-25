/**
 * Domain validation for tabular qPCR input.
 *
 * This module intentionally knows nothing about CSV, TSV or XLSX internals. It
 * receives a rectangular array of values and returns normalized qPCR rows plus
 * an audit record describing how the input was interpreted.
 */

const FIELD_DEFINITIONS = [
  { key: "preparation", canonical: "Preparat", required: true, aliases: ["preparat", "preparation", "preparation name", "treatment", "treatment name", "compound", "compound name"] },
  { key: "sex", canonical: "Płeć", required: false, aliases: ["płeć", "plec", "sex", "gender"] },
  { key: "well", canonical: "Well", required: false, aliases: ["well", "well position", "position"] },
  { key: "sample_name", canonical: "Sample Name", required: true, aliases: ["sample name", "sample", "sample id", "sample identifier"] },
  { key: "detector", canonical: "Detector", required: true, aliases: ["detector", "target", "target name", "assay", "assay name"] },
  { key: "task", canonical: "Task", required: false, defaultValue: "Unknown", aliases: ["task", "sample type", "well type"] },
  { key: "ct", canonical: "Ct", required: true, aliases: ["ct", "cq", "cp", "ct mean", "cq mean", "mean ct", "mean cq"] },
  { key: "stddev_ct", canonical: "StdDev Ct", required: false, aliases: ["stddev ct", "ct sd", "sd ct", "ct stddev", "std dev ct", "cq sd", "sd cq", "cq stddev", "std dev cq"] },
  { key: "qty", canonical: "Qty", required: true, aliases: ["qty", "quantity", "quantity mean", "mean quantity", "relative quantity"] },
];

export const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_DATA_ROWS = 100_000;

export class WorkbookValidationError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "WorkbookValidationError";
    this.code = code;
    this.details = details;
  }
}

function normalizePreparation(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A comma that groups thousands, e.g. "1,234" or "1,234,567". */
const THOUSANDS_GROUPED = /^[+-]?\d{1,3}(?:,\d{3})+$/;

/**
 * Decide, once per file, whether a comma marks decimals or groups thousands.
 *
 * "1,234" alone is genuinely ambiguous: 1234 with an English separator or
 * 1.234 with a Polish one. Reading it as the wrong one is a silent factor-1000
 * error, so the decision is taken from unambiguous evidence elsewhere in the
 * same file and never guessed per cell.
 */
export function detectDecimalMark(values) {
  let comma = false;
  for (const value of values) {
    const text = String(value ?? "").replace(/[\s\u00a0]/g, "");
    if (!text) continue;
    if (text.includes(".")) return ".";
    if (text.includes(",") && !THOUSANDS_GROUPED.test(text)) comma = true;
  }
  return comma ? "," : null;
}

/**
 * Normalize one numeric cell against the file-wide decimal mark.
 *
 * Returns `ambiguous` when the file offers no evidence and the value could be
 * read either way; such a value is rejected instead of silently guessed.
 */
export function normalizeNumericText(value, decimalMark) {
  const text = String(value ?? "").replace(/[\s\u00a0]/g, "");
  if (!text.includes(",")) return { text, ambiguous: false };
  const commas = (text.match(/,/g) ?? []).length;
  if (decimalMark === ".") return { text: text.replaceAll(",", ""), ambiguous: false };
  if (decimalMark === ",") {
    return commas > 1 ? { text, ambiguous: true } : { text: text.replace(",", "."), ambiguous: false };
  }
  if (text.includes(".")) return { text: text.replaceAll(",", ""), ambiguous: false };
  if (THOUSANDS_GROUPED.test(text) || commas > 1) return { text, ambiguous: true };
  return { text: text.replace(",", "."), ambiguous: false };
}

function nullableNumber(value, decimalMark = null) {
  const text = String(value ?? "").trim();
  if (!text || /^(?:NA|N\/A|NaN|Undetermined)$/i.test(text)) return null;
  const normalized = normalizeNumericText(text, decimalMark);
  if (normalized.ambiguous) return null;
  const parsed = Number(normalized.text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumericCell(value, field, rowNumber, decimalMark = null) {
  const text = String(value ?? "").trim();
  if (!text || /^(?:NA|N\/A|NaN|Undetermined|No\s*Ct)$/i.test(text)) {
    return { value: null, missing: true };
  }

  const normalized = normalizeNumericText(text, decimalMark);
  const parsed = normalized.ambiguous ? null : nullableNumber(text, decimalMark);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      value: null,
      invalid: true,
      issue: {
        row: rowNumber,
        field,
        value: text,
        reason: normalized.ambiguous ? "ambiguous_decimal_separator" : Number.isFinite(parsed) ? "negative" : "not_numeric",
      },
    };
  }
  return { value: parsed, missing: false };
}

function mapColumns(actualHeaders) {
  const normalizedHeaders = actualHeaders.map(normalizeHeader);
  const indices = {};
  const labels = {};
  const origins = {};
  const recognized = new Set();
  const missing = [];

  for (const definition of FIELD_DEFINITIONS) {
    const aliases = new Set(definition.aliases.map(normalizeHeader));
    const matches = normalizedHeaders
      .map((header, index) => aliases.has(header) ? index : -1)
      .filter((index) => index >= 0);

    if (matches.length > 1) {
      throw new WorkbookValidationError(
        "AMBIGUOUS_COLUMN_MAPPING",
        `More than one input column maps to ${definition.canonical}.`,
        { field: definition.key, matching_headers: matches.map((index) => actualHeaders[index]) },
      );
    }

    const index = matches[0] ?? null;
    indices[definition.key] = index;
    labels[definition.key] = index == null ? null : actualHeaders[index];
    origins[definition.key] = index == null
      ? (definition.defaultValue == null ? "missing_optional" : "default")
      : normalizedHeaders[index] === normalizeHeader(definition.canonical) ? "canonical" : "alias";

    if (index != null) recognized.add(index);
    else if (definition.required) missing.push({ field: definition.key, accepted_headers: definition.aliases });
  }

  if (missing.length) {
    throw new WorkbookValidationError(
      "MISSING_REQUIRED_COLUMNS",
      "The input is missing one or more required qPCR columns.",
      {
        required_fields: FIELD_DEFINITIONS.filter((definition) => definition.required).map((definition) => definition.key),
        actual_headers: actualHeaders,
        missing,
      },
    );
  }

  return {
    indices,
    labels,
    origins,
    mapping_mode: Object.values(origins).includes("alias") ? "aliases" : "canonical",
    defaulted_fields: FIELD_DEFINITIONS.filter((definition) => origins[definition.key] === "default").map((definition) => definition.key),
    missing_optional_fields: FIELD_DEFINITIONS.filter((definition) => origins[definition.key] === "missing_optional").map((definition) => definition.key),
    unmapped_headers: actualHeaders.filter((header, index) => header && !recognized.has(index)),
  };
}

/**
 * Resolve sex from the declared column first.
 *
 * The sample-name prefix is only a fallback for files without a Sex column.
 * It must never override a declared value: names such as "Mouse-7" or
 * "Field-3" start with M or F without saying anything about sex, and sex is
 * one of the pairing keys.
 */
export function resolveSex(sampleName, rawSex) {
  const declared = String(rawSex ?? "").trim();
  if (/^(?:1|M|male)$/i.test(declared)) return "male";
  if (/^(?:2|F|female)$/i.test(declared)) return "female";
  if (declared) return null;
  if (/^[Mm]/.test(String(sampleName ?? ""))) return "male";
  if (/^[Ff]/.test(String(sampleName ?? ""))) return "female";
  return null;
}

function warningCodes({ missingQtyValues, missingCtValues, zeroQtyValues, duplicateGroups, blankTaskRows, unmappedHeaders }) {
  return [
    missingQtyValues ? "missing_qty_values" : null,
    missingCtValues ? "missing_ct_values" : null,
    zeroQtyValues ? "zero_qty_values" : null,
    duplicateGroups.length ? "duplicate_observations" : null,
    blankTaskRows ? "blank_tasks_defaulted" : null,
    unmappedHeaders.length ? "unmapped_headers" : null,
  ].filter(Boolean);
}

/** Normalize and validate parsed worksheet rows without changing their order. */
export function buildValidatedRows(rows, term, filename, sourceFormat, formatDetails = {}) {
  if (rows.length < 2) {
    throw new WorkbookValidationError("NO_DATA_ROWS", "The first worksheet must contain a header and at least one data row.");
  }
  if (rows.length - 1 > MAX_DATA_ROWS) {
    throw new WorkbookValidationError("TOO_MANY_DATA_ROWS", `The input exceeds ${MAX_DATA_ROWS} data rows.`);
  }

  const actualHeaders = rows[0].map((value) => String(value).trim());
  const mapping = mapColumns(actualHeaders);
  const valueAt = (row, key) => {
    const definition = FIELD_DEFINITIONS.find((item) => item.key === key);
    const index = mapping.indices[key];
    return index == null ? definition?.defaultValue ?? "" : row[index] ?? "";
  };

  const numericIndices = ["ct", "stddev_ct", "qty"].map((key) => mapping.indices[key]).filter((index) => index != null);
  const decimalMark = detectDecimalMark(rows.slice(1).flatMap((row) => numericIndices.map((index) => row[index])));

  const normalizedRows = [];
  const identityIssues = [];
  const numericIssues = [];
  let blankTaskRows = 0;

  for (const [dataIndex, row] of rows.slice(1).entries()) {
    const rowNumber = dataIndex + 2;
    const preparation = normalizePreparation(valueAt(row, "preparation"));
    const sampleName = String(valueAt(row, "sample_name")).trim();

    if (!preparation || !sampleName) {
      identityIssues.push({
        row: rowNumber,
        missing_fields: [!preparation ? "preparation" : null, !sampleName ? "sample_name" : null].filter(Boolean),
      });
      continue;
    }

    const rawSex = String(valueAt(row, "sex"));
    const rawCt = String(valueAt(row, "ct"));
    const ct = parseNumericCell(rawCt, "ct", rowNumber, decimalMark);
    const standardDeviationCt = parseNumericCell(valueAt(row, "stddev_ct"), "stddev_ct", rowNumber, decimalMark);
    const quantity = parseNumericCell(valueAt(row, "qty"), "qty", rowNumber, decimalMark);
    for (const parsed of [ct, standardDeviationCt, quantity]) {
      if (parsed.invalid) numericIssues.push(parsed.issue);
    }

    const rawTask = String(valueAt(row, "task")).trim();
    const task = rawTask || "Unknown";
    if (!rawTask) blankTaskRows += 1;

    normalizedRows.push({
      term,
      source_file: filename,
      preparation,
      sex_raw: rawSex,
      sex: resolveSex(sampleName, rawSex),
      well: String(valueAt(row, "well")),
      sample_name: sampleName,
      detector: String(valueAt(row, "detector")).trim(),
      task,
      ct: ct.value,
      stddev_ct: standardDeviationCt.value,
      qty: quantity.value,
      ct_undetermined: /undetermined|no\s*ct/i.test(rawCt),
    });
  }

  if (identityIssues.length) {
    throw new WorkbookValidationError(
      "MISSING_ROW_IDENTITY",
      "One or more data rows have no preparation or sample identifier.",
      { issue_count: identityIssues.length, issues: identityIssues.slice(0, 20) },
    );
  }
  if (numericIssues.length) {
    throw new WorkbookValidationError(
      "INVALID_NUMERIC_VALUES",
      "One or more Ct/Cq, SD or Qty values are invalid.",
      { issue_count: numericIssues.length, issues: numericIssues.slice(0, 20) },
    );
  }
  if (!normalizedRows.length) {
    throw new WorkbookValidationError("NO_DATA_ROWS", "The input has no usable qPCR data rows.");
  }

  const detectorsByKey = new Map();
  for (const row of normalizedRows) {
    if (row.detector) {
      const key = row.detector.toLocaleLowerCase();
      detectorsByKey.set(key, detectorsByKey.get(key) ?? row.detector);
    }
  }
  const detectors = [...detectorsByKey.values()];
  const blankDetectorRows = normalizedRows.filter((row) => !row.detector).length;
  const invalidTasks = [...new Set(normalizedRows.map((row) => row.task).filter((task) => task.toLowerCase() !== "unknown"))];

  if (blankDetectorRows || detectors.length !== 1) {
    throw new WorkbookValidationError(
      "INVALID_DETECTOR",
      "Every row must use one common, non-empty Detector value.",
      { detectors, blank_detector_rows: blankDetectorRows },
    );
  }
  if (invalidTasks.length) {
    throw new WorkbookValidationError(
      "INVALID_TASK",
      "Local qPCR analysis accepts only Task=Unknown rows.",
      { invalid_tasks: invalidTasks },
    );
  }

  const observationCounts = new Map();
  for (const row of normalizedRows) {
    const key = JSON.stringify([row.preparation, row.sex ?? "", row.sample_name, row.detector.toLocaleLowerCase(), row.task.toLocaleLowerCase()]);
    observationCounts.set(key, (observationCounts.get(key) ?? 0) + 1);
  }

  const duplicateGroups = [...observationCounts.values()].filter((count) => count > 1);
  const missingQtyValues = normalizedRows.filter((row) => row.qty == null).length;
  const missingCtValues = normalizedRows.filter((row) => row.ct == null).length;
  const zeroQtyValues = normalizedRows.filter((row) => row.qty === 0).length;
  const warnings = warningCodes({
    missingQtyValues,
    missingCtValues,
    zeroQtyValues,
    duplicateGroups,
    blankTaskRows,
    unmappedHeaders: mapping.unmapped_headers,
  });

  return {
    rows: normalizedRows,
    validation: {
      source_format: sourceFormat,
      decimal_mark: decimalMark,
      headers: actualHeaders,
      column_mapping: mapping.labels,
      mapping_origins: mapping.origins,
      mapping_mode: mapping.mapping_mode,
      defaulted_fields: mapping.defaulted_fields,
      missing_optional_fields: mapping.missing_optional_fields,
      unmapped_headers: mapping.unmapped_headers,
      source_rows: rows.length - 1,
      data_rows: normalizedRows.length,
      detectors,
      tasks: ["Unknown"],
      blank_detector_rows: blankDetectorRows,
      blank_task_rows: blankTaskRows,
      missing_qty_values: missingQtyValues,
      missing_ct_values: missingCtValues,
      zero_qty_values: zeroQtyValues,
      duplicate_observation_groups: duplicateGroups.length,
      duplicate_observation_rows: duplicateGroups.reduce((sum, count) => sum + count, 0),
      warnings,
      ...formatDetails,
    },
  };
}

/** Ensure every selected timepoint represents the same assay target. */
export function validateCompatibleWorkbooks(workbooks) {
  const detectorsByKey = new Map();
  for (const detector of workbooks.flatMap((workbook) => workbook.validation.detectors)) {
    const key = detector.toLocaleLowerCase();
    detectorsByKey.set(key, detectorsByKey.get(key) ?? detector);
  }
  const detectors = [...detectorsByKey.values()];
  if (detectors.length !== 1) {
    throw new WorkbookValidationError(
      "INCOMPATIBLE_DETECTORS",
      "All timepoints must use the same Detector value.",
      { detectors },
    );
  }
  return {
    detector: detectors[0],
    data_rows: workbooks.reduce((sum, workbook) => sum + workbook.rows.length, 0),
  };
}
