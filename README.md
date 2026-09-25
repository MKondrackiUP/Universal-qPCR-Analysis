# Universal qPCR Analysis Web 0.22.0

GitHub package revision: **2026-09-18**; application/engine versions unchanged.
This is a browser application with a JavaScript module API, not an HTTP REST analysis service.
See [API guide (Polish)](documentation/API_GUIDE_PL.md), [user guide](documentation/USER_GUIDE_PL.md),
and [GitHub publishing instructions](GITHUB_SETUP_PL.md). No npm dependencies need installing.


***English** · [Polski](README.pl.md)*

A static, account-free application for local paired qPCR and RT-qPCR analysis
across T0–T4 timepoints. XLSX, CSV and TSV files are read and analysed in
browser memory. The host serves only the application's own assets: qPCR data and
the generated DOCX reports are never sent to a server.

Version 0.21.0 extended XLSX/CSV/TSV validation, added UTF-8, UTF-16 and
Windows-1250 detection, rejected malformed numbers and incomplete identifiers,
and began reporting missing values, zero quantities, repeated observations,
defaulted Task cells and ignored columns explicitly. Version 0.21.1 reorganized
the code without changing any scientific result: byte-level decoding, XLSX
reading, domain validation, DOM lookup and error messages are now separate
modules. The module map and the rules for safe changes are in
[`documentation/ARCHITECTURE.md`](documentation/ARCHITECTURE.md).

Version 0.21.2 follows an audit of the whole application. It restores chart
rendering under the deployed Content-Security-Policy, decides the decimal mark
once per file so an English thousands separator can no longer be read as a
Polish decimal comma, gives a declared Sex column precedence over the
sample-name prefix, replaces the bundled Tier evidence profile with a synthetic
example, removes an unreachable server report path, and reports the Qty offset
and effect scale that each run used. The scientific engine stays at 1.0.0 and no
calculation was changed; `CHANGELOG.md` lists every item.

Version 0.22.0 adds one capability: the frozen comparison table used by the
screening reconstruction can be supplied with the analysis instead of being
built in. A study can therefore keep its own evidence profile and its own
benchmark alongside the article that reports them, while the distribution ships
synthetic examples only. `validation/verify-release.mjs` verifies a release
end to end from this repository, and `validation/verify-study-case.mjs` does the
same for a dataset that lives elsewhere.

## Supported input and validation

- **XLSX**: the first declared worksheet, shared strings and `inlineStr` cells.
- **CSV**: comma or semicolon, quoted fields, CRLF, and a decimal comma when the
  delimiter is a semicolon.
- **TSV**: tab-delimited.
- **Text encodings**: UTF-8 with or without BOM, UTF-16 LE/BE with a BOM or
  detected heuristically, and Windows-1250 as a controlled fallback.
- **Limits**: 5 MB per file and 100 000 data rows.
- **Required columns**: preparation, sample, one common Detector/Target, Ct/Cq
  and Qty/Quantity.
- Ct/Cq, SD and Qty values must be non-negative. Missing data may be written as
  an empty cell, `NA`, `N/A`, `NaN`, `Undetermined` or `No Ct`.
- Only `Task=Unknown` rows enter the analysis; blank Task cells are explicitly
  set to `Unknown`.
- The decimal mark is decided once per file from unambiguous evidence. A value
  such as `1,234`, which could be either 1234 or 1.234, is rejected rather than
  guessed when the file gives no other indication.

## GitHub Pages

1. Upload the contents of this package to the root of a GitHub repository.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**, branch `main`, folder `/docs`.
4. The application then also runs at the project address, for example
   `https://username.github.io/repository-name/`.

`.nojekyll` is already present in `docs`. Every reference is relative, so the
repository does not have to be published at a domain root.

## Server without Docker

Copy the contents of `docs` into the web root of Apache, Nginx or any static
host. The server should serve `index.html` as the start document, return `.mjs`
and `.js` as JavaScript, run over HTTPS in a public environment, and add no
backend upload path for qPCR files.

