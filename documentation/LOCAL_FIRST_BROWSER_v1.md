# Local-first browser execution v1

**Application release:** `0.22.0`
**Scientific engine:** `universal-qpcr-scientific-engine` 1.0.0  
**Scope:** complete T0–T4 qPCR and RT-qPCR browser workflow

## Privacy contract

For every supported contiguous input from T0/T1 through T0–T4, the user-interface path:

1. reads every selected XLSX, CSV or TSV file through `docs/xlsx-reader.js`;
2. maps validated Polish/English column aliases, requires explicit Qty/Quantity, and validates the common target plus `Task=Unknown` locally;
3. holds normalized records only in browser-tab memory;
4. executes `docs/lib/scientific-engine.mjs` in the browser;
5. calculates the prespecified T1/T0 Tier result plus every baseline and adjacent contrast;
6. classifies all preparation trajectories and creates the result tables, integrity audit and two downloadable SVG figures locally;
7. builds the complete seven-part OOXML DOCX report in browser memory and downloads it through a temporary object URL;
8. does not call `POST /api/analyze`;
9. does not create a run directory and does not store input-file or report contents on the server.

Delimited-input detection covers comma, semicolon and tab plus UTF-8, UTF-16 LE/BE and Windows-1250. Quoted CSV, decimal commas, shared-string XLSX and inline-string XLSX are supported. Ambiguous aliases, missing identities, negative or malformed numeric values, invalid Task values and mixed Detectors are rejected with stable codes, file/timepoint context, row details and localized corrective guidance. Missing Ct/Qty, zero Qty, repeated observations, blank Task defaults and ignored headers are reported explicitly in the UI and DOCX.

An optional `candidate-evidence-template.csv` profile is read and validated in the same browser memory. A user profile replaces the built-in evidence rows instead of merging with them; preparations omitted from the user CSV remain explicitly unprofiled and receive the configured Tier 4 missing-profile rule unless the overriding goal-opposed Tier 5 rule applies.

Closing or reloading the tab discards the in-memory result.

## Compatibility boundary

The browser UI has no server compatibility branch. `POST /api/analyze` remains available only as an explicit automation and reproducibility interface for external callers; the application interface does not invoke it.

## Regression verification

The repository test suite verifies the synthetic mathematical oracle in CSV and XLSX, extended text encodings and delimiters, inline and shared XLSX strings, file safety limits, schema and numeric failures, cross-timepoint Detector compatibility, server security headers and repository neutrality. Scientific fixtures are explicitly synthetic and cannot be used as biological evidence.

The interactive browser verification checks selected-file readiness, a successful two-file XLSX run, visible import-quality cards, localized invalid-number guidance, Polish/English switching and mobile-width overflow. Release 0.22.0 keeps Tier as a separate optional module and does not change the qPCR effect, Wilcoxon or FDR algorithms. It removes the unreachable server report path, so the interface contains no outbound call at all.
