import test from "node:test";
import assert from "node:assert/strict";
import { ballTypes, pendingSourceCards, pokemonCards } from "../src/data/card-manifest.js";

const coloredBallIds = new Set(ballTypes.map((ball) => ball.id));

test("confirmed ordinary card manifest covers every ordinary source card", () => {
  // Catches: leaving user-confirmed card images out of the playable decks.
  const countsByTier = pokemonCards.reduce((counts, card) => {
    counts[card.tier] = (counts[card.tier] ?? 0) + 1;
    return counts;
  }, {});

  assert.equal(pokemonCards.length, 80);
  assert.deepEqual(countsByTier, { 1: 35, 2: 30, 3: 15 });
  assert.deepEqual(pendingSourceCards, []);
});

test("ordinary cards each provide exactly one colored permanent discount", () => {
  // Catches: accidentally importing special two-point bonuses into the ordinary deck.
  for (const card of pokemonCards) {
    assert.equal(typeof card.bonus, "string", card.id);
    assert.equal(coloredBallIds.has(card.bonus), true, card.id);
  }
});

test("ordinary cards use one unique local PNG image each", () => {
  // Catches: duplicated mappings or entries that still point outside the imported asset directory.
  const imagePaths = pokemonCards.map((card) => card.image);

  assert.equal(new Set(imagePaths).size, 80);
  for (const image of imagePaths) {
    assert.match(image, /^\.\/assets\/source-cards\/tier-[123]\/tier-[123]-\d{3}\.png$/);
  }
});

test("ordinary evolution targets exist in a higher tier", () => {
  // Catches: reversed chain data such as a final form pointing back to its middle form.
  for (const card of pokemonCards.filter((candidate) => candidate.evolvesToName)) {
    const targets = pokemonCards.filter((candidate) => candidate.name === card.evolvesToName);
    assert.notEqual(targets.length, 0, card.id);
    assert.equal(targets.some((target) => target.tier > card.tier), true, card.id);
  }
});
