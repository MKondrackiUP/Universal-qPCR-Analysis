import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { analyzeWorkbooksLocally } from "../docs/local-analysis.js";
import { WorkbookValidationError, assertCompatibleWorkbooks, readQpcrInput } from "../docs/xlsx-reader.js";

const root = path.resolve(import.meta.dirname, "..");
const fixtures = path.join(root, "docs", "examples", "synthetic-qpcr-validation");
const utf8 = (text) => new TextEncoder().encode(text);

function utf16Le(text, bom = true) {
  const body = Buffer.from(text, "utf16le");
  return bom ? Buffer.concat([Buffer.from([0xff, 0xfe]), body]) : body;
}

function utf16Be(text, bom = true) {
  const body = Buffer.from(text, "utf16le");
  body.swap16();
  return bom ? Buffer.concat([Buffer.from([0xfe, 0xff]), body]) : body;
}

function windows1250(text) {
  const special = new Map([["Ł", 0xa3], ["ą", 0xb9]]);
  return Uint8Array.from([...text].map((character) => special.get(character) ?? character.codePointAt(0)));
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(value, "utf8");
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, nameBytes);
    localOffset += local.length + nameBytes.length + data.length;
  }
  const localData = Buffer.concat(localParts);
  const centralData = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(localData.length, 16);
  return Buffer.concat([localData, centralData, end]);
}

