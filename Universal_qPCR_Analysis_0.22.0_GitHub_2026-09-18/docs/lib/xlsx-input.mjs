import { WorkbookValidationError } from "./workbook-validation.mjs";

const MAX_ENTRY_BYTES = 32 * 1024 * 1024;
const XML_DECODER = new TextDecoder("utf-8");

function decodeXml(value) {
  return String(value ?? "").replace(
    /&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi,
    (match, numeric, named) => {
      if (numeric) {
        const radix = numeric[0].toLowerCase() === "x" ? 16 : 10;
        const digits = radix === 16 ? numeric.slice(1) : numeric;
        return String.fromCodePoint(Number.parseInt(digits, radix));
      }
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[named.toLowerCase()];
    },
  );
}

function xmlAttribute(source, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(source).match(new RegExp(`(?:^|\\s)${escapedName}=(?:"([^"]*)"|'([^']*)')`, "i"));
  return decodeXml(match?.[1] ?? match?.[2] ?? "");
}

function textNodes(source) {
  return [...String(source).matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

function columnNumber(reference) {
  const letters = String(reference).match(/^([A-Z]+)/i)?.[1]?.toUpperCase() ?? "";
  return [...letters].reduce(
    (value, character) => (value * 26) + character.charCodeAt(0) - 64,
    0,
  );
}

function findCentralDirectoryEnd(view) {
  const earliestOffset = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= earliestOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new WorkbookValidationError(
    "INVALID_XLSX_STRUCTURE",
    "The file has no readable ZIP central directory.",
  );
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new WorkbookValidationError(
      "BROWSER_DECOMPRESSION_UNAVAILABLE",
      "This browser cannot decompress XLSX files locally. Use a current Chrome, Edge or Firefox release.",
    );
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (error) {
    throw new WorkbookValidationError(
      "INVALID_XLSX_STRUCTURE",
      "A compressed XLSX entry could not be decompressed.",
      { reason: error.message },
    );
  }
}

async function readZipEntries(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const centralDirectoryEnd = findCentralDirectoryEnd(view);
  const entryCount = view.getUint16(centralDirectoryEnd + 10, true);
  let offset = view.getUint32(centralDirectoryEnd + 16, true);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new WorkbookValidationError("INVALID_XLSX_STRUCTURE", "The XLSX central directory is damaged.");
    }

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const rawName = new Uint8Array(arrayBuffer, offset + 46, nameLength);
    const name = XML_DECODER.decode(rawName).replaceAll("\\", "/");

    if (uncompressedSize > MAX_ENTRY_BYTES) {
      throw new WorkbookValidationError("XLSX_ENTRY_TOO_LARGE", `The XLSX entry ${name} is too large for local analysis.`);
    }
    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new WorkbookValidationError("INVALID_XLSX_STRUCTURE", `The XLSX entry ${name} has no local header.`);
    }

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > arrayBuffer.byteLength) {
      throw new WorkbookValidationError("INVALID_XLSX_STRUCTURE", `The XLSX entry ${name} exceeds the archive boundary.`);
    }

    const compressed = new Uint8Array(arrayBuffer, dataOffset, compressedSize);
    let data;
    if (compressionMethod === 0) data = new Uint8Array(compressed);
    else if (compressionMethod === 8) data = await inflateRaw(compressed);
    else {
      throw new WorkbookValidationError(
        "UNSUPPORTED_XLSX_COMPRESSION",
        `The XLSX entry ${name} uses unsupported compression method ${compressionMethod}.`,
      );
    }

    entries.set(name.replace(/^\//, ""), data);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function resolveFirstWorksheet(entries) {
  const workbook = entries.get("xl/workbook.xml");
  const relationships = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbook || !relationships) {
    throw new WorkbookValidationError(
      "INVALID_XLSX_STRUCTURE",
      "Missing workbook.xml or workbook relationships.",
    );
  }

  const workbookXml = XML_DECODER.decode(workbook);
  const relationshipXml = XML_DECODER.decode(relationships);
  const firstSheet = workbookXml.match(/<sheet\b([^>]*)\/?\s*>/i);
  if (!firstSheet) {
    throw new WorkbookValidationError("INVALID_XLSX_STRUCTURE", "The workbook has no worksheet.");
  }

  const relationshipId = xmlAttribute(firstSheet[1], "r:id");
  const worksheetName = xmlAttribute(firstSheet[1], "name") || "first";
  const relation = [...relationshipXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi)]
    .find((match) => xmlAttribute(match[1], "Id") === relationshipId);
  if (!relation) {
    throw new WorkbookValidationError("INVALID_XLSX_STRUCTURE", "The first worksheet relationship is missing.");
  }

  const target = xmlAttribute(relation[1], "Target").replaceAll("\\", "/");
  const entryName = target.startsWith("/")
    ? target.slice(1)
    : target.startsWith("xl/") ? target : `xl/${target}`;
  const worksheet = entries.get(entryName);
  if (!worksheet) {
    throw new WorkbookValidationError("INVALID_XLSX_STRUCTURE", "The first worksheet XML is missing.");
  }
  return { xml: XML_DECODER.decode(worksheet), name: worksheetName };
}

function readSharedStrings(entries) {
  const entry = entries.get("xl/sharedStrings.xml");
  if (!entry) return [];
  const xml = XML_DECODER.decode(entry);
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)]
    .map((match) => textNodes(match[1]));
}

function cellValue(attributes, content, sharedStrings) {
  const type = xmlAttribute(attributes, "t");
  if (type === "inlineStr") return textNodes(content);
  const rawValue = content.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1];
  if (rawValue == null) return "";
  const value = decodeXml(rawValue);
  return type === "s" ? sharedStrings[Number(value)] ?? "" : value;
}

function parseWorksheetRows(xml, sharedStrings) {
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)]
    .map((rowMatch) => {
      const values = new Map();
      for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
        const reference = xmlAttribute(cellMatch[1], "r");
        const column = columnNumber(reference);
        if (column) values.set(column, cellValue(cellMatch[1], cellMatch[2] ?? "", sharedStrings));
      }
      const maximumColumn = Math.max(0, ...values.keys());
      return Array.from({ length: maximumColumn }, (_, index) => values.get(index + 1) ?? "");
    })
    .filter((row) => row.some((value) => value !== ""));
}

/** Read the first worksheet from an XLSX file without evaluating formulas. */
export async function readFirstXlsxWorksheet(arrayBuffer) {
  const entries = await readZipEntries(arrayBuffer);
  const worksheet = resolveFirstWorksheet(entries);
  return {
    rows: parseWorksheetRows(worksheet.xml, readSharedStrings(entries)),
    worksheet: worksheet.name,
  };
}
