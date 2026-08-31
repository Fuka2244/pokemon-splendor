import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("card face images are shown uncropped", () => {
  // Catches: shrinking card assets into thumbnails and hiding printed rules from players.
  assert.match(css, /\.pokemon-image\s*{[^}]*aspect-ratio:\s*3\s*\/\s*4[^}]*object-fit:\s*contain/s);
  assert.match(css, /\.rare-image\s*{[^}]*aspect-ratio:\s*3\s*\/\s*4[^}]*object-fit:\s*contain/s);
  assert.match(css, /\.reserved-card img\s*{[^}]*aspect-ratio:\s*3\s*\/\s*4[^}]*object-fit:\s*contain/s);
});

test("card face columns stay compact for table preview", () => {
  // Catches: card faces growing so large that the table is awkward to preview.
  assert.match(css, /--card-width:\s*clamp\(104px,[^;]*168px\)/);
  assert.match(css, /\.card-row\s*{[^}]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /\.market-row\s*{[^}]*align-items:\s*stretch/s);
});

test("wild and special card buttons rely on printed card faces", () => {
  // Catches: reintroducing custom text overlays on card buttons instead of showing the card face.
  const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const cardMarkup = source.match(/function cardMarkup\(card,[^\n]*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const specialMarkup = source.match(/function specialCardMarkup\(type, card\) \{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.ok(cardMarkup.includes('class="pokemon-image"'));
  assert.doesNotMatch(cardMarkup, /<strong>|<span class="costs"|<span class="bonus"|<b class="points"|<span class="evolves-into"/);
  assert.doesNotMatch(specialMarkup, /<strong>|<span class="rare-requirements"|<b>/);
});
