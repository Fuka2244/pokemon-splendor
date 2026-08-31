import { games } from "./games.js";

const grid = document.querySelector("#game-grid");
const search = document.querySelector("#game-search");
const filters = [...document.querySelectorAll("[data-mode]")];
let selectedMode = "all";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function coverMarkup(game) {
  const cover = element("div", "game-cover");
  if (game.coverImage) {
    const image = element("img", "cover-image");
    image.src = game.coverImage;
    image.alt = "";
    cover.append(image);
  } else if (game.cover === "pokemon") {
    cover.classList.add("cover-pokemon");
    const fan = element("div", "pokemon-fan");
    for (const source of game.images ?? []) {
      const image = element("img", "fan-card");
      image.src = source;
      image.alt = "";
      image.draggable = false;
      fan.append(image);
    }
    cover.append(element("span", "cover-caption", "收集 · 构筑 · 进化"), fan);
  } else if (game.cover === "spell") {
    cover.classList.add("cover-spell");
    const circle = element("div", "spell-circle");
    circle.append(element("span", "spell-star", "✧"));
    const stones = element("div", "spell-stones");
    for (const [number, symbol] of [["III", "☾"], ["VIII", "✳"], ["V", "◇"]]) {
      const stone = element("div", "spell-stone");
      stone.append(element("small", "", number), element("span", "", symbol));
      stones.append(stone);
    }
    cover.append(circle, stones, element("span", "cover-caption", "猜一手，施个法。"));
  } else {
    cover.append(element("span", "generic-cover", "⚄"));
  }
  // The status badge conveys information; only the artwork is decorative.
  for (const child of cover.children) child.setAttribute("aria-hidden", "true");
  return cover;
}

function gameCard(game) {
  const card = element("article", "game-card");
  card.setAttribute("aria-labelledby", `title-${game.id}`);
  const visual = coverMarkup(game);
  const status = element("span", `game-status ${game.mode === "online" ? "status-online" : ""}`, game.status);
  visual.append(status);
  const body = element("div", "game-body");
  const heading = element("div", "game-heading");
  const title = element("h3", "", game.title);
  title.id = `title-${game.id}`;
  heading.append(element("p", "game-subtitle", game.subtitle), title);
  const tags = element("div", "game-tags");
  tags.append(element("span", "players", game.players));
  for (const tag of game.tags ?? []) tags.append(element("span", "", tag));
  const actionRow = element("div", "game-action");
  const localPreview = ["localhost", "127.0.0.1"].includes(location.hostname) && game.localHref;
  const link = element("a", "game-link", `${game.action} ${game.external ? "↗" : "→"}`);
  link.href = localPreview || game.href;
  link.setAttribute("aria-label", `${game.action}：${game.title}${game.external ? "（新标签页）" : ""}`);
  if (game.external) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  actionRow.append(element("p", "game-note", localPreview ? "本地联机预览 · 在新标签页打开" : game.note), link);
  body.append(heading, element("p", "game-description", game.description), tags, actionRow);
  card.append(visual, body);
  return card;
}

function renderGames() {
  const query = search.value.trim().toLocaleLowerCase();
  const visibleGames = games.filter((game) => {
    const matchesMode = selectedMode === "all" || game.mode === selectedMode;
    const text = [game.title, game.subtitle, game.description, ...(game.tags ?? [])].join(" ").toLocaleLowerCase();
    return matchesMode && text.includes(query);
  });
  grid.replaceChildren(...visibleGames.map(gameCard));
  document.querySelector("#game-count").textContent = String(games.length).padStart(2, "0");
  document.querySelector("#result-count").textContent = `共 ${visibleGames.length} 款桌游`;
  document.querySelector("#empty-state").hidden = visibleGames.length !== 0;
  for (const button of filters) button.setAttribute("aria-pressed", String(button.dataset.mode === selectedMode));
}

search.addEventListener("input", renderGames);
for (const button of filters) {
  button.addEventListener("click", () => {
    selectedMode = button.dataset.mode;
    renderGames();
  });
}
document.querySelector("#clear-filters").addEventListener("click", () => {
  selectedMode = "all";
  search.value = "";
  renderGames();
  search.focus();
});
renderGames();
