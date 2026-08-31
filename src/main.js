import {
  capturePokemon,
  captureSpecialPokemon,
  evolvePokemon,
  getCaptureQuote,
  listEvolutionOptions,
  listSpecialCaptureOptions,
  reservePokemon,
  reservePokemonFromDeck,
  returnBalls,
  skipEvolution,
  takeBalls,
  takeTwoBalls,
} from "./game-engine.js";
import { ballTypes, legendaryPokemonCards, masterBall, pokemonCards, rarePokemonCards } from "./data/card-manifest.js";
import { createRoom, getPlayerView } from "./room-view.js";
import { createOnlineClient } from "./online-client.js";

const onlineMode = typeof location !== "undefined" && new URLSearchParams(location.search).get("mode") !== "local";
let onlineClient = null;
let onlineRevision = -1;

function safeText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function canAct() {
  return !onlineMode || Boolean(onlineClient?.connected && !onlineClient.busy && viewerTrainerIndex === game?.activeTrainerIndex);
}

function playerView() { return onlineMode ? game : getPlayerView(room, viewerTrainerIndex); }
function evolutionOptions() { return onlineMode && viewerTrainerIndex !== game.activeTrainerIndex ? [] : listEvolutionOptions(game); }

let room;
let game;
let viewerTrainerIndex = 0;
let selectedBalls = [];
let selectedCardId = null;
let selectedDeckTier = null;
let selectedSpecial = null;
let logExpanded = false;
let actionError = "";
let message = "选择精灵球，或者点击一张宝可梦卡";

function newDemoRoom() {
  const next = createRoom({
    roomId: "local-demo-room",
    trainerNames: ["小智（你）", "小霞", "小刚"],
    pokemonCards,
    rarePokemonCards,
    legendaryPokemonCards,
  });
  next.game.log.push("轮到小智（你）行动");
  return next;
}

function setGame(nextGame) {
  room.game = nextGame;
  game = room.game;
}

function ballMeta(type) {
  return type === "master" ? masterBall : ballTypes.find((ball) => ball.id === type);
}

function ballToken(type, amount = "") {
  const meta = ballMeta(type);
  return `<span class="ball-token" style="--color:${meta.color}" title="${meta.label}">${amount}<img src="${meta.image}" alt=""></span>`;
}

function costMarkup(cost = {}) {
  return Object.entries(cost).map(([type, amount]) => ballToken(type, amount)).join("");
}

function requirementMarkup(requirement = {}, masterCost = 0) {
  return `${masterCost ? ballToken("master", masterCost) : ""}${Object.entries(requirement).map(([type, amount]) => ballToken(type, amount)).join("")}`;
}

function evolutionRequirementText(requirement = {}) {
  const trainer = game.trainers[game.activeTrainerIndex];
  return Object.entries(requirement).map(([type, amount]) => `${trainer.bonuses[type]}/${amount}`).join("、");
}

function bankMarkup() {
  return ballTypes.map((meta) => `
    <div class="ball-choice" style="--color:${meta.color}">
      <button class="ball ${selectedBalls.includes(meta.id) ? "selected" : ""}" data-action="ball" data-type="${meta.id}" aria-label="${meta.label}，剩余 ${game.bank[meta.id]} 个" aria-pressed="${selectedBalls.includes(meta.id)}" ${game.phase === "action" && game.bank[meta.id] > 0 ? "" : "disabled"}>
        <span class="ball-icon"><img src="${meta.image}" alt=""></span><b>${game.bank[meta.id]}</b>
      </button>
      <button class="take-two ${selectedBalls.length === 2 && selectedBalls.every((value) => value === meta.id) ? "selected" : ""}" data-action="take-two" data-type="${meta.id}" aria-label="拿取两个${meta.label}" title="供应至少 4 个时可拿同色 2 个" ${game.phase === "action" && game.bank[meta.id] >= 4 ? "" : "disabled"}>拿2</button>
    </div>`).join("") + `
    <div class="ball master" title="${masterBall.label}，预留时获得" aria-label="${masterBall.label}，剩余 ${game.bank.master} 个，预留时获得"><span class="ball-icon"><img src="${masterBall.image}" alt=""></span><b>${game.bank.master}</b><small>预留获得</small></div>`;
}

