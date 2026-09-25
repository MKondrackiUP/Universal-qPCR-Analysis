/**
 * Emit the signed-rank cases and this application's results as JSON.
 *
 * Paired with `compare_with_scipy.py`, this lets an external reviewer check the
 * Wilcoxon implementation against an independent reference without trusting the
 * repository's own oracle fixtures.
 *
 *   node validation/export-signed-rank-cases.mjs > validation/cases.json
 */
import { wilcoxonSignedRank } from "../docs/lib/scientific-engine.mjs";

/** Small deterministic generator so the cases are reproducible without a seed library. */
function pseudoRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

const random = pseudoRandom(42);
const cases = [];

for (const n of [4, 6, 8, 10, 12, 15, 18, 20]) {
  const differences = Array.from({ length: n }, () => Math.round((random() - 0.45) * 1000) / 100);
  cases.push({ id: `untied_n${n}`, differences });
}
cases.push({ id: "tied_with_zeros", differences: [1, -1, 1, 1, -1, 2, 2, -2, 3, 0, 0, 1] });
cases.push({ id: "all_one_direction_n6", differences: [0.4, 0.31, 0.55, 0.22, 0.61, 0.18] });

const rows = cases.map((item) => {
  const result = wilcoxonSignedRank(item.differences);
  return {
    ...item,
    nonzero_pairs: result.n,
    statistic_w: result.statistic,
    p_value: result.p_value,
    method: result.method,
  };
});

process.stdout.write(`${JSON.stringify({
  source: "universal-qpcr-scientific-engine",
  generated_by: "validation/export-signed-rank-cases.mjs",
  cases: rows,
}, null, 2)}\n`);
