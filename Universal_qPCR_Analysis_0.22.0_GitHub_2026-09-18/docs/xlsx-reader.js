import { readDelimitedTable } from "./lib/delimited-input.mjs";
import {
  MAX_INPUT_BYTES,
  WorkbookValidationError,
  buildValidatedRows,
  validateCompatibleWorkbooks,
} from "./lib/workbook-validation.mjs";
import { readFirstXlsxWorksheet } from "./lib/xlsx-input.mjs";

export { WorkbookValidationError };

async function toArrayBuffer(input) {
  if (input instanceof ArrayBuffer) return input;
  if (ArrayBuffer.isView(input)) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  }
  return input.arrayBuffer();
}

function extensionOf(filename) {
  return filename.includes(".") ? filename.split(".").at(-1).toLowerCase() : null;
}

/**
 * Public input boundary used by the local analysis workflow.
 *
 * Format-specific readers only produce table rows. All scientific input rules
 * are applied afterwards by buildValidatedRows, so CSV/TSV and XLSX follow the
 * same validation contract.
 */
export async function readQpcrInput(input, term, filename = "input.xlsx") {
  const arrayBuffer = await toArrayBuffer(input);
  if (!arrayBuffer.byteLength) {
    throw new WorkbookValidationError("EMPTY_FILE", `${filename} is empty.`);
  }
  if (arrayBuffer.byteLength > MAX_INPUT_BYTES) {
    throw new WorkbookValidationError("FILE_TOO_LARGE", `${filename} exceeds the 5 MB limit.`);
  }

  const extension = extensionOf(filename);
  if (extension === "csv" || extension === "tsv") {
    const table = readDelimitedTable(arrayBuffer);
    return buildValidatedRows(
      table.rows,
      term,
      filename,
      extension,
      { delimiter: table.delimiter, encoding: table.encoding },
    );
  }

  if (extension !== "xlsx") {
    throw new WorkbookValidationError(
      "UNSUPPORTED_FILE_TYPE",
      "Use an XLSX, CSV or TSV input file.",
      { filename, extension },
    );
  }

  const worksheet = await readFirstXlsxWorksheet(arrayBuffer);
  return buildValidatedRows(
    worksheet.rows,
    term,
    filename,
    "xlsx",
    { worksheet: worksheet.worksheet },
  );
}

/** Backward-compatible alias retained for existing integrations. */
export async function readQpcrWorkbook(input, term, filename = "workbook.xlsx") {
  return readQpcrInput(input, term, filename);
}

export function assertCompatibleWorkbooks(workbooks) {
  return validateCompatibleWorkbooks(workbooks);
}