function cardMarkup(card, { variant = "market" } = {}) {
  const reserved = variant === "reserved";
  const quote = reserved && viewerTrainerIndex !== game.activeTrainerIndex ? { canCapture: false } : getCaptureQuote(game, card.id);
  const available = canAct() && game.phase === "action" && quote.canCapture;
  const status = onlineMode && !canAct() ? "等待你的回合 · 点击查看" : available ? "可捕捉" : reserved ? "暂不可捕捉 · 点击查看" : game.phase === "action" ? "暂不可捕捉 · 点击查看 / 预留" : "点击查看卡牌";
  return `<button class="pokemon-card ${reserved ? "reserved-card" : ""} ${available ? "available" : "unavailable"} ${selectedCardId === card.id ? "selected" : ""}" data-action="card" data-id="${card.id}" aria-pressed="${selectedCardId === card.id}" aria-label="${reserved ? "预留宝可梦 " : ""}${card.name}，${status}" title="${card.name} · ${status}">
    <img class="pokemon-image" src="${card.image}" alt="${card.name}">
  </button>`;
}

function deckMarkup(tier) {
  const activeTrainer = game.trainers[game.activeTrainerIndex];
  return `<button class="deck ${selectedDeckTier === tier ? "selected" : ""}" data-action="deck" data-tier="${tier}" aria-pressed="${selectedDeckTier === tier}" aria-label="${tier} 级牌库，剩余 ${game.decks[tier].length} 张，点击盲预留" title="点击卡背盲预留" ${game.phase === "action" && game.decks[tier].length > 0 && activeTrainer.reserved.length < 3 ? "" : "disabled"}><span>${"I".repeat(tier)}</span><b>牌库</b><small>剩余 ${game.decks[tier].length} 张</small></button>`;
}

function marketMarkup() {
  return [3, 2, 1].map((tier) => `<section class="market-row" aria-label="${tier} 级野外宝可梦">
    ${deckMarkup(tier)}
    <div class="card-row">${game.market.filter((card) => card.tier === tier).map((card) => cardMarkup(card)).join("")}</div>
  </section>`).join("");
}

function specialCardMarkup(type, card) {
  const eligible = canAct() && game.phase === "action" && listSpecialCaptureOptions(game).some((option) => option.type === type && option.card.id === card.id);
  const selected = selectedSpecial?.type === type && selectedSpecial?.id === card.id;
  return `<button class="rare-card ${eligible ? "eligible" : "unavailable"} ${selected ? "selected" : ""}" data-action="special-card" data-type="${type}" data-id="${card.id}" aria-pressed="${selected}" aria-label="${card.name}，${eligible ? "可捕捉" : "暂不可捕捉，点击查看条件"}" title="${eligible ? "可捕捉" : "点击查看捕捉条件"}">
    <img class="rare-image" src="${card.image}" alt="${card.name}">
  </button>`;
}

function specialMarkup() {
  return `<section class="rare-area panel">
    <header><h2>特殊宝可梦</h2></header>
    <div class="rare-card-row">
      <section class="special-slot"><h3>传说</h3>${game.specialPokemon.legendary.map((card) => specialCardMarkup("legendary", card)).join("") || '<p class="empty-state">传说牌堆已空</p>'}</section>
      <section class="special-slot"><h3>稀有</h3>${game.specialPokemon.rare.map((card) => specialCardMarkup("rare", card)).join("") || '<p class="empty-state">稀有牌堆已空</p>'}</section>
    </div>
  </section>`;
}