For a local preview with Node.js 20 or newer:

```bash
npm start
```

The default address is `http://127.0.0.1:8787`; `HOST` and `PORT` change where
it listens.

## Docker

```bash
docker compose up -d --build
```

The application is served at `http://localhost:8080` and the health check at
`/healthz`. The container runs read-only, without added capabilities, as an
unprivileged user. For a published or cited build, pin the base image to a
digest:

```bash
docker build --build-arg NGINX_IMAGE=nginx@sha256:<digest> -t universal-qpcr-analysis .
```

## Privacy

- no accounts and no sign-in;
- no database;
- no upload endpoint in this release, and no outbound request from the analysis
  workflow — a test asserts the application code contains none;
- inputs and reports stay in the browser tab's memory;
- closing or reloading the tab discards the current result, unless a local
  `.qpcrproj` file was downloaded first;
- a full `.qpcrproj` may contain sample identifiers and normalized
  measurements, so store it according to the study's data policy.

## Limitations

Read [`documentation/LIMITATIONS.md`](documentation/LIMITATIONS.md) before using
a result in a publication. In short:

- no reference-gene normalization — the validator requires one common Detector,
  so the auxiliary endpoint is ΔCt (T1 − T0) for a single target, not ΔΔCt;
- no amplification-efficiency correction — Qty is taken from the instrument's
  standard curve as reported;
- `Undetermined` and `No Ct` are treated as missing, so the pair leaves the
  complete-pair analysis;
- the Qty offset and the effect scale are derived from the whole submitted set
  of preparations, so scaled effects, integrated scores and Tier are comparable
  within one run and not between runs; the application displays both quantities
  alongside the result;
- the integrated score is a transparent additive tally with all weights at 1.0,
  not a formally elicited multi-criteria decision analysis, and the evidence
  scores come from a profile the application does not verify;
- Tier marks a validation priority, not efficacy and not a clinical
  classification.

## Licence and citation

Free use, including commercial use, under the custom [LICENSE](LICENSE).
Scientific outputs using this software or its results **must cite the software
and exact version**. See [CITATION_POLICY.md](CITATION_POLICY.md). This is not
Apache-2.0 or an OSI-approved licence. Earlier licence grants are unaffected.

## Guide and test data

- quick start: `documentation/USER_GUIDE_PL.md`;
- complete assessment rules: `documentation/ASSESSMENT_RULES_PL.md`;
- three synthetic T0/T1 sets in CSV and XLSX:
  `docs/examples/synthetic-qpcr-validation`.

The test sets have analytically established W, p and q values recorded in
`expected-results.json`. They exist for technical validation only and represent
no biological data. The bundled Tier evidence profile in `docs/config` is
likewise a synthetic example: it demonstrates the score ranges and the Tier
rules, carries no pharmacological meaning, and must be replaced with a
study-specific profile before Tier is interpreted.

## Development and automated checks

This repository is deliberately separated from historical manuscripts, data and
single-disease or single-assay analyses. It contains only the universal
application, its deployment and explicitly labelled synthetic data.

With Node.js 20 or newer:

```bash
npm run verify
npm run checksums:verify
```

GitHub Actions repeats the tests on Node 20 and 22 for every pull request and
push to `main`, builds the deployment container, starts it and checks that
`/healthz` reports the version in `package.json`.

`validation/` holds an optional comparison of the Wilcoxon signed-rank
implementation against `scipy.stats.wilcoxon`; SciPy is not a dependency and the
comparison is not part of `npm run verify`.

Rules for scientific changes are in [CONTRIBUTING.md](CONTRIBUTING.md),
vulnerability reporting in [SECURITY.md](SECURITY.md), the release procedure in
[RELEASE_PROCESS.md](RELEASE_PROCESS.md) and community expectations in
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
