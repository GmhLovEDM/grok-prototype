import characters from "../data/characters.json";
import initial from "../data/initial.json";
import presentation from "../data/presentation.json";
import schedule from "../data/schedule.json";
import compiled from "../generated/story.json";
import { Player, SAVE_REJECTED, tryRestore, type View } from "../engine/player";
import { createState } from "../engine/state";
import {
  browserStorage,
  defaultComfort,
  readComfort,
  readSave,
  readSettings,
  saveScriptMatches,
  writePreferences,
  writeSave,
  type Comfort,
  type SaveData,
  type SaveStorage,
  type Settings,
  type TextSpeed,
} from "../engine/storage";
import type { GameState, Pos, Story } from "../engine/types";

type Look = { background: string; place: string | null; shift?: { includes: string; background: string } };
type Mode = "title" | "settings" | "saves" | "log" | "play" | "version" | "menu";
type Back = "title" | "menu" | "play";

const cast = new Map(characters.map((person) => [person.name, person]));
const looks = presentation as Record<string, Look>;
const script = compiled as Story;
const scriptVersion = compiled.version;
const cues: Record<string, string> = {};
for (const [key, look] of Object.entries(looks)) {
  if (look.shift) cues[key] = look.shift.includes;
}

const autoStops = [
  { ms: 2800, label: "慢" },
  { ms: 2200, label: "稍慢" },
  { ms: 1600, label: "中" },
  { ms: 800, label: "快" },
] as const;

