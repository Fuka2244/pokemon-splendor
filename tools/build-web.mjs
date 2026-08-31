import { cp, mkdir, rm } from "node:fs/promises";

const destination = new URL("../dist/", import.meta.url);
// Rebuild only the generated project output; removed source pages must not linger.
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(new URL("../src/", import.meta.url), destination, { recursive: true });
await mkdir(new URL("assets/", destination), { recursive: true });
await cp(new URL("../assets/source-cards/", import.meta.url), new URL("assets/source-cards/", destination), { recursive: true });
console.log("Built static pages and card assets in dist/");
