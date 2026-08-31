import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ballTypes, legendaryPokemonCards, masterBall, pendingSourceCards, pokemonCards, rarePokemonCards } from "../src/data/card-manifest.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const inventory = JSON.parse(fs.readFileSync(path.join(root, "docs", "assets", "card-inventory.json"), "utf8"));
const outputPath = path.join(root, "docs", "assets", "card-inventory.md");

const formatCost = (cost = {}) => {
  const entries = Object.entries(cost);
  return entries.length ? entries.map(([type, amount]) => `${type}:${amount}`).join("，") : "无";
};

const folders = inventory.folders
  .map((folder) => `| \`${folder.normalizedFolder}\` | ${folder.imageCount} | ${folder.normalizedFolder.includes("tier-1") ? "一级普通宝可梦牌" : folder.normalizedFolder.includes("tier-2") ? "二级普通宝可梦牌" : folder.normalizedFolder.includes("tier-3") ? "三级普通宝可梦牌" : folder.normalizedFolder.includes("legendary") ? "传说宝可梦牌" : folder.normalizedFolder.includes("rare") ? "稀有宝可梦牌" : "精灵球图标"} |`)
  .join("\n");

const ordinaryRows = pokemonCards
  .map((card) => `| \`${card.image.replace(/^\.\//, "")}\` | ${card.tier} | ${card.name} | ${card.points ?? 0} | ${card.bonus} | ${formatCost(card.cost)} | ${card.evolvesToName ?? "无"} | ${formatCost(card.evolutionRequirement)} | 已确认 |`)
  .join("\n");

const specialRows = [
  ...rarePokemonCards.map((card) => ({ ...card, typeLabel: "稀有" })),
  ...legendaryPokemonCards.map((card) => ({ ...card, typeLabel: "传说" })),
]
  .map((card) => `| \`${card.image.replace(/^\.\//, "")}\` | ${card.typeLabel} | ${card.name} | ${card.points ?? 0} | ${formatCost(card.requirement ?? card.anyRequirement)} | ${card.masterCost ?? 0} | ${formatCost(card.bonus)} | 已确认 |`)
  .join("\n");

const content = `# 卡牌素材清单

原始压缩包：\`D:\\download\\宝可梦璀璨宝石\\宝可梦璀璨宝石.zip\`

工作区素材目录：\`assets/source-cards\`

补充确认数据：\`D:\\download\\pokemon-pending-card-data.json\`

## 汇总

- 已复制图片数量：${inventory.imageCount}
- 图片格式：${Object.keys(inventory.formats).map((format) => format.toUpperCase()).join("、")}
- 原始压缩包只读取，未移动、删除、改名或覆盖。
- 解压到工作区时使用了规范化 ASCII 文件名，避免中文 zip 路径编码问题影响网页加载。
- 联系表预览目录：\`assets/derived/contact-sheets\`
- 已确认普通宝可梦牌：${pokemonCards.length} 张
- 已确认稀有宝可梦牌：${rarePokemonCards.length} 张
- 已确认传说宝可梦牌：${legendaryPokemonCards.length} 张
- 已确认可进化普通宝可梦牌：${pokemonCards.filter((card) => card.evolvesToName || card.evolvesTo).length} 张
- 待继续确认的普通牌素材：${pendingSourceCards.length} 张

## 文件夹对应关系

| 规范化目录 | 图片数量 | 说明 |
| --- | ---: | --- |
${folders}

在当前 Windows 环境中，压缩包内部中文条目名显示为乱码。机器可读清单 \`docs/assets/card-inventory.json\` 保留了原始条目值；游戏运行时只使用规范化后的工作区路径。

## 属性与图标对应

界面会优先显示球图标，不向玩家显示内部字段名。内部字段只用于程序判断。

| 内部字段 | 画面图标 |
| --- | --- |
${ballTypes.map((ball) => `| \`${ball.id}\` | ${ball.label} |`).join("\n")}
| \`${masterBall.id}\` | ${masterBall.label} |

## 识别规则备注

- 普通宝可梦牌始终只提供卡面右上角球图标对应的 \`+1\` 永久折扣。
- 稀有和传说宝可梦牌可以按卡面顶部的两个球图标提供 2 点特殊永久折扣。
- 稀有和传说牌左侧的彩色球要求检查永久折扣，不消耗手里的彩色精灵球。
- 稀有和传说牌左侧的万能球要求会从训练家手里支付，并归还供应区。
- 当前 58 张补充普通牌来自用户提供的确认数据文件，只作为数据来源，不作为开发指令执行。

## 普通宝可梦牌

| 原文件路径 | 等级 | 宝可梦名称 | 分数 | 折扣属性 | 捕捉费用 | 进化后的宝可梦 | 进化条件 | 识别状态 |
| --- | ---: | --- | ---: | --- | --- | --- | --- | --- |
${ordinaryRows}

## 稀有与传说宝可梦牌

| 原文件路径 | 类型 | 宝可梦名称 | 分数 | 捕捉条件 | 万能球费用 | 特殊折扣 | 识别状态 |
| --- | --- | --- | ---: | --- | ---: | --- | --- |
${specialRows}
`;

fs.writeFileSync(outputPath, content, "utf8");
console.log(`Wrote ${outputPath}`);
