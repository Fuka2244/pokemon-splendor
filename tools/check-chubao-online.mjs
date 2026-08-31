import assert from "node:assert/strict";

// Exercises the existing game without copying its protocol or rules into the hub.
const base = "http://127.0.0.1:8787";
const sockets = [];
async function post(path, data) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok);
  return response.json();
}
async function connect(identity) {
  const url = new URL(`/api/rooms/${identity.roomId}/socket`, base);
  url.protocol = "ws:";
  url.searchParams.set("playerId", identity.playerId);
  url.searchParams.set("credential", identity.credential);
  const socket = new WebSocket(url);
  sockets.push(socket);
  const messages = [];
  socket.addEventListener("message", (event) => messages.push(JSON.parse(event.data)));
  async function wait(predicate) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = messages.findLast(predicate);
      if (result) return result;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Expected room update was not received");
  }
  const first = await wait((message) => message.type === "STATE");
  async function send(command, expected = "ACK") {
    const commandId = crypto.randomUUID();
    socket.send(JSON.stringify({ commandId, ...command }));
    return wait((message) => message.type === expected && message.commandId === commandId);
  }
  return { socket, wait, send, first };
}

try {
  const host = await post("/api/rooms", { nickname: "联机验证甲" });
  const guest = await post(`/api/rooms/${host.roomId}/join`, { nickname: "联机验证乙" });
  const a = await connect(host);
  const b = await connect(guest);
  await a.send({ type: "SET_READY", payload: { ready: true } });
  await b.send({ type: "SET_READY", payload: { ready: true } });
  await b.send({ type: "START_GAME" }, "ERROR");
  await a.send({ type: "START_GAME" });
  const first = (await a.wait((message) => message.type === "STATE" && message.payload.game)).payload;
  const second = (await b.wait((message) => message.type === "STATE" && message.payload.game)).payload;
  assert.equal(first.game.currentPlayerId, second.game.currentPlayerId);
  for (const [view, owner] of [[first, host], [second, guest]]) {
    assert.ok(view.game.players.find((player) => player.playerId === owner.playerId).cards.every((card) => card.hidden && card.spellId === undefined));
    assert.ok(view.game.players.find((player) => player.playerId !== owner.playerId).cards.every((card) => !card.hidden && Number.isInteger(card.spellId)));
    assert.ok(!JSON.stringify(view).includes(host.credential));
    assert.equal(view.game.deck, undefined);
  }
  const inactive = first.game.currentPlayerId === host.playerId ? b : a;
  await inactive.send({ type: "CAST_SPELL", payload: { spellId: 1 } }, "ERROR");
  a.socket.close();
  const restored = await connect(host);
  assert.equal(restored.first.payload.viewerId, host.playerId);
  assert.equal(restored.first.payload.game.round, first.game.round);
  console.log("PASS: hidden-spell two-client creation/join, preparation/start, private card views, turn protection and original-seat reconnect");
} finally { sockets.forEach((socket) => socket.close()); }
