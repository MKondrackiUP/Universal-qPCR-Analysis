import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const VERSION = "0.22.0";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "docs");
const host = process.env.HOST ?? "127.0.0.1";
const requestedPort = Number(process.env.PORT ?? 8787);
const port = Number.isInteger(requestedPort) && requestedPort >= 0 && requestedPort <= 65535 ? requestedPort : 8787;
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".yaml", "application/yaml; charset=utf-8"],
  [".yml", "application/yaml; charset=utf-8"],
]);

const securityHeaders = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; worker-src 'self' blob:",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

function reply(response, statusCode, body, contentType) {
  response.writeHead(statusCode, { ...securityHeaders, "content-type": contentType, "content-length": Buffer.byteLength(body) });
  response.end(body);
}

function resolvePublicPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const target = path.resolve(root, relative);
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return target === root || target.startsWith(prefix) ? target : null;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/healthz") {
      const body = JSON.stringify({ status: "ok", product: "Universal qPCR Analysis Web", version: VERSION, storage: "browser_memory_only" });
      if (request.method === "HEAD") return reply(response, 200, "", "application/json; charset=utf-8");
      if (request.method !== "GET") return reply(response, 405, "Method not allowed\n", "text/plain; charset=utf-8");
      return reply(response, 200, body, "application/json; charset=utf-8");
    }
    if (!["GET", "HEAD"].includes(request.method ?? "")) return reply(response, 405, "Method not allowed\n", "text/plain; charset=utf-8");
    const filePath = resolvePublicPath(url.pathname);
    if (!filePath) return reply(response, 404, "Not found\n", "text/plain; charset=utf-8");
    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat?.isFile()) return reply(response, 404, "Not found\n", "text/plain; charset=utf-8");
    const body = request.method === "HEAD" ? Buffer.alloc(0) : await readFile(filePath);
    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
    response.writeHead(200, { ...securityHeaders, "content-type": contentType, "content-length": body.length });
    response.end(body);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) reply(response, 500, "Internal server error\n", "text/plain; charset=utf-8");
    else response.destroy(error);
  }
});

server.listen(port, host, () => {
  const address = server.address();
  console.log(`Universal qPCR Analysis Web ${VERSION} listening on http://${host}:${address.port}`);
});
