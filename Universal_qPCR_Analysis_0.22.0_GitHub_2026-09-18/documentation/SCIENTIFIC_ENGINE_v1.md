# Universal qPCR scientific engine v1

**Engine ID:** `universal-qpcr-scientific-engine`  
**Engine version:** `1.0.0`  
**Input schema:** `1.0.0`  
**Application release:** `0.22.0`

## Boundary

`docs/lib/scientific-engine.mjs` is the sole calculation source for the primary T0/T1 result returned by the application. It accepts normalized long qPCR records and plain configuration values. It has no filesystem, HTTP, process, server or interface dependency.

The browser input facade reads XLSX, CSV or TSV and passes normalized records from the shared workbook validator to `local-analysis.js`. Primary candidate effects, Wilcoxon tests, Benjamini–Hochberg values, integrated scores and Tier decisions come exclusively from the scientific engine.

## Deterministic calculation sequence

1. Normalize finite Ct and Qty values and select the required T0 and T1 terms.
2. Set the Qty offset to half the minimum positive Qty across the supplied records, or the configured fallback.
3. Average finite within-term duplicates by preparation, sex and sample name.
4. Build complete-pair `delta_ct` and `log10((Qty_T1 + offset)/(Qty_T0 + offset))` effects.
5. Calculate preparation medians, means, completeness and direction consistency.
6. Apply the two-sided Wilcoxon signed-rank test with excluded zeros, average tie ranks and exact sign permutation for at most 20 nonzero pairs.
7. Apply Benjamini–Hochberg correction independently to the Qty and Ct endpoint families.
8. Scale the primary effect using the sample standard deviation of preparation medians and the locked limits.
9. Apply the versioned integrated evidence formula and ordered Tier override/threshold rules.

## Regression guarantee

`tests/synthetic-validation.test.mjs` checks independently specified synthetic CSV and XLSX fixtures against expected pair counts, effects, W, p, q and Tier values. The public-contract tests also enforce one application version and prohibit disease-specific terminology or non-synthetic spreadsheets.

Any intentional scientific change requires a new engine version and a new scientific baseline contract. Refactoring, report changes and visual changes must continue to reproduce baseline v1.