export function mount(root: ParentNode, storage: SaveStorage = browserStorage()): void {
  const stage = el("div", "stage");
  root.append(stage);
  let mode: Mode = "title";
  let backTo: Back = "title";
  let logBack: "play" | "menu" = "play";
  let saveMode: "load" | "save" = "load";
  let renderToken = 0;
  let player = Player.start(script, createState(initial.vars), schedule.totalDays, cues);
  let settings: Settings = { speed: "mid", scale: "mid" };
  let comfort: Comfort = defaultComfort();
  let auto = false;
  let skipping = false;
  let played = false;
  let error = "";
  let banner = "";
  let pending: SaveData | null = null;
  let continueReady = false;
  let confirmLeave = false;
  let overwrite: { slot: string; data: SaveData } | null = null;
  const backlog: { who: string; text: string }[] = [];
  let seenLine = "";
  let revealTimer = 0;
  let paceTimer = 0;
  let revealState = { key: "", count: 0, done: true };

  const asset = (rel: string) => `${import.meta.env.BASE_URL}${rel}`;

  function clearTimers() {
    window.clearInterval(revealTimer);
    window.clearTimeout(paceTimer);
  }

  function resetTranscript() {
    backlog.length = 0;
    seenLine = "";
    revealState = { key: "", count: 0, done: true };
  }

  function portraitOf(view: View): { src: string; cat: boolean } | null {
    if (view.kind !== "line" && view.kind !== "choice" && view.kind !== "minigame") return null;
    if (!view.portrait) return null;
    const person = cast.get(view.portrait);
    if (!person?.id) return null;
    const tag = view.expr || "normal";
    return { src: asset(`assets/portraits/${person.id}/${person.id}_${tag}.png`), cat: person.id === "na-tie" };
  }

  function placeText(place: string | null | undefined): string {
    return typeof place === "string" ? place.trim() : "";
  }

  function placeName(view: View): string {
    if (!("scene" in view)) return "";
    return placeText(looks[`${view.sourceDay}:${view.scene}`]?.place);
  }

  function shownPlace(saved: string | undefined): string {
    const raw = saved?.trim() ?? "";
    if (!raw) return "";
    const hits = Object.entries(looks).filter(([key]) => key.endsWith(`:${raw}`));
    if (!hits.length) return raw;
    const names = hits.map(([, look]) => placeText(look.place));
    if (names.every((name) => name === names[0])) return names[0];
    return raw;
  }

  function lookId(view: View): string {
    if (view.kind === "line" || view.kind === "choice" || view.kind === "minigame" || view.kind === "input") {
      const look = looks[`${view.sourceDay}:${view.scene}`];
      const cueHit = view.kind === "line" || view.kind === "choice" ? view.cueHit : false;
      const id = look && cueHit && look.shift ? look.shift.background : look?.background;
      if (id) return id;
    }
    if (view.kind === "day") {
      const first = script.days.find((day) => day.day === view.day)?.scenes[0];
      const id = first ? looks[`${view.day}:${first.id}`]?.background : "";
      if (id) return id;
    }
    return "bg-chaoxi-dusty-afternoon";
  }

  function backgroundOf(view: View): string {
    const id = lookId(view);
    return asset(`assets/backgrounds/${id}/${id}.png`);
  }

  function shellBackground(): string {
    if (mode === "title" || mode === "version") return asset("assets/backgrounds/bg-old-street-day/bg-old-street-day.png");
    if (mode === "settings" || mode === "saves") return asset("assets/backgrounds/bg-chaoxi-day/bg-chaoxi-day.png");
    return "";
  }

  function remember(view: View) {
    if (view.kind !== "line" || mode !== "play") return;
    const cursor = player.pos.jump ?? player.pos;
    const key = `${view.day}:${view.scene}:${cursor.blockIndex}:${cursor.lineIndex}:${view.text}`;
    if (key === seenLine) return;
    seenLine = key;
    const who = view.speaker ?? (view.lineKind === "letter" ? "信" : "旁白");
    backlog.push({ who, text: view.text });
    if (backlog.length > 300) backlog.shift();
  }

  function lineKey(view: Extract<View, { kind: "line" }>): string {
    const cursor = player.pos.jump ?? player.pos;
    return `${view.day}|${view.scene}|${cursor.blockIndex}|${cursor.lineIndex}|${view.text}`;
  }

  let persistQueue: Promise<void> = Promise.resolve();
  function persist() {
    persistQueue = persistQueue.then(() => writePreferences(storage, settings, comfort));
  }

  async function autosave() {
    if (!played) return;
    if (mode === "title" || mode === "version") return;
    try {
      player.view();
      await writeSave(storage, "auto", snapshot());
      continueReady = true;
    } catch {
      // 位置已经坏了就不要覆盖自动档。
    }
  }

  function snapshot(): SaveData {
    const view = player.view();
    const day = "day" in view ? view.day : script.days[script.days.length - 1]?.day ?? 1;
    const chapter = "chapter" in view ? view.chapter : "";
    const place = placeName(view);
    return {
      v: 1,
      scriptVersion,
      savedAt: new Date().toISOString(),
      pos: structuredClone(player.pos) as Pos,
      state: structuredClone(player.state) as GameState,
      summary: { day, name: player.state.playerName, gender: player.state.gender, chapter, place, background: lookId(view) },
    };
  }

  function pageClass(view: View | null): string {
    if (mode === "title" || mode === "version") return "page-title";
    if (mode === "settings") return "page-settings";
    if (mode === "saves") return "page-save";
    if (mode === "menu" || mode === "log") return "page-quick";
    if (!view) return "page-title";
    if (view.kind === "line" && view.lineKind !== "dialogue") return "page-narration";
    if (view.kind === "line") return "page-dialogue";
    if (view.kind === "choice" && view.id !== schedule.genderChoiceId && !schedule.mapChoiceIds.includes(view.id)) return "page-choices";
    if (view.kind === "minigame") return "page-choices";
    return "page-dialogue";
  }

  function render() {
    clearTimers();
    const token = ++renderToken;
    const playing = mode === "play" || mode === "menu" || mode === "log";
    let view: View | null = null;
    if (playing) {
      try {
        view = player.view();
      } catch {
        banner = SAVE_REJECTED;
        mode = "title";
        auto = false;
        skipping = false;
        view = null;
      }
    }
    stage.className = `stage ${pageClass(playing ? view : null)}`;
    stage.replaceChildren();
    const bg = el("div", "bg");
    const painted = playing && view ? backgroundOf(view) : shellBackground();
    if (painted) bg.style.backgroundImage = `url("${painted}")`;
    stage.append(bg);
    if (playing && view && mode !== "title") {
      if (mode === "play") remember(view);
      appendPlay(view);
    }
    if (mode === "menu") stage.append(menuOverlay());
    if (mode === "log") stage.append(logOverlay());
    if (mode === "title") stage.append(titleCard());
    if (mode === "settings") stage.append(settingsPanel());
    if (mode === "saves") void paintSaves(token);
    if (mode === "version") stage.append(versionModal());
    if (confirmLeave) stage.append(leaveModal());
    if (mode === "play" && view) schedulePace(view);
  }

  function appendPlay(view: View) {
    if (showPortrait(view)) {
      const found = portraitOf(view);
      if (found) {
        const img = document.createElement("img");
        img.className = found.cat ? "cat" : "portrait";
        img.alt = "";
        img.src = found.src;
        img.addEventListener("error", () => img.remove());
        stage.append(img);
      }
    }
    stage.append(hud(view));
    if (view.kind === "day") stage.append(dayModal(view));
    else if (view.kind === "end") stage.append(endModal(view));
    else if (view.kind === "line") stage.append(lineCard(view));
    else if (view.kind === "choice" && view.id === schedule.genderChoiceId) stage.append(genderModal(view));
    else if (view.kind === "choice" && schedule.mapChoiceIds.includes(view.id)) stage.append(mapPanel(view));
    else if (view.kind === "choice") stage.append(choiceList(view));
    else if (view.kind === "input") stage.append(nameModal());
    else if (view.kind === "minigame") stage.append(minigameModal(view));
  }

  function showPortrait(view: View): boolean {
    if (view.kind === "line" || view.kind === "minigame") return true;
    if (view.kind === "choice" && view.id !== schedule.genderChoiceId && !schedule.mapChoiceIds.includes(view.id)) return true;
    return false;
  }

  function hud(view: View): HTMLElement {
    const bar = el("header", "hud");
    const inner = el("div", "hud-inner");
    const day = "day" in view ? view.day : 1;
    const chapter = "chapter" in view ? view.chapter : "";
    const place = placeName(view);
    const capsule = el("p", "hud-day");
    capsule.append(el("b", "", `第 ${day} 天`));
    capsule.append(el("span", "hud-total", `/ ${schedule.totalDays}`));
    if (chapter) capsule.append(el("span", "hud-chapter", chapter));
    if (place) capsule.append(el("span", "hud-place", place));
    const actions = el("nav", "hud-actions");
    actions.setAttribute("aria-label", "顶部菜单");
    actions.append(
      hudButton("自动", auto, () => {
        auto = !auto;
        if (auto) skipping = false;
        render();
      }),
      hudButton("快进", skipping, () => {
        skipping = !skipping;
        if (skipping) auto = false;
        render();
      }),
      hudButton("日志", false, () => {
        logBack = mode === "menu" ? "menu" : "play";
        mode = "log";
        render();
      }),
      hudButton("菜单", false, () => {
        if (mode === "menu") {
          mode = "play";
          confirmLeave = false;
        } else {
          mode = "menu";
          void autosave();
        }
        render();
      }, mode === "menu"),
    );
    inner.append(capsule, actions);
    bar.append(inner);
    return bar;
  }

  function lineCard(view: Extract<View, { kind: "line" }>): HTMLElement {
    const panel = el("section", view.lineKind === "dialogue" ? "dialogue" : "dialogue is-narration");
    panel.setAttribute("aria-label", view.lineKind === "dialogue" ? "对白" : "旁白");
    if (view.speaker) {
      const plate = el("h2", "nameplate", view.speaker);
      panel.append(plate);
    }
    if (view.fast) panel.append(el("p", "fast-tag", "快进的一天"));
    const text = el("p", view.lineKind === "narration" ? "line is-narration" : view.lineKind === "letter" ? "line is-letter" : "line");
    panel.append(text);
    panel.addEventListener("click", () => {
      if (mode !== "play") return;
      advanceLine();
    });
    startReveal(panel, text, view);
    return panel;
  }

  function startReveal(panel: HTMLElement, node: HTMLElement, view: Extract<View, { kind: "line" }>) {
    const key = lineKey(view);
    const chars = [...view.text];
    if (revealState.key !== key) revealState = { key, count: 0, done: false };
    const instant = mode === "play" && (reducedMotion() || settings.speed === "instant" || skipping);
    if (instant) revealState.count = chars.length;
    node.textContent = chars.slice(0, revealState.count).join("");
    revealState.done = revealState.count >= chars.length;
    if (revealState.done) panel.append(continueEl());
    if (mode !== "play" || revealState.done) return;
    const delay = settings.speed === "slow" ? 80 : settings.speed === "fast" ? 16 : 48;
    revealTimer = window.setInterval(() => {
      if (!node.isConnected) {
        window.clearInterval(revealTimer);
        return;
      }
      revealState.count += 1;
      node.textContent = chars.slice(0, revealState.count).join("");
      if (revealState.count >= chars.length) {
        revealState.done = true;
        window.clearInterval(revealTimer);
        panel.append(continueEl());
        schedulePace(player.view());
      }
    }, delay);
  }

  function finishTyping() {
    const view = player.view();
    if (view.kind !== "line") return;
    window.clearInterval(revealTimer);
    revealState = { key: lineKey(view), count: [...view.text].length, done: true };
    const node = stage.querySelector(".dialogue .line");
    if (node) node.textContent = view.text;
    if (!stage.querySelector(".dialogue .continue")) stage.querySelector(".dialogue")?.append(continueEl());
    schedulePace(view);
  }

  function advanceLine() {
    if (skipping) {
      skipping = false;
      const view = player.view();
      if (view.kind === "line") revealState = { key: lineKey(view), count: [...view.text].length, done: true };
      render();
      return;
    }
    if (!revealState.done) {
      finishTyping();
      return;
    }
    act(() => player.advance());
  }

  function schedulePace(view: View) {
    window.clearTimeout(paceTimer);
    if (mode !== "play") return;
    if (view.kind !== "line" && view.kind !== "day") return;
    if (view.kind === "line" && !revealState.done) return;
    if (!auto && !skipping) return;
    const wait = skipping ? 80 : comfort.autoMs;
    paceTimer = window.setTimeout(() => {
      if (mode !== "play" || (!auto && !skipping)) return;
      const current = player.view();
      if (current.kind !== "line" && current.kind !== "day") return;
      if (current.kind === "line" && !revealState.done) return;
      act(() => player.advance());
    }, wait);
  }

  function choiceList(view: Extract<View, { kind: "choice" }>): HTMLElement {
    const list = el("div", "choice-list");
    list.setAttribute("aria-label", "选项");
    view.options.forEach((option, index) => {
      const node = button(option.label, "choice", () => pick(index));
      const label = el("span", "", option.label);
      node.textContent = "";
      node.append(label);
      list.append(node);
    });
    return list;
  }

  function dayModal(view: Extract<View, { kind: "day" }>): HTMLElement {
    const box = modal(`第 ${view.day} 天`);
    box.append(el("h3", "", view.chapter), el("p", "", `第 ${view.day} 天 / ${schedule.totalDays}`));
    const actions = el("div", "modal-actions");
    actions.append(button("进入这一天", "btn btn-primary", () => act(() => player.advance())));
    box.append(actions);
    return overlay(box);
  }

  function endModal(view: Extract<View, { kind: "end" }>): HTMLElement {
    const box = modal("这一章结束");
    box.append(el("h3", "", `${view.chapter}结束`), el("p", "", "序章和第一章到这里。店门还开着。"));
    const actions = el("div", "modal-actions");
    actions.append(button("回到标题", "btn btn-primary", () => {
      auto = false;
      skipping = false;
      mode = "title";
      render();
    }));
    box.append(actions);
    return overlay(box);
  }

  function genderModal(view: Extract<View, { kind: "choice" }>): HTMLElement {
    const box = modal("你是");
    box.append(el("h3", "", "你是"), el("p", "fine", "这一选择决定谁能谈恋爱。主线不变。"));
    const list = el("div", "menu-list");
    view.options.forEach((option, index) => list.append(button(option.label, "btn btn-primary", () => pick(index))));
    box.append(list);
    return overlay(box);
  }

  function nameModal(): HTMLElement {
    const box = modal("你的名字");
    box.append(el("h3", "", "你的名字"), el("p", "fine", "最多八个字。这一章还没有人这样叫你。"));
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 8;
    input.placeholder = "你的名字";
    input.value = player.state.playerName;
    const form = document.createElement("form");
    form.append(input);
    if (error) form.append(el("p", "form-error", error));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        player.submitName(input.value);
        error = "";
        act(() => undefined);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : "名字不行";
        render();
      }
    });
    const actions = el("div", "modal-actions");
    actions.append(button("就用这个名字", "btn btn-primary", () => form.requestSubmit()));
    form.append(actions);
    box.append(form);
    window.setTimeout(() => input.focus(), 0);
    return overlay(box);
  }

  function mapPanel(view: Extract<View, { kind: "choice" }>): HTMLElement {
    const panel = el("section", "panel map-panel");
    panel.setAttribute("aria-label", "傍晚");
    const head = el("header", "panel-head");
    head.append(el("h2", "", "傍晚"));
    panel.append(head, el("p", "fine", "只去一处。"));
    const board = el("div", "map-board");
    view.options.forEach((option, index) => {
      const node = button(option.label.replace(/^走到/, "").replace(/边上|底下|上|前|门口/g, ""), "choice", () => pick(index));
      const spot = mapSpot(option.label);
      node.style.left = spot.left;
      node.style.top = spot.top;
      board.append(node);
    });
    panel.append(board);
    return panel;
  }

  function minigameModal(view: Extract<View, { kind: "minigame" }>): HTMLElement {
    const box = modal("小游戏");
    box.append(el("h3", "", "小游戏占位"));
    for (const line of view.instructions) box.append(el("p", "", line));
    if (view.notice) box.append(el("p", "form-error", view.notice));
    const list = el("div", "menu-list");
    for (const item of minigameActions(view)) list.append(button(item.label, "btn", item.run));
    box.append(list);
    return overlay(box);
  }

  function minigameActions(view: Extract<View, { kind: "minigame" }>): { label: string; run: () => void }[] {
    const items = [{ label: "按普通表现继续", run: () => { auto = false; skipping = false; act(() => player.skipMinigame()); } }];
    view.options.forEach((option, index) => {
      if (index === view.normalIndex) return;
      items.push({ label: option.label, run: () => pick(index) });
    });
    return items;
  }

  function titleCard(): HTMLElement {
    const card = el("section", "title-card");
    card.append(el("p", "kicker", "老街十七号"), el("h1", "", "汐湾咖啡馆"), el("p", "subtitle", "一个夏天"));
    if (banner) card.append(el("p", "banner", banner));
    const list = el("div", "menu-list");
    list.append(
      button("开始游戏", "btn btn-primary", () => {
        player = Player.start(script, createState(initial.vars), schedule.totalDays, cues);
        resetTranscript();
        error = "";
        banner = "";
        pending = null;
        auto = false;
        skipping = false;
        played = true;
        confirmLeave = false;
        overwrite = null;
        mode = "play";
        void autosave();
        render();
      }),
      button("继续", "btn", () => void resume("auto"), !continueReady),
      button("读取存档", "btn", () => {
        saveMode = "load";
        backTo = "title";
        overwrite = null;
        mode = "saves";
        render();
      }),
      button("设置", "btn", () => {
        backTo = "title";
        mode = "settings";
        render();
      }),
    );
    const gallery = document.createElement("button");
    gallery.type = "button";
    gallery.className = "btn is-disabled";
    gallery.disabled = true;
    gallery.setAttribute("aria-disabled", "true");
    gallery.append(document.createTextNode("图鉴"), el("span", "lock", "锁定"));
    list.append(gallery);
    card.append(list, el("p", "fine", "外婆的店，叫「潮汐」"));
    return card;
  }

  function settingsPanel(): HTMLElement {
    const panel = el("section", "panel settings-panel");
    panel.setAttribute("aria-label", "设置");
    panel.append(panelHead("设置", () => {
      mode = backTo;
      render();
    }));
    const form = document.createElement("form");
    form.className = "settings-form";
    form.addEventListener("submit", (event) => event.preventDefault());
    const text = textStop(settings.speed);
    form.append(sliderRow("文字速度", 0, 2, text.index, text.label, (value) => {
      settings.speed = value === 0 ? "slow" : value === 2 ? "fast" : "mid";
      void persist();
      return value === 0 ? "慢" : value === 2 ? "快" : "中";
    }));
    const pace = autoStops.findIndex((item) => item.ms === comfort.autoMs);
    const paceIndex = pace < 0 ? 2 : pace;
    form.append(sliderRow("自动速度", 0, 3, paceIndex, autoStops[paceIndex].label, (value) => {
      const stop = autoStops[value] ?? autoStops[2];
      comfort.autoMs = stop.ms;
      void persist();
      return stop.label;
    }));
    form.append(sliderRow("音乐", 0, 100, comfort.music, String(comfort.music), (value) => {
      comfort.music = value;
      void persist();
      return String(value);
    }));
    form.append(sliderRow("音效", 0, 100, comfort.sfx, String(comfort.sfx), (value) => {
      comfort.sfx = value;
      void persist();
      return String(value);
    }));
    const screenRow = el("div", "set-row");
    screenRow.append(el("span", "", "全屏"));
    const holder = el("span");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = comfort.fullscreen ? "switch is-on" : "switch";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", comfort.fullscreen ? "true" : "false");
    toggle.append(el("span", "switch-knob"), el("span", "", comfort.fullscreen ? "开" : "关"));
    toggle.addEventListener("click", () => void toggleFullscreen());
    holder.append(toggle);
    screenRow.append(holder);
    const langRow = el("label", "set-row");
    langRow.append(el("span", "", "语言"));
    const select = document.createElement("select");
    select.className = "lang";
    select.setAttribute("aria-label", "语言");
    const option = document.createElement("option");
    option.textContent = "简体中文";
    select.append(option);
    langRow.append(select);
    form.append(screenRow, langRow);
    panel.append(form, el("p", "fine", "这一版界面只有简体中文。文字速度和自动速度的毫秒数见设计说明，玩家只看见慢和快。"));
    return panel;
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        comfort.fullscreen = false;
      } else {
        await document.documentElement.requestFullscreen();
        comfort.fullscreen = true;
      }
    } catch {
      comfort.fullscreen = false;
    }
    await persist();
    if (mode === "settings") render();
  }

  async function paintSaves(token: number) {
    const ids = ["auto", ...Array.from({ length: schedule.saveSlots }, (_, index) => String(index + 1))];
    const rows: { slot: string; data: SaveData | null }[] = [];
    for (const slot of ids) {
      const data = await readSave(storage, slot).catch(() => null);
      rows.push({ slot, data });
    }
    if (token !== renderToken || mode !== "saves") return;
    stage.append(savePanel(rows));
    if (overwrite) stage.append(overwriteModal(overwrite.data));
  }

  function savePanel(rows: { slot: string; data: SaveData | null }[]): HTMLElement {
    const panel = el("section", "panel save-panel");
    panel.setAttribute("aria-label", saveMode === "save" ? "存档" : "读档");
    const head = panelHead(saveMode === "save" ? "存档" : "读档", () => {
      overwrite = null;
      mode = backTo;
      render();
    });
    const seg = el("div", "seg");
    seg.setAttribute("role", "tablist");
    seg.setAttribute("aria-label", "存档或读档");
    seg.append(segButton("存档", saveMode === "save"), segButton("读档", saveMode === "load"));
    head.append(seg);
    panel.append(head, el("p", "fine save-note", "自动存档自己写，点它不能覆盖。"));
    const autoRow = rows[0];
    if (autoRow) panel.append(slotButton(autoRow.slot, autoRow.data, true));
    const grid = el("div", "slot-grid");
    for (const row of rows.slice(1)) grid.append(slotButton(row.slot, row.data, false));
    panel.append(grid);
    return panel;
  }

  function segButton(label: string, on: boolean): HTMLButtonElement {
    const node = button(label, on ? "is-on" : "", () => {
      saveMode = label === "存档" ? "save" : "load";
      overwrite = null;
      render();
    });
    node.setAttribute("role", "tab");
    node.setAttribute("aria-selected", on ? "true" : "false");
    return node;
  }

  function slotButton(slot: string, data: SaveData | null, automatic: boolean): HTMLButtonElement {
    const empty = !data;
    const locked = saveMode === "save" && automatic;
    const disabled = locked || (saveMode === "load" && empty);
    const node = document.createElement("button");
    node.type = "button";
    node.className = `slot${automatic ? " slot-auto" : ""}${empty ? " is-empty" : ""}${overwrite?.slot === slot ? " is-target" : ""}`;
    node.disabled = disabled;
    const thumb = el("span", empty ? "thumb thumb-empty" : "thumb");
    if (data?.summary.background) {
      const id = data.summary.background;
      thumb.style.backgroundImage = `url("${asset(`assets/backgrounds/${id}/${id}.png`)}")`;
    }
    const copy = el("span", "slot-copy");
    const title = el("b");
    if (!data) title.textContent = automatic ? "自动" : `栏位 ${slot}`;
    else if (automatic) {
      title.append(document.createTextNode(`第 ${data.summary.day} 天`), el("em", "badge", "自动"));
    } else title.textContent = `栏位 ${slot} · 第 ${data.summary.day} 天`;
    const where = el("span", "where");
    const mismatch = data ? !saveScriptMatches(data.scriptVersion, scriptVersion) : false;
    if (!data) where.textContent = "空栏位";
    else {
      const bits = [data.summary.chapter, shownPlace(data.summary.place)].filter(Boolean);
      if (mismatch) bits.push("另一版");
      where.textContent = bits.join(" · ") || "已保存";
    }
    const fine = el("span", "fine");
    if (!data) fine.textContent = saveMode === "save" ? "点这里记下现在" : "还没有记录";
    else fine.textContent = formatWhen(data.savedAt);
    copy.append(title, where, fine);
    node.append(thumb, copy);
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      if (disabled) return;
      void onSlot(slot, data);
    });
    return node;
  }

  async function onSlot(slot: string, data: SaveData | null) {
    if (saveMode === "save") {
      if (slot === "auto") return;
      if (data) {
        overwrite = { slot, data };
        render();
        return;
      }
      await writeSave(storage, slot, snapshot());
      render();
      return;
    }
    if (!data) return;
    openLoaded(data);
  }

  function overwriteModal(data: SaveData): HTMLElement {
    const box = modal("覆盖这个存档？");
    const bits = [`第 ${data.summary.day} 天`, data.summary.chapter, shownPlace(data.summary.place)].filter(Boolean);
    box.append(el("h3", "", "覆盖这个存档？"), el("p", "", bits.join(" · ")));
    box.append(el("p", "fine", `${formatWhen(data.savedAt)} 写下的。盖掉就找不回来了。`));
    const actions = el("div", "modal-actions");
    actions.append(
      button("留下", "btn", () => {
        overwrite = null;
        render();
      }),
      button("覆盖", "btn btn-primary", () => {
        const slot = overwrite?.slot;
        overwrite = null;
        if (!slot) {
          render();
          return;
        }
        void writeSave(storage, slot, snapshot()).then(() => render());
      }),
    );
    box.append(actions);
    const layer = overlay(box, () => {
      overwrite = null;
      render();
    });
    return layer;
  }

  function menuOverlay(): HTMLElement {
    const sheet = el("section", "quick-card");
    sheet.setAttribute("aria-label", "快捷菜单");
    sheet.append(el("h2", "", "菜单"));
    const list = el("div", "quick-list");
    list.append(
      button("继续游戏", "btn btn-primary", () => {
        confirmLeave = false;
        mode = "play";
        render();
      }),
      button("存档", "btn", () => openSaves("save")),
      button("读档", "btn", () => openSaves("load")),
      toggleRow("自动", auto, () => {
        auto = !auto;
        if (auto) skipping = false;
        render();
      }),
      toggleRow("快进", skipping, () => {
        skipping = !skipping;
        if (skipping) auto = false;
        render();
      }),
      button("日志", "btn", () => {
        logBack = "menu";
        mode = "log";
        render();
      }),
      button("设置", "btn", () => {
        backTo = "menu";
        mode = "settings";
        render();
      }),
    );
    const leave = el("div", "quick-list leave");
    leave.append(button("回到标题", "btn btn-ghost", () => {
      confirmLeave = true;
      render();
    }));
    sheet.append(list, leave);
    return overlay(sheet, () => {
      if (confirmLeave) return;
      mode = "play";
      render();
    }, true);
  }

  function logOverlay(): HTMLElement {
    const sheet = el("section", "quick-card log-card");
    sheet.setAttribute("aria-label", "日志");
    sheet.append(el("h2", "", "日志"));
    const list = el("div", "log-list");
    if (!backlog.length) list.append(el("p", "", "还没有对白。"));
    for (const line of backlog) {
      const row = el("article");
      row.append(el("b", "", line.who), el("p", "", line.text));
      list.append(row);
    }
    sheet.append(list, button("关闭", "btn", () => {
      mode = logBack;
      render();
    }));
    return overlay(sheet, () => {
      mode = logBack;
      render();
    }, true);
  }

  function leaveModal(): HTMLElement {
    const box = modal("回到标题？");
    box.append(el("h3", "", "回到标题？"), el("p", "", "这一段会停在自动存档。"));
    const actions = el("div", "modal-actions");
    actions.append(
      button("留下", "btn", () => {
        confirmLeave = false;
        render();
      }),
      button("回去", "btn btn-primary", () => void leaveToTitle()),
    );
    box.append(actions);
    return overlay(box, () => {
      confirmLeave = false;
      render();
    }, false, true);
  }

  async function leaveToTitle() {
    confirmLeave = false;
    auto = false;
    skipping = false;
    if (played) {
      try {
        await writeSave(storage, "auto", snapshot());
        continueReady = true;
      } catch {
        // 留下原来的自动档。
      }
    }
    mode = "title";
    render();
  }

  function versionModal(): HTMLElement {
    const box = modal("剧本版本不一样");
    box.append(
      el("h3", "", "剧本版本不一样"),
      el("p", "", "这份存档写下时的剧本和现在不是同一版。可以试着接着读；进度对不上的话，会回到标题。也可以先不读。"),
    );
    const actions = el("div", "modal-actions");
    actions.append(
      button("仍要读取", "btn btn-primary", () => {
        const data = pending;
        pending = null;
        if (!data) {
          mode = "title";
          render();
          return;
        }
        adoptSave(data);
      }),
      button("回到标题", "btn", () => {
        pending = null;
        mode = "title";
        render();
      }),
    );
    box.append(actions);
    return overlay(box, () => {
      pending = null;
      mode = "title";
      render();
    });
  }

  function openSaves(next: "load" | "save") {
    saveMode = next;
    backTo = "menu";
    overwrite = null;
    mode = "saves";
    render();
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
    const result = tryRestore(script, data.state, data.pos, schedule.totalDays, cues);
    pending = null;
    if (!result.ok) {
      banner = result.notice;
      resetTranscript();
      auto = false;
      skipping = false;
      mode = "title";
      render();
      return;
    }
    player = result.player;
    banner = "";
    error = "";
    resetTranscript();
    played = true;
    confirmLeave = false;
    overwrite = null;
    mode = "play";
    render();
  }

  function pick(index: number) {
    auto = false;
    skipping = false;
    act(() => player.choose(index));
  }

  function act(run: () => void) {
    played = true;
    run();
    void autosave();
    render();
  }

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (confirmLeave) {
        confirmLeave = false;
        render();
        return;
      }
      if (overwrite) {
        overwrite = null;
        render();
        return;
      }
      if (mode === "menu") {
        mode = "play";
        render();
        return;
      }
      if (mode === "log") {
        mode = logBack;
        render();
        return;
      }
      if (mode === "settings" || mode === "saves") {
        mode = backTo;
        render();
        return;
      }
      if (mode === "version") {
        pending = null;
        mode = "title";
        render();
        return;
      }
      if (mode === "play") {
        mode = "menu";
        void autosave();
        render();
      }
      return;
    }
    if (mode !== "play") return;
    let view: View;
    try {
      view = player.view();
    } catch {
      banner = SAVE_REJECTED;
      auto = false;
      skipping = false;
      mode = "title";
      render();
      return;
    }
    if ((event.key === " " || event.key === "Enter") && view.kind === "line") {
      event.preventDefault();
      advanceLine();
    }
    if (/^[1-9]$/.test(event.key) && (view.kind === "choice" || view.kind === "minigame")) {
      const index = Number(event.key) - 1;
      if (view.kind === "minigame") {
        const actions = minigameActions(view);
        actions[index]?.run();
        return;
      }
      if (view.options[index]) pick(index);
    }
  });

  document.addEventListener("fullscreenchange", () => {
    const on = document.fullscreenElement !== null;
    if (comfort.fullscreen === on) return;
    comfort.fullscreen = on;
    void persist();
    if (mode === "settings") render();
  });

  void Promise.all([readSettings(storage), readComfort(storage), readSave(storage, "auto").catch(() => null)]).then(([loaded, mix, saved]) => {
    settings = loaded;
    comfort = mix;
    continueReady = Boolean(saved);
    render();
  });
}

