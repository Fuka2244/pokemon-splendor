import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as engine from "../src/game-engine.js";
import * as cards from "../src/data/card-manifest.js";
import * as rooms from "../src/room-view.js";

// Exercise the existing render functions and delegated actions with real game data.
// The minimal document only supplies the render target; layout is checked in-browser.
const source = readFileSync(new URL("../src/main.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?from\s+"[^"]+";\s*/gm, "");

function createUI() {
  const app = { innerHTML: "" };
  const handlers = {};
  const context = vm.createContext({
    ...engine, ...cards, ...rooms,
    document: {
      activeElement: null,
      querySelector: (selector) => selector === "#app" ? app : null,
      querySelectorAll: () => [],
      addEventListener: (name, handler) => { handlers[name] = handler; },
    },
  });
  vm.runInContext(source, context);
  return {
    run: (code) => vm.runInContext(code, context),
    html: () => app.innerHTML,
    click: (action, data = {}) => handlers.click({ target: { closest: () => ({ dataset: { action, ...data } }) } }),
  };
}

test("the four columns contain legendary first, three aligned deck rows and local ball actions", () => {
  const ui = createUI();
  const html = ui.html();
  const columns = ['class="rare-area', 'class="wild', 'class="supply panel', 'class="opponent-rail'];
  const positions = columns.map((value) => html.indexOf(value));
  assert.ok(positions.every((value, index) => value >= 0 && (index === 0 || value > positions[index - 1])));
  assert.ok(html.indexOf('<h3>传说</h3>') < html.indexOf('<h3>稀有</h3>'));
  const rows = [...html.matchAll(/<section class="market-row"[\s\S]*?<\/section>/g)];
  assert.equal(rows.length, 3);
  for (const [index, [row]] of rows.entries()) {
    assert.equal((row.match(/data-action="deck"/g) ?? []).length, 1);
    assert.equal((row.match(/data-action="card"/g) ?? []).length, 4);
    assert.ok(row.includes(`data-tier="${3 - index}"`));
  }
  ui.click("ball", { type: "red" });
  const top = ui.html().split('</header>')[0];
  const supply = ui.html().split('<aside class="supply panel">')[1].split('</aside>')[0];
  assert.ok(!top.includes('data-action="confirm-balls"'));
  assert.ok(supply.includes('已选择 1 / 3'));
  assert.ok(supply.includes('data-action="confirm-balls" disabled'));
});

for (const count of [0, 1, 2, 3]) {
  test(`reserved area renders ${count} full card faces and ${3 - count} inert empty slots`, () => {
    const ui = createUI();
    ui.run(`game.trainers[0].reserved = game.decks[1].splice(0, ${count}); render();`);
    const before = ui.run("JSON.stringify(game)");
    const player = ui.run("trainerMarkup()");
    assert.equal((player.match(/class="pokemon-card reserved-card/g) ?? []).length, count);
    assert.equal((player.match(/class="reserved-slot"/g) ?? []).length, 3 - count);
    assert.equal((player.match(/class="pokemon-image"/g) ?? []).length, count);
    assert.ok(player.includes(`${count} / 3`));
    assert.ok(!player.includes("已捕捉宝可梦"));
    assert.equal(ui.run("JSON.stringify(game)"), before);
    if (count) {
      const id = ui.run("game.trainers[0].reserved[0].id");
      ui.click("card", { id });
      assert.ok(ui.html().includes("从预留区捕捉"));
      ui.click("switch-view", { index: "1" });
      assert.ok(!ui.html().includes(id));
    }
  });
}

test("reserved cards retain long names and use the same capture action", () => {
  const ui = createUI();
  ui.run('game.trainers[0].reserved = game.decks[1].splice(0, 1); game.trainers[0].reserved[0].name = "超长宝可梦名称".repeat(20); for (const type of ballTypes) game.trainers[0].balls[type.id] = 9; render();');
  const id = ui.run("game.trainers[0].reserved[0].id");
  ui.click("card", { id });
  assert.ok(ui.html().includes("超长宝可梦名称".repeat(20)));
  assert.ok(ui.html().includes("reserved-card available selected"));
  ui.click("capture", { id });
  assert.equal(ui.run("game.trainers[0].reserved.length"), 0);
  assert.equal(ui.run("game.trainers[0].captured[0].id"), id);
});

test("removing the captured panel preserves every evolution route and its existing action", () => {
  const ui = createUI();
  ui.run('game.trainers[0].captured = game.market.filter(card => ["t1-geodude-001", "t1-charmander-002"].includes(card.id)); game.market = game.market.filter(card => !game.trainers[0].captured.includes(card)); for (const type of ballTypes) game.trainers[0].bonuses[type.id] = 3; game.phase = "evolution"; selectedCardId = listEvolutionOptions(game)[0].cardId; render();');
  const options = ui.run("listEvolutionOptions(game)");
  assert.equal(options.length, 2);
  assert.equal((ui.html().match(/data-action="owned-card"/g) ?? []).length, 2);
  ui.click("owned-card", { id: options[1].cardId });
  assert.ok(ui.html().includes(`确认进化为 ${options[1].toName}`));
  ui.click("evolve", { cardId: options[1].cardId });
  assert.equal(ui.run("game.trainers[0].evolutionHistory.length"), 1);
  assert.equal(ui.run("game.trainers[0].captured.length"), 2);
});
