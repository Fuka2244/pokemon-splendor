# 两款桌游的联机准备

## 当前状态

- 宝可梦：新增 Cloudflare Worker + SQLite Durable Object 房间服务，复用原 `src/game-engine.js`，不修改规则和卡牌数据。准备室支持 2–4 人、匿名席位、准备、房主开局、邀请链接、等待室退出及房主转移、结算后返回准备室。
- 出包魔法师：复用 `F:\chubao` 已有 Vue / Worker / Durable Object 联机实现。本次运行其测试、类型检查、构建及真实双客户端验证，不修改其源码和线上部署。
- 大厅：本地分别跳转 4174 的宝可梦与 8787 的出包魔法师；公网出包魔法师跳转到其独立 workers.dev 入口。
- 2026-08-31 按用户要求将 <https://spldzy.dpdns.org/> 切换为大厅及宝可梦；出包魔法师保留 <https://hidden-spell-game.hidden-spell-worker.workers.dev/>，旧游戏代码和房间数据未修改。大厅原 workers.dev 地址继续可用。
- 当前发布版本：`665d63c9-307d-472a-8bd1-815b2c4e2c29`（2026-08-31 主域名切换，包含断线重试保护）。77 项测试及构建通过。主域名大厅、游戏页面、图片、健康接口和双客户端 WSS 同步、重复命令、原席位重连均通过检查。临时测试席位已释放，未操作已有对局。
- 首次发布的公网联机验证只创建了一个临时准备室，结束后已释放两个测试席位。已开局的房间保留原卡牌快照；修正后的数据用于新开局，不迁移正在进行的对局。

## 本机启动

要求 Node.js 22 或以上，首次在宝可梦项目运行 `npm ci`。同时运行下面两个终端：

```powershell
# 终端一：大厅和宝可梦
Set-Location F:\splender-baokemeng
npm start

# 终端二：出包魔法师
Set-Location F:\chubao
npm run build --workspace @hidden-spell/web
npm run dev --workspace @hidden-spell/worker -- --port 8787 --ip 127.0.0.1
```

打开 `http://127.0.0.1:4174/`。这两个预览只监听本机，不可直接把 `127.0.0.1` 邀请发给另一台设备；公网跨设备测试需正式部署后的 HTTPS 地址。同机人工测试使用不同浏览器或独立浏览器配置，普通新标签页会共享已有席位，不代表第二位玩家。

宝可梦：创建房间 → 复制邀请 → 朋友加入 → 所有人准备 → 房主开局。邀请只带房间 ID，不含席位凭证。分享者须知：持有邀请链接的人可在满员或开局前加入，没有额外房间密码。

`npm start` 先生成静态目录再启动 Worker。修改前端后运行 `npm run build` 并刷新页面；Worker 模块由 Wrangler 监听。需要纯静态预览可运行 `npm run start:local`，只用于 `pokemon.html?mode=local`，不要与同端口的联机服务同时启动。

## 宝可梦同步与隐私

- 每个房间对应一个 Durable Object。服务器生成并洗牌卡组，仍调用原规则引擎完成所有操作。
- 客户端通过同源 HTTP 提交动作，Authorization 中带私密凭证；WebSocket 负责按席位广播状态，首条消息验证凭证，不在 WebSocket URL 中放入凭证。
- 只向所属席位发送预留卡详情；其他人只收到数量。牌堆和特殊牌堆只发送数量，不发送顺序或卡牌标识。公开预留日志也不包含预留卡名。
- 服务端验证行动席位、参数及修订号。修改串行执行，状态与最近 128 条成功操作回执一起写入。网络结果不确定时客户端重试原操作编号；超过回执窗口的旧修订号仍会被拒绝，不能重复执行。
- 昵称、日志及服务端提示按文本转义展示。原游戏仍支持捕捉、预留、盲预留、归还精灵球、特殊捕捉、进化及跳过进化。

## 断线和房间生命周期

