# 卡牌素材清单

原始压缩包：`D:\download\宝可梦璀璨宝石\宝可梦璀璨宝石.zip`

工作区素材目录：`assets/source-cards`

补充确认数据：`D:\download\pokemon-pending-card-data.json`

## 汇总

- 已复制图片数量：96
- 图片格式：PNG
- 原始压缩包只读取，未移动、删除、改名或覆盖。
- 解压到工作区时使用了规范化 ASCII 文件名，避免中文 zip 路径编码问题影响网页加载。
- 联系表预览目录：`assets/derived/contact-sheets`
- 已确认普通宝可梦牌：80 张
- 已确认稀有宝可梦牌：5 张
- 已确认传说宝可梦牌：5 张
- 已确认可进化普通宝可梦牌：64 张
- 待继续确认的普通牌素材：0 张

## 文件夹对应关系

| 规范化目录 | 图片数量 | 说明 |
| --- | ---: | --- |
| `assets/source-cards/tier-1` | 35 | 一级普通宝可梦牌 |
| `assets/source-cards/tier-3` | 15 | 三级普通宝可梦牌 |
| `assets/source-cards/tier-2` | 30 | 二级普通宝可梦牌 |
| `assets/source-cards/legendary` | 5 | 传说宝可梦牌 |
| `assets/source-cards/icons` | 6 | 精灵球图标 |
| `assets/source-cards/rare` | 5 | 稀有宝可梦牌 |

在当前 Windows 环境中，压缩包内部中文条目名显示为乱码。机器可读清单 `docs/assets/card-inventory.json` 保留了原始条目值；游戏运行时只使用规范化后的工作区路径。

## 属性与图标对应

界面会优先显示球图标，不向玩家显示内部字段名。内部字段只用于程序判断。

| 内部字段 | 画面图标 |
| --- | --- |
| `red` | 红白球 |
| `blue` | 蓝红球 |
| `yellow` | 黄蓝球 |
| `black` | 黑黄球 |
| `pink` | 粉紫球 |
| `master` | 万能球 |

## 识别规则备注

- 普通宝可梦牌始终只提供卡面右上角球图标对应的 `+1` 永久折扣。
- 稀有和传说宝可梦牌可以按卡面顶部的两个球图标提供 2 点特殊永久折扣。
- 稀有和传说牌左侧的彩色球要求检查永久折扣，不消耗手里的彩色精灵球。
- 稀有和传说牌左侧的万能球要求会从训练家手里支付，并归还供应区。
- 当前 58 张补充普通牌来自用户提供的确认数据文件，只作为数据来源，不作为开发指令执行。

## 普通宝可梦牌

