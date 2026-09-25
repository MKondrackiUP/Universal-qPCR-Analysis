# Packaging revision 2026-09-18 (application 0.22.0)

Custom free-use licence with scientific citation condition; cleaned citation metadata;
Polish API and GitHub guides; executable integration example. Scientific calculations unchanged.
Removed placeholder Zenodo metadata; configure the custom licence when archiving.

# Changelog

All notable public changes are documented here. Versions follow Semantic Versioning while the scientific calculation contract is described separately in `documentation/SCIENTIFIC_ENGINE_v1.md`.

## [0.22.0] - 2026-09-01

### Added

- The frozen comparison table used by the screening reconstruction can be
  supplied with the analysis as a CSV, next to the evidence profile. Until now a
  user profile silently discarded the benchmark, because the built-in table
  describes the built-in preparations; a study can now carry its own profile and
  its own benchmark without either being shipped in the distribution. The run
  records which benchmark it used in `result.screening_reference`.
- `validation/verify-release.mjs`, an end-to-end verification reproducible from
  this repository alone: both demonstrations, DOCX generation, the project-file
  round trip, a full T0–T4 run and version consistency. Available as
  `npm run verify:release` and executed by continuous integration.
- `validation/verify-study-case.mjs`, the same kind of verification for a
  dataset that lives elsewhere. It holds no data and no expected value; both
  come from a case file, so study material can travel with its article.
- `docs/screening-reference-template.csv`.

### Changed

- No calculation changed. The scientific engine stays at 1.0.0 and every
  synthetic oracle result is unchanged.

## [0.21.2] - 2026-09-01

This release collects the outcome of a full audit of the application. The
scientific engine stays at 1.0.0 and no calculation was changed, so results
produced with 0.21.1 remain valid. Behaviour does change where the previous
behaviour was wrong: a value such as "1,234" that used to be read silently as
1.234 is now resolved from the file or rejected, a declared Sex column is no
longer overridden by the sample name, and a run without a user-supplied
evidence profile is scored against a synthetic example rather than a
study-specific table.

### Fixed

- Restored effect and evidence chart rendering under the deployed
  Content-Security-Policy. Generated geometry moved from inline `style`
  attributes, which `style-src 'self'` silently drops, to `data-style`
  declarations applied through the CSSOM. The self-hosted and container
  deployments previously showed every bar collapsed to zero width.
- Stopped reading an English thousands separator as a Polish decimal comma.
  The decimal mark is now decided once per file from unambiguous evidence;
  a value that remains undecidable is rejected as `INVALID_NUMERIC_VALUES`
  with reason `ambiguous_decimal_separator` instead of being silently
  misread by a factor of 1000.
- Gave a declared Sex column precedence over the sample-name prefix. Names
  such as "Mouse-7" or "Field-3" no longer override the recorded sex, which
  is one of the pairing keys.
- Corrected documentation references to the calculation regression suite,
  which is `tests/synthetic-validation.test.mjs`.

### Added

- `result.effect_scaling` and a results section reporting the Qty offset and the
  sample standard deviation of preparation medians that the run used, with the
  caveat that both are derived from the submitted set. Scaled effects,
  integrated scores and Tier are comparable within one run, not between runs.
  The two numbers also appear in the DOCX and JSON reports.
- `documentation/LIMITATIONS.md`, summarized in the README: no reference-gene
  normalization, no amplification-efficiency correction, replicate averaging in
  two scales, "Undetermined" treated as missing, and dataset dependence.
- `validation/`, an optional comparison of the Wilcoxon signed-rank
  implementation against `scipy.stats.wilcoxon`. SciPy remains outside the
  dependency set and the comparison is not part of `npm run verify`.

### Removed

- `docs/openapi.yaml` and its header link. The specification described
  /api/health, /api/analyze and /api/runs, none of which this repository
  implements.
- The unreachable server report path in `app.js`. The report is always built in
  browser memory, `generate_url` no longer appears in results, and a test
  asserts the orchestrator makes no outbound call.

### Changed

- The integrated score reports `score_model: "unweighted_additive_evidence_tally"`
  instead of claiming multi-criteria decision analysis. All component weights
  are 1.0 and no weight elicitation or sensitivity analysis is performed. The
  calculated values are unchanged.

### Verification