function inlineXlsx() {
  const row = (number, cells) => `<row r="${number}">${cells.map(([reference, type, value]) => type === "s" ? `<c r="${reference}" t="inlineStr"><is><t>${value}</t></is></c>` : `<c r="${reference}"><v>${value}</v></c>`).join("")}</row>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${row(1, [["A1", "s", "Preparation"], ["B1", "s", "Sample ID"], ["C1", "s", "Target"], ["D1", "s", "Cq"], ["E1", "s", "Quantity"]])}${row(2, [["A2", "s", "Inline control"], ["B2", "s", "S1"], ["C2", "s", "Target A"], ["D2", "n", "24.5"], ["E2", "n", "100"]])}</sheetData></worksheet>`;
  return storedZip({
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Instrument export" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": sheet,
  });
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof WorkbookValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

test("comma CSV supports quoted delimiters, escaped quotes and CRLF", async () => {
  const text = "Preparation,Sample ID,Target,Sample Type,Cq,Quantity,Operator note\r\n\"Compound, \"\"A\"\"\",S1,Target A,Unknown,24.2,100,ignored\r\n";
  const workbook = await readQpcrInput(utf8(text), "T0", "quoted.CSV");
  assert.equal(workbook.rows[0].preparation, "Compound, \"A\"");
  assert.equal(workbook.validation.delimiter, "comma");
  assert.equal(workbook.validation.encoding, "utf-8");
  assert.deepEqual(workbook.validation.unmapped_headers, ["Operator note"]);
});

test("semicolon UTF-8 BOM CSV supports Polish aliases and decimal commas", async () => {
  const text = "\ufeffPreparat;Próbka;Cel;Cq;Ilość\nPreparat A;S1;Cel 1;24,1;100,5\n".replace("Próbka", "Sample").replace("Cel", "Target").replace("Ilość", "Quantity");
  const workbook = await readQpcrInput(utf8(text), "T0", "polish.csv");
  assert.equal(workbook.validation.delimiter, "semicolon");
  assert.equal(workbook.validation.encoding, "utf-8-bom");
  assert.equal(workbook.rows[0].ct, 24.1);
  assert.equal(workbook.rows[0].qty, 100.5);
});

test("tab-separated UTF-16 LE and BE files are detected", async () => {
  const text = "Treatment\tSample\tAssay\tCp\tRelative Quantity\nPreparation A\tS1\tTarget 1\t24.1\t100\n";
  const le = await readQpcrInput(utf16Le(text), "T0", "export.tsv");
  const be = await readQpcrInput(utf16Be(text), "T1", "export.TSV");
  assert.equal(le.validation.source_format, "tsv");
  assert.equal(le.validation.encoding, "utf-16le");
  assert.equal(be.validation.encoding, "utf-16be");
  assert.equal(le.validation.delimiter, "tab");
  assert.equal(be.rows[0].qty, 100);
});

test("UTF-16 without BOM and Windows-1250 exports are detected", async () => {
  const text = "Preparation;Sample;Target;Cq;Quantity\nPreparation A;S1;Target 1;24;100\n";
  const utf16 = await readQpcrInput(utf16Le(text, false), "T0", "utf16.csv");
  assert.equal(utf16.validation.encoding, "utf-16le-detected");
  const legacy = await readQpcrInput(windows1250("Preparation;Sample;Target;Cq;Quantity\nŁąka;S1;Target 1;24;100\n"), "T0", "legacy.csv");
  assert.equal(legacy.validation.encoding, "windows-1250");
  assert.equal(legacy.rows[0].preparation, "Łąka");
});

test("inline-string XLSX and ordinary shared-string XLSX are supported", async () => {
  const inline = await readQpcrInput(inlineXlsx(), "T0", "inline.xlsx");
  assert.equal(inline.validation.worksheet, "Instrument export");
  assert.equal(inline.rows[0].preparation, "Inline control");
  assert.equal(inline.rows[0].ct, 24.5);
  const shared = await readQpcrInput(await readFile(path.join(fixtures, "01_clear_directions_T0.xlsx")), "T0", "shared.xlsx");
  assert.ok(shared.validation.worksheet);
  assert.equal(shared.validation.data_rows, 12);
});

test("missing values, zero Qty, blank Task and duplicate observations are explicit warnings", async () => {
  const text = "Preparation,Sample,Target,Task,Cq,Quantity\nA,S1,Target 1,,Undetermined,0\nA,S1,Target 1,,NA,0\nA,S2,Target 1,Unknown,25,\n";
  const workbook = await readQpcrInput(utf8(text), "T0", "warnings.csv");
  assert.equal(workbook.validation.blank_task_rows, 2);
  assert.equal(workbook.validation.missing_ct_values, 2);
  assert.equal(workbook.validation.missing_qty_values, 1);
  assert.equal(workbook.validation.zero_qty_values, 2);
  assert.equal(workbook.validation.duplicate_observation_groups, 1);
  assert.equal(workbook.validation.duplicate_observation_rows, 2);
  assert.deepEqual(new Set(workbook.validation.warnings), new Set(["missing_qty_values", "missing_ct_values", "zero_qty_values", "duplicate_observations", "blank_tasks_defaulted"]));
  assert.ok(workbook.rows.every((row) => row.task === "Unknown"));
});

test("detector comparison is case-insensitive but rejects different targets", async () => {
  const make = (target) => readQpcrInput(utf8(`Preparation,Sample,Target,Cq,Quantity\nA,S1,${target},24,100\n`), "T0", `${target}.csv`);
  const [upper, lower, other] = await Promise.all([make("Target A"), make("target a"), make("Target B")]);
  assert.equal(assertCompatibleWorkbooks([upper, lower]).detector, "Target A");
  assert.throws(() => assertCompatibleWorkbooks([upper, other]), (error) => error.code === "INCOMPATIBLE_DETECTORS");
});

test("invalid schemas and malformed delimited files return stable error codes", async () => {
  await expectCode(readQpcrInput(utf8("Preparation,Sample,Target,Cq,Ct,Quantity\nA,S1,T,24,24,100\n"), "T0", "ambiguous.csv"), "AMBIGUOUS_COLUMN_MAPPING");
  await expectCode(readQpcrInput(utf8("Preparation,Sample,Target,Cq\nA,S1,T,24\n"), "T0", "missing.csv"), "MISSING_REQUIRED_COLUMNS");
  await expectCode(readQpcrInput(utf8("Preparation,Sample,Target,Cq,Quantity\n\"A,S1,T,24,100\n"), "T0", "quote.csv"), "INVALID_CSV_STRUCTURE");
  await expectCode(readQpcrInput(utf8("Preparation,Sample,Target,Cq,Quantity\n"), "T0", "empty-data.csv"), "NO_DATA_ROWS");
});

test("invalid identities, numeric values, tasks and detectors are rejected", async () => {
  await expectCode(readQpcrInput(utf8("Preparation,Sample,Target,Cq,Quantity\n,S1,T,24,100\n"), "T0", "identity.csv"), "MISSING_ROW_IDENTITY");
  await expectCode(readQpcrInput(utf8("Preparation,Sample,Target,Cq,Quantity\nA,S1,T,wrong,100\n"), "T0", "numeric.csv"), "INVALID_NUMERIC_VALUES");
  await expectCode(readQpcrInput(utf8("Preparation,Sample,Target,Cq,Quantity\nA,S1,T,24,-1\n"), "T0", "negative.csv"), "INVALID_NUMERIC_VALUES");
  await expectCode(readQpcrInput(utf8("Preparation,Sample,Target,Task,Cq,Quantity\nA,S1,T,NTC,24,100\n"), "T0", "task.csv"), "INVALID_TASK");
  await expectCode(readQpcrInput(utf8("Preparation,Sample,Target,Cq,Quantity\nA,S1,T1,24,100\nA,S2,T2,25,90\n"), "T0", "detector.csv"), "INVALID_DETECTOR");
});

test("empty, oversized, unsupported and damaged files are rejected before analysis", async () => {
  await expectCode(readQpcrInput(new Uint8Array(), "T0", "empty.csv"), "EMPTY_FILE");
  await expectCode(readQpcrInput(new Uint8Array((5 * 1024 * 1024) + 1), "T0", "large.csv"), "FILE_TOO_LARGE");
  await expectCode(readQpcrInput(utf8("data"), "T0", "legacy.xls"), "UNSUPPORTED_FILE_TYPE");
  await expectCode(readQpcrInput(utf8("not a zip"), "T0", "damaged.xlsx"), "INVALID_XLSX_STRUCTURE");
});

test("local workflow attaches filename and timepoint to validation errors", async () => {
  const invalid = utf8("Preparation,Sample,Target,Cq,Quantity\nA,S1,T,wrong,100\n");
  const valid = utf8("Preparation,Sample,Target,Cq,Quantity\nA,S1,T,24,100\n");
  const file = (name, bytes) => ({ name, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  await assert.rejects(() => analyzeWorkbooksLocally({
    selections: [{ term: "T0", file: file("invalid-T0.csv", invalid), timeValue: 0 }, { term: "T1", file: file("valid-T1.csv", valid), timeValue: 1 }],
    assay: { technology: "qpcr", target_category: "other", target_name: "Test", analysis_goal: "decrease", host_species: null },
    timeUnit: "relative",
    profile: {},
    tierEnabled: false,
  }), (error) => {
    assert.equal(error.code, "INVALID_NUMERIC_VALUES");
    assert.equal(error.details.filename, "invalid-T0.csv");
    assert.equal(error.details.term, "T0");
    return true;
  });
});
