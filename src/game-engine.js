export const coloredBallTypes = ["red", "blue", "yellow", "black", "pink"];

const emptyBalls = () => ({
  red: 0,
  blue: 0,
  yellow: 0,
  black: 0,
  pink: 0,
  master: 0,
});

const emptyBonuses = () => ({
  red: 0,
  blue: 0,
  yellow: 0,
  black: 0,
  pink: 0,
});

export function createGame({ trainerNames, pokemonCards = [], rarePokemonCards = [], legendaryPokemonCards = [] }) {
  const coloredBallSupply = trainerNames.length >= 4 ? 7 : trainerNames.length === 3 ? 5 : 4;
  const market = [];
  const decks = { 1: [], 2: [], 3: [] };
  for (const tier of [1, 2, 3]) {
    const tierCards = pokemonCards.filter((card) => card.tier === tier).map((card) => structuredClone(card));
    market.push(...tierCards.slice(0, 4));
    decks[tier] = tierCards.slice(4);
  }

  return {
    bank: {
      red: coloredBallSupply,
      blue: coloredBallSupply,
      yellow: coloredBallSupply,
      black: coloredBallSupply,
      pink: coloredBallSupply,
      master: 5,
    },
    trainers: trainerNames.map((name) => ({
      name,
      score: 0,
      balls: emptyBalls(),
      bonuses: emptyBonuses(),
      captured: [],
      reserved: [],
      specialPokemon: [],
      evolutionHistory: [],
    })),
    activeTrainerIndex: 0,
    phase: "action",
    turn: 1,
    finalRoundTriggeredBy: null,
    winnerTrainerIndexes: [],
    market,
    decks,
    specialPokemon: {
      rare: rarePokemonCards.slice(0, 1).map((card) => structuredClone(card)),
      legendary: legendaryPokemonCards.slice(0, 1).map((card) => structuredClone(card)),
    },
    specialDecks: {
      rare: rarePokemonCards.slice(1).map((card) => structuredClone(card)),
      legendary: legendaryPokemonCards.slice(1).map((card) => structuredClone(card)),
    },
    log: ["对局开始"],
  };
}

function meetsRequirement(bonuses, requirement = {}) {
  return Object.entries(requirement).every(([ballType, amount]) => (bonuses[ballType] ?? 0) >= amount);
}

function meetsSpecialRequirement(bonuses, card) {
  if (card.anyRequirement) {
    const qualifyingColors = coloredBallTypes.filter((type) => bonuses[type] >= card.anyRequirement.amount).length;
    return qualifyingColors >= card.anyRequirement.colors;
  }
  return meetsRequirement(bonuses, card.requirement);
}

function canPaySpecialMasterCost(trainer, card) {
  return trainer.balls.master >= (card.masterCost ?? 0);
}

function findEvolutionTarget(game, trainer, pokemon) {
  if (!pokemon.evolvesTo && !pokemon.evolvesToName) return null;
  const matchesTarget = (candidate) => candidate.id === pokemon.evolvesTo || candidate.name === pokemon.evolvesToName;
  const marketCard = game.market.find(matchesTarget);
  if (marketCard) return { card: marketCard, location: "market" };
  const reservedCard = trainer.reserved.find(matchesTarget);
  if (reservedCard) return { card: reservedCard, location: "reserved" };
  return null;
}

function canEvolve(game, trainer, pokemon) {
  return Boolean(pokemon.evolvesTo || pokemon.evolvesToName)
    && meetsRequirement(trainer.bonuses, pokemon.evolutionRequirement)
    && Boolean(findEvolutionTarget(game, trainer, pokemon));
}

function completeAction(game) {
  const trainer = game.trainers[game.activeTrainerIndex];
  if (trainer.captured.some((pokemon) => canEvolve(game, trainer, pokemon))) {
    game.phase = "evolution";
    return game;
  }
  return finishTurn(game);
}

function ballCount(trainer) {
  return Object.values(trainer.balls).reduce((total, amount) => total + amount, 0);
}

function completeBallGain(game) {
  if (ballCount(game.trainers[game.activeTrainerIndex]) > 10) {
    game.phase = "return-balls";
    return game;
  }
  return completeAction(game);
}

function acquiredPokemonCount(trainer) {
  return trainer.captured.length + (trainer.specialPokemon?.length ?? 0);
}

