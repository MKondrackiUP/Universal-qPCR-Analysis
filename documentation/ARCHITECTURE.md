# Application architecture

Universal qPCR Analysis is a static, local-first browser application. qPCR files
and generated reports remain in browser memory; the deployment server only
serves public application assets.

## Dependency flow

```text
index.html
  └─ app.js                       browser orchestration and event handlers
      ├─ ui-elements.js           explicit DOM contract
      ├─ ui-helpers.js            pure presentation helpers
      ├─ validation-feedback.js   DOM-neutral validation messages
      ├─ xlsx-reader.js           public input facade
      │   ├─ lib/delimited-input.mjs
      │   ├─ lib/xlsx-input.mjs
      │   └─ lib/workbook-validation.mjs
      ├─ local-analysis.js        workflow and result assembly
      │   └─ lib/scientific-engine.mjs
      ├─ local-report.js          local report/download orchestration
      │   ├─ lib/generic-report-model.mjs
      │   └─ lib/docx.mjs
      └─ project-file.js          local project persistence
```

## Module boundaries

- Format readers convert bytes into rectangular tables. They do not decide
  scientific meaning.
- `workbook-validation.mjs` owns header mapping, normalized qPCR records,
  stable validation codes and import-quality warnings for every supported
  format.
- `scientific-engine.mjs` is deterministic and has no DOM, filesystem or HTTP
  dependencies. Pairing, effect estimates, Wilcoxon tests, FDR and Tier rules
  must remain here.
- `local-analysis.js` coordinates validated records and assembles application
  results; it must not maintain a second implementation of a scientific rule.
- UI modules may format or localize results but must not alter calculated
  values or Tier decisions.
- Report modules consume the same result object shown in the browser, so the
  on-screen result and DOCX share one calculation source.

## Change rules

1. A refactor must preserve all synthetic-oracle results and stable validation
   codes.
2. An intentional scientific change requires a scientific-engine version bump,
   an independently calculated fixture and updated rule documentation.
3. New input formats should implement byte-to-table parsing and then call the
   shared workbook validator.
4. User-visible text belongs in `i18n.js`; user-provided values inserted into
   HTML must pass through `escapeHtml`.
5. Generated fragments must not carry an inline `style` attribute: the deployed
   Content-Security-Policy drops it. Declare geometry in `data-style` and pass
   the container to `applyDeclaredStyles` after insertion.
6. Browser event callbacks should be named workflow functions. Registration is
   kept together at the end of `app.js`.

## Verification layers

- `tests/input-formats.test.mjs`: format and validation contract;
- `tests/synthetic-validation.test.mjs`: calculation regression contract;
- `tests/ui-modules.test.mjs`: presentation, validation messages and CSP safety;
- `tests/input-normalization.test.mjs`: decimal-separator and sex-resolution contract;
- `tests/server.test.mjs`: deployment and privacy boundary;
- manual browser smoke test: CSV/XLSX analysis, Tier visibility, report download,
  localization and responsive layout.
