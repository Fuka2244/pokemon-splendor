# 宝可梦璀璨宝石与桌游小馆

原生 JavaScript 前端，Cloudflare Worker + SQLite Durable Objects 联机房间。支持 2–4 人创建房间、邀请、准备开局、回合操作和原席位重连。

- [桌游大厅](https://spldzy.dpdns.org/)
- [宝可梦联机](https://spldzy.dpdns.org/pokemon.html)

大厅也提供出包魔法师的外部入口；该游戏独立维护，源码不包含在本仓库。

## 本地运行

需要 Node.js 22 或以上。

```sh
npm ci
npm start
```

打开 `http://127.0.0.1:4174/`。免建房的本地体验：`http://127.0.0.1:4174/pokemon.html?mode=local`。

修改前端或卡牌图片后运行 `npm run build` 并刷新页面。Worker 代码由开发服务监听。私密席位保存在浏览器中，不同玩家请使用独立浏览器或设备。

## 验证与发布

```sh
npm test
npm run check:deploy
# 本地联机服务运行时：
npm run test:online
```

`check:deploy` 仅构建和预检，不发布。正式发布使用 `npm run deploy`，通过 Wrangler 正常登录 Cloudflare。`wrangler.jsonc` 已绑定维护者的账号、Worker 和主域名；部署到其他账号前必须修改这些设置。

Git 推送与 Cloudflare 发布是独立操作，本仓库未配置自动部署工作流。

## 文件位置

- `src/hub/`：大厅和可扩展游戏列表。
- `src/main.js`、`src/styles.css`：宝可梦牌桌界面。
- `src/online-client.js`：联机准备室、同步和有次数上限的断线恢复。
- `src/game-engine.js`：游戏规则。
- `src/data/`：卡牌图片与费用、折扣、进化条件映射。
- `assets/source-cards/`：运行必需的卡牌和精灵球图片。
- `worker/`：房间身份、命令校验、状态持久化和 WebSocket 广播。
- `test/`、`tools/`：测试、构建和素材维护工具。

依赖、构建输出、测试截图、日志、本地数据库、登录配置和素材压缩副本不提交。不要将 Token、真实席位凭证或私钥写入源码；仅把不含真实值的环境示例提交到仓库。

更多说明：[联机与部署](docs/online-play.md)、[大厅扩展](docs/game-hub.md)、[断线重试保护](docs/retry-safety.md)。
