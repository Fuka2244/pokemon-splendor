import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("./", import.meta.url));
const publicRoot = join(projectRoot, "src");
const assetRoot = join(projectRoot, "assets");
const port = 4174;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const servesAssets = pathname.startsWith("/assets/");
  const root = servesAssets ? assetRoot : publicRoot;
  const relativePath = pathname === "/" ? "index.html" : servesAssets ? pathname.slice("/assets/".length) : pathname.slice(1);
  const requestedPath = normalize(join(root, relativePath));
  if (!requestedPath.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const body = await readFile(requestedPath);
    response.writeHead(200, { "Content-Type": mimeTypes[extname(requestedPath)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Pokemon Splendor: http://127.0.0.1:${port}`);
});
