import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const inputPath = process.argv[2];

if (!inputPath) {
  throw new Error("Usage: node tools/import-confirmed-pending-data.mjs <pokemon-pending-card-data.json>");
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (!Array.isArray(input.cards)) {
  throw new Error("Input JSON must contain a cards array");
}

const toCardId = (file) => file
  .replace(/^assets\/source-cards\//, "normal-")
  .replace(/\.png$/, "")
  .replace(/\//g, "-");

const tierOf = (file) => {
  const match = file.match(/tier-(\d)/);
  if (!match) throw new Error(`Cannot infer tier from ${file}`);
  return Number(match[1]);
};

const stringify = (value, indent = 0) => JSON.stringify(value, null, 2)
  .split("\n")
  .map((line, index) => `${" ".repeat(index === 0 ? 0 : indent)}${line}`)
  .join("\n")
  .replace(/"([A-Za-z][A-Za-z0-9_]*)":/g, "$1:");

const cards = input.cards.map((card) => {
  const entry = {
    id: toCardId(card.file),
    tier: tierOf(card.file),
    name: card.name,
    image: `./${card.file}`,
    points: card.score,
    bonus: card.discount,
    cost: card.cost,
  };
  if (card.evolvesTo) {
    entry.evolvesToName = card.evolvesTo;
    entry.evolutionRequirement = card.evolutionRequirement;
  }
  return entry;
});

const output = [
  "// Generated from user-confirmed pending card data.",
  "export const userConfirmedPokemonCards = [",
  ...cards.map((card) => `  ${stringify(card, 2).replaceAll("\n", "\n  ")},`),
  "];",
  "",
].join("\n");

fs.writeFileSync(path.join(root, "src", "data", "user-confirmed-pokemon-cards.js"), output, "utf8");
console.log(`Wrote ${cards.length} confirmed ordinary cards`);
