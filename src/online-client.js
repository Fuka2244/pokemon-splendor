export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

// Transport and lobby only. The table still uses the existing render functions.
export function createOnlineClient({ onView, onStatus }) {
  const app = document.querySelector("#app");
  const client = { view: null, connected: false, busy: false, error: "", command, toolbar, start, renderLobby };
  let session = null;
  let socket = null;
  let timer = null;
  let stableTimer = null;
  let handshakeTimer = null;
  let attempt = 0;
  let generation = 0;
  let pending = null;
  let syncing = null;
  const requests = new Set();
  const maxRetries = 8;

  function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { client.error = "浏览器未允许保存席位，请保持此页面打开"; } }
  function forget(key) { try { localStorage.removeItem(key); } catch { /* Private browsing can disable storage. */ } }
  function save() { if (session) write(`pokemon-room:${session.roomId}`, { ...session, pending }); }
  function validSession(value, roomId) {
    return value && value.roomId === roomId && typeof value.playerId === "string" && typeof value.credential === "string";
  }

  function display() {
    if (client.view?.game) onStatus();
    else renderLobby();
  }

  function receive(view) {
    if (client.view && view.revision < client.view.revision) return;
    client.view = view;
    if (view.game) onView(view);
    else renderLobby();
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(path, {
        ...options, signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(session ? { "X-Player-Id": session.playerId, Authorization: `Bearer ${session.credential}` } : {}), ...options.headers },
      });
      let result;
      try { result = await response.json(); } catch {
        const error = new Error(`联机服务响应异常（HTTP ${response.status}），请稍后重新连接`);
        if (!response.ok) error.status = response.status;
        throw error;
      }
      if (!response.ok) {
        const error = new Error(result.message ?? "请求失败");
        error.status = response.status;
        throw error;
      }
      return result;
    } finally { clearTimeout(timeout); requests.delete(controller); }
  }

  function stop() {
    generation += 1;
    clearTimeout(timer);
    clearTimeout(stableTimer);
    clearTimeout(handshakeTimer);
    timer = stableTimer = handshakeTimer = null;
    requests.forEach((controller) => controller.abort());
    syncing = null;
    const old = socket;
    socket = null;
    old?.close();
    client.connected = false;
  }

  function retryLater() {
    // Disconnect before waiting: broadcasts must not bypass the retry delay.
    stop();
    if (navigator.onLine === false) {
      client.error = "网络已断开，自动请求已暂停；恢复网络后请点击重新连接";
    } else if (attempt >= maxRetries) {
      client.error = "多次恢复失败，已停止自动请求；请稍后点击重新连接。未确认的操作已保留";
    } else {
      const delay = Math.min(1000 * 2 ** attempt++, 30000);
      timer = setTimeout(() => { timer = null; void connect(); }, delay);
    }
  }

  function markStable(connection) {
    if (stableTimer !== null || pending) return;
    // A single successful snapshot is not recovery; flapping must retain its budget.
    stableTimer = setTimeout(() => {
      stableTimer = null;
      if (socket === connection && client.connected && !pending) attempt = 0;
    }, 60000);
  }

  async function connect() {
    if (!session) return;
    stop();
    if (navigator.onLine === false) {
      client.error = "网络已断开，自动请求已暂停；恢复网络后请点击重新连接";
      display();
      return;
    }
    const current = generation;
    display();
    try {
      const view = await request(`/api/rooms/${session.roomId}/state`);
      if (generation !== current) return;
      receive(view);
      const url = new URL(`/api/rooms/${session.roomId}/socket`, location.href);
      url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const connection = new WebSocket(url);
      socket = connection;
      handshakeTimer = setTimeout(() => {
        if (socket !== connection) return;
        client.error = "同步连接超时，正在恢复原席位…";
        retryLater();
        display();
      }, 10000);
      connection.addEventListener("open", () => {
        if (socket !== connection) return;
        connection.send(JSON.stringify({ type: "AUTH", playerId: session.playerId, credential: session.credential }));
      });
      connection.addEventListener("message", (event) => {
        if (socket !== connection) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type !== "STATE") return;
          clearTimeout(handshakeTimer);
          handshakeTimer = null;
          client.connected = true;
          client.error = "";
          receive(data.view);
          if (pending && !syncing) void submitPending();
          else markStable(connection);
        } catch { client.error = "收到无效同步消息，请重新连接"; display(); }
      });
      connection.addEventListener("close", (event) => {
        if (socket !== connection) return;
        client.connected = false;
        if ([4001, 4003, 4004].includes(event.code)) {
          stop();
          client.error = event.code === 4001 ? "该席位已在另一个页面连接；如需切回请重新连接" : "席位或房间已失效，请返回入口";
        } else {
          client.error = "连接中断，正在恢复原席位…";
          retryLater();
        }
        display();
      });
    } catch (error) {
      if (generation !== current) return;
      client.error = error.message;
      if (![400, 401, 403, 404, 410, 429].includes(error.status)) retryLater();
      else stop();
      display();
    }
  }

  async function submitPending() {
    if (!pending || syncing || !session) return;
    const submission = {};
    syncing = submission;
    const current = generation;
    clearTimeout(stableTimer);
    stableTimer = null;
    client.busy = true;
    display();
    const submitted = pending;
    try {
      const result = await request(`/api/rooms/${session.roomId}/command`, { method: "POST", body: JSON.stringify(submitted) });
      if (generation !== current) return;
      pending = null;
      save();
      client.error = "";
      if (result.left) {
        forget(`pokemon-room:${session.roomId}`);
        exit();
      } else {
        receive(result);
        markStable(socket);
      }
    } catch (error) {
      if (generation !== current) return;
      client.error = error.message;
      // A network failure may happen after commit. Keep the SAME command id.
      if ([401, 403, 404, 410, 429].includes(error.status)) {
        // A rejected or throttled session must not trigger follow-up reads/retries.
        stop();
        client.error = `${error.message}；自动请求已暂停，请稍后重新连接`;
      } else if (error.status && error.status < 500) {
        pending = null;
        save();
        try {
          const view = await request(`/api/rooms/${session.roomId}/state`);
          if (generation === current) receive(view);
        } catch { /* The reconnect flow retains the seat. */ }
      } else {
        client.error = "操作结果尚未确认，正在重新同步，请勿重复操作";
        client.connected = false;
        retryLater();
      }
    } finally {
      if (syncing === submission) syncing = null;
      if (generation === current || !syncing) {
        client.busy = Boolean(pending);
        display();
      }
    }
  }

  async function command(payload) {
    if (client.busy || !client.connected || !client.view) return;
    pending = { ...payload, id: crypto.randomUUID(), revision: client.view.revision };
    save();
    await submitPending();
  }

  function exit() {
    stop();
    forget("pokemon-last-room");
    session = null;
    pending = null;
    client.view = null;
    client.busy = false;
    client.error = "";
    history.replaceState(null, "", "./pokemon.html");
    renderLobby();
  }

  function toolbar() {
    return `<div class="network-toolbar" role="status"><span class="connection ${client.connected ? "connected" : ""}">${client.connected ? client.busy ? "提交中…" : "已连接" : "未连接"}</span><button data-network="copy">邀请朋友</button>${!client.connected ? '<button data-network="reconnect">重新连接</button>' : ""}<button data-network="exit" ${client.busy ? "disabled" : ""}>切换房间</button></div>${client.error ? `<p class="network-error" role="alert">${escapeHTML(client.error)}</p>` : ""}`;
  }

  function renderLobby() {
    if (client.view?.game) return;
    const view = client.view;
    const me = view?.members[view.viewerTrainerIndex];
    app.innerHTML = `<section class="online-lobby panel"><a href="./">← 桌游大厅</a><p class="online-eyebrow">POKÉMON SPLENDOR · 好友联机</p><h1>宝可梦璀璨宝石</h1>${view ? `
      <p>准备室 · ${view.members.length} / ${view.capacity} 人</p>${toolbar()}
      <ul class="room-members">${view.members.map((player) => `<li><b>${escapeHTML(player.name)}${player.playerId === me.playerId ? "（你）" : ""}</b><span>${player.playerId === view.hostId ? "房主 · " : ""}${player.online ? "在线" : "离线"} · ${player.ready ? "已准备" : "未准备"}</span></li>`).join("")}</ul>
      <div class="room-actions"><button class="primary" data-network="ready" ${client.busy || !client.connected ? "disabled" : ""}>${me.ready ? "取消准备" : "准备好了"}</button>${me.playerId === view.hostId ? `<button data-network="start" ${client.busy || !client.connected || view.members.length < 2 || !view.members.every((player) => player.ready) ? "disabled" : ""}>开始对局</button>` : ""}<button data-network="leave" ${client.busy || !client.connected ? "disabled" : ""}>退出房间</button></div><p class="online-help">至少两人，全部准备后由房主开局。断线保留席位，不会自动代替玩家行动。</p>` : session ? `
      ${toolbar()}<p class="online-help">正在恢复席位。请勿同时在多个页面操作同一个席位。</p>` : `
      <p>创建一张牌桌，将邀请链接发给朋友。</p>${client.error ? `<p class="network-error" role="alert">${escapeHTML(client.error)}</p>` : ""}
      <form id="online-entry"><label>你的昵称<input name="nickname" required maxlength="16" autocomplete="nickname" placeholder="输入训练家昵称"></label><label>人数上限<select name="capacity"><option value="2">2 人</option><option value="3" selected>3 人</option><option value="4">4 人</option></select></label><button class="primary" type="submit" value="create" ${client.busy ? "disabled" : ""}>创建房间</button><div class="join-divider">已有朋友开桌？</div><label>房间码或邀请链接<input name="room" value="${escapeHTML(new URLSearchParams(location.search).get("room") ?? "")}" autocomplete="off" placeholder="粘贴邀请链接或房间码"></label><button type="submit" value="join" ${client.busy ? "disabled" : ""}>加入房间</button></form><p class="online-help">席位凭证只保存在当前浏览器，请勿清除站点数据。<a href="./pokemon.html?mode=local">也可以先本地体验 →</a></p>`}</section>`;
  }

  function parseRoom(value) {
    const text = value.trim();
    let id = text;
    if (text.startsWith("https://") || text.startsWith("http://")) id = new URL(text).searchParams.get("room") ?? "";
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("请粘贴完整邀请链接或 32 位房间码");
    return id;
  }

  function enter(identity) {
    attempt = 0;
    session = identity;
    pending = identity.pending ?? null;
    client.busy = Boolean(pending);
    write("pokemon-last-room", session.roomId);
    save();
    history.replaceState(null, "", `./pokemon.html?room=${session.roomId}`);
    void connect();
  }

  document.addEventListener("submit", async (event) => {
    if (event.target.id !== "online-entry") return;
    event.preventDefault();
    if (client.busy) return;
    const form = new FormData(event.target);
    const joining = event.submitter?.value === "join";
    client.busy = true;
    client.error = "";
    // Keep the form and nickname on errors; only disable submit buttons.
    const buttons = [...event.target.querySelectorAll("button")];
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const roomId = joining ? parseRoom(String(form.get("room"))) : null;
      const saved = roomId && read(`pokemon-room:${roomId}`);
      if (validSession(saved, roomId)) { enter(saved); return; }
      const result = await request(joining ? `/api/rooms/${roomId}/join` : "/api/rooms", { method: "POST", body: JSON.stringify({ nickname: form.get("nickname"), capacity: Number(form.get("capacity")) }) });
      enter(result);
    } catch (error) {
      client.error = error.message;
      let alert = app.querySelector("[role=alert]");
      if (!alert) { alert = document.createElement("p"); alert.className = "network-error"; alert.setAttribute("role", "alert"); event.target.before(alert); }
      alert.textContent = client.error;
    } finally { client.busy = Boolean(pending); buttons.forEach((button) => { button.disabled = false; }); }
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-network]");
    if (!button || button.disabled) return;
    switch (button.dataset.network) {
      case "ready": await command({ type: "READY", ready: !client.view.members[client.view.viewerTrainerIndex].ready }); break;
      case "start": await command({ type: "START" }); break;
      case "leave": await command({ type: "LEAVE" }); break;
      case "reconnect": attempt = 0; void connect(); break;
      case "exit": exit(); break;
      case "copy": {
        const url = new URL("./pokemon.html", location.href);
        url.searchParams.set("room", session.roomId);
        try { await navigator.clipboard.writeText(url.href); button.textContent = "已复制邀请链接"; }
        catch { client.error = `请复制地址栏中的邀请链接；房间码：${session.roomId}`; display(); }
        break;
      }
    }
  });

  window.addEventListener("offline", () => {
    if (!session) return;
    stop();
    client.error = "网络已断开，自动请求已暂停；恢复网络后请点击重新连接";
    display();
  });

  function start() {
    const requestedRoom = new URLSearchParams(location.search).get("room");
    const roomId = requestedRoom ?? read("pokemon-last-room");
    const saved = typeof roomId === "string" && /^[a-f0-9]{32}$/.test(roomId) ? read(`pokemon-room:${roomId}`) : null;
    if (validSession(saved, roomId)) enter(saved);
    else renderLobby();
  }
  return client;
}
