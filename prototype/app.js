// PROTOTYPE ONLY — three UI directions for a BGA-like Pokemon Splendor game.

const ballTypes = [
  { id: "fire", name: "火焰球", short: "火", color: "#ef5b5b" },
  { id: "water", name: "水波球", short: "水", color: "#4c8dff" },
  { id: "leaf", name: "森林球", short: "草", color: "#58b878" },
  { id: "light", name: "光辉球", short: "光", color: "#f5d36b" },
  { id: "night", name: "暗影球", short: "暗", color: "#765d9f" },
];

const initialCards = [
  { id: 1, tier: 3, name: "星翼龙", icon: "🐉", bonus: "fire", points: 5, cost: { fire: 4, water: 3, night: 3 } },
  { id: 2, tier: 3, name: "极光鲸", icon: "🐋", bonus: "water", points: 4, cost: { water: 5, leaf: 3, light: 2 } },
  { id: 3, tier: 3, name: "森冠鹿", icon: "🦌", bonus: "leaf", points: 4, cost: { leaf: 5, fire: 3, light: 3 } },
  { id: 4, tier: 3, name: "月影狐", icon: "🦊", bonus: "night", points: 3, cost: { night: 5, water: 3, fire: 3 } },
  { id: 5, tier: 2, name: "熔岩龟", icon: "🐢", bonus: "fire", points: 2, cost: { fire: 2, night: 2, light: 1 } },
  { id: 6, tier: 2, name: "潮音獭", icon: "🦦", bonus: "water", points: 2, cost: { water: 2, leaf: 2, night: 1 } },
  { id: 7, tier: 2, name: "花角羊", icon: "🐏", bonus: "leaf", points: 1, cost: { leaf: 3, light: 2 } },
  { id: 8, tier: 2, name: "夜巡猫", icon: "🐈", bonus: "night", points: 1, cost: { night: 3, fire: 2 } },
  { id: 9, tier: 1, name: "炽尾狐", icon: "🦊", bonus: "fire", points: 0, cost: { water: 1, light: 1 } },
  { id: 10, tier: 1, name: "泡泡獭", icon: "🦦", bonus: "water", points: 0, cost: { fire: 1, leaf: 1 } },
  { id: 11, tier: 1, name: "芽灵鹿", icon: "🦌", bonus: "leaf", points: 0, cost: { water: 1, night: 1 } },
  { id: 12, tier: 1, name: "暮光猫", icon: "🐈", bonus: "night", points: 0, cost: { fire: 1, light: 1 } },
];

const variantNames = {
  A: "BGA 桌面",
  B: "卡牌焦点",
  C: "移动引导",
};

const freshState = () => ({
  turn: 1,
  phase: "choose",
  selectedBalls: [],
  selectedCardId: null,
  bank: { fire: 4, water: 4, leaf: 4, light: 4, night: 4, master: 5 },
  player: {
    name: "你",
    score: 2,
    balls: { fire: 1, water: 1, leaf: 0, light: 1, night: 0, master: 0 },
    bonuses: { fire: 1, water: 0, leaf: 1, light: 0, night: 0 },
    captured: ["电绒鼠", "青藤芽"],
    reserved: [],
  },
  opponents: [
    { name: "小霞", score: 5, balls: 6, captured: 4, status: "等待中" },
    { name: "大木", score: 3, balls: 4, captured: 5, status: "等待中" },
  ],
  cards: structuredClone(initialCards),
  log: ["第 4 回合开始", "轮到你行动", "可拿取精灵球、捕捉或预留宝可梦"],
});

let state = freshState();

function variant() {
  const value = new URLSearchParams(location.search).get("variant")?.toUpperCase();
  return variantNames[value] ? value : "A";
}

function ballName(id) {
  return ballTypes.find((ball) => ball.id === id)?.name ?? "大师球";
}

function ballColor(id) {
  return ballTypes.find((ball) => ball.id === id)?.color ?? "#e7c44d";
}

function remainingCost(card) {
  const result = {};
  for (const [type, amount] of Object.entries(card.cost)) {
    result[type] = Math.max(0, amount - state.player.bonuses[type] - state.player.balls[type]);
  }
  return result;
}

function canCapture(card) {
  const shortage = Object.values(remainingCost(card)).reduce((sum, value) => sum + value, 0);
  return shortage <= state.player.balls.master;
}

function costHtml(card) {
  return Object.entries(card.cost)
    .map(([type, amount]) => `<span class="cost" style="--cost:${ballColor(type)}">${amount}</span>`)
    .join("");
}

