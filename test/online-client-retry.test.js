import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/online-client.js", import.meta.url), "utf8").replace(/^export /gm, "");
const roomId = "a".repeat(32);
const identity = { roomId, playerId: "host", credential: "test-seat" };
const view = { revision: 1, game: {}, members: [], viewerTrainerIndex: 0 };
const response = (status, value = view) => ({ ok: status < 400, status, json: async () => value });

function harness({ state = () => response(200), submit = () => response(200), offline = false, pending = null, socketMode = "stable" } = {}) {
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  const requests = [];
  const sockets = [];
  const events = new Map();
  const storage = new Map([["pokemon-last-room", JSON.stringify(roomId)], [`pokemon-room:${roomId}`, JSON.stringify({ ...identity, pending })]]);
  const app = { innerHTML: "" };
  const schedule = (fn, delay = 0) => { const id = ++sequence; timers.set(id, { fn, due: now + delay }); return id; };
  class Socket {
    handlers = new Map();
    constructor() {
      sockets.push(this);
      schedule(() => this.emit("open"), 0);
    }
    addEventListener(type, fn) { this.handlers.set(type, fn); }
    emit(type, event = {}) { this.handlers.get(type)?.(event); }
    send() {
      schedule(() => {
        if (socketMode === "silent") return;
        this.emit("message", { data: JSON.stringify({ type: "STATE", view }) });
        if (socketMode === "flap") this.emit("close", { code: 1006 });
      }, 0);
    }
    close() { this.emit("close", { code: 1000 }); }
  }
  class Clock extends Date { static now() { return now; } }
  const navigator = { onLine: !offline };
  const context = vm.createContext({
    URL, URLSearchParams, AbortController, crypto, Date: Clock,
    location: { search: "", href: "http://localhost/pokemon.html", protocol: "http:" },
    history: { replaceState() {} }, navigator,
    document: { querySelector: () => app, addEventListener: (type, fn) => events.set(type, fn) },
    window: { addEventListener: (type, fn) => events.set(type, fn) },
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    setTimeout: schedule, clearTimeout: (id) => timers.delete(id), WebSocket: Socket,
    fetch: async (path, options) => {
      requests.push({ path, options });
      return path.endsWith("/command") ? submit(options) : state(options);
    },
  });
  vm.runInContext(source, context);
  const client = vm.runInContext("createOnlineClient({ onView() {}, onStatus() {} })", context);
  const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  async function advance(ms) {
    const until = now + ms;
    await flush();
    let steps = 0;
    while (true) {
      const entry = [...timers].filter(([, timer]) => timer.due <= until).sort((a, b) => a[1].due - b[1].due)[0];
      if (!entry) break;
      assert.ok(++steps < 100000, "Runaway timer loop");
      const [id, timer] = entry;
      now = timer.due;
      timers.delete(id);
      timer.fn();
      await flush();
    }
    now = until;
    await flush();
  }
  const click = (network) => events.get("click")({ target: { closest: () => ({ dataset: { network } }) } });
  client.start();
  return { client, requests, sockets, advance, flush, click, storage, events, navigator };
}

test("persistent service failure stops automatic requests after a bounded recovery budget", async () => {
  const h = harness({ state: () => response(503, { message: "Unavailable" }) });
  await h.advance(3600000);
  assert.ok(h.requests.length <= 9, `One hour generated ${h.requests.length} HTTP requests`);
  const count = h.requests.length;
  await h.advance(86400000);
  assert.equal(h.requests.length, count, "Must stay stopped until user retries");
});

test("brief successful snapshots do not reset the retry budget during repeated disconnects", async () => {
  const h = harness({ socketMode: "flap" });
  await h.advance(3600000);
  assert.ok(h.sockets.length <= 9, `One hour generated ${h.sockets.length} WebSocket handshakes`);
});

test("an unconfirmed command cannot retry forever through successful state reconnects", async () => {
  const pending = { id: "same-command", revision: 1, type: "READY", ready: true };
  const h = harness({ pending, submit: () => response(503, { message: "Unavailable" }) });
  await h.advance(3600000);
  const commands = h.requests.filter((request) => request.path.endsWith("/command"));
  assert.ok(commands.length <= 9, `One hour generated ${commands.length} command submissions`);
  assert.ok(commands.every(({ options }) => JSON.parse(options.body).id === pending.id));
  assert.equal(JSON.parse(h.storage.get(`pokemon-room:${roomId}`)).pending.id, pending.id);
});

