import test from "node:test";
import assert from "node:assert/strict";
import { createRoom, deserializeRoom, getPlayerView, serializeRoom } from "../src/room-view.js";
import { readFileSync } from "node:fs";

test("room state wraps a serializable local game with trainer seats", () => {
  // Catches: keeping browser-only state that cannot become a Cloudflare room later.
  const room = createRoom({
    roomId: "room-001",
    trainerNames: ["小智", "小霞", "小刚"],
    pokemonCards: [{ id: "pidgey", tier: 1 }],
  });

  assert.equal(room.id, "room-001");
  assert.deepEqual(room.seats.map((seat) => seat.trainerIndex), [0, 1, 2]);
  assert.deepEqual(room.seats.map((seat) => seat.name), ["小智", "小霞", "小刚"]);

  const restored = deserializeRoom(serializeRoom(room));
  assert.deepEqual(restored, room);
});

test("player view only exposes reserved card details for that trainer", () => {
  // Catches: leaking private reserved cards when the same room state is sent to every client.
  const room = createRoom({
    roomId: "room-privacy",
    trainerNames: ["小智", "小霞", "小刚"],
  });
  room.game.trainers[0].reserved = [{ id: "abra", name: "凯西", tier: 1, points: 1, cost: { pink: 4 } }];
  room.game.trainers[1].reserved = [{ id: "mewtwo", name: "超梦", tier: 3, points: 5, cost: { red: 7 } }];

  const xiaozhiView = getPlayerView(room, 0);
  const xiaView = getPlayerView(room, 1);

  assert.deepEqual(xiaozhiView.trainers[0].reserved, room.game.trainers[0].reserved);
  assert.equal(xiaozhiView.trainers[1].reservedCount, 1);
  assert.equal(xiaozhiView.trainers[1].reserved, undefined);

  assert.deepEqual(xiaView.trainers[1].reserved, room.game.trainers[1].reserved);
  assert.equal(xiaView.trainers[0].reservedCount, 1);
  assert.equal(xiaView.trainers[0].reserved, undefined);
});

test("player view rejects unknown trainer seats", () => {
  // Catches: silently showing a default player's private data to an invalid viewer.
  const room = createRoom({ roomId: "room-bad-seat", trainerNames: ["小智"] });

  assert.throws(() => getPlayerView(room, 3), /未知训练家座位/);
});

test("layout view makes the selected trainer the private bottom panel and keeps the active seat marked", () => {
  const room = createRoom({ roomId: "room-layout", trainerNames: ["小智", "小霞", "小刚"] });
  room.game.activeTrainerIndex = 0;
  room.game.trainers[0].reserved = [{ id: "opponent-secret-a", name: "对手秘密牌", cost: { red: 7 } }];
  room.game.trainers[1].reserved = [{ id: "viewer-secret", name: "自己的秘密牌", cost: { blue: 4 } }];
  room.game.trainers[2].reserved = [{ id: "opponent-secret-b", name: "另一张秘密牌", cost: { yellow: 5 } }];

  const layout = getPlayerView(room, 1);
  const opponents = layout.trainers.filter((_, index) => index !== layout.viewerTrainerIndex);

  assert.equal(layout.viewerTrainerIndex, 1);
  assert.equal(layout.activeTrainerIndex, 0);
  assert.equal(layout.trainers[layout.viewerTrainerIndex].name, "小霞");
  assert.deepEqual(layout.trainers[layout.viewerTrainerIndex].reserved.map((card) => card.id), ["viewer-secret"]);
  assert.deepEqual(opponents.map((trainer) => trainer.name), ["小智", "小刚"]);
  assert.deepEqual(opponents.map((trainer, index) => index === 0), [true, false]);
  assert.deepEqual(opponents.map((trainer) => trainer.reservedCount), [1, 1]);
  assert.equal(opponents.every((trainer) => trainer.reserved === undefined), true);
});

test("layout view does not serialize other trainers' reserved card details", () => {
  const room = createRoom({ roomId: "room-layout-privacy", trainerNames: ["小智", "小霞", "小刚"] });
  room.game.trainers[0].reserved = [{ id: "hidden-a", name: "隐藏甲", cost: { red: 9 } }];
  room.game.trainers[1].reserved = [{ id: "visible-to-viewer", name: "可见牌", cost: { blue: 2 } }];
  room.game.trainers[2].reserved = [{ id: "hidden-b", name: "隐藏乙", cost: { yellow: 8 } }];

  const serialized = JSON.stringify(getPlayerView(room, 1));

  assert.match(serialized, /visible-to-viewer/);
  assert.doesNotMatch(serialized, /hidden-a|hidden-b|隐藏甲|隐藏乙/);
});

test("room layout markup has a public area, opponent rail, and bottom self area without card overflow", () => {
  const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(main, /class="table-layout"/);
  assert.match(main, /class="opponent-rail"/);
  assert.match(main, /class="self-panel"/);
  assert.match(styles, /\.table-layout\s*\{/);
  assert.match(styles, /\.opponent-rail\s*\{/);
  assert.match(styles, /\.self-panel\s*\{/);
  assert.match(styles, /\.card-row[^\n]*minmax\(0, 1fr\)/);
  assert.match(styles, /object-fit:\s*contain/);
});