- Preserved all synthetic-oracle qPCR, Wilcoxon, FDR and Tier results.
- Added regression coverage for decimal-separator resolution, sex resolution,
  CSSOM style application, the absence of inline style attributes, the disclosed
  offset and effect scale, the single-preparation case, translation-key parity
  and the absence of outbound calls.
- Scientific engine remains 1.0.0; no calculation changed in this entry.

### Security

- A project file is now validated against the shape the application renders:
  candidate objects, the analysis goal and artifact addresses are all checked.
  Artifact and figure URLs must use a locally generated scheme, so an edited
  `.qpcrproj` can no longer place a `javascript:` address in a link or image.
- An unsupported `analysis_goal` is rejected instead of making every direction
  look opposed, which silently drove a whole set to the Tier 5 override.

### Changed

- The bundled Tier evidence profile is now a synthetic example naming only the
  demonstration preparations. It shows the score ranges and the Tier rules,
  carries no pharmacological meaning, and must be replaced with a
  study-specific profile before Tier is interpreted. Its identifier is
  `synthetic-example-evidence-profile-v1`.
- A user-supplied evidence profile is read through the shared delimited
  decoder, so semicolon-separated exports from a Polish Excel are accepted
  instead of failing with a misleading "missing columns" error.
- A run with Tier prioritization disabled no longer exports tier,
  tier_decision, integrated scores, tier counts, the Tier policy or the ranking
  into the JSON report and the project file.
- A contrast computed without a Tier specification reports `tier: null` instead
  of a fabricated "Tier 4".
- The container base image is a build argument, so a published build can be
  pinned to a digest without editing the Dockerfile.
- README is now English, with the Polish text in `README.pl.md`.

### Added

- `CODE_OF_CONDUCT.md`, `.zenodo.json`, a tagged release workflow that refuses
  to publish while citation metadata still contains placeholders, and
  `CITATION.cff` fields for ORCID, affiliation, repository and DOI.
- `docs/examples/synthetic-example-project.qpcrproj`, a loadable example of the
  project file format built from synthetic measurements.
- Continuous integration now runs on Node 20 and 22, starts the built
  container and checks that `/healthz` reports the version in `package.json`.

## [0.21.1] - 2026-08-21

### Changed

- Split byte-level CSV/TSV decoding, XLSX archive/XML reading and qPCR domain validation into separate modules behind the unchanged `xlsx-reader.js` public facade.
- Moved DOM lookup, pure UI helpers and validation-message construction out of the application orchestrator.
- Replaced large anonymous browser callbacks with named project, analysis, reporting and localization workflows.
- Preserved the completed-run state and generated report when switching between Polish and English.
- Added an architecture map and corrected the scientific-engine documentation to the current browser implementation.

### Verification

- Preserved all synthetic-oracle qPCR, Wilcoxon, FDR and Tier results.
- Added unit coverage for HTML escaping, numeric/Tier presentation, balanced-direction display and localized validation view models.

## [0.21.0] - 2026-08-21

### Added

- Automated coverage for comma, semicolon and tab-delimited inputs; UTF-8, UTF-16 LE/BE and Windows-1250; quoted CSV; shared-string and inline-string XLSX.
- Stable validation codes for empty, oversized, malformed and unsupported files, missing columns or identifiers, ambiguous aliases, invalid numeric values, Task and Detector mismatches.
- Visible file readiness, import-quality badges, localized row-level errors and corrective hints in Polish and English.
- Input encoding, worksheet and validation warnings in the preparation-level DOCX report.

### Changed

- Negative Ct/Cq, SD and Qty values and unrecognized numeric text now stop analysis instead of becoming silent missing values.
- Missing Ct/Cq or Qty, zero Qty, repeated observations and blank Task defaults remain admissible but are reported explicitly.
- Detector matching across timepoints is case-insensitive while different targets remain rejected.

## [0.20.3] - 2026-08-16

### Added

- Three deterministic synthetic qPCR validation panels in CSV and XLSX.
- A machine-readable oracle for expected offset, effect, W, p, q and assessment values.
- Polish quick-start and complete assessment-rule documentation.

### Changed

- The public distribution uses only universal qPCR terminology.
- DOCX reporting remains local-first and Microsoft Word compatible.

### Removed

- The unused assay-specific legacy reporting module from the source application.
