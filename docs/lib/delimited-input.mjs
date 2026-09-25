import { WorkbookValidationError } from "./workbook-validation.mjs";

/** Parse RFC-4180-style rows while preserving empty fields and embedded delimiters. */
function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text).replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new WorkbookValidationError("INVALID_CSV_STRUCTURE", "The CSV contains an unclosed quoted field.");
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => String(value).trim() !== "")) rows.push(row);
  }
  return rows;
}

function selectDelimiter(text) {
  const candidates = [
    { delimiter: ",", name: "comma" },
    { delimiter: ";", name: "semicolon" },
    { delimiter: "\t", name: "tab" },
  ].map((candidate) => ({
    ...candidate,
    rows: parseDelimitedRows(text, candidate.delimiter),
  }));

  const selected = candidates.sort(
    (left, right) => (right.rows[0]?.length ?? 0) - (left.rows[0]?.length ?? 0),
  )[0];
  if (!selected.rows.length || (selected.rows[0]?.length ?? 0) < 2) {
    throw new WorkbookValidationError(
      "INVALID_CSV_STRUCTURE",
      "The CSV delimiter or header row could not be recognized.",
    );
  }
  return selected;
}

function decodeText(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "utf-16le" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "utf-16be" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "utf-8-bom" };
  }

  const sample = bytes.subarray(0, Math.min(bytes.length, 2048));
  const evenZeros = sample.filter((byte, index) => index % 2 === 0 && byte === 0).length;
  const oddZeros = sample.filter((byte, index) => index % 2 === 1 && byte === 0).length;
  if (sample.length >= 8 && oddZeros > sample.length * 0.2) {
    return { text: new TextDecoder("utf-16le").decode(bytes), encoding: "utf-16le-detected" };
  }
  if (sample.length >= 8 && evenZeros > sample.length * 0.2) {
    return { text: new TextDecoder("utf-16be").decode(bytes), encoding: "utf-16be-detected" };
  }

  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1250").decode(bytes), encoding: "windows-1250" };
  }
}

/** Decode a CSV/TSV buffer and report the detected delimiter and text encoding. */
export function readDelimitedTable(arrayBuffer) {
  const decoded = decodeText(new Uint8Array(arrayBuffer));
  const parsed = selectDelimiter(decoded.text);
  return {
    rows: parsed.rows,
    delimiter: parsed.name,
    encoding: decoded.encoding,
  };
}
