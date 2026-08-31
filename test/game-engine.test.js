import test from "node:test";
import assert from "node:assert/strict";
import { capturePokemon, captureSpecialPokemon, createGame, evolvePokemon, getCaptureQuote, listEvolutionOptions, listSpecialCaptureOptions, reservePokemon, reservePokemonFromDeck, returnBalls, skipEvolution, takeBalls, takeTwoBalls } from "../src/game-engine.js";

test("new game exposes the shared ball supply and active trainer", () => {
  // Catches: an incomplete initial state that cannot drive the table UI.
  const game = createGame({ trainerNames: ["小智", "小霞"] });

  assert.deepEqual(game.bank, {
    red: 4,
    blue: 4,
    yellow: 4,
    black: 4,
    pink: 4,
    master: 5,
  });
  assert.equal(game.trainers[0].name, "小智");
  assert.equal(game.trainers[1].name, "小霞");
  assert.equal(game.activeTrainerIndex, 0);
});

test("new game deals four visible Pokémon per tier and keeps the rest in its deck", () => {
  // Catches: exposing every card at once or losing the undealt cards that must refill the wild area.
  const pokemonCards = [
    { id: "one", tier: 1 },
    { id: "two", tier: 1 },
    { id: "three", tier: 1 },
    { id: "four", tier: 1 },
    { id: "five", tier: 1 },
  ];

  const game = createGame({ trainerNames: ["小智"], pokemonCards });

  assert.deepEqual(game.market.map((card) => card.id), ["one", "two", "three", "four"]);
  assert.deepEqual(game.decks[1].map((card) => card.id), ["five"]);
  assert.deepEqual(game.decks[2], []);
  assert.deepEqual(game.decks[3], []);
});

test("shared colored ball supply scales for three and four trainers", () => {
  // Catches: multiplayer games starting with the two-player supply and running out too early.
  const threePlayerGame = createGame({ trainerNames: ["小智", "小霞", "小刚"] });
  const fourPlayerGame = createGame({ trainerNames: ["小智", "小霞", "小刚", "小茂"] });

  assert.equal(threePlayerGame.bank.red, 5);
  assert.equal(threePlayerGame.bank.black, 5);
  assert.equal(fourPlayerGame.bank.red, 7);
  assert.equal(fourPlayerGame.bank.black, 7);
  assert.equal(fourPlayerGame.bank.master, 5);
});

test("new game reveals one rare and one legendary Pokémon from separate decks", () => {
  // Catches: mixing rare and legendary cards into one public row or revealing player-count-plus-one cards.
  const rarePokemonCards = [{ id: "aerodactyl" }, { id: "ditto" }];
  const legendaryPokemonCards = [{ id: "mewtwo" }, { id: "mew" }];

  const game = createGame({ trainerNames: ["小智", "小霞", "小刚"], rarePokemonCards, legendaryPokemonCards });

  assert.deepEqual(game.specialPokemon.rare?.map((card) => card.id), ["aerodactyl"]);
  assert.deepEqual(game.specialPokemon.legendary?.map((card) => card.id), ["mewtwo"]);
  assert.deepEqual(game.specialDecks.rare?.map((card) => card.id), ["ditto"]);
  assert.deepEqual(game.specialDecks.legendary?.map((card) => card.id), ["mew"]);
});