function finishTurn(game) {
  const completedTrainerIndex = game.activeTrainerIndex;
  if (game.finalRoundTriggeredBy === null && game.trainers[completedTrainerIndex].score >= 18) {
    game.finalRoundTriggeredBy = completedTrainerIndex;
    game.log.push(`${game.trainers[completedTrainerIndex].name}达到18分，进入最终轮`);
  }

  const nextTrainerIndex = (completedTrainerIndex + 1) % game.trainers.length;
  game.activeTrainerIndex = nextTrainerIndex;
  game.turn += 1;
  if (game.finalRoundTriggeredBy !== null && nextTrainerIndex === 0) {
    const highestScore = Math.max(...game.trainers.map((trainer) => trainer.score));
    const topScorers = game.trainers
      .map((trainer, index) => ({ trainer, index }))
      .filter(({ trainer }) => trainer.score === highestScore);
    const fewestCards = Math.min(...topScorers.map(({ trainer }) => acquiredPokemonCount(trainer)));
    game.winnerTrainerIndexes = topScorers
      .filter(({ trainer }) => acquiredPokemonCount(trainer) === fewestCards)
      .map(({ index }) => index);
    game.phase = "game-over";
    game.log.push(`对局结束：${game.winnerTrainerIndexes.map((index) => game.trainers[index].name).join("、")}获胜`);
    return game;
  }
  game.phase = "action";
  return game;
}

function assertActionPhase(game) {
  if (game.phase === "game-over") throw new Error("对局已经结束");
  if (game.phase === "evolution") throw new Error("请先完成或跳过进化阶段");
  if (game.phase === "return-balls") throw new Error("请先将持有的精灵球归还至10个");
}

export function listSpecialCaptureOptions(game) {
  const trainer = game.trainers[game.activeTrainerIndex];
  return ["rare", "legendary"].flatMap((type) => {
    const card = game.specialPokemon?.[type]?.[0];
    return card && meetsSpecialRequirement(trainer.bonuses, card) && canPaySpecialMasterCost(trainer, card) ? [{ type, card }] : [];
  });
}

export function captureSpecialPokemon(game, type, cardId) {
  assertActionPhase(game);
  if (!["rare", "legendary"].includes(type)) throw new Error("未知的特殊宝可梦类型");
  const visibleCard = game.specialPokemon?.[type]?.find((card) => card.id === cardId);
  if (!visibleCard) throw new Error("公共区域没有这只宝可梦");
  const trainer = game.trainers[game.activeTrainerIndex];
  if (!meetsSpecialRequirement(trainer.bonuses, visibleCard)) throw new Error("永久折扣尚未满足捕捉条件");
  if (!canPaySpecialMasterCost(trainer, visibleCard)) throw new Error("万能球不足，无法捕捉");

  const next = structuredClone(game);
  const nextTrainer = next.trainers[next.activeTrainerIndex];
  const claimedCard = structuredClone(visibleCard);
  nextTrainer.score += claimedCard.points ?? 0;
  nextTrainer.balls.master -= claimedCard.masterCost ?? 0;
  next.bank.master += claimedCard.masterCost ?? 0;
  for (const [ballType, amount] of Object.entries(claimedCard.bonus ?? {})) {
    nextTrainer.bonuses[ballType] += amount;
  }
  nextTrainer.specialPokemon.push(claimedCard);
  next.specialPokemon[type] = [];
  const replacement = next.specialDecks[type].shift();
  if (replacement) next.specialPokemon[type].push(replacement);
  next.log.push(`${nextTrainer.name}捕捉了${claimedCard.name}`);
  return completeAction(next);
}

function removeVisiblePokemon(game, cardId) {
  const card = game.market.find((candidate) => candidate.id === cardId);
  game.market = game.market.filter((candidate) => candidate.id !== cardId);
  const replacement = game.decks?.[card.tier]?.shift();
  if (replacement) game.market.push(replacement);
}

export function takeBalls(game, ballTypes) {
  assertActionPhase(game);
  if (new Set(ballTypes).size !== ballTypes.length) {
    throw new Error("请选择不同颜色的精灵球");
  }
  const availableTypes = coloredBallTypes.filter((ballType) => game.bank[ballType] > 0);
  const requiredCount = Math.min(3, availableTypes.length);
  if (requiredCount === 0) throw new Error("当前没有可拿取的彩色精灵球");
  if (ballTypes.length !== requiredCount) {
    throw new Error(requiredCount === 3 ? "必须拿取3种不同颜色的精灵球" : `必须拿取当前全部${requiredCount}种精灵球`);
  }
  if (ballTypes.some((ballType) => !coloredBallTypes.includes(ballType) || game.bank[ballType] < 1)) {
    throw new Error("所选精灵球当前不可拿取");
  }

  const next = structuredClone(game);
  const trainer = next.trainers[next.activeTrainerIndex];

  for (const ballType of ballTypes) {
    next.bank[ballType] -= 1;
    trainer.balls[ballType] += 1;
  }

  next.log.push(`${trainer.name}拿取了${ballTypes.length}个精灵球`);
  return completeBallGain(next);
}

