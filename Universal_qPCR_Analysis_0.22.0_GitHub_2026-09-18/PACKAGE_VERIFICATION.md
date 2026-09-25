# Package verification — 2026-09-18

Application: 0.22.0. Packaging revision: 2026-09-18.
Environment: Windows, Node.js 24.9.0.

- `npm.cmd run verify`: syntax checks passed; 60 tests passed, no failures or skips.
- `npm.cmd run verify:release`: 37 checks passed (including DOCX and project round-trip).
- `node examples/analyze.mjs`: six preparations, 46 complete Qty and Ct pairs.
- The example was also executed with bundled CSV and XLSX inputs; candidate results
  agree, and pair counts, p and q match the independent synthetic expectations.
- 29 local Markdown links resolve to existing files.
- Root and served licence files match; root and served citation files match.
- The scientific engine is byte-identical to the source 0.22.0 distribution.

Changes are packaging, licence/citation metadata and documentation. The limitations
document now correctly identifies the synthetic Tier profile and states that three
non-zero pairs have minimum two-sided exact p=0.25, not q<0.05.

No Docker build or interactive browser validation was performed for this packaging
revision. GitHub Actions workflows are included but have not run on GitHub yet.
No repository was created or published as part of preparing this archive.

`SHA256SUMS.txt` is generated after documentation is finalized; verify it with
`npm run checksums:verify`. Its script normalizes CRLF/LF for selected text file
extensions. The SHA-256 file beside the ZIP instead hashes the exact archive bytes.