function trainerMarkup() {
  const viewerGame = playerView();
  const trainer = viewerGame.trainers[viewerTrainerIndex];
  const isActiveViewer = viewerTrainerIndex === game.activeTrainerIndex;
  const returning = isActiveViewer && game.phase === "return-balls";
  const ownedBallMarkup = [...ballTypes, masterBall].map((meta) => {
    const selectedCount = returning ? selectedBalls.filter((value) => value === meta.id).length : 0;
    const contents = `<img src="${meta.image}" alt="">${trainer.balls[meta.id]}${selectedCount ? `<small>归还 ${selectedCount}</small>` : ""}`;
    return returning
      ? `<button class="owned-ball returnable ${selectedCount ? "selected" : ""}" style="--color:${meta.color}" data-action="return-ball" data-type="${meta.id}" aria-label="归还${meta.label}，持有 ${trainer.balls[meta.id]}，已选 ${selectedCount}" ${trainer.balls[meta.id] > selectedCount ? "" : "disabled"}>${contents}</button>`
      : `<span class="owned-ball" title="${meta.label}" style="--color:${meta.color}">${contents}</span>`;
  }).join("");
  const bonusMarkup = ballTypes.map((meta) => `<span class="bonus-counter" title="${meta.label}永久折扣" style="--color:${meta.color}"><img src="${meta.image}" alt="">${trainer.bonuses[meta.id]}</span>`).join("");
  const reservedMarkup = Array.from({ length: 3 }, (_, index) => trainer.reserved[index]
    ? cardMarkup(trainer.reserved[index], { variant: "reserved" })
    : `<div class="reserved-slot" aria-label="第 ${index + 1} 个预留槽为空">可预留</div>`).join("");
  return `<section class="trainer-board panel ${isActiveViewer ? "is-active" : ""}">
    <div class="self-identity"><div class="trainer-name"><span>${viewerTrainerIndex + 1}</span><div><b>${safeText(trainer.name.replace("（你）", ""))}（你）</b><small>${game.phase === "game-over" ? "对局结束" : isActiveViewer ? `正在行动 · 第 ${game.turn} 次行动` : "等待行动"}</small></div></div><div class="self-score"><strong>${trainer.score}</strong> 分 <span>${game.phase === "game-over" ? "已结算" : returning ? "请归还精灵球" : isActiveViewer && game.phase === "evolution" ? "可以进化" : isActiveViewer ? "进行中" : "等待中"}</span></div></div>
    <div class="resource-group"><h3>精灵球 <small>${Object.values(trainer.balls).reduce((total, amount) => total + amount, 0)} / 10</small></h3><div class="owned-balls">${ownedBallMarkup}</div></div>
    <div class="resource-group"><h3>永久折扣</h3><div class="bonuses">${bonusMarkup}</div></div>
    <div class="reserved-collection"><h3>预留宝可梦 <small>${trainer.reserved.length} / 3</small></h3><div class="reserved-slots">${reservedMarkup}</div></div>
  </section>`;
}

function viewSwitcherMarkup() {
  if (onlineMode) return `<span>你的席位：${safeText(game.trainers[viewerTrainerIndex].name)}</span>`;
  const viewerGame = playerView();
  return `<div class="view-switcher" aria-label="本机视角">
    <span>本机视角</span>
    ${viewerGame.trainers.map((trainer, index) => `<button class="${index === viewerTrainerIndex ? "selected" : ""}" data-action="switch-view" data-index="${index}" aria-pressed="${index === viewerTrainerIndex}">${safeText(trainer.name.replace("（你）", ""))}</button>`).join("")}
  </div>`;
}