export function takeTwoBalls(game, ballType) {
  assertActionPhase(game);
  if (!coloredBallTypes.includes(ballType)) {
    throw new Error("所选精灵球当前不可拿取");
  }
  if (game.bank[ballType] < 4) throw new Error("供应区至少有4个同色精灵球时才能拿取2个");

  const next = structuredClone(game);
  const trainer = next.trainers[next.activeTrainerIndex];
  next.bank[ballType] -= 2;
  trainer.balls[ballType] += 2;
  next.log.push(`${trainer.name}拿取了2个同色精灵球`);
  return completeBallGain(next);
}

export function returnBalls(game, ballTypes) {
  if (game.phase !== "return-balls") throw new Error("当前不需要归还精灵球");
  const trainer = game.trainers[game.activeTrainerIndex];
  const excess = ballCount(trainer) - 10;
  if (ballTypes.length !== excess) throw new Error(`需要归还${excess}个精灵球`);

  const returnCounts = {};
  for (const ballType of ballTypes) {
    if (!Object.hasOwn(trainer.balls, ballType)) throw new Error("所选精灵球无法归还");
    returnCounts[ballType] = (returnCounts[ballType] ?? 0) + 1;
  }
  if (Object.entries(returnCounts).some(([ballType, amount]) => trainer.balls[ballType] < amount)) {
    throw new Error("归还数量超过了当前持有数量");
  }

  const next = structuredClone(game);
  const nextTrainer = next.trainers[next.activeTrainerIndex];
  for (const ballType of ballTypes) {
    nextTrainer.balls[ballType] -= 1;
    next.bank[ballType] += 1;
  }
  next.log.push(`${nextTrainer.name}归还了${excess}个精灵球`);
  return completeAction(next);
}

export function capturePokemon(game, cardId) {
  assertActionPhase(game);
  const currentTrainer = game.trainers[game.activeTrainerIndex];
  const marketCard = game.market.find((candidate) => candidate.id === cardId);
  const reservedCard = currentTrainer.reserved.find((candidate) => candidate.id === cardId);
  const card = marketCard ?? reservedCard;
  if (!card) throw new Error("当前可捕捉区域中没有这只宝可梦");

  let masterNeeded = 0;
  for (const [ballType, amount] of Object.entries(card.cost ?? {})) {
    const discountedCost = Math.max(0, amount - (currentTrainer.bonuses[ballType] ?? 0));
    masterNeeded += Math.max(0, discountedCost - currentTrainer.balls[ballType]);
  }
  if (masterNeeded > currentTrainer.balls.master) throw new Error("精灵球不足，无法捕捉");

  const next = structuredClone(game);
  const trainer = next.trainers[next.activeTrainerIndex];
  for (const [ballType, amount] of Object.entries(card.cost ?? {})) {
    const discountedCost = Math.max(0, amount - (trainer.bonuses[ballType] ?? 0));
    const coloredPayment = Math.min(discountedCost, trainer.balls[ballType]);
    trainer.balls[ballType] -= coloredPayment;
    next.bank[ballType] += coloredPayment;
    const masterPayment = discountedCost - coloredPayment;
    trainer.balls.master -= masterPayment;
    next.bank.master += masterPayment;
  }

  trainer.score += card.points ?? 0;
  trainer.bonuses[card.bonus] += 1;
  trainer.captured.push(structuredClone(card));
  if (marketCard) {
    removeVisiblePokemon(next, cardId);
  } else {
    trainer.reserved = trainer.reserved.filter((candidate) => candidate.id !== cardId);
  }
  next.log.push(`${trainer.name}捕捉了${card.name}`);
  return completeAction(next);
}

export function reservePokemon(game, cardId) {
  assertActionPhase(game);
  const card = game.market.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error("野外区域中没有这只宝可梦");
  const currentTrainer = game.trainers[game.activeTrainerIndex];
  if (currentTrainer.reserved.length >= 3) throw new Error("最多只能预留三只宝可梦");

  const next = structuredClone(game);
  const trainer = next.trainers[next.activeTrainerIndex];
  trainer.reserved.push(structuredClone(card));
  removeVisiblePokemon(next, cardId);
  if (next.bank.master > 0) {
    next.bank.master -= 1;
    trainer.balls.master += 1;
  }
  next.log.push(`${trainer.name}预留了${card.name}`);
  return completeBallGain(next);
}

