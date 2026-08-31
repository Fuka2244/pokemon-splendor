# 断线重试与额度检查

日期：2026-08-31。检查对象为宝可梦客户端和 Worker。以下修复已包含在当前源码中，部署者需自行发布后才能在自己的联机服务中使用。

## 可重复的故障

运行 `node --test test/online-client-retry.test.js`，使用真实客户端模块配合模拟时钟、fetch 和 WebSocket，不向 Cloudflare 发请求。原代码的 1 小时模拟结果：

| 场景 | 原代码 | 修复后每次恢复上限 |
| --- | --- | --- |
| state 接口始终快速返回 503 | 363 次 HTTP，之后继续 | 9 次 HTTP（首次 + 8 次重试） |
| state 正常，WebSocket 收到 STATE 后立即断开 | 3,601 次 state 请求 + 3,601 次握手 | 9 次 state 请求 + 9 次握手 |
| state / WebSocket 正常，待确认 command 始终返回 503 | 3,601 次同 ID 操作提交，并伴随重连 | 各最多 9 次 state、握手和 command |
| 正常连接闲置一天 | 仅初次 state / 握手，无定时请求 | 同样不轮询 |

上述为指定故障模型中的模拟请求数，不是线上用量统计。网络耗时、浏览器后台节流会影响实际频率。主要原因是原代码无重试上限，并且每条 STATE 都把退避次数归零；操作失败后连接仍接收广播，也可能绕过退避时间重试待确认操作。

## 重试保护

- `src/online-client.js`：最多 8 次自动重试，最长间隔 30 秒；连接稳定满 60 秒且没有未确认操作，才恢复预算。仅玩家手动点击、重新进入或刷新可主动开启新的恢复流程。
- 重试等待前关闭当前连接，旧消息不能触发操作重试；浏览器报告离线时立即停止并中止在途 fetch。恢复网络后点击“重新连接”。
- 身份失效、禁止访问、房间不存在、限流及席位被其他页面接管时停止自动请求，保留原席位和未确认操作 ID。即使错误响应是 HTML，仍按 HTTP 状态停止。
- 同步握手 10 秒未完成则按同一预算重试。暂停后没有后台定时请求。稳定计时器仅运行在浏览器，不是 Durable Object 定时器。
- `worker/index.js`：重复成功命令直接返回当前视图，跳过原本多余的 `put`、`setAlarm` 和广播；首次命令照常持久化并广播，游戏规则及接口不变。
- `test/online-client-retry.test.js`：14 项回归场景，包括长期失败、短连接、失败操作、限流、离线、手动恢复、正常闲置、旧响应和多标签页接管。
- `test/online-worker-replay.test.js`：真实 Worker 请求处理路径验证首次写入、重复命令不写入也不广播。

验证：77 项 Node 测试、本地双 WebSocket 联机测试、静态构建和 `wrangler deploy --dry-run` 全部通过。项目没有单独 lint 脚本。修复不修改卡牌数据、游戏规则或接口协议。

## Cloudflare 额度含义

按检查日官方文档，Workers Free 的动态请求额度为 100,000/日；Durable Objects Free 另有 100,000 次请求/日和 13,000 GB-s/日的时长额度。一次 WebSocket 握手属于请求，DO 入站消息按 20:1 折算请求，出站消息不收费。不能把握手与普通消息的计费混为一谈。来源：[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)、[Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)。

宝可梦使用 `ctx.acceptWebSocket`，没有周期性 Worker 心跳；闲置时满足休眠条件可免去持续时长消耗。七天清理 alarm 不是短周期轮询。重复命令即使免去存储写入，接收请求及读取状态仍会消耗资源。来源：[WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)。

如果账号确实处于 Free 计划，超过 DO 免费限制会使相应操作失败，日限额于 UTC 00:00（北京时间 08:00）重置；本次未查询账号当前套餐或实际剩余额度，因此不能断言已经耗尽或永不会耗尽。

## 尚存边界

- 已打开的旧客户端不会自动获得新保护。现在需要刷新游戏页面才加载新代码；无需清除席位数据或重新创建房间。
- 这是正常客户端故障重试保护，不是防恶意刷接口。公开创建/加入接口没有本次新增的边缘限流；脚本可以绕过客户端。大量玩家、反复人工刷新或其他同账号 Worker 也能消耗额度。需要进一步配置入口限流与用量监控时应另行实施，不能靠这次修复承诺额度绝不会耗尽。
