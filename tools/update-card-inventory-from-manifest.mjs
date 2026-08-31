import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { legendaryPokemonCards, masterBall, pokemonCards, rarePokemonCards } from "../src/data/card-manifest.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const inventoryPath = path.join(root, "docs", "assets", "card-inventory.json");
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

const normalizeImage = (image) => image.replace(/^\.\//, "");

const cardByPath = new Map();
for (const card of pokemonCards) {
  cardByPath.set(normalizeImage(card.image), {
    cardType: "ordinary",
    pokemonName: card.name,
    tier: card.tier,
    bonus: card.bonus,
    cost: card.cost ?? {},
    points: card.points ?? 0,
    isLowerEvolutionCard: Boolean(card.evolvesToName || card.evolvesTo),
    evolvesTo: card.evolvesToName ?? card.evolvesTo ?? null,
    evolutionRequirement: card.evolutionRequirement ?? null,
    isRarePokemon: false,
    recognitionStatus: "confirmed",
  });
}

for (const card of rarePokemonCards) {
  cardByPath.set(normalizeImage(card.image), {
    cardType: "rare",
    pokemonName: card.name,
    tier: null,
    bonus: card.bonus ?? {},
    cost: {},
    points: card.points ?? 0,
    isLowerEvolutionCard: false,
    evolvesTo: null,
    evolutionRequirement: null,
    requirement: card.requirement ?? card.anyRequirement ?? {},
    masterCost: card.masterCost ?? 0,
    isRarePokemon: true,
    recognitionStatus: "confirmed",
  });
}

for (const card of legendaryPokemonCards) {
  cardByPath.set(normalizeImage(card.image), {
    cardType: "legendary",
    pokemonName: card.name,
    tier: null,
    bonus: card.bonus ?? {},
    cost: {},
    points: card.points ?? 0,
    isLowerEvolutionCard: false,
    evolvesTo: null,
    evolutionRequirement: null,
    requirement: card.requirement ?? card.anyRequirement ?? {},
    masterCost: card.masterCost ?? 0,
    isRarePokemon: true,
    recognitionStatus: "confirmed",
  });
}

for (const file of inventory.files) {
  const details = cardByPath.get(file.normalizedPath);
  if (details) {
    Object.assign(file, details);
  } else if (file.inferredGroup === "icons") {
    Object.assign(file, {
      cardType: "icon",
      pokemonName: null,
      tier: null,
      bonus: null,
      cost: {},
      points: null,
      isLowerEvolutionCard: false,
      evolvesTo: null,
      evolutionRequirement: null,
      isRarePokemon: false,
      recognitionStatus: "confirmed",
      iconName: file.normalizedPath.endsWith("icon-002.png") ? masterBall.label : "精灵球图标",
    });
  }
}

fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
console.log(`Updated ${inventory.files.length} inventory entries`);
