import assert from "node:assert/strict";

// Deliberately restricted to local simulation: this creates disposable test rooms.
const base = process.env.POKEMON_TEST_URL ?? "http://127.0.0.1:4174";
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname), "Only local test servers are allowed");
const sockets = [];

async function request(path, { identity, data, method = data ? "POST" : "GET", status = 200, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json", ...(identity ? { "X-Player-Id": identity.playerId, Authorization: `Bearer ${identity.credential}` } : {}), ...headers },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}

async function connect(identity) {
  const url = new URL(`/api/rooms/${identity.roomId}/socket`, base);
  url.protocol = "ws:";
  const socket = new WebSocket(url);
  sockets.push(socket);
  const messages = [];
  socket.addEventListener("message", (event) => messages.push(JSON.parse(event.data)));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket connection timed out")), 5000);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("WebSocket failed")); }, { once: true });
  });
  socket.send(JSON.stringify({ type: "AUTH", playerId: identity.playerId, credential: identity.credential }));
  async function state(predicate) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const latest = messages.findLast((message) => message.type === "STATE" && predicate(message.view));
      if (latest) return latest.view;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Expected synchronized state was not broadcast");
  }
  await state(() => true);
  return { socket, state };
}

try {
  for (const [path, content] of [["/", "桌游小馆"], ["/pokemon.html", "./main.js"]]) {
    const page = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10000) });
    assert.equal(page.status, 200, `Page unavailable: ${path}`);
    assert.ok((await page.text()).includes(content), `Wrong page: ${path}`);
  }
  assert.equal((await request("/api/health")).ready, true);
  const host = await request("/api/rooms", { data: { nickname: "测试小智", capacity: 2 }, status: 201 });
  const guest = await request(`/api/rooms/${host.roomId}/join`, { data: { nickname: "<b>小霞</b>" }, status: 201 });
  const root = `/api/rooms/${host.roomId}`;
  await request(`${root}/state`, { status: 401 });
  await request(`${root}/state`, { identity: { ...host, credential: guest.credential }, status: 401 });
  await request(`${root}/join`, { data: { nickname: "超员" }, status: 409 });
  await request("/api/rooms", { data: { nickname: "跨站", capacity: 2 }, headers: { Origin: "https://other.example" }, status: 403 });
  const a = await connect(host);
  const b = await connect(guest);
  let view = await request(`${root}/state`, { identity: host });
  async function send(identity, payload, status = 200) {
    const command = { id: crypto.randomUUID(), revision: view.revision, ...payload };
    const result = await request(`${root}/command`, { identity, data: command, status });
    if (status === 200) view = result;
    return command;
  }
  await send(host, { type: "START" }, 409);
  await send(host, { type: "READY", ready: true });
  await send(guest, { type: "READY", ready: true });
  await send(guest, { type: "START" }, 409);
  await send(host, { type: "START" });
  await a.state((snapshot) => snapshot.game?.phase === "action");
  await b.state((snapshot) => snapshot.game?.phase === "action");
  await send(guest, { type: "TAKE_TWO", ball: "red" }, 409);

  const reservation = await send(host, { type: "RESERVE_DECK", tier: 1 });
  const owner = await a.state((snapshot) => snapshot.revision === view.revision);
  const other = await b.state((snapshot) => snapshot.revision === view.revision);
  const privateId = owner.game.trainers[0].reserved[0].id;
  assert.equal(other.game.trainers[0].reservedCount, 1);
  assert.equal(other.game.trainers[0].reserved.length, 0);
  assert.ok(!JSON.stringify(other).includes(privateId));
  assert.ok(!JSON.stringify(other).includes(host.credential));
  assert.equal(other.game.specialDecks, undefined);
  assert.deepEqual(Object.keys(other.game.decks[1]), ["length"]);
  const revision = view.revision;
  const duplicate = await request(`${root}/command`, { identity: host, data: reservation });
  assert.equal(duplicate.revision, revision);
  assert.equal(duplicate.game.trainers[0].reserved.length, 1);
  await request(`${root}/command`, { identity: guest, data: { id: crypto.randomUUID(), revision: revision - 1, type: "TAKE_TWO", ball: "red" }, status: 409 });

  // Two concurrent commands at one revision: at most one may commit.
  const concurrent = await Promise.all(["red", "blue"].map((ball) => fetch(`${base}${root}/command`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": guest.playerId, Authorization: `Bearer ${guest.credential}` },
    body: JSON.stringify({ id: crypto.randomUUID(), revision, type: "TAKE_TWO", ball }), signal: AbortSignal.timeout(10000),
  })));
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409]);
  view = await request(`${root}/state`, { identity: host });
  assert.equal(view.game.turn, 3);
  a.socket.close();
  const resumed = await connect(host);
  const restored = await resumed.state((snapshot) => snapshot.revision === view.revision);
  assert.equal(restored.viewerTrainerIndex, 0);
  assert.equal(restored.game.trainers[0].reserved[0].id, privateId);
  assert.equal(restored.game.turn, 3);

  const malicious = await connect({ ...host, credential: "wrong" }).then(() => false, () => true);
  assert.equal(malicious, true);
  console.log("PASS: two clients, preparation/start, auth/origin/turn checks, private views, atomic concurrent actions, replay/stale commands and reconnect");
} finally {
  sockets.forEach((socket) => socket.close());
}
