import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { applyDeclaredStyles, collectApplicationElements } from "../docs/ui-elements.js";
import {
  assessmentTone,
  displayedAlignment,
  escapeHtml,
  finiteNumber,
  hasBalancedMixedDirections,
  parseStyleDeclarations,
  tierNumber,
} from "../docs/ui-helpers.js";
import { localizedErrorMessage, validationErrorViewModel } from "../docs/validation-feedback.js";

test("UI helpers keep escaping, numeric and Tier presentation deterministic", () => {
  assert.equal(escapeHtml('<script data-x="1">&</script>'), "&lt;script data-x=&quot;1&quot;&gt;&amp;&lt;/script&gt;");
  assert.equal(finiteNumber("1.25"), 1.25);
  assert.equal(finiteNumber(""), null);
  assert.equal(finiteNumber("not-a-number"), null);
  assert.equal(tierNumber({ tier: "Tier 2" }), 2);
  assert.equal(tierNumber({ tier: "unexpected" }), 4);
  assert.equal(assessmentTone("confirmed_supportive"), "supportive");
  assert.equal(assessmentTone("confirmed_contradictory"), "contradictory");
  assert.equal(assessmentTone("descriptive_only"), "descriptive");
});

test("balanced mixed directions remain uncertain in the presentation layer", () => {
  const candidate = {
    complete_quantity_pairs: 6,
    decreased_pairs: 3,
    increased_pairs: 3,
    goal_alignment: "supportive",
  };
  assert.equal(hasBalancedMixedDirections(candidate), true);
  assert.equal(displayedAlignment(candidate), "uncertain");
  assert.equal(displayedAlignment({ ...candidate, increased_pairs: 2 }), "supportive");
});

test("validation feedback creates a DOM-neutral localized view model", () => {
  const translate = (key, parameters = {}, fallback) => {
    if (fallback !== undefined) return fallback;
    if (key === "error.detail.row") return `row ${parameters.row}: ${parameters.fields}`;
    if (key === "error.detail.value") return `value ${parameters.value}`;
    if (key.startsWith("input.field.")) return key.slice("input.field.".length);
    return key;
  };
  const error = Object.assign(new Error("Invalid numeric input"), {
    code: "INVALID_NUMERIC_VALUES",
    details: {
      term: "T1",
      filename: "invalid.csv",
      issues: [{ row: 4, field: "qty", value: "wrong" }],
    },
  });

  assert.equal(localizedErrorMessage(error, translate), "Invalid numeric input");
  assert.deepEqual(validationErrorViewModel(error, translate), {
    titleKey: "error.validationTitle",
    code: "INVALID_NUMERIC_VALUES",
    message: "Invalid numeric input",
    context: "T1 · invalid.csv",
    items: ["row 4: qty · value wrong"],
    hint: "",
    term: "T1",
  });
});

test("DOM collection reports the first missing application element", () => {
  const emptyDocument = { querySelector: () => null, querySelectorAll: () => [] };
  assert.throws(
    () => collectApplicationElements(emptyDocument),
    /Application element not found: #new-project-button/,
  );
});

function styledElement(declaration) {
  const applied = new Map();
  return {
    applied,
    removed: [],
    dataset: { style: declaration },
    style: { setProperty: (property, value) => applied.set(property, value) },
    removeAttribute(name) { this.removed.push(name); },
  };
}

test("style declarations are parsed into property and value pairs", () => {
  assert.deepEqual(parseStyleDeclarations("left:12.50%;width:31.00%"), [["left", "12.50%"], ["width", "31.00%"]]);
  assert.deepEqual(parseStyleDeclarations("--zero:48.00%"), [["--zero", "48.00%"]]);
  assert.deepEqual(parseStyleDeclarations("left:0%;"), [["left", "0%"]]);
  assert.deepEqual(parseStyleDeclarations("broken"), []);
  assert.deepEqual(parseStyleDeclarations(""), []);
  assert.deepEqual(parseStyleDeclarations(null), []);
});

test("declared geometry reaches the element through the CSSOM", () => {
  const element = styledElement("left:10.00%;width:25.00%");
  applyDeclaredStyles({ querySelectorAll: () => [element] });
  assert.deepEqual([...element.applied], [["left", "10.00%"], ["width", "25.00%"]]);
  assert.deepEqual(element.removed, ["data-style"]);
  assert.equal(applyDeclaredStyles(null), null);
});

test("no shipped file relies on an inline style attribute", async () => {
  // `style-src 'self'` without `'unsafe-inline'` makes the browser drop inline
  // style attributes, which silently collapses every generated bar to zero
  // width. Geometry must go through `data-style` and `applyDeclaredStyles`.
  const root = path.resolve(import.meta.dirname, "..", "docs");
  const extensions = new Set([".js", ".mjs", ".html"]);
  const offenders = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
        const text = await readFile(full, "utf8");
        if (/(?<!data-)style="/.test(text)) offenders.push(path.relative(root, full));
      }
    }
  };
  await walk(root);
  assert.deepEqual(offenders, []);
});

test("every module that declares geometry also applies it", async () => {
  const root = path.resolve(import.meta.dirname, "..", "docs");
  const source = await readFile(path.join(root, "app.js"), "utf8");
  const declared = (source.match(/data-style="/g) ?? []).length;
  const applied = (source.match(/applyDeclaredStyles\(/g) ?? []).length;
  assert.ok(declared > 0, "the application should still render declared geometry");
  assert.ok(applied > 0, "declared geometry must be applied through the CSSOM");
});