function opponentsMarkup() {
  const viewerGame = playerView();
  return viewerGame.trainers.map((trainer, index) => {
    if (index === viewerTrainerIndex) return "";
    const isActive = index === game.activeTrainerIndex;
    const heldBalls = Object.values(trainer.balls).reduce((total, amount) => total + amount, 0);
    const bonusMarkup = ballTypes.map((meta) => `<span class="bonus-counter" style="--color:${meta.color}"><img src="${meta.image}" alt="">${trainer.bonuses[meta.id]}</span>`).join("");
    const ballsMarkup = [...ballTypes, masterBall].map((meta) => `<span class="bonus-counter" title="${meta.label}"><img src="${meta.image}" alt="${meta.label}">${trainer.balls[meta.id]}</span>`).join("");
    return `<article class="opponent panel ${isActive ? "is-active" : ""}" ${isActive ? "aria-current=\"true\"" : ""}>
      <div class="opponent-heading"><span>${index + 1}</span><div><b>${safeText(trainer.name.replace("（你）", ""))}</b><small>${onlineMode ? onlineClient.view.members[index].online ? "在线 · " : "离线 · " : ""}${game.phase === "game-over" ? "对局结束" : isActive ? "● 当前行动" : "等待中"} · 预留 ${trainer.reservedCount} 张</small></div></div>
      <div class="opponent-stats"><span><strong>${trainer.score}</strong><small>分数</small></span><span><strong>${heldBalls}</strong><small>精灵球</small></span><span title="普通 ${trainer.captured.length} · 稀有 / 传说 ${trainer.specialPokemon.length}"><strong>${trainer.captured.length + trainer.specialPokemon.length}</strong><small>宝可梦</small></span></div>
      <div class="opponent-balls"><small>持有精灵球</small>${ballsMarkup}</div>
      <div class="opponent-bonuses"><small>永久折扣</small>${bonusMarkup}</div>
    </article>`;
  }).join("");
}

function inspectorMarkup() {
  if (selectedDeckTier !== null) {
    return `<aside class="inspector deck-inspector panel"><button class="close" data-action="close" aria-label="关闭">×</button><div class="deck-preview"><span>${"◆".repeat(selectedDeckTier)}</span><b>${game.decks[selectedDeckTier].length}</b></div><h2>${selectedDeckTier} 级牌堆</h2><div class="quote ready">获得1个万能球，野外区域不会变化。</div><button class="primary wide" data-action="reserve-deck" data-tier="${selectedDeckTier}" ${game.phase === "action" && game.decks[selectedDeckTier].length > 0 ? "" : "disabled"}>确认盲预留</button></aside>`;
  }
  const activeTrainer = game.trainers[game.activeTrainerIndex];
  const viewerGame = playerView();
  const viewerTrainer = viewerGame.trainers[viewerTrainerIndex];
  const evolutionOption = game.phase === "evolution" ? evolutionOptions().find((option) => option.cardId === selectedCardId) : null;
  if (evolutionOption) {
    const pokemon = activeTrainer.captured.find((candidate) => candidate.id === evolutionOption.cardId);
    const target = evolutionOption.targetLocation === "market" ? game.market.find((card) => card.id === evolutionOption.targetCardId) : activeTrainer.reserved.find((card) => card.id === evolutionOption.targetCardId);
    const choices = evolutionOptions().map((option) => `<button data-action="owned-card" data-id="${option.cardId}" aria-pressed="${option.cardId === selectedCardId}">${option.fromName} → ${option.toName}</button>`).join("");
    return `<aside class="inspector evolution-inspector panel"><button class="close" data-action="close" aria-label="关闭">×</button><nav class="evolution-choices" aria-label="可选进化路线">${choices}</nav><div class="evolution-preview"><img src="${pokemon.image}" alt="${pokemon.name}"><i>→</i><img src="${target.image}" alt="${target.name}"></div><small>${evolutionOption.targetLocation === "market" ? "目标在野外，进化后补牌" : "目标在个人预留区"}</small><h2>${pokemon.name} → ${target.name}</h2><p>条件：${evolutionRequirementText(evolutionOption.requirement)}。进化不支付精灵球，目标牌替换当前牌。</p><div class="evolution-delta"><span>分数 <b>${pokemon.points} → ${target.points}</b></span><span>永久折扣 <b>${ballToken(pokemon.bonus, "+1")}</b></span></div><button class="primary wide" data-action="evolve" data-card-id="${pokemon.id}">确认进化为 ${target.name}</button><button class="wide" data-action="skip-evolution">本回合不进化</button></aside>`;
  }
  if (selectedSpecial) {
    const card = game.specialPokemon[selectedSpecial.type].find((candidate) => candidate.id === selectedSpecial.id);
    if (!card) return "";
    const eligible = listSpecialCaptureOptions(game).some((option) => option.type === selectedSpecial.type && option.card.id === card.id);
    return `<aside class="inspector rare-inspector panel"><button class="close" data-action="close-special" aria-label="关闭">×</button><img class="large-card" src="${card.image}" alt="${card.name}"><small>${selectedSpecial.type === "rare" ? "稀有宝可梦" : "传说宝可梦"}</small><h2>${card.name}</h2><div class="rare-detail"><span>捕捉条件</span><b>${requirementMarkup(card.requirement, card.masterCost)}</b></div><div class="quote ${eligible ? "ready" : ""}">${eligible ? "可以作为本回合主要行动捕捉。" : "条件尚未满足。"}</div><button class="primary wide" data-action="capture-special" data-type="${selectedSpecial.type}" data-id="${card.id}" ${game.phase === "action" && eligible ? "" : "disabled"}>捕捉 ${card.name}</button></aside>`;
  }
  const marketCard = game.market.find((candidate) => candidate.id === selectedCardId);
  const reservedCard = viewerTrainer.reserved?.find((candidate) => candidate.id === selectedCardId);
  const card = marketCard ?? reservedCard;
  if (!card) return "";
  const isReserved = Boolean(reservedCard && !marketCard);
  const quote = reservedCard && viewerTrainerIndex !== game.activeTrainerIndex
    ? { canCapture: false, missing: {} }
    : getCaptureQuote(game, card.id);
  const missingText = Object.entries(quote.missing).map(([type, amount]) => `${ballMeta(type).label} ${amount}`).join("、");
  const viewOnly = (onlineMode && !canAct()) || (isReserved && viewerTrainerIndex !== game.activeTrainerIndex);
  return `<aside class="inspector panel"><button class="close" data-action="close" aria-label="关闭">×</button><img class="large-card" src="${card.image}" alt="${card.name}"><small>${isReserved ? "个人预留" : `${card.tier} 级野外宝可梦`}</small><h2>${card.name}</h2><p>捕捉后获得 ${card.points} 分，并永久获得 ${ballToken(card.bonus, "+1")}。</p><div class="inspect-cost"><span>所需</span>${costMarkup(card.cost)}</div><div class="quote ${quote.canCapture ? "ready" : ""}">${viewOnly ? "当前不是该训练家的行动回合。" : quote.canCapture ? `可以捕捉${quote.masterPayment ? `，将使用 ${quote.masterPayment} 个万能球` : ""}` : `仍缺：${missingText}`}</div><button class="primary wide" data-action="capture" data-id="${card.id}" ${game.phase === "action" && quote.canCapture ? "" : "disabled"}>${isReserved ? "从预留区捕捉" : "捕捉"} ${card.name}</button>${isReserved ? "" : `<button class="wide" data-action="reserve" data-id="${card.id}" ${game.phase === "action" ? "" : "disabled"}>预留并获得万能球</button>`}</aside>`;
}