function textStop(speed: TextSpeed): { index: number; label: string } {
  if (speed === "slow") return { index: 0, label: "慢" };
  if (speed === "fast" || speed === "instant") return { index: 2, label: "快" };
  return { index: 1, label: "中" };
}

function sliderRow(name: string, min: number, max: number, value: number, caption: string, onInput: (value: number) => string): HTMLElement {
  const row = el("label", "set-row");
  row.append(el("span", "", name));
  const line = el("span", "slider-line");
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  input.value = String(value);
  const percent = max === min ? 100 : ((value - min) / (max - min)) * 100;
  input.style.setProperty("--val", `${percent}%`);
  input.setAttribute("aria-valuetext", caption);
  const read = el("b", "", caption);
  const left = el("i", "", name === "音乐" || name === "音效" ? "关" : "慢");
  const right = el("i", "", name === "音乐" || name === "音效" ? "满" : "快");
  input.addEventListener("input", () => {
    const next = Number(input.value);
    const span = max === min ? 100 : ((next - min) / (max - min)) * 100;
    input.style.setProperty("--val", `${span}%`);
    const label = onInput(next);
    read.textContent = label;
    input.setAttribute("aria-valuetext", label);
  });
  line.append(left, input, right, read);
  row.append(line);
  return row;
}

