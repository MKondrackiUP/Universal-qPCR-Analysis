# External validation

The repository test suite checks the scientific engine against fixtures that
live in the same repository. That is necessary but circular: it proves the
implementation is stable, not that it is correct. This folder holds an
independent check against a widely used reference implementation, for reviewers
who want to confirm the statistics without reading the source.

SciPy is **not** a dependency of the application, which has none. These scripts
are optional and are not part of `npm run verify`.

## What is here

- `verify-release.mjs` — end-to-end verification reproducible from this
  repository alone: both bundled demonstrations, DOCX generation, the
  project-file round trip, a full T0–T4 run and version consistency. Run with
  `npm run verify:release`.
- `verify-study-case.mjs` — the same kind of verification for a dataset that
  does not live here. It contains no data and no expected value; both come from
  a case file supplied on the command line, so a study's measurements, evidence
  profile and benchmark table can travel with the article that reports them
  instead of with the software.
- `export-signed-rank-cases.mjs` and `compare_with_scipy.py` — comparison of the
  Wilcoxon implementation with an external reference, described below.

```bash
npm run verify:release
node validation/verify-study-case.mjs path/to/case.json
```

The case file format is documented in the header of `verify-study-case.mjs`.

## Wilcoxon signed-rank test

```bash
node validation/export-signed-rank-cases.mjs > validation/cases.json
python3 validation/compare_with_scipy.py validation/cases.json
```

The Node script prints ten deterministic paired-difference vectors together with
the statistic, p-value and method this application produces for each. The Python
script recomputes every p-value with `scipy.stats.wilcoxon(method="exact")` and
exits non-zero on any disagreement.

`validation/cases.json` is committed so the comparison can be reproduced, and
re-generated output should be byte-identical.

### Ties

SciPy's exact branch assumes there are no ties and falls back to the untied null
distribution when it meets them. This application permutes the observed average
ranks, which is the exact conditional permutation test and remains valid with
ties. The two therefore disagree for tied input by design, and the comparison
script marks such a case `EXPECTED-DIFF` and checks the application's value
against a brute-force enumeration of all 2^n sign assignments instead.

Recorded results are in `RESULTS.md`.