- 宝可梦同一席位只保留一个实时连接，新页面接管后旧页面停止自动争抢。断线后自动重连；刷新会从浏览器保存的凭证恢复原席位。
- 已上线的重试保护：一次恢复最多自动重试 8 次，间隔为 1、2、4、8、16、30、30、30 秒；耗尽后仅由玩家点击“重新连接”重新尝试。连续稳定连接 60 秒且无待确认操作后才重置次数。浏览器报告离线时立即暂停并取消在途请求，恢复网络后手动重连。发布前已打开的页面需刷新一次加载新客户端。详见 [请求与额度检查](retry-safety.md)。
- 断线不自动结束回合、不代打、不自动判负。轮到离线玩家时需要等待其重连。
- “切换房间”保留原房间凭证，可用原邀请再次进入；准备室“退出房间”才会释放席位。开局后禁止释放席位，结算后由房主返回准备室再退出。
- 对局状态持久化到 Durable Object；连续 7 天没有房间变更或成功操作会过期清理，单纯保持连接或读取状态不续期。此版本无账号登录或跨设备找回，清除浏览器站点数据后不能恢复私密席位。
- 出包魔法师保留其现有行为：断线暂停与 90 秒原身份重连、主动退出认输等，不使用宝可梦的生命周期策略。

## 验证

```powershell
Set-Location F:\splender-baokemeng
npm test
npm run check:deploy
# 两个本地服务已启动后：
npm run test:online
node tools/check-chubao-online.mjs

Set-Location F:\chubao
npm test
npm run typecheck
npm run build
```

宝可梦新增房间/渲染测试验证身份、回合、重复与过期命令、隐藏视图、昵称转义和客户端不直接修改游戏状态。`check-online.mjs` 使用两个真实 WebSocket 客户端验证服务端同步、并发只提交一次、断线恢复，且只允许本机测试地址。出包魔法师脚本验证其准备开局、自身手牌隐藏、其他玩家可见手牌、回合保护和重连。脚本创建的都是本地测试房间。

## 发布准备与边界

宝可梦部署配置为根目录 `wrangler.jsonc`，独立名称 `pokemon-board-game`，Durable Object 类为 `PokemonRoom`，不会覆盖出包魔法师的 `hidden-spell-game` / `RoomDurableObject`。`npm run check:deploy` 只做 dry-run；真正发布命令是 `npm run deploy`，需要先完成 Cloudflare 登录和目标账号确认。

本次已完成账号确认、构建和发布。`html_handling: none` 保持 `.html` 入口不变；根路径 `/` 由 Worker 显式映射到 `/index.html`，避免大厅首页 404。页面请求仍从 ASSETS 绑定读取静态文件。

发布验收：77 项 Node 测试通过；此前本地双客户端联机检查通过。主域名公网大厅、游戏页、JS 模块、卡牌图片、健康接口均通过检查。公网两个 WSS 客户端验证了创建/加入、准备状态同步、未授权拒绝、重复命令不重复执行和原席位重连。公网验证未开局，完整动作与回合检查在本地运行。出包魔法师独立 workers.dev 入口返回 200。

本机 Node 直接访问 `workers.dev` 曾超时，公网检查通过系统已有代理完成；未修改系统网络设置。此结果不代表所有地区直连可用。大厅及宝可梦已使用主域名；出包魔法师仍使用 workers.dev，后续可单独绑定子域名。

部署包只包含 `src/` 页面和 `assets/source-cards/`，不包含测试、日志、源码仓库元数据或席位凭证。`.wrangler/` 为本机状态和构建预检目录，不提交或上传。

`spldzy.dpdns.org` 根入口现已属于大厅。更换游戏域名会改变浏览器凭证存储作用域，旧席位不会自动迁移。原宝可梦对局可继续使用原 workers.dev 邀请地址；出包魔法师在独立入口可能需要重新开房。本次没有跨域复制任何私密凭证。

当前准备面向好友邀请测试，不含公开匹配、账号找回、聊天、观战、付费或排行榜。大规模公开开放前需另行配置入口限流和额度监控。本次未开通付费资源，不能据本地验证承诺公网延迟或免费额度永不耗尽。

实现参考：[Cloudflare WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)、[Static Assets binding](https://developers.cloudflare.com/workers/static-assets/binding/)。
