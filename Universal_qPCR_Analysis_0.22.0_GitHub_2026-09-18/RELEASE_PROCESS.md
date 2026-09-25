# Release process

1. Update the version in `package.json`, `serve.mjs`, `docs/index.html`, `CITATION.cff` and release documentation.
2. Add a dated entry to `CHANGELOG.md`.
3. Run `npm run verify` and `npm run verify:release`, and record the number of
   end-to-end checks if a manuscript cites it.
4. Perform a browser smoke test with one CSV pair and one XLSX pair.
5. Generate and verify the file manifest with `npm run checksums:write` and `npm run checksums:verify`.
6. Resolve the base image digest with `docker buildx imagetools inspect nginx:stable-alpine`,
   build with `docker build --build-arg NGINX_IMAGE=nginx@sha256:<digest> .`, record the
   digest in the release notes and confirm `/healthz` reports the release version. A
   published or cited build must not use a floating tag.
7. Tag the reviewed commit as `vX.Y.Z` and publish the source archive plus checksum.
8. Archive the release in Zenodo and update `CITATION.cff` with the DOI when available.

Never publish real qPCR workbooks in this repository. Only explicitly labelled synthetic fixtures are permitted.