test("capturing a rare Pokémon is its own main action and refills only the rare slot", () => {
  // Catches: treating rare Pokémon as an automatic end-of-turn encounter or refilling from the wrong deck.
  const rarePokemonCards = [
    { id: "aerodactyl", name: "化石翼龙", points: 0, requirement: { yellow: 2 }, bonus: { yellow: 2 } },
    { id: "ditto", name: "百变怪", points: 0, requirement: { pink: 1 }, bonus: { pink: 2 } },
  ];
  const legendaryPokemonCards = [
    { id: "mewtwo", name: "超梦", points: 2, requirement: { black: 2 } },
  ];
  const game = createGame({ trainerNames: ["小智", "小霞"], rarePokemonCards, legendaryPokemonCards });
  game.trainers[0].bonuses.yellow = 2;

  const next = captureSpecialPokemon(game, "rare", "aerodactyl");

  assert.equal(next.trainers[0].score, 0);
  assert.equal(next.trainers[0].bonuses.yellow, 4);
  assert.deepEqual(next.trainers[0].specialPokemon.map((card) => card.id), ["aerodactyl"]);
  assert.deepEqual(next.specialPokemon.rare.map((card) => card.id), ["ditto"]);
  assert.deepEqual(next.specialPokemon.legendary.map((card) => card.id), ["mewtwo"]);
  assert.equal(next.activeTrainerIndex, 1);
  assert.equal(next.turn, 2);
  assert.equal(next.phase, "action");
});

test("capturing a special Pokémon pays required master balls but only checks colored discounts", () => {
  // Catches: treating printed master balls as permanent discounts or spending colored balls for special Pokémon.
  const rarePokemonCards = [
    { id: "aerodactyl", name: "化石翼龙", points: 0, requirement: { blue: 3, pink: 2 }, masterCost: 1, bonus: { yellow: 2 } },
  ];
  const game = createGame({ trainerNames: ["小智", "小霞"], rarePokemonCards });
  game.trainers[0].bonuses.blue = 3;
  game.trainers[0].bonuses.pink = 2;
  game.trainers[0].balls.blue = 3;
  game.trainers[0].balls.pink = 2;
  game.trainers[0].balls.master = 1;
  game.bank.master = 4;

  const next = captureSpecialPokemon(game, "rare", "aerodactyl");

  assert.equal(next.trainers[0].balls.master, 0);
  assert.equal(next.bank.master, 5);
  assert.equal(next.trainers[0].balls.blue, 3);
  assert.equal(next.trainers[0].balls.pink, 2);
  assert.equal(next.trainers[0].bonuses.yellow, 2);
});

test("capturing a legendary Pokémon does not spend balls and may lead to evolution", () => {
  // Catches: charging printed resources for legendary capture or skipping the normal post-action evolution check.
  const legendaryPokemonCards = [
    { id: "mewtwo", name: "超梦", points: 2, requirement: { black: 2 }, bonus: { red: 2 } },
  ];
  const game = createGame({ trainerNames: ["小智", "小霞"], legendaryPokemonCards });
  game.trainers[0].bonuses.black = 2;
  game.trainers[0].bonuses.red = 1;
  game.trainers[0].captured = [{
    id: "charmander",
    name: "小火龙",
    tier: 1,
    points: 1,
    bonus: "red",
    evolvesTo: "charmeleon",
    evolutionRequirement: { red: 3 },
  }];
  game.market = [{ id: "charmeleon", name: "火恐龙", tier: 2, points: 3, bonus: "red", cost: { blue: 4 } }];

  const next = captureSpecialPokemon(game, "legendary", "mewtwo");

  assert.equal(next.phase, "evolution");
  assert.equal(next.activeTrainerIndex, 0);
  assert.equal(next.trainers[0].balls.blue, 0);
  assert.equal(next.trainers[0].bonuses.red, 3);
  assert.deepEqual(listEvolutionOptions(next).map((option) => option.cardId), ["charmander"]);
});

test("taking three distinct balls transfers them and advances the active trainer", () => {
  // Catches: resources moving in the wrong direction or a completed action not ending the turn.
  const game = createGame({ trainerNames: ["小智", "小霞"] });

  const next = takeBalls(game, ["red", "blue", "yellow"]);

  assert.equal(next.bank.red, 3);
  assert.equal(next.bank.blue, 3);
  assert.equal(next.bank.yellow, 3);
  assert.equal(next.trainers[0].balls.red, 1);
  assert.equal(next.trainers[0].balls.blue, 1);
  assert.equal(next.trainers[0].balls.yellow, 1);
  assert.equal(next.activeTrainerIndex, 1);
  assert.equal(next.turn, 2);
  assert.equal(game.bank.red, 4);
});

