import test from "node:test";
import assert from "node:assert/strict";
import { createOnlineRoom, joinOnlineRoom, authenticate, applyCommand, roomView, nickname } from "../worker/room.js";

function setup() {
  let room = createOnlineRoom("a".repeat(32), "小智", 2);
  room = joinOnlineRoom(room, "小霞");
  const send = (index, payload) => {
    room = applyCommand(room, room.members[index].playerId, { id: crypto.randomUUID(), revision: room.revision, ...payload });
    return room;
  };
  return { get room() { return room; }, send };
}

function started() {
  const state = setup();
  state.send(0, { type: "READY", ready: true });
  state.send(1, { type: "READY", ready: true });
  state.send(0, { type: "START" });
  return state;
}

test("only the host starts after at least two players are ready; membership locks during play", () => {
  const state = setup();
  assert.throws(() => state.send(0, { type: "START" }), /全部准备/);
  state.send(0, { type: "READY", ready: true });
  state.send(1, { type: "READY", ready: true });
  assert.throws(() => state.send(1, { type: "START" }), /房主/);
  state.send(0, { type: "START" });
  assert.throws(() => joinOnlineRoom(state.room, "小刚"), /已经开始/);
  assert.throws(() => state.send(1, { type: "LEAVE" }), /保留席位/);
  assert.equal(state.room.game.bank.red, 4);
});

test("invalid seat credentials and another player's turn cannot change game state", () => {
  const state = started();
  const before = JSON.stringify(state.room);
  assert.throws(() => authenticate(state.room, state.room.members[0].playerId, state.room.members[1].credential), /凭证无效/);
  assert.throws(() => state.send(1, { type: "TAKE_TWO", ball: "red" }), /不是你的/);
  assert.equal(JSON.stringify(state.room), before);
});

test("a committed command survives serialization and replays once; conflicting IDs and stale revisions fail", () => {
  const state = started();
  const actor = state.room.members[0].playerId;
  const command = { id: crypto.randomUUID(), revision: state.room.revision, type: "TAKE_TWO", ball: "red" };
  const applied = applyCommand(state.room, actor, command);
  const restored = JSON.parse(JSON.stringify(applied));
  assert.deepEqual(applyCommand(restored, actor, command), applied);
  assert.equal(applied.game.trainers[0].balls.red, 2);
  assert.equal(applied.game.turn, 2);
  assert.throws(() => applyCommand(applied, actor, { ...command, ball: "blue" }), /操作编号/);
  assert.throws(() => applyCommand(applied, applied.members[1].playerId, { ...command, id: crypto.randomUUID() }), /对局已更新/);
});

test("views never serialize credentials, receipt payloads, hidden reservations or either deck order", () => {
  const state = started();
  state.send(0, { type: "RESERVE_DECK", tier: 1 });
  const room = state.room;
  const owner = roomView(room, room.members[0].playerId);
  const peer = roomView(room, room.members[1].playerId);
  assert.equal(owner.game.trainers[0].reserved.length, 1);
  assert.equal(peer.game.trainers[0].reservedCount, 1);
  assert.equal(peer.game.trainers[0].reserved.length, 0);
  assert.equal(peer.game.specialDecks, undefined);
  assert.deepEqual(peer.game.decks[1], { length: room.game.decks[1].length });
  for (const secret of [room.members[0].credential, room.members[1].credential, room.game.trainers[0].reserved[0].id, room.game.decks[1][0].id, room.game.specialDecks.rare[0].id, room.receipts[0].id]) {
    assert.ok(!JSON.stringify(peer).includes(secret), `leaked ${secret}`);
  }
});

test("leaving the preparation room transfers host; a finished game returns to preparation without losing seats", () => {
  const state = setup();
  const nextHost = state.room.members[1].playerId;
  state.send(0, { type: "LEAVE" });
  assert.equal(state.room.hostId, nextHost);
  const finished = started();
  finished.room.game.phase = "game-over";
  const ids = finished.room.members.map((player) => player.playerId);
  assert.throws(() => finished.send(1, { type: "RESTART" }), /仅房主/);
  finished.send(0, { type: "RESTART" });
  assert.equal(finished.room.game, null);
  assert.deepEqual(finished.room.members.map((player) => player.playerId), ids);
  assert.ok(finished.room.members.every((player) => !player.ready));
});

test("bad input and illegal actions are rejected without mutating the stored state", () => {
  assert.throws(() => nickname(" "), /昵称/);
  assert.throws(() => createOnlineRoom("room", "小智", 5), /2–4/);
  const state = started();
  const before = JSON.stringify(state.room);
  for (const payload of [{ type: "TAKE_BALLS", balls: "red" }, { type: "CAPTURE", cardId: {} }, { type: "RESERVE_DECK", tier: "__proto__" }, { type: "SKIP_EVOLUTION" }, { type: "GIVE_POINTS", amount: 99 }]) {
    assert.throws(() => state.send(0, payload));
  }
  assert.equal(JSON.stringify(state.room), before);
});