function gameOverMarkup() {
  if (game.phase !== "game-over") return "";
  const winners = game.winnerTrainerIndexes.map((index) => safeText(game.trainers[index].name)).join("、");
  const isHost = !onlineMode || onlineClient.view.hostId === onlineClient.view.members[viewerTrainerIndex].playerId;
  return `<section class="game-over-dialog panel"><small>对局结算</small><h2>${winners}获胜</h2><button class="primary wide" data-action="reset" ${isHost ? "" : "disabled"}>${onlineMode ? isHost ? "返回准备室" : "等待房主返回准备室" : "再来一局"}</button></section><div class="dialog-backdrop"></div>`;
}

function render() {
  const previousLog = document.querySelector(".log");
  if (previousLog) logExpanded = previousLog.open;
  const focusedAction = document.activeElement?.dataset?.action ? { ...document.activeElement.dataset } : null;
  const trainer = game.trainers[game.activeTrainerIndex];
  const inEvolution = game.phase === "evolution";
  const returningBalls = game.phase === "return-balls";
  const gameOver = game.phase === "game-over";
  const heldBallCount = Object.values(trainer.balls).reduce((total, amount) => total + amount, 0);
  const returnCount = Math.max(0, heldBallCount - 10);
  const isSameColorSelection = selectedBalls.length === 2 && selectedBalls[0] === selectedBalls[1];
  const requiredDistinct = Math.min(3, ballTypes.filter((ball) => game.bank[ball.id] > 0).length);
  const canConfirmBalls = isSameColorSelection || selectedBalls.length === requiredDistinct;
  const isActiveViewer = viewerTrainerIndex === game.activeTrainerIndex;
  const activeName = safeText(trainer.name.replace("（你）", ""));
  const turnTitle = gameOver ? "对局结束" : isActiveViewer ? "你的回合" : `${activeName}的回合`;
  const turnSubtitle = onlineMode && !isActiveViewer && !gameOver ? "请等待对方行动，可以查看卡牌与公开信息" : gameOver ? "最终排名已经确定" : inEvolution ? `进化阶段 · 可选择 ${evolutionOptions().length} 条进化路线，也可以跳过` : returningBalls ? `请在下方精灵球中选择归还 ${returnCount} 个 · 已选 ${selectedBalls.length} 个` : "请选择一个操作：";
  const supplyHint = gameOver ? "对局已结束" : inEvolution ? "进化阶段 · 暂不可拿取" : returningBalls ? "请从自己的精灵球中归还" : selectedBalls.length ? `已选择 ${selectedBalls.length} / ${isSameColorSelection ? 2 : requiredDistinct}${isSameColorSelection ? " · 同色" : ""}` : `选择不同颜色，最多 ${requiredDistinct} 个`;
  const ballActions = game.phase === "action" && selectedBalls.length ? `<div class="supply-actions"><button class="primary" data-action="confirm-balls" ${canConfirmBalls ? "" : "disabled"}>确认拿取</button><button data-action="clear">取消选择</button></div>` : "";
  const selectedCard = [...game.market, ...game.trainers[viewerTrainerIndex].reserved, ...trainer.captured].find((card) => card.id === selectedCardId);
  const selectionText = selectedDeckTier !== null ? `已选择 ${selectedDeckTier} 级牌库 · 在详情中确认盲预留` : selectedSpecial ? `已选择 ${game.specialPokemon[selectedSpecial.type].find((card) => card.id === selectedSpecial.id)?.name ?? "特殊宝可梦"} · 查看捕捉条件` : selectedCard ? `已选择 ${selectedCard.name} · 在详情中确认操作` : "";
  const phaseActions = gameOver ? "" : inEvolution ? '<button class="primary" data-action="focus-evolution">查看可进化卡牌</button><button data-action="skip-evolution">跳过进化</button>' : returningBalls ? `<button class="primary" data-action="confirm-return" ${selectedBalls.length === returnCount ? "" : "disabled"}>确认归还</button><button data-action="clear">重选</button>` : "";
  document.querySelector("#app").innerHTML = `
    ${onlineMode ? `<section class="online-table-status">${onlineClient.toolbar()}</section>` : ""}
    <header class="action-bar current-action ${isActiveViewer && !gameOver ? "is-active" : ""}">
      <div class="turn" role="status" aria-live="polite"><i aria-hidden="true"></i><div>
        <div class="turn-heading"><b>${turnTitle}</b><span>${activeName} · 第 ${game.turn} 次行动${!isActiveViewer && !gameOver ? onlineMode ? " · 请等待对方行动" : " · 你正在查看其他席位" : ""}</span></div>
        <p>${turnSubtitle}${game.phase === "action" && canAct() ? '<span class="operation-hints">拿取精灵球 <span>/</span> 捕捉宝可梦 <span>/</span> 预留宝可梦</span>' : ""}</p>
        ${actionError ? `<p class="action-error" role="alert">${safeText(actionError)}</p>` : ""}
        ${selectionText ? `<small class="selection-hint">${selectionText}</small>` : ""}
      </div></div>
      <div class="actions"><div class="phase-actions">${phaseActions}</div><div class="table-controls">${viewSwitcherMarkup()}${onlineMode ? "" : '<button data-action="reset">重新开始</button>'}</div></div>
    </header>
    <div class="table-layout">
      ${specialMarkup()}
      <section class="wild panel ${inEvolution ? "is-evolving" : ""}"><header><h1>野外区域</h1><p>${inEvolution ? "点击顶部“查看可进化卡牌”选择路线" : "绿框可捕捉 · 点击卡背盲预留"}</p></header>${marketMarkup()}</section>
      <aside class="supply panel"><h2>精灵球供应</h2><p class="supply-hint" role="status" aria-live="polite">${supplyHint}</p><div class="bank">${bankMarkup()}</div>${ballActions}<p class="supply-rule">同色拿2需供应 ≥ 4<br>万能球通过预留获得</p></aside>
      <aside class="opponent-rail"><header><h2>其他训练家</h2><p>公开状态 · 预留仅显示数量</p></header>${opponentsMarkup()}<p class="table-note">${onlineMode ? '好友联机 · 各自操作自己的席位<br>断线保留对局，请等待朋友重连' : '本地 3 人对局<br>行动后自动切换到下一位训练家'}</p></aside>
      <section class="self-panel">${trainerMarkup()}</section>
      <details class="log panel" ${logExpanded ? "open" : ""}><summary>对局记录 <span>${game.log.length} 条</span><small>${safeText(message)}</small></summary><div class="log-entries">${game.log.slice().reverse().map((entry, index) => `<p class="${index === 0 ? "latest" : ""}">${safeText(entry)}</p>`).join("")}</div></details>
    </div>${inspectorMarkup()}${gameOverMarkup()}
    <footer><span>宝可梦璀璨宝石 · 房间 ${room.id}</span><span>18 分触发最终轮</span></footer>`;
  if (onlineMode && !canAct()) {
    const blocked = new Set(["ball", "take-two", "return-ball", "confirm-balls", "confirm-return", "capture", "reserve", "reserve-deck", "capture-special", "evolve", "skip-evolution", "focus-evolution", "deck"]);
    document.querySelectorAll("[data-action]").forEach((button) => { if (blocked.has(button.dataset.action)) button.disabled = true; });
  }
  // The page is re-rendered after each selection; keep keyboard focus on its control.
  if (focusedAction) {
    const nextFocus = [...document.querySelectorAll("[data-action]")].find((element) => Object.entries(focusedAction).every(([key, value]) => element.dataset[key] === value));
    nextFocus?.focus({ preventScroll: true });
  }
}