test("reaching eighteen points finishes the round before ending the game", () => {
  // Catches: ending immediately and denying later seats the same number of turns.
  let game = createGame({ trainerNames: ["小智", "小霞", "小刚"] });
  game.trainers[0].score = 18;

  game = takeBalls(game, ["red", "blue", "yellow"]);
  assert.equal(game.finalRoundTriggeredBy, 0);
  assert.equal(game.phase, "action");
  assert.equal(game.activeTrainerIndex, 1);

  game = takeBalls(game, ["red", "blue", "yellow"]);
  assert.equal(game.phase, "action");
  assert.equal(game.activeTrainerIndex, 2);

  game = takeBalls(game, ["red", "blue", "yellow"]);
  assert.equal(game.phase, "game-over");
  assert.deepEqual(game.winnerTrainerIndexes, [0]);
  assert.throws(() => takeBalls(game, ["red", "blue", "yellow"]), /对局已经结束/);
});

test("a tied final score favors the trainer with fewer acquired Pokémon cards", () => {
  // Catches: declaring all top scorers winners without applying the card-count tiebreaker.
  let game = createGame({ trainerNames: ["小智", "小霞", "小刚"] });
  game.trainers[0].score = 18;
  game.trainers[0].captured = [{ id: "a" }, { id: "b" }];
  game.trainers[1].score = 18;
  game.trainers[1].captured = [{ id: "c" }];

  game = takeBalls(game, ["red", "blue", "yellow"]);
  game = takeBalls(game, ["red", "blue", "yellow"]);
  game = takeBalls(game, ["red", "blue", "yellow"]);

  assert.deepEqual(game.winnerTrainerIndexes, [1]);
});

test("rare and legendary Pokémon count in the final tiebreaker while evolution remains one card", () => {
  // Catches: ignoring special Pokémon in the tiebreaker or counting an evolution replacement as two cards.
  let game = createGame({ trainerNames: ["小智", "小霞", "小刚"] });
  game.trainers[0].score = 18;
  game.trainers[0].captured = [{ id: "evolved-fox" }];
  game.trainers[0].evolutionHistory = [{ cardId: "evolved-fox", fromName: "炽尾狐", toName: "焰尾狐" }];
  game.trainers[0].specialPokemon = [{ id: "mewtwo" }];
  game.trainers[1].score = 18;
  game.trainers[1].captured = [{ id: "a" }];

  game = takeBalls(game, ["red", "blue", "yellow"]);
  game = takeBalls(game, ["red", "blue", "yellow"]);
  game = takeBalls(game, ["red", "blue", "yellow"]);

  assert.deepEqual(game.winnerTrainerIndexes, [1]);
});

test("taking duplicate ball colors is rejected before state changes", () => {
  // Catches: accepting an illegal BGA-style selection as if it were three different colors.
  const game = createGame({ trainerNames: ["小智", "小霞"] });

  assert.throws(() => takeBalls(game, ["red", "red", "blue"]), /不同颜色/);
  assert.equal(game.bank.red, 4);
  assert.equal(game.trainers[0].balls.red, 0);
});

test("taking different colors requires three while three or more colors remain", () => {
  // Catches: ending a turn after taking only one or two colors despite a full supply.
  const game = createGame({ trainerNames: ["小智", "小霞"] });

  assert.throws(() => takeBalls(game, ["red", "blue"]), /必须拿取3种/);
  assert.equal(game.activeTrainerIndex, 0);
});

test("taking different colors uses every available color when fewer than three remain", () => {
  // Catches: making a depleted late-game supply impossible to use, or allowing one available color to be skipped.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.bank.yellow = 0;
  game.bank.pink = 0;
  game.bank.black = 0;

  assert.throws(() => takeBalls(game, ["red"]), /全部2种/);
  const next = takeBalls(game, ["red", "blue"]);

  assert.equal(next.trainers[0].balls.red, 1);
  assert.equal(next.trainers[0].balls.blue, 1);
  assert.equal(next.activeTrainerIndex, 1);
});

