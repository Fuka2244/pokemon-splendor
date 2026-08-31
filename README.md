# 宝可梦璀璨宝石 · Pokémon Splendor

基于原生 JavaScript 的宝可梦主题资源构筑桌游，支持本地体验与 2–4 人自部署联机，包含卡牌捕捉、进化、预留、回合管理和断线重连功能。

本仓库仅包含宝可梦游戏，不包含其他桌游或多游戏导航页面。

## 功能

- 收集精灵球、捕捉宝可梦、积累永久折扣。
- 普通、稀有与传说卡牌，支持预留和进化。
- 本地同机体验，或通过邀请链接进行 2–4 人联机。
- 服务端校验操作、持久化对局，并按玩家隐藏私密卡牌信息。
- 刷新恢复原席位；断线自动重试有次数上限，避免无限请求。

## 本地体验

需要 Node.js 22 或以上。

```sh
npm ci
npm run start:local
```

打开 `http://127.0.0.1:4174/?mode=local`。此模式无需部署 Cloudflare，也不支持跨设备状态同步。

## 联机需要自行部署

**仓库不提供公共联机服务器。与朋友跨设备联机，需要使用你自己的 Cloudflare 账号部署前端、Worker 和 Durable Objects。仅上传静态页面不能提供完整联机功能。**

本地调试联机服务：

```sh
npm start
```

打开 `http://127.0.0.1:4174/`，创建房间并用独立浏览器测试多个席位。不要把 `127.0.0.1` 邀请链接发给其他设备；它只指向各自的本机。本地静态服务与联机服务使用同一端口，不要同时启动。

部署到自己的 Cloudflare：

1. 准备自己的 Cloudflare 账号，在 `wrangler.jsonc` 中设置你要使用的 Worker 名称。仓库未绑定个人账号或自定义域名。
2. 执行以下命令：

```sh
npx wrangler login
npm test
npm run check:deploy
npm run deploy
```

3. 打开部署输出的 HTTPS 地址，创建房间并分享邀请链接；所有玩家准备后由房主开始对局。

`check:deploy` 只进行构建预检，不发布。免费额度和服务可用性由你的 Cloudflare 账号决定，请自行关注用量。Git 推送不会自动发布，本仓库未配置自动部署工作流。

## 开发与验证

```sh
npm test
npm run build
# 本地联机服务运行时：
npm run test:online
```

修改前端或图片后运行 `npm run build` 并刷新页面。联机开发时 Worker 代码由开发服务监听；已开局房间保留原卡牌快照，数据修改请用新对局验证。

## 文件位置

- `src/index.html`：游戏首页；`src/pokemon.html` 保留兼容入口。
- `src/main.js`、`src/styles.css`：牌桌界面与交互。
- `src/game-engine.js`：游戏规则。
- `src/online-client.js`：联机准备室、状态同步与重连。
- `src/data/`：卡牌费用、折扣、进化条件和图片映射。
- `assets/source-cards/`：游戏使用的卡牌与精灵球图片。
- `worker/`：房间服务、命令校验与状态持久化。
- `test/`、`tools/`：测试、构建和素材维护工具。

不要提交 Token、真实席位凭证、私钥或本地数据库。依赖、构建输出、日志和调试截图已由 `.gitignore` 排除。

详细说明：[联机与自部署](docs/online-play.md)、[断线重试保护](docs/retry-safety.md)。