export function reservePokemonFromDeck(game, tier) {
  assertActionPhase(game);
  const currentTrainer = game.trainers[game.activeTrainerIndex];
  if (currentTrainer.reserved.length >= 3) throw new Error("最多只能预留三只宝可梦");
  if (![1, 2, 3].includes(Number(tier)) || !game.decks?.[tier]?.length) throw new Error("所选等级的牌堆已经没有宝可梦");

  const next = structuredClone(game);
  const trainer = next.trainers[next.activeTrainerIndex];
  trainer.reserved.push(next.decks[tier].shift());
  if (next.bank.master > 0) {
    next.bank.master -= 1;
    trainer.balls.master += 1;
  }
  next.log.push(`${trainer.name}从${tier}级牌堆盲预留了一只宝可梦`);
  return completeBallGain(next);
}

export function getCaptureQuote(game, cardId) {
  const trainer = game.trainers[game.activeTrainerIndex];
  const card = game.market.find((candidate) => candidate.id === cardId)
    ?? trainer.reserved.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error("当前可捕捉区域中没有这只宝可梦");
  const coloredPayment = {};
  const missing = {};
  let masterAvailable = trainer.balls.master;
  let masterPayment = 0;

  for (const [ballType, amount] of Object.entries(card.cost ?? {})) {
    const discountedCost = Math.max(0, amount - (trainer.bonuses[ballType] ?? 0));
    coloredPayment[ballType] = Math.min(discountedCost, trainer.balls[ballType]);
    const shortage = discountedCost - coloredPayment[ballType];
    const masterForType = Math.min(shortage, masterAvailable);
    masterAvailable -= masterForType;
    masterPayment += masterForType;
    if (shortage > masterForType) missing[ballType] = shortage - masterForType;
  }

  return {
    canCapture: Object.keys(missing).length === 0,
    coloredPayment,
    masterPayment,
    missing,
  };
}

export function listEvolutionOptions(game) {
  const trainer = game.trainers[game.activeTrainerIndex];
  return trainer.captured.flatMap((pokemon) => {
    if (!canEvolve(game, trainer, pokemon)) return [];
    const target = findEvolutionTarget(game, trainer, pokemon);
    return [{
      cardId: pokemon.id,
      targetCardId: target.card.id,
      targetLocation: target.location,
      fromName: pokemon.name,
      toName: target.card.name,
      requirement: structuredClone(pokemon.evolutionRequirement),
    }];
  });
}

export function evolvePokemon(game, cardId) {
  if (game.phase !== "evolution") throw new Error("当前不在进化阶段");
  const option = listEvolutionOptions(game).find((candidate) => candidate.cardId === cardId);
  if (!option) throw new Error("当前不满足这条进化路线");

  const next = structuredClone(game);
  const trainer = next.trainers[next.activeTrainerIndex];
  const sourceIndex = trainer.captured.findIndex((card) => card.id === cardId);
  const source = trainer.captured[sourceIndex];
  const previousPoints = source.points ?? 0;
  const target = option.targetLocation === "market"
    ? next.market.find((card) => card.id === option.targetCardId)
    : trainer.reserved.find((card) => card.id === option.targetCardId);
  const evolvedCard = structuredClone(target);
  evolvedCard.evolved = true;
  evolvedCard.evolvedFrom = source.id;
  trainer.captured[sourceIndex] = evolvedCard;
  trainer.score += (evolvedCard.points ?? 0) - previousPoints;
  trainer.evolutionHistory.push({
    fromCardId: source.id,
    toCardId: evolvedCard.id,
    fromName: source.name,
    toName: evolvedCard.name,
  });

  if (option.targetLocation === "market") {
    removeVisiblePokemon(next, option.targetCardId);
  } else {
    trainer.reserved = trainer.reserved.filter((card) => card.id !== option.targetCardId);
  }

  next.log.push(`${trainer.name}将${source.name}进化为${evolvedCard.name}`);
  return finishTurn(next);
}

export function skipEvolution(game) {
  if (game.phase !== "evolution") throw new Error("当前没有可跳过的进化阶段");
  const next = structuredClone(game);
  next.log.push(`${next.trainers[next.activeTrainerIndex].name}跳过了进化`);
  return finishTurn(next);
}