test("taking two balls of one color requires at least four in that supply", () => {
  // Catches: using the same-color action below its four-ball threshold.
  const game = createGame({ trainerNames: ["小智", "小霞"] });

  const next = takeTwoBalls(game, "red");
  assert.equal(next.bank.red, 2);
  assert.equal(next.trainers[0].balls.red, 2);
  assert.equal(next.activeTrainerIndex, 1);

  game.bank.red = 3;
  assert.throws(() => takeTwoBalls(game, "red"), /至少有4个/);
});

test("exceeding ten held balls pauses the turn until the excess is returned", () => {
  // Catches: advancing the turn while a trainer illegally holds more than ten balls.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.trainers[0].balls = { red: 2, blue: 2, yellow: 2, pink: 2, black: 1, master: 0 };

  const overLimit = takeBalls(game, ["red", "blue", "yellow"]);
  assert.equal(overLimit.phase, "return-balls");
  assert.equal(overLimit.activeTrainerIndex, 0);

  assert.throws(() => returnBalls(overLimit, ["red"]), /归还2个/);
  const next = returnBalls(overLimit, ["red", "blue"]);
  assert.equal(next.trainers[0].balls.red, 2);
  assert.equal(next.trainers[0].balls.blue, 2);
  assert.equal(next.bank.red, 4);
  assert.equal(next.bank.blue, 4);
  assert.equal(next.phase, "action");
  assert.equal(next.activeTrainerIndex, 1);
});

test("a master ball gained by reserving also respects the ten-ball limit", () => {
  // Catches: applying the limit to normal takes but skipping the same rule after a reservation reward.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.trainers[0].balls = { red: 2, blue: 2, yellow: 2, pink: 2, black: 2, master: 0 };
  game.market = [{ id: "star-dragon", name: "星翼龙", points: 5, bonus: "red", cost: { red: 4 } }];

  const next = reservePokemon(game, "star-dragon");

  assert.equal(next.trainers[0].balls.master, 1);
  assert.equal(next.phase, "return-balls");
  assert.equal(next.activeTrainerIndex, 0);
});

test("capturing pays the discounted cost and grants score and permanent bonus", () => {
  // Catches: ignoring permanent bonuses or granting the card without returning spent balls.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.market = [{ id: "ember-fox", name: "炽尾狐", points: 1, bonus: "yellow", cost: { red: 2, blue: 1 } }];
  game.trainers[0].bonuses.red = 1;
  game.trainers[0].balls.red = 1;
  game.trainers[0].balls.blue = 1;

  const next = capturePokemon(game, "ember-fox");

  assert.equal(next.trainers[0].balls.red, 0);
  assert.equal(next.trainers[0].balls.blue, 0);
  assert.equal(next.bank.red, 5);
  assert.equal(next.bank.blue, 5);
  assert.equal(next.trainers[0].score, 1);
  assert.equal(next.trainers[0].bonuses.yellow, 1);
  assert.deepEqual(next.trainers[0].captured.map((card) => card.id), ["ember-fox"]);
  assert.equal(next.market.length, 0);
  assert.equal(next.activeTrainerIndex, 1);
});

test("capturing a visible Pokémon refills its tier from the top of the deck", () => {
  // Catches: leaving a permanent hole in the wild area or drawing from the wrong tier.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.market = [{ id: "ember-fox", tier: 1, name: "炽尾狐", points: 0, bonus: "red", cost: {} }];
  game.decks[1] = [{ id: "bud-deer", tier: 1, name: "芽灵鹿", points: 0, bonus: "yellow", cost: {} }];
  game.decks[2] = [{ id: "black-cat", tier: 2, name: "夜巡猫", points: 1, bonus: "black", cost: {} }];

  const next = capturePokemon(game, "ember-fox");

  assert.deepEqual(next.market.map((card) => card.id), ["bud-deer"]);
  assert.deepEqual(next.decks[1], []);
  assert.deepEqual(next.decks[2].map((card) => card.id), ["black-cat"]);
});

