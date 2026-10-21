import characters from "../data/characters.json";
import initial from "../data/initial.json";
import presentation from "../data/presentation.json";
import schedule from "../data/schedule.json";
import compiled from "../generated/story.json";
import { Player, type View } from "../engine/player";
import { createState } from "../engine/state";
import {
  browserStorage,
  readSave,
  readSettings,
  saveScriptMatches,
  writeSave,
  writeSettings,
  type SaveData,
  type SaveStorage,
  type Settings,
} from "../engine/storage";
import type { GameState, Pos, Story } from "../engine/types";

type Look = { background: string; shift?: { includes: string; background: string } };

const cast = new Map(characters.map((person) => [person.name, person]));
const looks = presentation as Record<string, Look>;
const script = compiled as Story;
const scriptVersion = compiled.version;
const cues: Record<string, string> = {};
for (const [key, look] of Object.entries(looks)) {
  if (look.shift) cues[key] = look.shift.includes;
}

const speeds = [
  ["slow", "慢"],
  ["mid", "中"],
  ["fast", "快"],
  ["instant", "瞬间"],
] as const;

export function mount(root: ParentNode, storage: SaveStorage = browserStorage()): void {
  const stage = el("div", "stage");
  root.append(stage);
  let mode: "title" | "settings" | "saves" | "log" | "play" | "version" = "title";
  let backTo: "title" | "play" = "title";
  let saveMode: "load" | "save" = "load";
  let renderToken = 0;
  let player = Player.start(script, createState(initial.vars), schedule.totalDays, cues);
  let settings: Settings = { speed: "mid", scale: "mid" };
  let auto = false;
  let error = "";
  let banner = "";
  let pending: SaveData | null = null;
  const backlog: { speaker: string | null; text: string }[] = [];
  let seenLine = "";
  let reveal = { full: "", shown: "", done: true, timer: 0 };

  const asset = (rel: string) => `${import.meta.env.BASE_URL}${rel}`;

  function portraitOf(name: string | null, expr: string | null): string | null {
    if (!name) return null;
    const person = cast.get(name);
    if (!person?.id) return null;
    const tag = expr || "normal";
    return asset(`assets/portraits/${person.id}/${person.id}_${tag}.png`);
  }

  function backgroundOf(view: View): string {
    if (view.kind === "line" || view.kind === "choice" || view.kind === "minigame" || view.kind === "input") {
      const look = looks[`${view.sourceDay}:${view.scene}`];
      const id = look && "cueHit" in view && view.cueHit && look.shift ? look.shift.background : look?.background;
      if (id) return asset(`assets/backgrounds/${id}/${id}.png`);
    }
    if (view.kind === "day") {
      const first = script.days.find((day) => day.day === view.day)?.scenes[0];
      const id = first ? looks[`${view.day}:${first.id}`]?.background : "";
      if (id) return asset(`assets/backgrounds/${id}/${id}.png`);
    }
    return asset("assets/backgrounds/bg-chaoxi-dusty-afternoon/bg-chaoxi-dusty-afternoon.png");
  }

  function remember(view: View) {
    if (view.kind !== "line") return;
    const key = `${view.day}:${view.scene}:${view.text}`;
    if (key === seenLine) return;
    seenLine = key;
    backlog.push({ speaker: view.speaker, text: view.text });
    if (backlog.length > 300) backlog.shift();
  }

  async function autosave() {
    if (mode !== "play") return;
    await writeSave(storage, "auto", snapshot());
  }

  function snapshot(): SaveData {
    const view = player.view();
    const day = "day" in view ? view.day : script.days[script.days.length - 1]?.day ?? 1;
    const chapter = "chapter" in view ? view.chapter : "";
    return {
      v: 1,
      scriptVersion,
      savedAt: new Date().toISOString(),
      pos: structuredClone(player.pos) as Pos,
      state: structuredClone(player.state) as GameState,
      summary: { day, name: player.state.playerName, gender: player.state.gender, chapter },
    };
  }

  function render() {
    window.clearInterval(reveal.timer);
    const token = ++renderToken;
    stage.dataset.scale = settings.scale;
    stage.dataset.screen = mode === "play" ? player.view().kind : mode;
    const view = player.view();
    if (mode === "play") remember(view);
    stage.replaceChildren();
    const bg = el("div", "bg");
    const bgView: View = mode === "play" ? view : { kind: "day", day: 1, chapter: "序章", totalDays: schedule.totalDays };
    const image = mode === "play" ? backgroundOf(bgView) : asset("assets/backgrounds/bg-chaoxi-dusty-afternoon/bg-chaoxi-dusty-afternoon.png");
    bg.style.backgroundImage = `url("${image}")`;
    stage.append(bg);
    if (mode === "play") stage.append(playLayer(view));
    if (mode === "title") stage.append(titleCard());
    if (mode === "settings") stage.append(settingsCard());
    if (mode === "saves") {
      void saveCard().then((card) => {
        if (token === renderToken) stage.append(card);
      });
    }
    if (mode === "log") stage.append(logCard());
    if (mode === "version") stage.append(versionCard());
    if (mode === "play" && auto) kickAuto();
  }

  function playLayer(view: View): HTMLElement {
    const layer = el("div");
    const portraitName =
      view.kind === "line" || (view.kind === "choice" && view.id !== schedule.genderChoiceId && !schedule.mapChoiceIds.includes(view.id)) || view.kind === "minigame"
        ? view.portrait
        : null;
    if (portraitName && "expr" in view) {
      const src = portraitOf(portraitName, view.expr);
      if (src) appendPortrait(layer, src);
    }
    layer.append(hud(view));
    if (view.kind === "day") layer.append(dayCard(view));
    else if (view.kind === "end") layer.append(endCard(view));
    else if (view.kind === "line") layer.append(lineCard(view));
    else if (view.kind === "choice" && view.id === schedule.genderChoiceId) layer.append(genderCard(view));
    else if (view.kind === "choice" && schedule.mapChoiceIds.includes(view.id)) layer.append(mapCard(view));
    else if (view.kind === "choice") layer.append(choiceCard(view));
    else if (view.kind === "input") layer.append(nameCard(view));
    else if (view.kind === "minigame") layer.append(minigameCard(view));
    return layer;
  }

  function appendPortrait(layer: HTMLElement, src: string) {
    const img = document.createElement("img");
    img.className = "portrait";
    img.alt = "";
    img.src = src;
    img.addEventListener("error", () => img.remove());
    layer.append(img);
  }

  function hud(view: View): HTMLElement {
    const bar = el("div", "hud");
    const day = "day" in view ? `第 ${view.day} 天 / ${schedule.totalDays}` : "汐湾咖啡馆";
    bar.append(el("div", "", day));
    const actions = el("div", "hud-actions");
    const skip = button("快进", "ghost", () => {
      auto = !auto;
      render();
    });
    skip.setAttribute("aria-pressed", auto ? "true" : "false");
    actions.append(
      skip,
      button("菜单", "ghost", () => {
        auto = false;
        openMenu();
      }),
    );
    bar.append(actions);
    return bar;
  }

  function openMenu() {
    const card = el("div", "overlay");
    const sheet = el("div", "sheet");
    sheet.append(el("h2", "", "菜单"));
    const stack = el("div", "stack");
    stack.append(
      button("继续", "solid", () => {
        card.remove();
        render();
      }),
      button("存档", "solid", () => {
        saveMode = "save";
        backTo = "play";
        mode = "saves";
        render();
      }),
      button("读档", "solid", () => {
        saveMode = "load";
        backTo = "play";
        mode = "saves";
        render();
      }),
      button("回顾", "solid", () => {
        backTo = "play";
        mode = "log";
        render();
      }),
      button("设置", "solid", () => {
        backTo = "play";
        mode = "settings";
        render();
      }),
      button("回到标题", "solid", () => {
        mode = "title";
        render();
      }),
    );
    sheet.append(stack);
    card.append(sheet);
    stage.append(card);
  }

  function dayCard(view: Extract<View, { kind: "day" }>): HTMLElement {
    const card = overlay();
    const box = el("div", "overlay-card");
    box.append(el("h1", "", view.chapter), el("p", "sub", `第 ${view.day} 天 / ${schedule.totalDays}`));
    box.append(button("进入这一天", "solid", () => act(() => player.advance())));
    card.append(box);
    return card;
  }

  function endCard(view: Extract<View, { kind: "end" }>): HTMLElement {
    const card = overlay();
    const box = el("div", "overlay-card");
    box.append(el("h1", "", `${view.chapter}结束`), el("p", "sub", "序章和第一章到这里。店门还开着。"));
    box.append(button("回到标题", "solid", () => {
      mode = "title";
      render();
    }));
    card.append(box);
    return card;
  }

  function lineCard(view: Extract<View, { kind: "line" }>): HTMLElement {
    const panel = el("div", "panel");
    panel.addEventListener("click", () => advanceLine());
    if (view.speaker) panel.append(el("div", "nameplate", view.speaker));
    if (view.fast) panel.append(el("div", "fast-tag", "快进的一天"));
    const text = el("p", view.lineKind === "dialogue" ? "" : view.lineKind);
    panel.append(text, el("div", "hint", "点击继续"));
    startReveal(text, view.text);
    return panel;
  }

  function choiceCard(view: Extract<View, { kind: "choice" }>): HTMLElement {
    const panel = el("div", "panel");
    const stack = el("div", "choices");
    view.options.forEach((option, index) => {
      stack.append(button(option.label, "choice", () => act(() => player.choose(index))));
    });
    panel.append(stack);
    return panel;
  }

  function genderCard(view: Extract<View, { kind: "choice" }>): HTMLElement {
    const card = overlay();
    const box = el("div", "overlay-card");
    box.append(el("h1", "", "你是"), el("p", "sub", "这一选择决定谁能谈恋爱。主线不变。"));
    const stack = el("div", "stack");
    view.options.forEach((option, index) => stack.append(button(option.label, "solid", () => act(() => player.choose(index)))));
    box.append(stack);
    card.append(box);
    return card;
  }

  function nameCard(view: Extract<View, { kind: "input" }>): HTMLElement {
    const card = overlay();
    const box = el("div", "overlay-card");
    box.append(el("h1", "", "你的名字"), el("p", "sub", "这一章还没有人这样叫你。"));
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 8;
    input.placeholder = "最多八个字";
    input.value = player.state.playerName;
    const form = document.createElement("form");
    form.append(input, el("p", "notice", error));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        player.submitName(input.value);
        error = "";
        void autosave().then(render);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : "名字不行";
        render();
      }
    });
    form.append(button("就用这个名字", "solid", () => form.requestSubmit()));
    box.append(form);
    card.append(box);
    window.setTimeout(() => input.focus(), 0);
    return card;
  }

  function mapCard(view: Extract<View, { kind: "choice" }>): HTMLElement {
    const card = overlay();
    const box = el("div", "overlay-card");
    box.append(el("h1", "", "傍晚"), el("p", "sub", "只去一处。"));
    const board = el("div", "map-board");
    view.options.forEach((option, index) => {
      const node = button(option.label.replace(/^走到/, "").replace(/边上|底下|上|前|门口/g, ""), "choice", () => act(() => player.choose(index)));
      node.style.left = spot(option.label).left;
      node.style.top = spot(option.label).top;
      board.append(node);
    });
    box.append(board);
    card.append(box);
    return card;
  }

  function minigameCard(view: Extract<View, { kind: "minigame" }>): HTMLElement {
    const panel = el("div", "panel");
    panel.append(el("div", "nameplate", "小游戏占位"));
    for (const line of view.instructions) panel.append(el("p", "narration", line));
    if (view.notice) panel.append(el("p", "notice", view.notice));
    const stack = el("div", "choices");
    stack.append(button("按普通表现继续", "choice", () => act(() => player.skipMinigame())));
    view.options.forEach((option, index) => {
      if (index === view.normalIndex) return;
      stack.append(button(option.label, "choice", () => act(() => player.choose(index))));
    });
    panel.append(stack);
    return panel;
  }

  function titleCard(): HTMLElement {
    const card = overlay();
    const box = el("div", "overlay-card");
    box.append(el("h1", "", "汐湾咖啡馆"), el("p", "sub", "序章与第一章。这一轮没有声音。"));
    if (banner) box.append(el("p", "notice", banner));
    const stack = el("div", "stack");
    stack.append(
      button("开始游戏", "solid", () => {
        player = Player.start(script, createState(initial.vars), schedule.totalDays, cues);
        backlog.length = 0;
        seenLine = "";
        error = "";
        banner = "";
        pending = null;
        mode = "play";
        render();
      }),
      button("继续", "solid", () => void resume("auto")),
      button("读档", "solid", () => {
        saveMode = "load";
        backTo = "title";
        mode = "saves";
        render();
      }),
      button("设置", "solid", () => {
        backTo = "title";
        mode = "settings";
        render();
      }),
    );
    box.append(stack);
    card.append(box);
    return card;
  }

  function settingsCard(): HTMLElement {
    const card = overlay();
    const box = el("div", "overlay-card");
    box.append(el("h2", "", "设置"), el("p", "sub", "声音这一轮关掉。界面还是占位，等 Alex 的设计。"));
    const speedRow = el("div", "choices");
    for (const [id, label] of speeds) {
      const node = button(`文字${label}`, settings.speed === id ? "solid" : "choice", () => {
        settings.speed = id;
        void writeSettings(storage, settings);
        render();
      });
      speedRow.append(node);
    }
    const scaleRow = el("div", "choices");
    for (const [id, label] of [["small", "小"], ["mid", "中"], ["large", "大"]] as const) {
      scaleRow.append(button(`字号${label}`, settings.scale === id ? "solid" : "choice", () => {
        settings.scale = id;
        void writeSettings(storage, settings);
        render();
      }));
    }
    box.append(speedRow, scaleRow, button("返回", "solid", () => {
      mode = backTo;
      render();
    }));
    card.append(box);
    return card;
  }

  async function saveCard(): Promise<HTMLElement> {
    const card = overlay();
    const box = el("div", "overlay-card");
    box.append(el("h2", "", saveMode === "save" ? "存档" : "读档"));
    const stack = el("div", "stack");
    const slots = ["auto", ...Array.from({ length: schedule.saveSlots }, (_, index) => String(index + 1))];
    for (const slot of slots) {
      const data = await readSave(storage, slot).catch(() => null);
      const label = slot === "auto" ? "自动" : `档位 ${slot}`;
      const mismatch = data ? !saveScriptMatches(data.scriptVersion, scriptVersion) : false;
      const detail = data
        ? `${label} · 第 ${data.summary.day} 天 · ${data.summary.name || "未命名"} · ${data.summary.gender === "女" ? "女主" : data.summary.gender === "男" ? "男主" : "未选"}${mismatch ? " · 剧本版本不同" : ""}`
        : `${label} · 空`;
      stack.append(button(detail, "choice", () => void onSlot(slot, data)));
    }
    stack.append(button("返回", "solid", () => {
      mode = backTo;
      render();
    }));
    box.append(stack);
    card.append(box);
    return card;
  }

  async function onSlot(slot: string, data: SaveData | null) {
    if (saveMode === "save") {
      if (slot === "auto") return;
      await writeSave(storage, slot, snapshot());
      mode = "play";
      render();
      return;
    }
    if (!data) return;
    openLoaded(data);
  }

  async function resume(slot: string) {
    const data = await readSave(storage, slot).catch(() => null);
    if (!data) return;
    openLoaded(data);
  }

  function openLoaded(data: SaveData) {
    if (!saveScriptMatches(data.scriptVersion, scriptVersion)) {
      pending = data;
      mode = "version";
      render();
      return;
    }
    adoptSave(data);
  }

  function adoptSave(data: SaveData) {
    try {
      player = new Player(script, data.state, data.pos, schedule.totalDays, cues);
    } catch {
      pending = null;
      banner = "这份存档和当前剧本对不上，已经回到标题。";
      backlog.length = 0;
      seenLine = "";
      mode = "title";
      render();
      return;
    }
    pending = null;
    banner = "";
    backlog.length = 0;
    seenLine = "";
    mode = "play";
    render();
  }

  function versionCard(): HTMLElement {
    const card = overlay();
    const box = el("div", "overlay-card");
    box.append(
      el("h2", "", "剧本版本不一样"),
      el("p", "sub", "这份存档写下时的剧本和现在不是同一版。可以试着接着读；进度对不上的话，会回到标题。也可以先不读。"),
    );
    const stack = el("div", "stack");
    stack.append(
      button("仍要读取", "solid", () => {
        const data = pending;
        if (!data) {
          mode = "title";
          render();
          return;
        }
        adoptSave(data);
      }),
      button("回到标题", "solid", () => {
        pending = null;
        mode = "title";
        render();
      }),
    );
    box.append(stack);
    card.append(box);
    return card;
  }

  function logCard(): HTMLElement {
    const card = overlay();
    const box = el("div", "overlay-card");
    box.append(el("h2", "", "回顾"));
    const list = el("div", "log");
    if (!backlog.length) list.append(el("p", "", "还没有读过的句子。"));
    for (const line of backlog) {
      const row = el("p");
      if (line.speaker) row.append(el("span", "who", `${line.speaker} `));
      row.append(document.createTextNode(line.text));
      list.append(row);
    }
    box.append(list, button("返回", "solid", () => {
      mode = backTo;
      render();
    }));
    card.append(box);
    return card;
  }

  function startReveal(node: HTMLElement, text: string) {
    const full = [...text];
    const step = settings.speed === "instant" ? full.length : settings.speed === "fast" ? 3 : settings.speed === "slow" ? 1 : 2;
    const delay = settings.speed === "slow" ? 55 : settings.speed === "mid" ? 32 : 16;
    let count = settings.speed === "instant" ? full.length : 0;
    const paint = () => {
      node.textContent = full.slice(0, count).join("");
    };
    paint();
    reveal = { full: text, shown: node.textContent ?? "", done: count >= full.length, timer: 0 };
    if (reveal.done) return;
    reveal.timer = window.setInterval(() => {
      count = Math.min(full.length, count + step);
      paint();
      reveal.shown = node.textContent ?? "";
      reveal.done = count >= full.length;
      if (reveal.done) window.clearInterval(reveal.timer);
    }, delay);
  }

  function advanceLine() {
    if (!reveal.done) {
      reveal.done = true;
      window.clearInterval(reveal.timer);
      const node = stage.querySelector(".panel p");
      if (node) node.textContent = reveal.full;
      return;
    }
    act(() => player.advance());
  }

  function kickAuto() {
    window.setTimeout(() => {
      if (!auto || mode !== "play") return;
      const view = player.view();
      if (view.kind === "line" && !reveal.done) {
        reveal.done = true;
        window.clearInterval(reveal.timer);
        const node = stage.querySelector(".panel p");
        if (node) node.textContent = reveal.full;
      }
      const next = player.view();
      if (next.kind === "line" || next.kind === "day") act(() => player.advance());
    }, 30);
  }

  function act(run: () => void) {
    auto = mode === "play" ? auto : false;
    run();
    void autosave();
    render();
  }

  window.addEventListener("keydown", (event) => {
    if (mode !== "play") return;
    if (event.key === "Escape") {
      auto = false;
      openMenu();
      return;
    }
    const view = player.view();
    if ((event.key === " " || event.key === "Enter") && view.kind === "line") {
      event.preventDefault();
      advanceLine();
    }
    if (/^[1-9]$/.test(event.key) && (view.kind === "choice" || view.kind === "minigame")) {
      const index = Number(event.key) - 1;
      if (view.kind === "minigame" && index === 0) act(() => player.skipMinigame());
      else if (view.kind === "choice" && view.options[index]) act(() => player.choose(index));
    }
  });

  void readSettings(storage).then((loaded) => {
    settings = loaded;
    render();
  });
}

function overlay(): HTMLElement {
  return el("div", "overlay");
}

function spot(label: string): { left: string; top: string } {
  if (label.includes("灯塔")) return { left: "38%", top: "12%" };
  if (label.includes("码头")) return { left: "8%", top: "42%" };
  if (label.includes("礁石")) return { left: "62%", top: "38%" };
  if (label.includes("卫生所")) return { left: "18%", top: "68%" };
  if (label.includes("邮局")) return { left: "58%", top: "70%" };
  return { left: "40%", top: "46%" };
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = label;
  node.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return node;
}

function el(tag: string, className = "", text = ""): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