test("a known offline browser sends no automatic network requests", async () => {
  const h = harness({ offline: true });
  await h.advance(3600000);
  assert.equal(h.requests.length, 0);
});

test("a stable idle connection does not poll or send periodic application heartbeats", async () => {
  const h = harness();
  await h.advance(86400000);
  assert.equal(h.requests.length, 1);
  assert.equal(h.sockets.length, 1);
});

test("manual reconnect can recover after the automatic budget is exhausted", async () => {
  let unavailable = true;
  const h = harness({ state: () => unavailable ? response(503) : response(200) });
  await h.advance(3600000);
  unavailable = false;
  await h.click("reconnect");
  await h.advance(0);
  assert.equal(h.client.connected, true);
  assert.equal(h.requests.length, 10);
});

test("a genuinely stable connection restores the budget for a later outage", async () => {
  let unavailable = true;
  const h = harness({ state: () => unavailable ? response(503) : response(200) });
  await h.advance(31000);
  unavailable = false;
  await h.advance(90000);
  h.sockets.at(-1).emit("close", { code: 1006 });
  await h.advance(1000);
  assert.equal(h.sockets.length, 2);
  assert.equal(h.client.connected, true);
});

test("a WebSocket that never authenticates times out with bounded retries", async () => {
  const h = harness({ socketMode: "silent" });
  await h.advance(3600000);
  assert.equal(h.client.connected, false);
  assert.equal(h.sockets.length, 9);
});

test("expired, forbidden or throttled state responses stop even when not JSON", async () => {
  for (const status of [401, 403, 404, 410, 429]) {
    const h = harness({ state: () => ({ ok: false, status, json: async () => { throw new SyntaxError("HTML response"); } }) });
    await h.advance(3600000);
    assert.equal(h.requests.length, 1, `HTTP ${status} must not retry`);
  }
});

test("terminal WebSocket close codes never auto-reclaim a seat or retry", async () => {
  for (const code of [4001, 4003, 4004]) {
    const h = harness();
    await h.advance(0);
    h.sockets[0].emit("close", { code });
    await h.advance(3600000);
    assert.equal(h.requests.length, 1);
    assert.equal(h.client.connected, false);
  }
});

test("stale broadcasts cannot accelerate pending-command retries", async () => {
  const h = harness({ pending: { id: "original-id", revision: 1, type: "READY", ready: true }, submit: () => response(503) });
  await h.advance(0);
  const socket = h.sockets[0];
  for (let i = 0; i < 100; i++) socket.emit("message", { data: JSON.stringify({ type: "STATE", view }) });
  await h.flush();
  assert.equal(h.requests.filter(({ path }) => path.endsWith("/command")).length, 1);
});

test("going offline aborts an in-flight request and does not restart behind the user's back", async () => {
  const h = harness({ state: ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")));
  }) });
  await h.flush();
  h.navigator.onLine = false;
  h.events.get("offline")();
  await h.advance(3600000);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.sockets.length, 0);
});

test("switching rooms cancels scheduled retries and ignores a late response", async () => {
  let resolve;
  const h = harness({ state: () => new Promise((done) => { resolve = done; }) });
  await h.flush();
  await h.click("exit");
  resolve(response(200));
  await h.advance(3600000);
  assert.equal(h.requests.length, 1);
  assert.equal(h.sockets.length, 0);
  assert.equal(h.client.view, null);
});

test("throttled commands preserve their id and make no follow-up requests", async () => {
  const h = harness({ pending: { id: "original-id", revision: 1, type: "READY", ready: true }, submit: () => response(429, { message: "Too many requests" }) });
  await h.advance(3600000);
  assert.equal(h.requests.length, 2);
  assert.equal(h.client.connected, false);
  assert.equal(JSON.parse(h.storage.get(`pokemon-room:${roomId}`)).pending.id, "original-id");
});