test("capturing a personally reserved Pokémon pays its cost and removes it from the reservation", () => {
  // Catches: restricting capture to the wild area or leaving a captured card duplicated in the reservation.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.trainers[0].reserved = [{ id: "black-cat", tier: 2, name: "夜巡猫", points: 2, bonus: "black", cost: { red: 2, pink: 1 } }];
  game.trainers[0].bonuses.red = 1;
  game.trainers[0].balls.red = 1;
  game.trainers[0].balls.pink = 1;
  game.market = [{ id: "ember-fox", tier: 1, name: "炽尾狐", points: 0, bonus: "red", cost: {} }];

  const next = capturePokemon(game, "black-cat");

  assert.deepEqual(next.trainers[0].reserved, []);
  assert.deepEqual(next.trainers[0].captured.map((card) => card.id), ["black-cat"]);
  assert.equal(next.trainers[0].score, 2);
  assert.equal(next.trainers[0].bonuses.black, 1);
  assert.equal(next.trainers[0].balls.red, 0);
  assert.equal(next.trainers[0].balls.pink, 0);
  assert.deepEqual(next.market.map((card) => card.id), ["ember-fox"]);
  assert.equal(next.activeTrainerIndex, 1);
});

test("a trainer cannot capture another trainer's reserved Pokémon", () => {
  // Catches: searching every trainer's private reservation instead of only the active trainer's cards.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.trainers[1].reserved = [{ id: "star-dragon", name: "星翼龙", points: 5, bonus: "red", cost: {} }];

  assert.throws(() => capturePokemon(game, "star-dragon"), /没有这只宝可梦/);
  assert.deepEqual(game.trainers[1].reserved.map((card) => card.id), ["star-dragon"]);
  assert.equal(game.activeTrainerIndex, 0);
});

test("capture quote also evaluates the active trainer's reserved Pokémon", () => {
  // Catches: the interface disabling an affordable reserved card because quotes only inspect the wild area.
  const game = createGame({ trainerNames: ["小智"] });
  game.trainers[0].reserved = [{ id: "flower-sheep", name: "花角羊", points: 1, bonus: "yellow", cost: { yellow: 2 } }];
  game.trainers[0].bonuses.yellow = 1;
  game.trainers[0].balls.yellow = 1;

  assert.deepEqual(getCaptureQuote(game, "flower-sheep"), {
    canCapture: true,
    coloredPayment: { yellow: 1 },
    masterPayment: 0,
    missing: {},
  });
});

test("reserving removes a card from the wild and grants one master ball", () => {
  // Catches: a reserved card remaining public or the master ball moving in the wrong direction.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.market = [{ id: "star-dragon", tier: 3, name: "星翼龙", points: 5, bonus: "red", cost: { red: 4 } }];
  game.decks[3] = [{ id: "aurora-whale", tier: 3, name: "极光鲸", points: 4, bonus: "blue", cost: {} }];

  const next = reservePokemon(game, "star-dragon");

  assert.deepEqual(next.trainers[0].reserved.map((card) => card.id), ["star-dragon"]);
  assert.equal(next.trainers[0].balls.master, 1);
  assert.equal(next.bank.master, 4);
  assert.deepEqual(next.market.map((card) => card.id), ["aurora-whale"]);
  assert.deepEqual(next.decks[3], []);
  assert.equal(next.activeTrainerIndex, 1);
});

test("blind reservation takes the top card without changing the visible wild area", () => {
  // Catches: revealing/removing a visible card or drawing from the wrong level during a blind reservation.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.market = [{ id: "flower-sheep", tier: 2, name: "花角羊" }];
  game.decks[2] = [{ id: "tide-otter", tier: 2, name: "潮音獭", points: 2, bonus: "blue", cost: {} }];

  const next = reservePokemonFromDeck(game, 2);

  assert.deepEqual(next.trainers[0].reserved.map((card) => card.id), ["tide-otter"]);
  assert.deepEqual(next.market.map((card) => card.id), ["flower-sheep"]);
  assert.deepEqual(next.decks[2], []);
  assert.equal(next.trainers[0].balls.master, 1);
  assert.equal(next.activeTrainerIndex, 1);
});

