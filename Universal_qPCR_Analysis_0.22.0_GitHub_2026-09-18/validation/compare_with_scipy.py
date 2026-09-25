"""Compare this application's Wilcoxon signed-rank results with SciPy.

    node validation/export-signed-rank-cases.mjs > validation/cases.json
    python3 validation/compare_with_scipy.py validation/cases.json

Requires SciPy; it is not a dependency of the application, which has none.

Note on ties: SciPy's exact branch assumes no ties and falls back to the
untied null distribution, whereas this application permutes the observed
average ranks. The two therefore disagree for tied inputs by design, and the
application's value is the exact conditional permutation p-value. The script
reports such a case as EXPECTED-DIFF and verifies the application's value
against a brute-force enumeration instead.
"""
import itertools
import json
import sys

from scipy.stats import wilcoxon

TOLERANCE = 1e-12


def average_ranks(values):
    """Rank absolute differences, giving tied values their average rank."""
    order = sorted(range(len(values)), key=lambda i: (abs(values[i]), i))
    ranks = [0.0] * len(values)
    start = 0
    while start < len(order):
        end = start
        while end + 1 < len(order) and abs(values[order[end + 1]]) == abs(values[order[start]]):
            end += 1
        rank = ((start + 1) + (end + 1)) / 2
        for position in range(start, end + 1):
            ranks[order[position]] = rank
        start = end + 1
    return ranks


def brute_force_two_sided(values):
    """Exact conditional permutation p-value over the observed (possibly tied) ranks."""
    ranks = average_ranks(values)
    expected = sum(ranks) / 2
    observed = abs(sum(rank for rank, value in zip(ranks, values) if value > 0) - expected)
    extreme = sum(
        1
        for signs in itertools.product([0, 1], repeat=len(ranks))
        if abs(sum(rank for rank, sign in zip(ranks, signs) if sign) - expected) + TOLERANCE >= observed
    )
    return extreme / (2 ** len(ranks))


def main(path):
    payload = json.load(open(path, encoding="utf-8"))
    failures = 0
    print(f"{'case':<20} {'n':>3} {'application p':>16} {'reference p':>16}  verdict")
    for case in payload["cases"]:
        nonzero = [value for value in case["differences"] if value != 0]
        has_ties = len({abs(value) for value in nonzero}) != len(nonzero)
        application = case["p_value"]
        if has_ties:
            reference = brute_force_two_sided(nonzero)
            label = "EXPECTED-DIFF vs SciPy exact; matches brute force"
        else:
            reference = float(wilcoxon(nonzero, alternative="two-sided", method="exact").pvalue)
            label = "match"
        agrees = abs(application - reference) <= 1e-9
        if not agrees:
            failures += 1
            label = "MISMATCH"
        print(f"{case['id']:<20} {len(nonzero):>3} {application:>16.12f} {reference:>16.12f}  {label}")
    print()
    print("all cases agree with the reference" if not failures else f"{failures} case(s) disagree")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "validation/cases.json"))
