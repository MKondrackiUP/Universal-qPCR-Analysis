# Contributing

Universal qPCR Analysis is a research tool. Changes to calculations require stronger evidence than ordinary interface changes.

Read `documentation/ARCHITECTURE.md` before changing module boundaries. Format
parsers, domain validation, scientific calculations, presentation and reporting
have deliberately separate responsibilities.

## Local verification

Use Node.js 20 or newer. The repository has no runtime npm dependencies.

```bash
npm run verify
npm run checksums:write
npm run checksums:verify
```

Run `npm start` and open `http://127.0.0.1:8787` for a manual browser check.

## Scientific changes

Any change to pairing, offsets, effect sizes, Wilcoxon testing, multiple-testing correction, assessment labels or Tier scoring must:

1. state the changed rule and its rationale;
2. add a synthetic oracle or regression fixture with an independently calculated expectation;
3. update the corresponding documentation;
4. preserve the separation between statistical qPCR output and optional Tier prioritisation;
5. avoid claiming biological or clinical validation from synthetic data.

Do not add confidential, identifiable or unpublished research data. A bug report should use the smallest possible synthetic example.

## Pull requests

Keep changes focused and describe their user-visible effect. CI must pass before merge. The `main` branch should always remain deployable as a static site from `docs/`.