test("blind reservation rejects an empty deck before changing the turn", () => {
  // Catches: reserving an undefined card and consuming a turn from an exhausted level.
  const game = createGame({ trainerNames: ["小智", "小霞"] });

  assert.throws(() => reservePokemonFromDeck(game, 2), /牌堆已经没有/);
  assert.equal(game.activeTrainerIndex, 0);
  assert.deepEqual(game.trainers[0].reserved, []);
});

test("blind reservation respects the three-card reservation limit", () => {
  // Catches: bypassing the personal reservation limit by drawing from a deck instead of the visible area.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.trainers[0].reserved = [{ id: "a" }, { id: "b" }, { id: "c" }];
  game.decks[1] = [{ id: "fourth", tier: 1 }];

  assert.throws(() => reservePokemonFromDeck(game, 1), /最多只能预留三只/);
  assert.deepEqual(game.decks[1].map((card) => card.id), ["fourth"]);
});

test("capture quote reports missing colored resources after permanent discounts", () => {
  // Catches: the UI highlighting a card as affordable using the printed rather than discounted cost.
  const game = createGame({ trainerNames: ["小智"] });
  game.market = [{ id: "black-cat", name: "夜巡猫", points: 1, bonus: "black", cost: { red: 3, pink: 2 } }];
  game.trainers[0].bonuses.red = 1;
  game.trainers[0].balls.red = 1;
  game.trainers[0].balls.pink = 2;
  game.trainers[0].balls.master = 1;

  assert.deepEqual(getCaptureQuote(game, "black-cat"), {
    canCapture: true,
    coloredPayment: { red: 1, pink: 2 },
    masterPayment: 1,
    missing: {},
  });
});

test("a completed action pauses before changing trainer when an evolution is available", () => {
  // Catches: ending the turn before checking for an owned card whose target evolution is visible.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.trainers[0].captured = [{
    id: "ember-fox",
    name: "炽尾狐",
    points: 0,
    bonus: "red",
    evolvesTo: "flare-fox",
    evolutionRequirement: { red: 2 },
  }, { id: "red-bird", name: "火羽雀", points: 0, bonus: "red" }];
  game.trainers[0].bonuses.red = 2;
  game.market = [{ id: "flare-fox", tier: 2, name: "焰尾狐", points: 2, bonus: "red", cost: { red: 3 } }];

  const next = takeBalls(game, ["blue", "yellow", "pink"]);

  assert.equal(next.phase, "evolution");
  assert.equal(next.activeTrainerIndex, 0);
  assert.equal(next.turn, 1);
});

test("special discount bonuses count toward evolution requirements", () => {
  // Catches: using ordinary card counts instead of permanent discount totals for evolution.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.trainers[0].captured = [{
    id: "ember-fox",
    name: "炽尾狐",
    points: 0,
    bonus: "red",
    evolvesTo: "legacy-flare-fox",
    evolutionRequirement: { red: 3 },
  }];
  game.trainers[0].bonuses.red = 3;
  game.market = [{ id: "legacy-flare-fox", name: "焰尾狐", points: 2, bonus: "red", cost: {} }];

  const next = takeBalls(game, ["blue", "yellow", "pink"]);

  assert.equal(next.phase, "evolution");
  assert.equal(next.activeTrainerIndex, 0);
});

test("evolution options require the target card to be visible or personally reserved", () => {
  // Catches: allowing evolution when the target form is only in the deck or another trainer's reservation.
  const game = createGame({ trainerNames: ["小智"] });
  game.phase = "evolution";
  game.trainers[0].captured = [{
    id: "ember-fox",
    name: "炽尾狐",
    points: 0,
    bonus: "red",
    evolvesTo: "flare-fox",
    evolutionRequirement: { red: 2 },
  }, { id: "red-bird", name: "火羽雀", points: 0, bonus: "red" }];
  game.trainers[0].reserved = [{ id: "flare-fox", name: "焰尾狐", tier: 2, points: 2, bonus: "red", cost: { red: 3 } }];
  game.trainers[0].bonuses.red = 2;

  assert.deepEqual(listEvolutionOptions(game), [{
    cardId: "ember-fox",
    targetCardId: "flare-fox",
    targetLocation: "reserved",
    fromName: "炽尾狐",
    toName: "焰尾狐",
    requirement: { red: 2 },
  }]);
});

