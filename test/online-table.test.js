import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as engine from "../src/game-engine.js";
import * as cards from "../src/data/card-manifest.js";
import * as rooms from "../src/room-view.js";
import { createOnlineRoom, joinOnlineRoom, applyCommand, roomView } from "../worker/room.js";

const source = readFileSync(new URL("../src/main.js", import.meta.url), "utf8").replace(/^import[\s\S]*?from\s+"[^"]+";\s*/gm, "");
function onlineUI(index) {
  let room = joinOnlineRoom(createOnlineRoom("b".repeat(32), "<b>小智</b>", 2), "小霞");
  for (const [actor, payload] of [[0, { type: "READY", ready: true }], [1, { type: "READY", ready: true }], [0, { type: "START" }]]) {
    room = applyCommand(room, room.members[actor].playerId, { id: crypto.randomUUID(), revision: room.revision, ...payload });
  }
  const app = { innerHTML: "" };
  let click;
  let callbacks;
  const commands = [];
  const client = { connected: true, busy: false, view: roomView(room, room.members[index].playerId), toolbar: () => "", command: (command) => commands.push(command), start() { callbacks.onView(this.view); } };
  const context = vm.createContext({
    ...engine, ...cards, ...rooms, URLSearchParams, location: { search: "" },
    createOnlineClient: (options) => { callbacks = options; return client; },
    document: { activeElement: null, querySelector: (selector) => selector === "#app" ? app : null, querySelectorAll: () => [], addEventListener: (_, handler) => { click = handler; } },
  });
  vm.runInContext(source, context);
  return { app, commands, client, run: (code) => vm.runInContext(code, context), click: (action, dataset = {}) => click({ target: { closest: () => ({ dataset: { action, ...dataset } }) } }) };
}

test("online renderer escapes names and submits commands without locally applying a move", () => {
  const ui = onlineUI(0);
  assert.ok(ui.app.innerHTML.includes("&lt;b&gt;小智&lt;/b&gt;"));
  assert.ok(!ui.app.innerHTML.includes("<b>小智</b>"));
  const before = ui.run("JSON.stringify(game)");
  ui.click("take-two", { type: "red" });
  ui.click("confirm-balls");
  assert.equal(JSON.stringify(ui.commands[0]), JSON.stringify({ type: "TAKE_TWO", ball: "red" }));
  assert.equal(ui.run("JSON.stringify(game)"), before);
});

test("waiting or disconnected clients cannot send gameplay commands or change seats", () => {
  const ui = onlineUI(1);
  ui.click("confirm-balls");
  ui.click("switch-view", { index: "0" });
  assert.equal(ui.commands.length, 0);
  assert.equal(ui.run("viewerTrainerIndex"), 1);
  const active = onlineUI(0);
  active.client.connected = false;
  active.click("take-two", { type: "red" });
  active.click("confirm-balls");
  assert.equal(active.commands.length, 0);
});
