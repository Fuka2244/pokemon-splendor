# 桌游小馆

总入口与游戏独立维护。大厅只负责展示和跳转，不接管任何游戏的身份、房间、WebSocket 或规则。

## 本地入口

运行 `npm start`（已有服务时无需重复启动）。

- `http://127.0.0.1:4174/`：桌游大厅。
- `http://127.0.0.1:4174/pokemon.html`：宝可梦联机准备室，2–4 人创建、加入、准备后开局。
- `http://127.0.0.1:4174/pokemon.html?mode=local`：保留的本地三人体验。
- 出包魔法师卡片：本机访问大厅时打开 `http://127.0.0.1:8787/`，需先启动 `F:\chubao` 的本地 Worker；生产域名下打开 `https://hidden-spell-game.hidden-spell-worker.workers.dev/`。大厅不复制该项目的游戏代码。

宝可梦页脚提供在新标签页打开大厅的链接。联机模式刷新会恢复原席位和服务端对局；本地体验刷新仍会重新初始化。

## 增加桌游

在 `src/hub/games.js` 的数组中新增一项，列表数量、搜索与模式筛选会自动更新。保持 `id` 唯一，数组顺序即显示顺序。所有文本通过 DOM `textContent` 输出，不将配置文本作为 HTML 执行。

```js
{
  id: "my-board-game",
  title: "新桌游",
  subtitle: "MY BOARD GAME",
  description: "简短介绍游戏玩法。",
  players: "2–4 人",
  mode: "online", // online 或 local；与游戏实际能力一致
  status: "联机对战",
  tags: ["策略", "卡牌"],
  href: "https://your-game.example/", // 替换为真实游戏入口
  // 可选 localHref: "http://127.0.0.1:8787/"；只在本机大厅使用
  external: true, // 独立站点新标签页打开；站内链接可为 false
  action: "进入游戏",
  note: "在新标签页打开",
  // 可选 coverImage: "./assets/your-cover.webp"
  // 不提供封面时使用默认骰子图案，无需新增 CSS。
}
```

封面图片是装饰性内容，标题、介绍和状态必须以文本提供。`status` 是配置的功能说明，不代表实时在线状态。游戏链接与图片路径仅由项目维护者配置，应使用可信 HTTPS URL 或相对路径。

## Cloudflare 入口

2026-08-31 已发布大厅及宝可梦联机服务：

- 大厅：<https://spldzy.dpdns.org/>
- 宝可梦：<https://spldzy.dpdns.org/pokemon.html>
- 出包魔法师：<https://hidden-spell-game.hidden-spell-worker.workers.dev/>
- 大厅与宝可梦原 `pokemon-board-game.hidden-spell-worker.workers.dev` 地址仍然保留。

当前部署包包含大厅及宝可梦；出包魔法师保持独立 Worker，不同游戏使用各自的 API，避免根路径 `/api/*`、静态资源与浏览器会话互相冲突，不用 iframe 嵌入。以后可将大厅单独部署，只需将宝可梦的相对链接改为其真实独立网址。

2026-08-31 按用户要求，将 `spldzy.dpdns.org` Custom Domain 从 `hidden-spell-game` 切换到 `pokemon-board-game`，并在 `wrangler.jsonc` 固定绑定。先验证出包魔法师独立入口返回 200，再修改大厅链接，避免跳转回大厅。没有改动旧游戏代码或删除 Durable Object 房间。

切换后已验证主域名大厅、宝可梦、卡牌资源、双 WSS 客户端同步及原席位重连。浏览器私密席位按域名保存，不会随域名自动迁移：原宝可梦对局可继续使用旧的 workers.dev 邀请；出包魔法师在新入口可能需要重新开房。后续可为旧游戏增加独立自定义子域名，但不要再将其大厅链接设为 `spldzy.dpdns.org/`。

详细启动、联机验收与发布预检见 [联机说明](online-play.md)。