test("evolution can target any visible card with the printed evolved name", () => {
  // Catches: binding evolution to one generated id when the physical deck has multiple cards with the same evolved Pokémon name.
  const game = createGame({ trainerNames: ["小智"] });
  game.phase = "evolution";
  game.trainers[0].captured = [{
    id: "charmander-a",
    name: "小火龙",
    points: 1,
    bonus: "blue",
    evolvesToName: "火恐龙",
    evolutionRequirement: { yellow: 3 },
  }];
  game.trainers[0].bonuses.yellow = 3;
  game.market = [{ id: "charmeleon-b", name: "火恐龙", tier: 3, points: 3, bonus: "blue", cost: { red: 4, black: 1 } }];

  assert.deepEqual(listEvolutionOptions(game), [{
    cardId: "charmander-a",
    targetCardId: "charmeleon-b",
    targetLocation: "market",
    fromName: "小火龙",
    toName: "火恐龙",
    requirement: { yellow: 3 },
  }]);
});

test("evolving replaces the owned card with a visible target and refills the target tier", () => {
  // Catches: keeping both forms, paying balls, adding a second discount, or failing to refill the wild area.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  const base = {
    id: "ember-fox",
    name: "炽尾狐",
    points: 1,
    bonus: "red",
    evolvesTo: "flare-fox",
    evolutionRequirement: { red: 2 },
  };
  game.phase = "evolution";
  game.trainers[0].captured = [base, { id: "red-bird", name: "火羽雀", points: 1, bonus: "red" }];
  game.trainers[0].score = 2;
  game.trainers[0].bonuses.red = 2;
  game.market = [{ id: "flare-fox", tier: 2, name: "焰尾狐", points: 3, bonus: "red", cost: { red: 3 } }];
  game.decks[2] = [{ id: "tide-otter", tier: 2, name: "潮音獭", points: 2, bonus: "blue", cost: {} }];

  const next = evolvePokemon(game, "ember-fox");

  assert.deepEqual(next.trainers[0].captured.map((card) => card.id), ["flare-fox", "red-bird"]);
  assert.equal(next.trainers[0].captured[0].name, "焰尾狐");
  assert.equal(next.trainers[0].captured[0].points, 3);
  assert.equal(next.trainers[0].captured[0].bonus, "red");
  assert.equal(next.trainers[0].captured[0].evolved, true);
  assert.deepEqual(next.trainers[0].evolutionHistory, [{ fromCardId: "ember-fox", toCardId: "flare-fox", fromName: "炽尾狐", toName: "焰尾狐" }]);
  assert.equal(next.trainers[0].score, 4);
  assert.equal(next.trainers[0].bonuses.red, 2);
  assert.deepEqual(next.market.map((card) => card.id), ["tide-otter"]);
  assert.equal(next.phase, "action");
  assert.equal(next.activeTrainerIndex, 1);
  assert.equal(next.turn, 2);
});

test("skipping an optional evolution ends the current trainer turn", () => {
  // Catches: trapping the trainer in an optional phase when they choose not to evolve.
  const game = createGame({ trainerNames: ["小智", "小霞"] });
  game.phase = "evolution";

  const next = skipEvolution(game);

  assert.equal(next.phase, "action");
  assert.equal(next.activeTrainerIndex, 1);
  assert.equal(next.turn, 2);
});

test("a normal action is rejected while the trainer is choosing an evolution", () => {
  // Catches: taking a second main action before the optional evolution phase is resolved.
  const game = createGame({ trainerNames: ["小智"] });
  game.phase = "evolution";

  assert.throws(() => takeBalls(game, ["red"]), /进化阶段/);
  assert.equal(game.bank.red, 4);
});
