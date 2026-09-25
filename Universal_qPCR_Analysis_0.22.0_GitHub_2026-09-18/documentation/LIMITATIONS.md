# Analysis limitations

This file states, in one place, what the application does not do. It is written
for reviewers and for anyone deciding whether a result from this tool supports
the claim they intend to make. Nothing here is a defect report; each item is a
deliberate boundary of the current design.

## Measurement model

**No reference-gene normalization.** The input validator requires one common
`Detector`/`Target` value across every row and every timepoint, so a reference
gene cannot be supplied. The auxiliary Ct endpoint is therefore ΔCt = Ct_T1 −
Ct_T0 for a single target over time, not ΔΔCt. Results describe the change of
one target between timepoints in the same sample; they are not normalized
against a housekeeping gene and do not correct for differences in input
material.

**No amplification-efficiency correction.** Quantity is taken from the `Qty` /
`Quantity` column exactly as the instrument reports it, normally from the
operator's standard curve. The application neither reads nor applies an
amplification efficiency (E), and performs no efficiency-corrected relative
quantification. The quality of the standard curve is inherited from the
instrument run and is outside the tool's control.

**Technical replicates are averaged arithmetically.** Repeated observations of
the same preparation, sex, sample and timepoint are averaged with an arithmetic
mean, separately for Ct and for Qty. An arithmetic mean of Ct corresponds to a
geometric mean on the quantity scale, so the two endpoints are averaged in
different scales and can, for strongly discordant replicates, indicate
different directions for the same pair.

**"Undetermined" is treated as missing.** `Undetermined` and `No Ct` are
recorded as flags but the affected value becomes missing, so the pair leaves
the complete-pair analysis. In qPCR a non-amplifying well is usually
informative — a quantity below the detection limit rather than a value missing
at random — so complete-pair analysis biases the estimate toward "no change".
Reported counts of missing Ct and Qty values allow the size of this exclusion
to be judged.

## Statistical model

**Paired, distribution-free, two-sided.** The primary endpoint is the paired
median of log10((Qty_T1 + offset)/(Qty_T0 + offset)), tested with a two-sided
Wilcoxon signed-rank test. Zero differences are excluded, ties receive average
ranks, and the p-value comes from an exact sign permutation over the observed
ranks for up to 20 non-zero pairs and from a tie- and continuity-corrected
normal approximation above that. The exact branch permutes the tied ranks
themselves, so it remains valid in the presence of ties. Multiplicity is
controlled with Benjamini–Hochberg within each endpoint and contrast.

**Association is not causation.** A confirmed direction means the paired
distribution is inconsistent with no change under the stated model. It does not
establish efficacy, mechanism, biological importance or clinical validity.

**No power analysis and no minimum effect size.** The tool reports what the
supplied pairs show. Three complete pairs suffice for a descriptive direction,
but three non-zero pairs cannot reach p < 0.05 in the two-sided exact test:
the smallest p is 2/2^3 = 0.25, and Benjamini–Hochberg adjustment cannot reduce
it below that value. Interpret the pair counts alongside every q-value.

## Dataset dependence

**The Qty offset comes from the submitted set.** It is half the smallest
positive Qty across all supplied timepoints. Adding or removing a preparation
can change the offset, and with it every log10 ratio in the run.

**The effect scale comes from the submitted set.** The scaled effect divides
the preparation median by the sample standard deviation of preparation medians
in the same run. The scaled effect of one preparation therefore depends on
which other preparations were analysed with it. With fewer than two
preparations holding complete pairs the standard deviation is undefined and the
qPCR component of the integrated score is zero.

Both quantities are reported in the results, in the DOCX report and in
`result.effect_scaling`. **Scaled effects, integrated scores and Tier are
comparable within one run and not between runs.** Record the offset and the
standard deviation together with any result that is to be cited.

## Prioritization model

**The integrated score is an additive tally, not a formal MCDA.** Five evidence
components are summed with weights fixed at 1.0 and a safety-risk penalty is
subtracted. There is no weight elicitation, no criterion normalization and no
sensitivity analysis. The field `score_model` records this explicitly.

**Evidence scores are expert judgements, not measurements.** They arrive from a
versioned profile — the built-in reference set or a user-supplied CSV — and the
application does not verify them. The built-in profile is an explicitly synthetic demonstration; it is not a general
pharmacological resource, and a study using Tier should supply its own profile
and publish the reasoning behind its scores.

**Tier is a validation priority.** Tier 1–5 orders candidates for further work.
It is not an efficacy ranking, not a safety assessment and not a clinical
classification.

## Scope

This is research software. It is not a clinical or diagnostic system, has no
regulatory clearance, and must not be used to guide the care of a patient or an
animal.