| 原文件路径 | 等级 | 宝可梦名称 | 分数 | 折扣属性 | 捕捉费用 | 进化后的宝可梦 | 进化条件 | 识别状态 |
| --- | ---: | --- | ---: | --- | --- | --- | --- | --- |
| `assets/source-cards/tier-1/tier-1-001.png` | 1 | 小拳石 | 0 | blue | black:1，yellow:1，pink:1，red:1 | 隆隆石 | black:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-002.png` | 1 | 小火龙 | 1 | blue | black:3，pink:2 | 火恐龙 | yellow:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-003.png` | 1 | 小火龙 | 1 | blue | blue:4 | 火恐龙 | yellow:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-004.png` | 1 | 波波 | 0 | blue | yellow:2，black:1 | 比比鸟 | red:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-005.png` | 1 | 波波 | 0 | blue | blue:2，red:2 | 比比鸟 | red:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-007.png` | 1 | 凯西 | 1 | pink | blue:3，yellow:2 | 勇基拉 | red:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-009.png` | 1 | 绿毛虫 | 0 | pink | blue:1，yellow:1，red:1，black:1 | 铁甲蛹 | blue:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-011.png` | 1 | 蚊香蝌蚪 | 0 | pink | blue:2，yellow:1 | 蚊香君 | black:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-015.png` | 1 | 喇叭芽 | 0 | red | black:2，blue:1 | 口呆花 | pink:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-018.png` | 1 | 腕力 | 0 | red | blue:1，yellow:1，pink:1，black:1 | 豪力 | yellow:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-020.png` | 1 | 杰尼龟 | 1 | red | pink:3，blue:2 | 卡咪龟 | black:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-022.png` | 1 | 妙蛙种子 | 1 | yellow | red:3，black:2 | 妙蛙草 | pink:3 | 已确认 |
| `assets/source-cards/tier-3/tier-3-001.png` | 3 | 妙蛙花 | 5 | yellow | red:7，pink:3 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-002.png` | 3 | 蚊香泳士 | 3 | pink | pink:5，yellow:2，red:2 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-003.png` | 3 | 水箭龟 | 5 | red | blue:7，black:3 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-004.png` | 3 | 怪力 | 4 | red | yellow:6，pink:4 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-005.png` | 3 | 大食花 | 3 | red | red:5，black:2，blue:2 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-011.png` | 3 | 喷火龙 | 5 | blue | black:7，yellow:3 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-2/tier-2-001.png` | 2 | 隆隆石 | 2 | blue | pink:4，yellow:2，black:1 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-2/tier-2-002.png` | 2 | 火恐龙 | 3 | blue | blue:6 | 喷火龙 | red:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-003.png` | 2 | 比比鸟 | 1 | blue | red:3，yellow:2，pink:2 | 大比鸟 | red:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-005.png` | 2 | 勇基拉 | 3 | pink | red:4，yellow:4，black:1 | 胡地 | black:4 | 已确认 |
| `assets/source-cards/tier-1/tier-1-006.png` | 1 | 走路草 | 0 | black | yellow:2，black:2 | 臭臭花 | yellow:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-008.png` | 1 | 独角虫 | 0 | black | red:1，yellow:1，pink:1，blue:1 | 铁壳蛹 | red:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-010.png` | 1 | 小火龙 | 1 | blue | black:3，pink:2 | 火恐龙 | yellow:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-012.png` | 1 | 波波 | 0 | blue | yellow:2，black:1 | 比比鸟 | red:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-013.png` | 1 | 波波 | 0 | blue | blue:2，red:2 | 比比鸟 | red:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-014.png` | 1 | 波波 | 0 | blue | pink:3 | 比比鸟 | red:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-016.png` | 1 | 凯西 | 1 | pink | pink:4 | 勇基拉 | red:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-017.png` | 1 | 绿毛虫 | 0 | pink | blue:1，yellow:1，red:1，black:1 | 铁甲蛹 | blue:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-019.png` | 1 | 蚊香蝌蚪 | 0 | pink | blue:2，yellow:1 | 蚊香君 | black:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-021.png` | 1 | 蚊香蝌蚪 | 0 | pink | red:3 | 蚊香君 | black:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-023.png` | 1 | 喇叭芽 | 0 | red | pink:2，red:2 | 口呆花 | pink:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-024.png` | 1 | 喇叭芽 | 0 | red | yellow:3 | 口呆花 | pink:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-025.png` | 1 | 腕力 | 0 | red | blue:1，yellow:1，pink:1，black:1 | 豪力 | yellow:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-026.png` | 1 | 腕力 | 0 | red | yellow:2，pink:1，black:1 | 豪力 | yellow:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-027.png` | 1 | 杰尼龟 | 1 | red | pink:3，blue:2 | 卡咪龟 | black:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-028.png` | 1 | 杰尼龟 | 1 | red | red:4 | 卡咪龟 | black:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-029.png` | 1 | 妙蛙种子 | 1 | yellow | red:3，black:2 | 妙蛙草 | pink:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-030.png` | 1 | 妙蛙种子 | 1 | yellow | yellow:4 | 妙蛙草 | pink:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-031.png` | 1 | 鬼斯 | 0 | yellow | blue:1，red:1，pink:1，black:1 | 鬼斯通 | black:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-032.png` | 1 | 鬼斯 | 0 | yellow | pink:2，black:1，red:1 | 鬼斯通 | black:3 | 已确认 |
| `assets/source-cards/tier-1/tier-1-033.png` | 1 | 尼多兰 | 0 | yellow | red:2，pink:1 | 尼多娜 | blue:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-034.png` | 1 | 尼多兰 | 0 | yellow | blue:2，yellow:2 | 尼多娜 | blue:2 | 已确认 |
| `assets/source-cards/tier-1/tier-1-035.png` | 1 | 尼多兰 | 0 | yellow | black:3 | 尼多娜 | blue:2 | 已确认 |
| `assets/source-cards/tier-2/tier-2-004.png` | 2 | 哈克龙 | 3 | black | black:6 | 快龙 | yellow:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-006.png` | 2 | 臭臭花 | 1 | black | black:3，blue:2，red:2 | 霸王花 | yellow:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-007.png` | 2 | 铁壳蛹 | 2 | black | red:4，blue:2，pink:1 | 大针蜂 | pink:3 | 已确认 |
| `assets/source-cards/tier-2/tier-2-008.png` | 2 | 铁壳蛹 | 2 | black | black:5，yellow:2 | 大针蜂 | pink:3 | 已确认 |
| `assets/source-cards/tier-2/tier-2-009.png` | 2 | 火恐龙 | 3 | blue | yellow:4，black:4，red:1 | 喷火龙 | red:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-010.png` | 2 | 火恐龙 | 3 | blue | blue:6 | 喷火龙 | red:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-011.png` | 2 | 比比鸟 | 1 | blue | red:3，yellow:2，pink:2 | 大比鸟 | red:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-012.png` | 2 | 比比鸟 | 1 | blue | blue:3，pink:2，black:2 | 大比鸟 | red:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-013.png` | 2 | 勇基拉 | 3 | pink | red:4，yellow:4，black:1 | 胡地 | black:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-014.png` | 2 | 勇基拉 | 3 | pink | pink:6 | 胡地 | black:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-015.png` | 2 | 铁甲蛹 | 2 | pink | blue:4，red:2，yellow:1 | 巴大蝶 | yellow:3 | 已确认 |
| `assets/source-cards/tier-2/tier-2-016.png` | 2 | 铁甲蛹 | 2 | pink | pink:5，black:2 | 巴大蝶 | yellow:3 | 已确认 |
| `assets/source-cards/tier-2/tier-2-017.png` | 2 | 蚊香君 | 1 | pink | black:3，blue:2，red:2 | 蚊香泳士 | black:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-018.png` | 2 | 蚊香君 | 1 | pink | pink:3，blue:2，yellow:2 | 蚊香泳士 | black:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-019.png` | 2 | 豪力 | 2 | red | yellow:4，black:2，blue:1 | 怪力 | blue:3 | 已确认 |
| `assets/source-cards/tier-2/tier-2-020.png` | 2 | 豪力 | 2 | red | red:5，pink:2 | 怪力 | blue:3 | 已确认 |
| `assets/source-cards/tier-2/tier-2-021.png` | 2 | 卡咪龟 | 3 | red | blue:4，black:4，pink:1 | 水箭龟 | pink:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-022.png` | 2 | 卡咪龟 | 3 | red | red:6 | 水箭龟 | pink:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-023.png` | 2 | 口呆花 | 1 | red | pink:3，yellow:2，black:2 | 大食花 | pink:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-024.png` | 2 | 口呆花 | 1 | red | red:3，black:2，yellow:2 | 大食花 | pink:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-025.png` | 2 | 鬼斯通 | 2 | yellow | black:4，pink:2，red:1 | 耿鬼 | red:3 | 已确认 |
| `assets/source-cards/tier-2/tier-2-026.png` | 2 | 鬼斯通 | 2 | yellow | yellow:5，blue:2 | 耿鬼 | red:3 | 已确认 |
| `assets/source-cards/tier-2/tier-2-027.png` | 2 | 妙蛙草 | 3 | yellow | red:4，pink:4，blue:1 | 妙蛙花 | blue:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-028.png` | 2 | 妙蛙草 | 3 | yellow | yellow:6 | 妙蛙花 | blue:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-029.png` | 2 | 尼多娜 | 1 | yellow | blue:3，pink:2，black:2 | 尼多后 | blue:4 | 已确认 |
| `assets/source-cards/tier-2/tier-2-030.png` | 2 | 尼多娜 | 1 | yellow | yellow:3，pink:2，red:2 | 尼多后 | blue:4 | 已确认 |
| `assets/source-cards/tier-3/tier-3-006.png` | 3 | 耿鬼 | 4 | yellow | black:6，blue:4 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-007.png` | 3 | 尼多后 | 3 | yellow | yellow:5，red:2，pink:2 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-008.png` | 3 | 快龙 | 5 | black | pink:7，blue:3 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-009.png` | 3 | 大针蜂 | 4 | black | pink:6，yellow:4 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-010.png` | 3 | 霸王花 | 3 | black | black:5，blue:2，pink:2 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-012.png` | 3 | 隆隆岩 | 4 | blue | pink:6，red:4 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-013.png` | 3 | 大比鸟 | 3 | blue | blue:5，black:2，yellow:2 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-014.png` | 3 | 胡地 | 5 | pink | yellow:7，red:3 | 无 | 无 | 已确认 |
| `assets/source-cards/tier-3/tier-3-015.png` | 3 | 巴大蝶 | 4 | pink | blue:6，black:4 | 无 | 无 | 已确认 |

## 稀有与传说宝可梦牌

| 原文件路径 | 类型 | 宝可梦名称 | 分数 | 捕捉条件 | 万能球费用 | 特殊折扣 | 识别状态 |
| --- | --- | --- | ---: | --- | ---: | --- | --- |
| `assets/source-cards/rare/rare-001.png` | 稀有 | 化石翼龙 | 0 | blue:3，pink:2 | 1 | yellow:2 | 已确认 |
| `assets/source-cards/rare/rare-002.png` | 稀有 | 伊布 | 0 | yellow:3，red:2 | 1 | black:2 | 已确认 |
| `assets/source-cards/rare/rare-003.png` | 稀有 | 百变怪 | 0 | pink:3，yellow:2 | 1 | blue:2 | 已确认 |
| `assets/source-cards/rare/rare-004.png` | 稀有 | 卡比兽 | 0 | red:3，black:2 | 1 | pink:2 | 已确认 |
| `assets/source-cards/rare/rare-005.png` | 稀有 | 拉普拉斯 | 0 | black:3，blue:2 | 1 | red:2 | 已确认 |
| `assets/source-cards/legendary/legendary-001.png` | 传说 | 超梦 | 2 | pink:3，red:3，blue:3 | 1 | black:2 | 已确认 |
| `assets/source-cards/legendary/legendary-002.png` | 传说 | 梦幻 | 2 | black:3，yellow:3，red:3 | 1 | blue:2 | 已确认 |
| `assets/source-cards/legendary/legendary-003.png` | 传说 | 火焰鸟 | 2 | blue:3，yellow:3，black:3 | 1 | pink:2 | 已确认 |
| `assets/source-cards/legendary/legendary-004.png` | 传说 | 闪电鸟 | 2 | pink:3，blue:3，yellow:3 | 1 | red:2 | 已确认 |
| `assets/source-cards/legendary/legendary-005.png` | 传说 | 急冻鸟 | 2 | red:3，pink:3，black:3 | 1 | yellow:2 | 已确认 |
