import { DurableObject } from "cloudflare:workers";
import { RoomError, createOnlineRoom, joinOnlineRoom, authenticate, identity, applyCommand, roomView } from "./room.js";

const ROOM_TTL = 7 * 24 * 60 * 60 * 1000;
const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const failure = (error) => json({ message: error instanceof RoomError ? error.message : "服务暂时不可用，请稍后重试" }, error instanceof RoomError ? error.status : 500);

async function body(request) {
  const text = await request.text();
  if (text.length > 4096) throw new RoomError("请求过大", 413);
  try { return JSON.parse(text); } catch { throw new RoomError("请求不是有效 JSON", 400); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      url.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      if (request.headers.has("Origin") && request.headers.get("Origin") !== url.origin) throw new RoomError("请从本站连接游戏", 403);
      if (url.pathname === "/api/health" && request.method === "GET") return json({ service: "pokemon-online", ready: true });
      if (url.pathname === "/api/rooms" && request.method === "POST") {
        const input = await body(request);
        // A 128-bit room address avoids collisions and casual room-code guessing.
        const id = crypto.randomUUID().replaceAll("-", "");
        return await env.ROOMS.getByName(id).fetch(new Request(`https://room/create/${id}`, { method: "POST", body: JSON.stringify(input) }));
      }
      const match = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{32})\/(join|state|command|socket)$/);
      if (!match) throw new RoomError("接口不存在", 404);
      return await env.ROOMS.getByName(match[1]).fetch(request);
    } catch (error) { return failure(error); }
  },
};

export class PokemonRoom extends DurableObject {
  async fetch(request) {
    // Keep read/validate/write and broadcasting ordered even across async handlers.
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        const url = new URL(request.url);
        const creating = url.pathname.match(/^\/create\/([a-f0-9]{32})$/);
        let room = await this.ctx.storage.get("room");
        if (creating && request.method === "POST") {
          if (room) throw new RoomError("房间已存在");
          const input = await body(request);
          room = createOnlineRoom(creating[1], input?.nickname, input?.capacity);
          await this.save(room);
          return json(identity(room, room.members[0]), 201);
        }
        if (!room || room.members.length === 0 || Date.now() - room.updatedAt > ROOM_TTL) throw new RoomError("房间不存在或已过期", 404);
        const action = url.pathname.split("/").at(-1);
        if (action === "join" && request.method === "POST") {
          const input = await body(request);
          room = joinOnlineRoom(room, input?.nickname);
          await this.save(room);
          this.broadcast(room);
          return json(identity(room, room.members.at(-1)), 201);
        }
        if (action === "socket" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
          if (this.ctx.getWebSockets().length >= 16) throw new RoomError("连接数过多，请关闭重复页面", 429);
          const pair = new WebSocketPair();
          this.ctx.acceptWebSocket(pair[1]);
          // Authenticate in the first message, keeping credentials out of URLs/logs.
          pair[1].serializeAttachment({ authenticated: false });
          return new Response(null, { status: 101, webSocket: pair[0] });
        }
        const player = authenticate(room, request.headers.get("X-Player-Id"), request.headers.get("Authorization")?.replace(/^Bearer /, ""));
        if (action === "state" && request.method === "GET") return json(this.view(room, player.playerId));
        if (action === "command" && request.method === "POST") {
          const command = await body(request);
          const next = applyCommand(room, player.playerId, command);
          // Replayed receipts return the original object: no new state to persist.
          if (next !== room) {
            await this.save(next);
            this.broadcast(next);
          }
          room = next;
          if (command.type === "LEAVE") return json({ left: true });
          return json(this.view(room, player.playerId));
        }
        throw new RoomError("请求方法不支持", 405);
      } catch (error) { return failure(error); }
    });
  }

  async webSocketMessage(socket, message) {
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        if (typeof message !== "string" || message.length > 1024) throw new RoomError("消息格式错误", 400);
        const room = await this.ctx.storage.get("room");
        if (!room || Date.now() - room.updatedAt > ROOM_TTL) throw new RoomError("房间已过期", 404);
        const input = JSON.parse(message);
        if (input.type !== "AUTH") throw new RoomError("请先验证席位", 401);
        const player = authenticate(room, input.playerId, input.credential);
        socket.serializeAttachment({ authenticated: true, playerId: player.playerId });
        for (const other of this.ctx.getWebSockets()) {
          if (other !== socket && other.deserializeAttachment()?.playerId === player.playerId) {
            other.serializeAttachment({ authenticated: false });
            other.close(4001, "席位已在另一个页面连接");
          }
        }
        this.broadcast(room);
      } catch {
        socket.close(4003, "席位验证失败，请重新连接");
      }
    });
  }

  async webSocketClose(socket) {
    socket.serializeAttachment({ authenticated: false });
    const room = await this.ctx.storage.get("room");
    if (room) this.broadcast(room);
  }

  async webSocketError(socket) { await this.webSocketClose(socket); }

  async alarm() {
    return this.ctx.blockConcurrencyWhile(async () => {
      const room = await this.ctx.storage.get("room");
      if (room && Date.now() - room.updatedAt < ROOM_TTL) {
        await this.ctx.storage.setAlarm(room.updatedAt + ROOM_TTL);
        return;
      }
      for (const socket of this.ctx.getWebSockets()) socket.close(4004, "房间已过期");
      await this.ctx.storage.deleteAll();
    });
  }

  async save(room) {
    await this.ctx.storage.put("room", room);
    await this.ctx.storage.setAlarm(room.updatedAt + ROOM_TTL);
  }

  view(room, playerId) {
    const online = this.ctx.getWebSockets().flatMap((socket) => socket.deserializeAttachment()?.playerId ?? []);
    return roomView(room, playerId, online);
  }

  broadcast(room) {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment();
      if (!attachment?.authenticated) continue;
      if (!room.members.some((player) => player.playerId === attachment.playerId)) {
        socket.close(4003, "已退出房间");
        continue;
      }
      try { socket.send(JSON.stringify({ type: "STATE", view: this.view(room, attachment.playerId) })); } catch { /* A disconnected peer will restore its view on reconnect. */ }
    }
  }
}