function cardHtml(card, large = false) {
  const affordable = canCapture(card);
  return `
    <button class="creature-card ${large ? "large" : ""} ${affordable ? "affordable" : ""}"
      data-action="select-card" data-card-id="${card.id}" aria-label="查看${card.name}">
      <span class="card-tier">${"◆".repeat(card.tier)}</span>
      <span class="card-score">${card.points}</span>
      <span class="creature-icon">${card.icon}</span>
      <strong>${card.name}</strong>
      <span class="card-costs">${costHtml(card)}</span>
      <span class="bonus-dot" style="--bonus:${ballColor(card.bonus)}">+1</span>
      ${affordable ? '<span class="ready-tag">可捕捉</span>' : ""}
    </button>`;
}

function bankHtml(compact = false) {
  return `<div class="ball-bank ${compact ? "compact" : ""}">
    ${ballTypes.map((ball) => {
      const selected = state.selectedBalls.includes(ball.id);
      return `<button class="ball-stack ${selected ? "selected" : ""}" data-action="select-ball" data-ball="${ball.id}"
        style="--ball:${ball.color}" ${state.bank[ball.id] === 0 ? "disabled" : ""}>
        <span class="ball-shape"><i></i></span><strong>${state.bank[ball.id]}</strong><small>${ball.short}</small>
      </button>`;
    }).join("")}
    <div class="ball-stack master" style="--ball:#e7c44d"><span class="ball-shape"><i></i></span><strong>${state.bank.master}</strong><small>万能</small></div>
  </div>`;
}

function marketHtml(large = false) {
  return [3, 2, 1].map((tier) => `
    <section class="market-row">
      <button class="deck" data-action="reserve-deck" data-tier="${tier}" aria-label="预留${tier}级牌堆">
        <span>${"◆".repeat(tier)}</span><strong>牌堆</strong><small>预留顶牌</small>
      </button>
      <div class="cards">${state.cards.filter((card) => card.tier === tier).map((card) => cardHtml(card, large)).join("")}</div>
    </section>`).join("");
}

function opponentsHtml() {
  return state.opponents.map((player, index) => `
    <article class="opponent">
      <span class="avatar">${index ? "🧑‍🔬" : "🧢"}</span>
      <div><strong>${player.name}</strong><small>${player.status}</small></div>
      <span><b>${player.score}</b> 分</span><span>${player.balls} 球</span><span>${player.captured} 只</span>
    </article>`).join("");
}

function playerHtml() {
  return `<section class="player-area">
    <div class="player-title"><span class="avatar">🧑</span><div><strong>你的训练家区域</strong><small>${state.player.score} 分 · 第 ${state.turn} 次行动</small></div></div>
    <div class="inventory">
      ${ballTypes.map((ball) => `<span style="--item:${ball.color}"><i></i>${state.player.balls[ball.id]}</span>`).join("")}
      <span style="--item:#e7c44d"><i></i>${state.player.balls.master}</span>
    </div>
    <div class="collection"><span>永久加成</span>${ballTypes.map((ball) => `<b style="--item:${ball.color}">${state.player.bonuses[ball.id]}</b>`).join("")}</div>
    <div class="collection"><span>已捕捉</span><strong>${state.player.captured.join(" · ") || "暂无"}</strong></div>
    <div class="collection"><span>预留</span><strong>${state.player.reserved.join(" · ") || "暂无"}</strong></div>
  </section>`;
}

function actionBarHtml() {
  const count = state.selectedBalls.length;
  return `<header class="action-bar">
    <div><span class="turn-pulse"></span><strong>你的回合</strong><small>${count ? `已选择 ${count}/3 个精灵球` : "选择一种行动"}</small></div>
    <div class="action-buttons">
      ${count ? `<button class="primary" data-action="confirm-balls">确认拿取</button><button data-action="clear-balls">取消选择</button>` : ""}
      <button data-action="reset">重置原型</button>
    </div>
  </header>`;
}

function logHtml() {
  return `<aside class="game-log"><h3>对局记录</h3>${state.log.slice().reverse().map((entry, i) => `<p class="${i === 0 ? "latest" : ""}">${entry}</p>`).join("")}</aside>`;
}

