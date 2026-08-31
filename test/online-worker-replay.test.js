import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as rooms from "../worker/room.js";

const source = readFileSync(new URL("../worker/index.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace("export default {", "const entry = {")
  .replace("export class PokemonRoom", "class PokemonRoom");

test("replaying a committed command returns its state without storage writes or broadcasts", async () => {
  let room = rooms.createOnlineRoom("a".repeat(32), "测试玩家", 2);
  let puts = 0;
  let alarms = 0;
  let broadcasts = 0;
  const ctx = {
    blockConcurrencyWhile: (fn) => fn(),
    storage: {
      get: async () => structuredClone(room),
      put: async (_, next) => { room = structuredClone(next); puts++; },
      setAlarm: async () => { alarms++; },
    },
    getWebSockets: () => [{
      deserializeAttachment: () => ({ authenticated: true, playerId: room.members[0].playerId }),
      send: () => { broadcasts++; },
    }],
  };
  const context = vm.createContext({ ...rooms, ctx, Response, Request, URL, crypto, DurableObject: class { constructor(ctx) { this.ctx = ctx; } } });
  vm.runInContext(source, context);
  const worker = vm.runInContext("new PokemonRoom(ctx)", context);
  const player = room.members[0];
  const command = { id: crypto.randomUUID(), revision: room.revision, type: "READY", ready: true };
  const request = () => new Request(`https://room/api/rooms/${room.id}/command`, {
    method: "POST", headers: { "X-Player-Id": player.playerId, Authorization: `Bearer ${player.credential}` }, body: JSON.stringify(command),
  });
  const first = await worker.fetch(request());
  assert.equal(first.status, 200);
  const state = await first.json();
  assert.deepEqual([puts, alarms, broadcasts], [1, 1, 1]);
  puts = alarms = broadcasts = 0;
  const replay = await worker.fetch(request());
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).revision, state.revision);
  assert.deepEqual([puts, alarms, broadcasts], [0, 0, 0], "Duplicate transport delivery must not write or rebroadcast");
});