function panelHead(title: string, onBack: () => void): HTMLElement {
  const head = el("header", "panel-head");
  head.append(button("返回", "btn btn-ghost", onBack), el("h2", "", title));
  return head;
}

function hudButton(label: string, on: boolean, onClick: () => void, pressed = false): HTMLButtonElement {
  const node = button(label, on ? "hud-btn is-on" : pressed ? "hud-btn is-pressed" : "hud-btn", onClick);
  if (on) node.setAttribute("aria-pressed", "true");
  return node;
}

function toggleRow(label: string, on: boolean, onClick: () => void): HTMLButtonElement {
  const node = button("", on ? "btn is-on" : "btn", onClick);
  node.append(document.createTextNode(label), el("em", "", on ? "开" : "关"));
  node.setAttribute("aria-pressed", on ? "true" : "false");
  return node;
}

function continueEl(): HTMLElement {
  const node = el("p", "continue");
  const mark = document.createElement("i");
  mark.setAttribute("aria-hidden", "true");
  node.append(el("span", "", "点击继续"), mark);
  return node;
}

function overlay(content: HTMLElement, onBackdrop?: () => void, belowHud = false, front = false): HTMLElement {
  const layer = el("div", front ? "overlay confirm-layer" : "overlay");
  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "backdrop";
  backdrop.setAttribute("aria-label", "关闭");
  if (belowHud) backdrop.style.top = "var(--hud-h)";
  if (onBackdrop) {
    backdrop.addEventListener("click", (event) => {
      event.stopPropagation();
      onBackdrop();
    });
  }
  layer.append(backdrop, content);
  return layer;
}

function modal(label: string): HTMLElement {
  const box = el("div", "modal");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", label);
  return box;
}

function mapSpot(label: string): { left: string; top: string } {
  if (label.includes("灯塔")) return { left: "38%", top: "12%" };
  if (label.includes("码头")) return { left: "8%", top: "42%" };
  if (label.includes("礁石")) return { left: "62%", top: "38%" };
  if (label.includes("卫生所")) return { left: "18%", top: "68%" };
  if (label.includes("邮局")) return { left: "58%", top: "70%" };
  return { left: "40%", top: "46%" };
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function button(label: string, className: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.className = disabled ? `${className} is-disabled`.trim() : className;
  node.disabled = disabled;
  if (label) node.textContent = label;
  node.addEventListener("click", (event) => {
    event.stopPropagation();
    if (node.disabled) return;
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