function inspectorHtml() {
  const card = state.cards.find((item) => item.id === state.selectedCardId);
  if (!card) return `<aside class="inspector empty"><span>👆</span><strong>选择一张宝可梦卡</strong><p>这里会显示捕捉费用、永久加成和可执行操作。</p></aside>`;
  const remaining = remainingCost(card);
  const shortage = Object.entries(remaining).filter(([, amount]) => amount > 0);
  return `<aside class="inspector">
    <button class="close" data-action="close-card" aria-label="关闭">×</button>
    <span class="inspector-icon">${card.icon}</span><small>${card.tier} 级宝可梦</small><h2>${card.name}</h2>
    <p>捕捉后永久获得 <b style="color:${ballColor(card.bonus)}">${ballName(card.bonus)} +1</b>，并获得 ${card.points} 分。</p>
    <div class="detail-cost"><span>所需</span>${costHtml(card)}</div>
    <div class="remaining">${shortage.length ? `仍缺：${shortage.map(([type, amount]) => `${ballName(type)} ${amount}`).join("、")}` : "资源充足，可以捕捉"}</div>
    <button class="primary wide" data-action="capture" data-card-id="${card.id}" ${canCapture(card) ? "" : "disabled"}>捕捉 ${card.name}</button>
    <button class="wide" data-action="reserve" data-card-id="${card.id}">预留并获得万能球</button>
  </aside>`;
}

