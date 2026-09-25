import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function startServer() {
  const child = spawn(process.execPath, ["serve.mjs"], {
    cwd: root,
    env: { ...process.env, HOST: "127.0.0.1", PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server startup timed out")), 5000);
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      const match = chunk.toString("utf8").match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited before startup with code ${code}: ${stderr}`));
    });
  });
  return { child, ready };
}

const packageVersion = JSON.parse(
  await (await import("node:fs/promises")).readFile(
    (await import("node:path")).resolve(import.meta.dirname, "..", "package.json"), "utf8"),
).version;

test("deployment server exposes health, application and security boundaries", async () => {
  const { child, ready } = startServer();
  try {
    const port = await ready;
    const base = `http://127.0.0.1:${port}`;
    const healthResponse = await fetch(`${base}/healthz`);
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), {
      status: "ok",
      product: "Universal qPCR Analysis Web",
      version: packageVersion,
      storage: "browser_memory_only",
    });
    assert.equal(healthResponse.headers.get("x-content-type-options"), "nosniff");
    assert.match(healthResponse.headers.get("content-security-policy"), /object-src 'none'/);

    const indexResponse = await fetch(`${base}/`);
    assert.equal(indexResponse.status, 200);
    assert.match(await indexResponse.text(), /Universal qPCR/i);

    const postResponse = await fetch(`${base}/`, { method: "POST", body: "not accepted" });
    assert.equal(postResponse.status, 405);

    const missingResponse = await fetch(`${base}/not-present.txt`);
    assert.equal(missingResponse.status, 404);
  } finally {
    child.kill();
  }
});

test("the browser workflow cannot send a result anywhere", async () => {
  // The local-first contract is only credible if it is statically true: the
  // orchestrator must contain no network call and no server-supplied report
  // endpoint that a restored project file could point at.
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const app = await readFile(path.resolve(import.meta.dirname, "..", "docs", "app.js"), "utf8");
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /generate_url/);
  assert.doesNotMatch(app, /XMLHttpRequest|navigator\.sendBeacon/);
});
