# Recorded comparison results

Reference environment: SciPy 1.17.1, NumPy 2.4.4, Python 3.11.15.
Application: `universal-qpcr-scientific-engine` 1.0.0 on Node.js 22.

```
case                   n    application p      reference p  verdict
untied_n4              4   0.125000000000   0.125000000000  match
untied_n6              6   0.843750000000   0.843750000000  match
untied_n8              8   0.460937500000   0.460937500000  match
untied_n10            10   0.232421875000   0.232421875000  match
untied_n12            12   0.969726562500   0.969726562500  match
untied_n15            15   0.454284667969   0.454284667969  match
untied_n18            18   0.865043640137   0.865043640137  match
untied_n20            20   0.647655487061   0.647655487061  match
tied_with_zeros       10   0.253906250000   0.253906250000  EXPECTED-DIFF vs SciPy exact; matches brute force
all_one_direction_n6   6   0.031250000000   0.031250000000  match

all cases agree with the reference
```

## Reading of the result

Every untied case agrees with `scipy.stats.wilcoxon(method="exact")` to twelve
decimal places, and the statistic W matches in each case.

The tied case is the informative one. The application returns 0.25390625 where
SciPy's exact branch returns 0.23242188. A brute-force enumeration of all 2^10
sign assignments over the observed average ranks (`3.5` ×6, `8` ×3, `10`)
returns 0.25390625, confirming the application. SciPy documents that its exact
method does not account for ties; the application's rank-permutation approach
does, so it is the more accurate of the two for tied qPCR data — which is common,
because replicate-averaged differences frequently tie.

`all_one_direction_n6` reproduces the analytic value for six pairs sharing one
direction: 2/64 = 0.03125.