function act(action) {
  actionError = "";
  try {
    setGame(action());
    viewerTrainerIndex = game.activeTrainerIndex;
    selectedBalls = [];
    selectedCardId = game.phase === "evolution" ? evolutionOptions()[0]?.cardId ?? null : null;
    selectedDeckTier = null;
    selectedSpecial = null;
    message = game.phase === "evolution" ? "行动完成，现在可以额外进化一次" : game.phase === "game-over" ? "对局结束" : `轮到${game.trainers[game.activeTrainerIndex].name}行动`;
  } catch (error) {
    message = error.message;
    actionError = error.message;
  }
  render();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.disabled) return;
  const action = target.dataset.action;
  if (onlineMode) {
    if (!onlineClient.view?.game) return;
    if (action === "switch-view") return;
    if (action === "reset") { void onlineClient.command({ type: "RESTART" }); return; }
    const mutations = {
      "confirm-balls": () => selectedBalls.length === 2 && selectedBalls[0] === selectedBalls[1] ? { type: "TAKE_TWO", ball: selectedBalls[0] } : { type: "TAKE_BALLS", balls: [...selectedBalls] },
      "confirm-return": () => ({ type: "RETURN_BALLS", balls: [...selectedBalls] }),
      "capture": () => ({ type: "CAPTURE", cardId: target.dataset.id }),
      "reserve": () => ({ type: "RESERVE", cardId: target.dataset.id }),
      "reserve-deck": () => ({ type: "RESERVE_DECK", tier: Number(target.dataset.tier) }),
      "capture-special": () => ({ type: "CAPTURE_SPECIAL", kind: target.dataset.type, cardId: target.dataset.id }),
      "evolve": () => ({ type: "EVOLVE", cardId: target.dataset.cardId }),
      "skip-evolution": () => ({ type: "SKIP_EVOLUTION" }),
    };
    if (mutations[action]) { if (canAct()) void onlineClient.command(mutations[action]()); return; }
    if (["ball", "take-two", "return-ball", "deck", "focus-evolution"].includes(action) && !canAct()) return;
  }
  if (action === "ball") {
    if (game.phase !== "action") return;
    const type = target.dataset.type;
    if (selectedBalls.length === 2 && selectedBalls[0] === selectedBalls[1]) selectedBalls = [];
    selectedBalls = selectedBalls.includes(type) ? selectedBalls.filter((value) => value !== type) : selectedBalls.length < 3 ? [...selectedBalls, type] : selectedBalls;
    render();
  }
  if (action === "take-two") { selectedBalls = [target.dataset.type, target.dataset.type]; render(); }
  if (action === "return-ball") {
    const returnCount = Object.values(game.trainers[game.activeTrainerIndex].balls).reduce((total, amount) => total + amount, 0) - 10;
    if (selectedBalls.length < returnCount) selectedBalls = [...selectedBalls, target.dataset.type];
    render();
  }
  if (action === "clear") { selectedBalls = []; render(); }
  if (action === "confirm-balls") act(() => selectedBalls[0] === selectedBalls[1] ? takeTwoBalls(game, selectedBalls[0]) : takeBalls(game, selectedBalls));
  if (action === "confirm-return") act(() => returnBalls(game, selectedBalls));
  if (action === "card") { selectedCardId = target.dataset.id; selectedDeckTier = null; selectedSpecial = null; render(); }
  if (action === "owned-card") { selectedCardId = target.dataset.id; selectedDeckTier = null; selectedSpecial = null; render(); }
  if (action === "close") { selectedCardId = null; selectedDeckTier = null; render(); }
  if (action === "special-card") { selectedSpecial = { type: target.dataset.type, id: target.dataset.id }; selectedCardId = null; selectedDeckTier = null; render(); }
  if (action === "close-special") { selectedSpecial = null; render(); }
  if (action === "capture-special") act(() => captureSpecialPokemon(game, target.dataset.type, target.dataset.id));
  if (action === "capture") act(() => capturePokemon(game, target.dataset.id));
  if (action === "reserve") act(() => reservePokemon(game, target.dataset.id));
  if (action === "reserve-deck") act(() => reservePokemonFromDeck(game, Number(target.dataset.tier)));
  if (action === "evolve") act(() => evolvePokemon(game, target.dataset.cardId));
  if (action === "skip-evolution") act(() => skipEvolution(game));
  if (action === "focus-evolution") { selectedCardId = evolutionOptions()[0]?.cardId ?? null; render(); }
  if (action === "deck") { selectedDeckTier = Number(target.dataset.tier); selectedCardId = null; selectedSpecial = null; render(); }
  if (action === "switch-view") { viewerTrainerIndex = Number(target.dataset.index); selectedCardId = null; selectedDeckTier = null; selectedSpecial = null; render(); }
  if (action === "reset") { room = newDemoRoom(); game = room.game; viewerTrainerIndex = 0; selectedBalls = []; selectedCardId = null; selectedDeckTier = null; selectedSpecial = null; actionError = ""; message = "选择精灵球，或者点击一张宝可梦卡"; render(); }
});

if (onlineMode) {
  onlineClient = createOnlineClient({
    onView(view) {
      room = { id: view.id, game: view.game };
      game = view.game;
      viewerTrainerIndex = view.viewerTrainerIndex;
      if (view.revision !== onlineRevision) {
        onlineRevision = view.revision;
        selectedBalls = [];
        selectedCardId = null;
        selectedDeckTier = null;
        selectedSpecial = null;
        actionError = "";
      }
      message = `轮到${game.trainers[game.activeTrainerIndex].name}行动`;
      render();
    },
    onStatus() { if (game) render(); },
  });
  onlineClient.start();
} else {
  room = newDemoRoom();
  game = room.game;
  render();
}
