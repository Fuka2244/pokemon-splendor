import * as engine from "../src/game-engine.js";
import { pokemonCards, rarePokemonCards, legendaryPokemonCards } from "../src/data/card-manifest.js";

export class RoomError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

export function nickname(value) {
  if (typeof value !== "string" || !value.trim() || [...value.trim()].length > 16 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new RoomError("昵称须为 1–16 个可见字符", 400);
  }
  return value.trim();
}

function member(name) {
  return { playerId: crypto.randomUUID(), credential: crypto.randomUUID(), name: nickname(name), ready: false };
}

export function createOnlineRoom(id, name, capacity) {
  if (![2, 3, 4].includes(capacity)) throw new RoomError("请选择 2–4 人的房间", 400);
  const host = member(name);
  return { id, capacity, hostId: host.playerId, members: [host], game: null, revision: 0, receipts: [], updatedAt: Date.now() };
}

export function joinOnlineRoom(room, name) {
  if (room.game) throw new RoomError("对局已经开始，不能加入新席位");
  if (room.members.length >= room.capacity) throw new RoomError("房间已满");
  const next = structuredClone(room);
  next.members.push(member(name));
  next.revision += 1;
  next.updatedAt = Date.now();
  return next;
}

export function authenticate(room, playerId, credential) {
  const player = room.members.find((candidate) => candidate.playerId === playerId);
  if (!player || typeof credential !== "string" || player.credential !== credential) throw new RoomError("席位凭证无效，请重新加入", 401);
  return player;
}

export function identity(room, player) {
  return { roomId: room.id, playerId: player.playerId, credential: player.credential };
}