function debugStateHtml() {
  return `<details class="prototype-state"><summary>查看原型状态</summary><pre>${escapeHtml(JSON.stringify({
    turn: state.turn,
    selectedBalls: state.selectedBalls,
    score: state.player.score,
    balls: state.player.balls,
    bonuses: state.player.bonuses,
    captured: state.player.captured,
    reserved: state.player.reserved,
  }, null, 2))}</pre></details>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]);
}

function variantA() {
  return `<div class="prototype variant-a">
    ${actionBarHtml()}
    <section class="opponents-strip">${opponentsHtml()}</section>
    <div class="table-layout">
      <aside class="supply-panel"><h2>精灵球供应</h2><p>点击三种不同颜色</p>${bankHtml()}</aside>
      <section class="market"><div class="section-heading"><div><span>野外区域</span><h1>宝可梦市场</h1></div><p><i class="green-dot"></i> 绿色边框表示可捕捉</p></div>${marketHtml()}</section>
      ${logHtml()}
    </div>
    ${playerHtml()}
    ${inspectorHtml()}
    ${debugStateHtml()}
  </div>`;
}

function variantB() {
  return `<div class="prototype variant-b">
    <nav class="focus-rail">
      <div class="brand-mark">PS</div><strong>第 4 回合</strong><span class="active-step">1<br><small>选择</small></span><span>2<br><small>确认</small></span><span>3<br><small>结算</small></span>
      <button data-action="reset">↻</button>
    </nav>
    <main class="focus-main">
      <section class="focus-top"><div><small>轮到你了</small><h1>选择下一只伙伴</h1></div>${bankHtml(true)}</section>
      <section class="focus-market">${marketHtml(true)}</section>
      ${playerHtml()}
      ${debugStateHtml()}
    </main>
    <aside class="focus-side">${inspectorHtml()}${logHtml()}</aside>
    ${state.selectedBalls.length ? `<div class="floating-confirm"><span>已选择 ${state.selectedBalls.length}/3</span><button class="primary" data-action="confirm-balls">确认拿取</button><button data-action="clear-balls">取消</button></div>` : ""}
  </div>`;
}

function variantC() {
  return `<div class="prototype variant-c">
    <header class="mobile-head"><div><small>第 4 回合</small><h1>你的回合</h1></div><div class="score-badge"><b>${state.player.score}</b><small>分数</small></div></header>
    <details class="mobile-opponents"><summary>其他训练家 · 2 人等待中</summary>${opponentsHtml()}</details>
    <section class="coach-card"><span>①</span><div><strong>${state.selectedBalls.length ? "继续选择或确认" : "你想做什么？"}</strong><p>${state.selectedBalls.length ? `已选择 ${state.selectedBalls.length}/3 个不同的精灵球` : "点击精灵球，或直接点击一张宝可梦卡。"}</p></div></section>
    <section class="mobile-supply"><h2>精灵球</h2>${bankHtml()}</section>
    ${state.selectedBalls.length ? `<div class="mobile-confirm"><button class="primary" data-action="confirm-balls">确认拿取</button><button data-action="clear-balls">取消</button></div>` : ""}
    <section class="mobile-market"><h2>附近的宝可梦</h2>${marketHtml(true)}</section>
    ${playerHtml()}
    ${logHtml()}
    ${inspectorHtml()}
    ${debugStateHtml()}
    <nav class="mobile-dock"><button class="active">◉<small>对局</small></button><button>▦<small>图鉴</small></button><button>☰<small>记录</small></button><button data-action="reset">↻<small>重置</small></button></nav>
  </div>`;
}

function switcherHtml() {
  const current = variant();
  return `<nav class="prototype-switcher" aria-label="原型布局切换">
    <button data-action="previous-variant" aria-label="上一个布局">←</button>
    <span><small>PROTOTYPE</small><strong>${current} — ${variantNames[current]}</strong></span>
    <button data-action="next-variant" aria-label="下一个布局">→</button>
  </nav>`;
}

function render() {
  const current = variant();
  document.body.dataset.variant = current;
  document.querySelector("#app").innerHTML = (current === "A" ? variantA() : current === "B" ? variantB() : variantC()) + switcherHtml();
}

function cycleVariant(direction) {
  const variants = Object.keys(variantNames);
  const index = variants.indexOf(variant());
  const next = variants[(index + direction + variants.length) % variants.length];
  const url = new URL(location.href);
  url.searchParams.set("variant", next);
  history.replaceState({}, "", url);
  state.selectedCardId = null;
  render();
}

function selectBall(type) {
  if (state.selectedBalls.includes(type)) {
    state.selectedBalls = state.selectedBalls.filter((item) => item !== type);
  } else if (state.selectedBalls.length < 3) {
    state.selectedBalls.push(type);
  } else {
    state.log.push("一次最多选择 3 种不同的精灵球");
  }
  render();
}

function confirmBalls() {
  if (!state.selectedBalls.length) return;
  const names = state.selectedBalls.map(ballName);
  for (const type of state.selectedBalls) {
    state.bank[type] -= 1;
    state.player.balls[type] += 1;
  }
  state.log.push(`你拿取了${names.join("、")}`);
  state.turn += 1;
  state.selectedBalls = [];
  render();
}

function capture(cardId) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card || !canCapture(card)) return;
  let masterNeeded = 0;
  for (const [type, amount] of Object.entries(card.cost)) {
    const due = Math.max(0, amount - state.player.bonuses[type]);
    const paid = Math.min(due, state.player.balls[type]);
    state.player.balls[type] -= paid;
    state.bank[type] += paid;
    masterNeeded += due - paid;
  }
  state.player.balls.master -= masterNeeded;
  state.bank.master += masterNeeded;
  state.player.bonuses[card.bonus] += 1;
  state.player.score += card.points;
  state.player.captured.push(card.name);
  state.cards = state.cards.filter((item) => item.id !== cardId);
  state.log.push(`你捕捉了${card.name}，获得 ${card.points} 分和永久加成`);
  state.turn += 1;
  state.selectedCardId = null;
  render();
}

function reserve(cardId) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;
  if (state.player.reserved.length >= 3) {
    state.log.push("最多只能预留 3 只宝可梦");
    render();
    return;
  }
  state.player.reserved.push(card.name);
  state.cards = state.cards.filter((item) => item.id !== cardId);
  if (state.bank.master > 0) {
    state.bank.master -= 1;
    state.player.balls.master += 1;
  }
  state.log.push(`你预留了${card.name}，获得 1 个万能球`);
  state.turn += 1;
  state.selectedCardId = null;
  render();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "select-ball") selectBall(target.dataset.ball);
  if (action === "confirm-balls") confirmBalls();
  if (action === "clear-balls") { state.selectedBalls = []; render(); }
  if (action === "select-card") { state.selectedCardId = Number(target.dataset.cardId); render(); }
  if (action === "close-card") { state.selectedCardId = null; render(); }
  if (action === "capture") capture(Number(target.dataset.cardId));
  if (action === "reserve") reserve(Number(target.dataset.cardId));
  if (action === "reserve-deck") { state.log.push(`牌堆预留将在规则原型阶段实现（${target.dataset.tier}级）`); render(); }
  if (action === "reset") { state = freshState(); render(); }
  if (action === "previous-variant") cycleVariant(-1);
  if (action === "next-variant") cycleVariant(1);
});

document.addEventListener("keydown", (event) => {
  if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  if (event.key === "ArrowLeft") cycleVariant(-1);
  if (event.key === "ArrowRight") cycleVariant(1);
  if (event.key === "Escape" && state.selectedCardId) { state.selectedCardId = null; render(); }
});

render();