function shuffled(cards) {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function validateCommand(command) {
  if (!command || typeof command !== "object" || typeof command.id !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(command.id)
    || !Number.isSafeInteger(command.revision) || command.revision < 0 || typeof command.type !== "string") {
    throw new RoomError("操作格式错误", 400);
  }
  const allowed = ["READY", "START", "LEAVE", "RESTART", "TAKE_BALLS", "TAKE_TWO", "RETURN_BALLS", "CAPTURE", "RESERVE", "RESERVE_DECK", "CAPTURE_SPECIAL", "EVOLVE", "SKIP_EVOLUTION"];
  if (!allowed.includes(command.type)) throw new RoomError("未知操作", 400);
  if (["TAKE_BALLS", "RETURN_BALLS"].includes(command.type) && (!Array.isArray(command.balls) || command.balls.length > 20 || command.balls.some((ball) => ![...engine.coloredBallTypes, "master"].includes(ball)))) throw new RoomError("精灵球参数错误", 400);
  if (["CAPTURE", "RESERVE", "CAPTURE_SPECIAL", "EVOLVE"].includes(command.type) && (typeof command.cardId !== "string" || command.cardId.length > 100)) throw new RoomError("卡牌参数错误", 400);
  if (command.type === "READY" && typeof command.ready !== "boolean") throw new RoomError("准备状态错误", 400);
  if (command.type === "TAKE_TWO" && !engine.coloredBallTypes.includes(command.ball)) throw new RoomError("精灵球参数错误", 400);
  if (command.type === "RESERVE_DECK" && ![1, 2, 3].includes(command.tier)) throw new RoomError("牌库参数错误", 400);
  if (command.type === "CAPTURE_SPECIAL" && !["rare", "legendary"].includes(command.kind)) throw new RoomError("特殊卡参数错误", 400);
}

// Receipts and game state are stored together by the transport in one atomic write.
export function applyCommand(room, playerId, command) {
  validateCommand(command);
  const playerIndex = room.members.findIndex((player) => player.playerId === playerId);
  if (playerIndex < 0) throw new RoomError("不属于当前房间", 401);
  const fingerprint = JSON.stringify(command);
  const receipt = room.receipts.find((item) => item.playerId === playerId && item.id === command.id);
  if (receipt) {
    if (receipt.fingerprint !== fingerprint) throw new RoomError("操作编号已被用于其他内容", 400);
    return room;
  }
  if (command.revision !== room.revision) throw new RoomError("对局已更新，请查看最新状态后重试");
  const next = structuredClone(room);
  if (command.type === "READY") {
    if (next.game) throw new RoomError("对局进行中，不能改变准备状态");
    next.members[playerIndex].ready = command.ready;
  } else if (command.type === "START") {
    if (playerId !== next.hostId) throw new RoomError("只有房主可以开始");
    if (next.game || next.members.length < 2 || !next.members.every((player) => player.ready)) throw new RoomError("至少两人且全部准备后才能开始");
    next.game = engine.createGame({ trainerNames: next.members.map((player) => player.name), pokemonCards: shuffled(pokemonCards), rarePokemonCards: shuffled(rarePokemonCards), legendaryPokemonCards: shuffled(legendaryPokemonCards) });
  } else if (command.type === "RESTART") {
    if (playerId !== next.hostId || next.game?.phase !== "game-over") throw new RoomError("仅房主可在结算后返回准备室");
    next.game = null;
    next.members.forEach((player) => { player.ready = false; });
  } else if (command.type === "LEAVE") {
    if (next.game) throw new RoomError("已开始的对局会保留席位，可关闭页面后重连");
    next.members.splice(playerIndex, 1);
    if (playerId === next.hostId) next.hostId = next.members[0]?.playerId ?? null;
  } else {
    if (!next.game || next.game.activeTrainerIndex !== playerIndex) throw new RoomError("现在不是你的行动回合");
    try {
      switch (command.type) {
        case "TAKE_BALLS": next.game = engine.takeBalls(next.game, command.balls); break;
        case "TAKE_TWO": next.game = engine.takeTwoBalls(next.game, command.ball); break;
        case "RETURN_BALLS": next.game = engine.returnBalls(next.game, command.balls); break;
        case "CAPTURE": next.game = engine.capturePokemon(next.game, command.cardId); break;
        case "RESERVE": next.game = engine.reservePokemon(next.game, command.cardId); break;
        case "RESERVE_DECK": next.game = engine.reservePokemonFromDeck(next.game, command.tier); break;
        case "CAPTURE_SPECIAL": next.game = engine.captureSpecialPokemon(next.game, command.kind, command.cardId); break;
        case "EVOLVE": next.game = engine.evolvePokemon(next.game, command.cardId); break;
        case "SKIP_EVOLUTION": next.game = engine.skipEvolution(next.game); break;
      }
    } catch (error) { throw new RoomError(error.message); }
  }
  next.revision += 1;
  next.updatedAt = Date.now();
  next.receipts.push({ playerId, id: command.id, fingerprint });
  next.receipts = next.receipts.slice(-128);
  return next;
}

export function roomView(room, playerId, onlinePlayerIds = []) {
  const viewerTrainerIndex = room.members.findIndex((player) => player.playerId === playerId);
  if (viewerTrainerIndex < 0) throw new RoomError("不属于当前房间", 401);
  let game = null;
  if (room.game) {
    const { decks, specialDecks, ...publicGame } = structuredClone(room.game);
    game = {
      ...publicGame,
      // Only counts cross the network; no hidden card IDs, images or deck order.
      decks: Object.fromEntries(Object.entries(decks).map(([tier, cards]) => [tier, { length: cards.length }])),
      specialDeckCounts: Object.fromEntries(Object.entries(specialDecks).map(([kind, cards]) => [kind, cards.length])),
      trainers: publicGame.trainers.map((trainer, index) => ({ ...trainer, reserved: index === viewerTrainerIndex ? trainer.reserved : [], reservedCount: trainer.reserved.length })),
      log: publicGame.log.map((entry) => entry.replace(/预留了.+$/, "预留了一只宝可梦")),
    };
  }
  return {
    id: room.id, capacity: room.capacity, hostId: room.hostId, revision: room.revision, viewerTrainerIndex, game,
    members: room.members.map(({ playerId: id, name, ready }) => ({ playerId: id, name, ready, online: onlinePlayerIds.includes(id) })),
  };
}
