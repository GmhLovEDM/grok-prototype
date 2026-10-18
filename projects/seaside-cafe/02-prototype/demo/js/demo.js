/* 可点击灰盒演示。好感只存在内存里，界面不出现数字。 */
const STORE_SETTINGS = "seaside-cafe-demo-settings";
const STORE_SAVES = "seaside-cafe-demo-saves";
const SLOT_COUNT = 6;
const TRANSIENT = ["save", "settings", "codex"];

let state;
let typeTimer = 0;
let autoTimer = 0;
let toastTimer = 0;
let miniRaf = 0;
let audioCtx = null;

function defaultSettings() {
  return { textSpeed: 52, autoSpeed: 46, volume: 60, fullscreen: false, lang: "zh-Hans" };
}

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    /* 直接打开文件时，个别浏览器会拦住存储。演示仍可继续。 */
  }
}

function loadSettings() {
  return Object.assign(defaultSettings(), readStore(STORE_SETTINGS, {}));
}

function saveSettings() {
  writeStore(STORE_SETTINGS, state.settings);
}

function emptySaves() {
  return Array.from({ length: SLOT_COUNT }, () => null);
}

function loadSaves() {
  const saved = readStore(STORE_SAVES, emptySaves());
  if (!Array.isArray(saved) || saved.length !== SLOT_COUNT) return emptySaves();
  return saved;
}

function writeSaves(slots) {
  writeStore(STORE_SAVES, slots);
}

function latestSave() {
  return loadSaves()
    .filter(Boolean)
    .sort((a, b) => b.savedAt - a.savedAt)[0] || null;
}

function freshState() {
  return {
    screen: "title",
    overlay: null,
    returnTo: "title",
    player: { name: "", gender: "" },
    day: 1,
    phase: "day",
    scene: "main",
    scriptIndex: 0,
    lineDone: false,
    remembered: "",
    auto: false,
    skip: false,
    met: {},
    hearts: {},
    history: [],
    flags: {
      shiftDone: false,
      outing: "",
      phoneReady: false,
      phoneRead: false,
      phoneReply: "",
      miniResult: "",
      roamOpen: false,
    },
    settings: loadSettings(),
    saveMode: "load",
    pendingSlot: null,
    previewSaves: null,
    mini: { step: 0, pours: 0, bloom: false, pos: 8, dir: 1 },
    instant: false,
    resume: false,
    stack: [],
  };
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function chapterName(day) {
  if (day <= 1) return "序章";
  if (day <= 14) return "第一章";
  if (day <= 40) return "第二章";
  return "第三章";
}

function genderLabel(gender) {
  return gender === "female" ? "女主" : "男主";
}

function resolveText(text) {
  const raw = text && typeof text === "object" ? text[state.player.gender] || text.male || "" : text || "";
  return String(raw).replaceAll("{name}", state.player.name || "你");
}

function currentNode() {
  const scene = CafeData.scenes[state.scene] || [];
  return scene[state.scriptIndex] || null;
}

function nodeIndex(sceneName, id) {
  return (CafeData.scenes[sceneName] || []).findIndex((node) => node.id === id);
}

function $(selector) {
  return document.querySelector(selector);
}

function toast(message) {
  const el = $("#toast");
  el.hidden = false;
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 1700);
}

function flickerBond(id) {
  const kind = cafeBondKind(id, state.player.gender);
  const el = $("#heart");
  el.classList.remove("play", "is-heart", "is-shell");
  el.dataset.kind = kind;
  el.innerHTML = kind === "heart" ? "♥" : cafeShellSvg();
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add("play", kind === "heart" ? "is-heart" : "is-shell");
}

function blip() {
  const volume = Number(state.settings.volume) / 100;
  if (!volume) return;
  try {
    audioCtx = audioCtx || new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 620;
    gain.gain.value = volume * 0.04;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.07);
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (err) {
    /* 没有音频也不影响点击。 */
  }
}

function stopLoops() {
  clearInterval(typeTimer);
  clearTimeout(autoTimer);
  cancelAnimationFrame(miniRaf);
}

function meet(id) {
  if (!id || state.met[id]) return;
  state.met[id] = true;
  state.hearts[id] = 1;
}

function addHeart(id) {
  if (!id) return;
  state.met[id] = true;
  const next = Math.min(3, (state.hearts[id] || 0) + 1);
  state.hearts[id] = next;
}

function remember(node) {
  if (!node || node.type !== "line" || state.remembered === node.id) return;
  state.remembered = node.id;
  state.history.push({ speaker: node.speaker || "旁白", text: resolveText(node.text) });
  if (state.history.length > 80) state.history.shift();
}

function applyMeetDay(node) {
  if (!node) return;
  if (node.day) state.day = node.day;
  if (node.meet) meet(node.meet);
}

function show(screen) {
  stopLoops();
  state.screen = screen;
  state.overlay = null;
  render();
}

function render() {
  cafeApplyHeartField(state.player.gender || "male");
  $("#app").innerHTML = (renderers[state.screen] || renderers.title)();
  renderOverlay();
  if (state.screen === "dialogue") {
    const node = currentNode();
    if (node && node.type === "line") {
      if (state.resume || state.lineDone) {
        const line = $(".line-text");
        if (line) line.textContent = resolveText(node.text);
        const caret = $(".caret");
        if (caret) caret.hidden = true;
        const hint = $(".continue-hint");
        if (hint) hint.hidden = false;
        state.lineDone = true;
        state.resume = false;
      } else {
        startTyping();
      }
    }
  }
  if (state.screen === "minigame") startMini();
}

function renderOverlay() {
  const el = $("#overlay");
  if (!state.overlay) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  if (state.overlay === "menu") el.innerHTML = menuHtml();
  else if (state.overlay === "log") el.innerHTML = logHtml();
  else if (state.overlay === "confirm-title") el.innerHTML = confirmHtml("回到标题？当前进度如果没存，会留在这一局里。", "title-yes", "留下");
  else el.innerHTML = "";
}

function openOverlay(name) {
  clearTimeout(autoTimer);
  state.overlay = name;
  renderOverlay();
}

function closeOverlay() {
  state.overlay = null;
  renderOverlay();
  if (state.auto && state.lineDone && state.screen === "dialogue" && currentNode() && currentNode().type === "line") {
    scheduleAuto();
  }
}

function gotoId(id) {
  const index = nodeIndex(state.scene, id);
  if (index < 0) return;
  state.scriptIndex = index;
  enterNode();
}

function enterNode() {
  const node = currentNode();
  if (!node) return;
  applyMeetDay(node);
  if (node.type === "goto") {
    state.skip = false;
    applyGoto(node);
    return;
  }
  if (node.type === "choice") {
    state.skip = false;
    state.auto = false;
  }
  state.screen = "dialogue";
  state.lineDone = false;
  state.overlay = null;
  render();
}

function applyGoto(node) {
  if (node.day) state.day = node.day;
  if (node.phase) state.phase = node.phase;
  if (node.outing) state.flags.outing = node.outing;
  if (node.phoneReady) state.flags.phoneReady = true;
  if (node.screen === "phone" && state.flags.phoneReady) {
    state.flags.phoneRead = true;
    meet("shen-ruo");
  }
  show(node.screen);
}

function playScene(name) {
  state.scene = name;
  state.scriptIndex = 0;
  state.remembered = "";
  enterNode();
}

function advance() {
  if (state.overlay) return;
  const node = currentNode();
  if (!node) return;
  clearTimeout(autoTimer);
  if (node.next) {
    gotoId(node.next);
    return;
  }
  const scene = CafeData.scenes[state.scene] || [];
  if (state.scriptIndex >= scene.length - 1) return;
  state.scriptIndex += 1;
  enterNode();
}

function typingDelay() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  const speed = Number(state.settings.textSpeed) || 0;
  return Math.max(8, 92 - speed * 0.78);
}

function startTyping() {
  clearInterval(typeTimer);
  const node = currentNode();
  const el = $(".line-text");
  if (!node || !el) return;
  const full = resolveText(node.text);
  state.lineDone = false;
  const caret = $(".caret");
  if (state.instant || state.skip || typingDelay() === 0) {
    el.textContent = full;
    if (caret) caret.hidden = true;
    onLineDone(node);
    return;
  }
  let index = 0;
  el.textContent = "";
  if (caret) caret.hidden = false;
  typeTimer = setInterval(() => {
    index += 1;
    el.textContent = full.slice(0, index);
    if (index >= full.length) {
      clearInterval(typeTimer);
      if (caret) caret.hidden = true;
      onLineDone(node);
    }
  }, typingDelay());
}

function finishTyping() {
  clearInterval(typeTimer);
  const node = currentNode();
  const el = $(".line-text");
  if (!node || !el) return;
  el.textContent = resolveText(node.text);
  const caret = $(".caret");
  if (caret) caret.hidden = true;
  onLineDone(node);
}

function onLineDone(node) {
  if (state.lineDone) return;
  state.lineDone = true;
  remember(node);
  const hint = $(".continue-hint");
  if (hint) hint.hidden = false;
  if (state.skip) {
    autoTimer = setTimeout(advance, 30);
  } else if (state.auto) {
    scheduleAuto();
  }
}

function scheduleAuto() {
  clearTimeout(autoTimer);
  const speed = Number(state.settings.autoSpeed) || 0;
  const wait = Math.max(360, 2400 - speed * 18);
  autoTimer = setTimeout(advance, wait);
}

function choose(index) {
  const node = currentNode();
  if (!node || node.type !== "choice") return;
  const option = node.options[index];
  if (!option) return;
  state.history.push({ speaker: state.player.name || "你", text: option.text });
  if (option.bond) {
    addHeart(option.bond);
    flickerBond(option.bond);
  }
  state.skip = false;
  state.auto = false;
  gotoId(option.next);
}

function sceneHtml(name, prop) {
  const tag = CafeData.sceneTag[name] || "";
  const cat = prop === "cat"
    ? '<svg class="cat" viewBox="0 0 120 70" aria-hidden="true"><ellipse cx="34" cy="28" r="10"/><ellipse cx="78" cy="24" r="10"/><ellipse cx="58" cy="42" rx="34" ry="18"/><circle cx="46" cy="40" r="2"/><circle cx="68" cy="40" r="2"/></svg>'
    : "";
  return (
    '<div class="scene scene-' + name + '">' +
    '<div class="sky"></div><div class="sea"></div><div class="land"></div>' +
    '<i class="prop a"></i><i class="prop b"></i><i class="prop c"></i>' +
    cat +
    '<span class="scene-tag">' + esc(tag) + "</span></div>"
  );
}

function hud(options) {
  const dialogue = options && options.dialogue;
  const autoClass = state.auto ? " is-on" : "";
  const skipClass = state.skip ? " is-on" : "";
  const play = dialogue
    ? '<button class="hud-btn' + autoClass + '" data-act="auto">自动</button>' +
      '<button class="hud-btn' + skipClass + '" data-act="skip">快进</button>'
    : "";
  return (
    '<header class="hud">' +
    '<div class="hud-day"><b>第 ' + state.day + " 天</b><span>/ 60</span><em>" + chapterName(state.day) + "</em></div>" +
    '<div class="hud-actions">' + play +
    '<button class="hud-btn" data-act="log">日志</button>' +
    '<button class="hud-btn" data-act="save">存档</button>' +
    '<button class="hud-btn" data-act="menu">菜单</button>' +
    "</div></header>"
  );
}

function figureHtml(id) {
  if (!id) return '<div class="figure empty"></div>';
  return '<div class="figure">' + cafeSilhouette(id) + "</div>";
}

const renderers = {
  title() {
    const hasSave = Boolean(latestSave());
    return (
      '<section class="screen title-screen">' +
      '<div class="title-mark"><span>灰盒演示</span></div>' +
      '<h1>汐湾咖啡馆</h1>' +
      '<p class="subtitle">一个夏天 · 六十天 · 外婆的店「潮汐」</p>' +
      '<div class="menu-list">' +
      '<button class="btn primary" data-act="new">开始游戏</button>' +
      '<button class="btn" data-act="continue" data-enabled="' + (hasSave ? "1" : "0") + '">继续</button>' +
      '<button class="btn" data-act="load">读档</button>' +
      '<button class="btn" data-act="settings">设置</button>' +
      '<button class="btn locked" data-act="gallery-locked" aria-disabled="true">图鉴<span>锁定</span></button>' +
      "</div>" +
      '<p class="fine">序章加三章 · 单周目三小时以内 · 二十二个结局</p>' +
      "</section>"
    );
  },

  newgame() {
    const gender = state.player.gender;
    return (
      '<section class="screen new-screen">' +
      '<header class="panel-head"><button class="text-btn" data-act="back-title">返回</button><h2>新的夏天</h2></header>' +
      '<p class="lead">先选你是谁。名字可以自己起。男女主走同一条主线。能走在一起的人，图鉴里是心；其余是一枚贝壳。</p>' +
      '<div class="gender-row">' +
      '<button class="gender' + (gender === "male" ? " is-selected" : "") + '" data-act="gender" data-gender="male">' +
      "<b>男主</b><span>可以亲近的人：夏栀、唐棠、叶帆、苏念、程鹭、沈若</span></button>" +
      '<button class="gender' + (gender === "female" ? " is-selected" : "") + '" data-act="gender" data-gender="female">' +
      "<b>女主</b><span>可以亲近的人：陆屿、江叙白、许之言、宋知远</span></button>" +
      "</div>" +
      '<label class="name-field">你的名字<input id="player-name" maxlength="8" placeholder="例如：林夏" value="' + esc(state.player.name) + '"></label>' +
      '<button class="btn primary" data-act="begin">进入汐湾</button>' +
      '<p class="fine">序章里还不会遇见他们。第 2 天，隔壁的陆屿会过来帮忙。</p>' +
      "</section>"
    );
  },

  dialogue() {
    const node = currentNode() || { type: "line", bg: "cafe", speaker: "旁白", text: "" };
    const choice = node.type === "choice";
    const figure = figureHtml(node.figure);
    let body;
    if (choice) {
      body =
        '<p class="quote">' + esc(node.speaker) + "：" + esc(node.quote || "") + "</p>" +
        '<p class="prompt">' + esc(node.prompt) + "</p>" +
        '<div class="choices">' +
        node.options.map((option, index) => '<button class="choice" data-act="choice" data-index="' + index + '">' + esc(option.text) + "</button>").join("") +
        "</div>";
    } else {
      body = '<p class="line-text"></p><i class="caret" aria-hidden="true"></i><span class="continue-hint" hidden>点击继续</span>';
    }
    return (
      '<section class="screen play">' +
      hud({ dialogue: true }) +
      '<div class="stage-scene" data-act="' + (choice ? "" : "advance") + '">' +
      sceneHtml(node.bg || "cafe", node.prop) +
      figure +
      "</div>" +
      '<div class="text-panel" data-act="' + (choice ? "" : "advance") + '">' +
      '<div class="name-box">' + esc(node.speaker || "旁白") + "</div>" +
      body +
      "</div></section>"
    );
  },

  map() {
    const phase = state.phase;
    const places = CafeData.places.map((place) => {
      const today = placeHasEvent(place);
      const cls = ["pin"];
      if (place.locked) cls.push("is-locked");
      if (place.id === "cafe") cls.push("is-cafe");
      if (place.landmark) cls.push("is-landmark");
      if (today) cls.push("is-event");
      const mark = today ? '<i class="today">今日</i>' : "";
      return '<button class="' + cls.join(" ") + '" style="left:' + place.x + "%;top:" + place.y + '%" data-act="place" data-place="' + place.id + '"><b>' + esc(place.name) + "</b>" + mark + "<span>" + esc(place.hint) + "</span></button>";
    }).join("");
    const eveningOpen = state.flags.roamOpen && state.day >= 6;
    const eveningLabel = eveningOpen ? "第6天傍晚（示意）" : "傍晚 · 第6天起";
    return (
      '<section class="screen play map-screen">' +
      hud() +
      '<div class="phase-switch" role="tablist">' +
      '<button class="' + (phase === "day" ? "is-on" : "") + '" data-act="phase" data-phase="day">白天 · 咖啡馆班次</button>' +
      '<button class="' + (phase === "evening" ? "is-on" : "") + (eveningOpen ? "" : " is-wait") + '" data-act="phase" data-phase="evening">' + eveningLabel + "</button>" +
      "</div>" +
      '<div class="map-board" aria-hidden="false">' +
      '<svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="M22 93 L22 28" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-dasharray="4 3"/>' +
      '<path d="M22 42 L34 36" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-dasharray="4 3"/>' +
      '<path d="M8 20 H96" fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"/>' +
      "</svg>" +
      '<span class="map-label sea-label">海</span>' +
      '<span class="map-label beach-label">沙滩一侧</span>' +
      '<span class="map-label street-label">老街从车站往上，通向海边</span>' +
      places +
      "</div>" +
      '<div class="map-dock">' + mapObjective() + "</div>" +
      "</section>"
    );
  },

  minigame() {
    const step = state.mini.step;
    const names = ["温杯", "闷蒸", "注水", "完成"];
    const help = [
      "先温一下杯子。",
      "闷蒸。标记走进色块时，点「注水」。",
      "再分几次，把水慢慢注完。",
      state.mini.bloom ? "这杯还算顺手。" : "这杯可以上桌。",
    ];
    const action = step === 0 ? "温杯" : step === 3 ? "端出去" : "注水";
    const water = step === 0 ? 6 : step === 1 ? 16 : Math.min(92, 16 + state.mini.pours * 26);
    const dots = names.map((name, index) => '<i class="' + (index === step ? "is-on" : index < step ? "is-done" : "") + '">' + esc(name) + "</i>").join("");
    const result = step === 3
      ? '<p class="brew-result">' + (state.flags.miniResult === "good" ? "顺手" : "普通") + "</p>"
      : "";
    return (
      '<section class="screen play">' +
      hud() +
      '<div class="brew-layout">' +
      '<div class="brew-rig">' +
      '<div class="kettle' + (step === 1 || step === 2 ? " is-ready" : "") + '"><span>壶</span></div>' +
      '<div class="dripper"><span>滤杯</span><i class="stream' + (step === 2 && state.mini.pours ? " is-on" : "") + '"></i></div>' +
      '<div class="cup"><div class="water" style="height:' + water + '%"></div><span>杯</span></div>' +
      "</div>" +
      '<div class="brew-side">' +
      "<h2>手冲</h2>" +
      '<p class="note">外婆在配方本空白处写过：慢慢煮，别着急。</p>' +
      '<div class="steps">' + dots + "</div>" +
      "<p>" + help[step] + "</p>" +
      (step === 1
        ? '<div class="meter"><div class="zone"></div><div class="marker" id="marker" style="left:' + state.mini.pos + '%"></div></div><p class="fine">色块是这一次的节奏。</p>'
        : "") +
      result +
      '<div class="brew-actions">' +
      '<button class="btn primary" data-act="brew">' + action + "</button>" +
      '<button class="btn" data-act="brew-skip">跳过</button>' +
      "</div>" +
      '<p class="fine">跳过按普通表现结算。这一局可以随时跳过。</p>' +
      "</div></div></section>"
    );
  },

  phone() {
  const reply = state.flags.phoneReply;
  const replied = reply === "warm" || reply === "cool";
  const ready = state.flags.phoneReady;
  let thread;
  if (!ready) {
    thread = '<div class="phone-empty">暂时没有新消息。<p>沈若还没发来。</p></div>';
  } else {
    const bubbles = CafeData.messages.map((msg) => '<div class="bubble in"><b>' + esc(msg.from) + "</b><p>" + esc(msg.text) + "</p></div>").join("");
    const mine = replied
      ? '<div class="bubble out"><p>' + esc(replyLabel(reply)) + "</p></div>" +
        '<div class="bubble in"><b>沈若</b><p>' + esc(replyBack(reply)) + "</p></div>"
      : "";
    const choices = replied
      ? '<button class="btn primary" data-act="phone-close">放下手机</button>'
      : '<div class="reply-row">' +
        CafeData.replies.map((item) => '<button class="choice" data-act="reply" data-reply="' + item.id + '">' + esc(item.label) + "</button>").join("") +
        '<button class="text-btn" data-act="phone-close">先不回</button></div>';
    thread = bubbles + mine + choices;
  }
    return (
      '<section class="screen play phone-screen">' +
      hud() +
      '<div class="phone-shell">' +
      '<header><span>21:14</span><b>沈若</b><span>前同事</span></header>' +
      '<div class="thread">' + thread + "</div>" +
      '<p class="fine">人还没到汐湾。她第 18 天才拖着行李箱出现。</p>' +
      "</div></section>"
    );
  },

  codex() {
    const cards = CafeData.characters.map((person) => codexCard(person)).join("");
    return (
      '<section class="screen codex-screen">' +
      '<header class="panel-head"><button class="text-btn" data-act="back">返回</button><h2>人物图鉴</h2></header>' +
      '<p class="lead">心是可以走在一起的人，贝壳是朋友。换了主角，同一人的图标会换。还没遇见的，故事先锁着。</p>' +
      '<div class="codex-grid">' + cards + "</div>" +
      "</section>"
    );
  },

  save() {
    const slots = state.previewSaves || loadSaves();
    const mode = state.saveMode === "save" ? "存档" : "读档";
    const cards = slots.map((slot, index) => saveCard(slot, index)).join("");
    const confirm = state.pendingSlot != null
      ? '<div class="confirm-bar"><p>覆盖栏位 ' + (state.pendingSlot + 1) + '？</p><button class="btn primary" data-act="overwrite">覆盖</button><button class="btn" data-act="cancel-overwrite">取消</button></div>'
      : "";
    return (
      '<section class="screen save-screen">' +
      '<header class="panel-head"><button class="text-btn" data-act="back">返回</button><h2>' + mode + "</h2>" +
      '<div class="seg">' +
      '<button class="' + (state.saveMode === "save" ? "is-on" : "") + '" data-act="save-mode" data-mode="save">存档</button>' +
      '<button class="' + (state.saveMode === "load" ? "is-on" : "") + '" data-act="save-mode" data-mode="load">读档</button>' +
      "</div></header>" +
      '<div class="slot-grid">' + cards + "</div>" +
      confirm +
      "</section>"
    );
  },

  chapter() {
    return (
      '<section class="screen chapter-screen">' +
      sceneHtml("night") +
      '<div class="chapter-card">' +
      '<p class="kicker">演示快进 · 第 7 天到第 13 天略过</p>' +
      "<h2>第一章 · 重新开张</h2>" +
      '<p class="day-line">第 14 天 / 60</p>' +
      "<p>第 6 天傍晚已经单独看过。第 4 天和第 5 天没有演出。</p>" +
      "<p>夏日祭。烟花在码头上空散开。</p>" +
      "<p>回家的路上，城里的前公司打来电话：「位置给你留着，八月底前答复。」</p>" +
      '<ul class="threads">' +
      "<li>夏日特调：配方的最后一页，还没找到</li>" +
      "<li>老街：周总还没上门</li>" +
      "<li>去留：八月底前，要给一个答复</li>" +
      "</ul>" +
      '<div class="row-actions">' +
      '<button class="btn primary" data-act="ending">查看结局示意</button>' +
      '<button class="btn" data-act="back-title">回到标题</button>' +
      "</div></div></section>"
    );
  },

  ending() {
    const card = CafeData.endings[state.player.gender] || CafeData.endings.male;
    const name = state.player.name || "你";
    return (
      '<section class="screen ending-screen">' +
      '<div class="ending-layout">' +
      '<div class="ending-figure">' + cafeSilhouette(card.figure) + "</div>" +
      '<article class="ending-card">' +
      '<p class="kicker">示意</p>' +
      "<h2>" + esc(card.who) + " · " + esc(card.title) + "</h2>" +
      '<p class="where">' + esc(card.where) + "</p>" +
      "<p>" + esc(card.text) + "</p>" +
      '<p class="fine">这张卡片是「示意」。正式文案以 Kai 的 endings.md 为准。</p>' +
      '<p class="fine">' + esc(name) + " · " + genderLabel(state.player.gender || "male") + " · 全游戏二十二个结局里的一则。</p>" +
      '<p class="fine">男主可达十四个，女主可达十个，里面都有「独自留在汐湾」和「回到城市」。</p>' +
      '<button class="btn primary" data-act="back-title">回到标题</button>' +
      "</article></div></section>"
    );
  },

  settings() {
    const s = state.settings;
    const langNote = s.lang === "zh-Hans" ? "" : '<p class="warn">演示里的界面和剧情都是简体中文。语言开关先留在这里。</p>';
    return (
      '<section class="screen settings-screen">' +
      '<header class="panel-head"><button class="text-btn" data-act="back">返回</button><h2>设置</h2></header>' +
      '<form class="settings-form" data-act="noop">' +
      sliderField("文字速度", "textSpeed", s.textSpeed, "慢", "快") +
      sliderField("自动速度", "autoSpeed", s.autoSpeed, "慢", "快") +
      sliderField("主音量", "volume", s.volume, "关", "开") +
      '<label class="set-row toggle-row"><span>全屏</span><button type="button" class="btn" data-act="fullscreen">' + (document.fullscreenElement ? "退出全屏" : "进入全屏") + "</button></label>" +
      '<label class="set-row">语言<select data-setting="lang">' +
      '<option value="zh-Hans"' + (s.lang === "zh-Hans" ? " selected" : "") + ">简体中文</option>" +
      '<option value="zh-Hant"' + (s.lang === "zh-Hant" ? " selected" : "") + ">繁體中文</option>" +
      '<option value="en"' + (s.lang === "en" ? " selected" : "") + ">English</option>" +
      "</select></label>" +
      langNote +
      '<p class="fine">文字速度和自动速度会立刻作用在下一句。音量只影响界面的轻提示音。</p>' +
      "</form></section>"
    );
  },
};

function sliderField(label, key, value, minLabel, maxLabel) {
  return (
    '<label class="set-row"><span>' + label + "</span>" +
    '<span class="slider-line"><em>' + minLabel + "</em>" +
    '<input type="range" min="0" max="100" value="' + Number(value) + '" data-setting="' + key + '">' +
    "<em>" + maxLabel + "</em>" +
    '<b data-out="' + key + '">' + Number(value) + "</b></span></label>"
  );
}

function placeHasEvent(place) {
  if (state.phase === "day") return place.id === "cafe" && state.day === 3 && !state.flags.shiftDone;
  return Boolean(place.eveningEvent) && state.day >= 6 && state.day <= 8;
}

function mapObjective() {
  if (state.phase === "day" || !state.flags.roamOpen) {
    if (state.flags.shiftDone && state.day >= 6) {
      return '<p>白天的班次做完了。</p><button class="btn" data-act="phase" data-phase="evening">第6天傍晚（示意）</button>';
    }
    if (state.flags.shiftDone) {
      return "<p>班次做完了。第 3 天傍晚，夏栀会留下来擦窗。</p>";
    }
    return '<p>今天的班次：做出回来后的第一杯。夏栀会把旧咖啡壶送来。</p><button class="btn primary" data-act="place" data-place="cafe">开始班次</button>';
  }
  const note = "<p><b>第6天傍晚（示意）</b>第 4、5 天略过。自由行动从第 6 天起到第 8 天。标着「今日」的地方今晚有事。</p>";
  if (!state.flags.outing) {
    return '<div class="map-copy">' + note + "<p>码头、灯塔、礁石滩，今晚只能去一处。老街·秀姨是日常，只有两句话。</p></div>";
  }
  return '<div class="map-copy">' + note + "<p>这一晚就到这里。第 7 天到第 13 天，演示会快进。</p></div>" +
    '<button class="btn primary" data-act="chapter">快进到章末</button>';
}

function bondMarks(person, count) {
  const kind = person.heart || cafeBondKind(person.id, state.player.gender);
  const total = Math.max(1, count || 1);
  const marks = kind === "heart" ? "♥".repeat(total) : Array.from({ length: total }, () => cafeShellSvg()).join("");
  return { kind: kind, marks: marks, label: kind === "heart" ? "心" : "贝壳" };
}

function codexCard(person) {
  const known = Boolean(state.met[person.id]);
  if (!known) {
    const icon = bondMarks(person, 1);
    return (
      '<article class="codex-card is-locked">' +
      '<div class="lock-mark">锁定</div>' +
      "<h3>" + esc(person.name) + "</h3>" +
      '<p class="hearts is-dim" data-bond="' + icon.kind + '" aria-label="' + icon.label + '">' + icon.marks + "</p>" +
      "<p>尚未相遇</p>" +
      '<p class="fine">' + esc(person.day) + "</p></article>"
    );
  }
  const tier = Math.max(0, Math.min(2, (state.hearts[person.id] || 1) - 1));
  const gender = state.player.gender === "female" ? "female" : "male";
  const line = (person.bond[gender] || person.bond.male)[tier] || person.bond[gender][0];
  const icon = bondMarks(person, Math.min(3, state.hearts[person.id] || 1));
  const badge = person.messageOnly ? '<span class="badge">仅消息</span>' : "";
  return (
    '<article class="codex-card">' +
    cafeSilhouette(person.id) +
    "<h3>" + esc(person.name) + badge + "</h3>" +
    '<p class="role">' + esc(person.role) + "</p>" +
    "<p>" + esc(person.bio) + "</p>" +
    '<p class="hearts" data-bond="' + icon.kind + '" aria-label="' + esc(icon.label + "。" + line) + '">' + icon.marks + "</p>" +
    '<p class="bond">' + esc(line) + "</p></article>"
  );
}

function saveCard(slot, index) {
  if (!slot) {
    return '<button class="slot is-empty" data-act="slot" data-slot="' + index + '"><b>栏位 ' + (index + 1) + "</b><span>空栏位</span></button>";
  }
  const when = new Date(slot.savedAt);
  const stamp = (when.getMonth() + 1) + "月" + when.getDate() + "日 " + String(when.getHours()).padStart(2, "0") + ":" + String(when.getMinutes()).padStart(2, "0");
  const where = slot.screen === "map"
    ? (slot.phase === "evening" && slot.day >= 6 ? "傍晚（示意）" : slot.phase === "evening" ? "傍晚" : "白天班次")
    : slot.screen === "dialogue" ? "对话" : "进行中";
  return (
    '<button class="slot" data-act="slot" data-slot="' + index + '">' +
    "<b>栏位 " + (index + 1) + "</b>" +
    "<span>" + esc(slot.player.name || "你") + " · " + genderLabel(slot.player.gender) + "</span>" +
    "<span>第 " + slot.day + " 天 · " + chapterName(slot.day) + " · " + where + "</span>" +
    '<span class="fine">' + stamp + "</span></button>"
  );
}

function replyLabel(id) {
  if (id === "later") return "（先放下了手机）";
  const found = CafeData.replies.find((item) => item.id === id);
  return found ? found.label : "";
}

function replyBack(id) {
  const found = CafeData.replies.find((item) => item.id === id);
  return found ? found.back : "";
}

function menuHtml() {
  return (
    '<div class="overlay-wrap">' +
    '<button class="backdrop" data-act="close-overlay" aria-label="关闭菜单"></button>' +
    '<div class="sheet">' +
    "<h2>菜单</h2>" +
    '<button class="btn" data-act="close-overlay">继续游戏</button>' +
    '<button class="btn" data-act="log">日志</button>' +
    '<button class="btn" data-act="save">存档</button>' +
    '<button class="btn" data-act="load">读档</button>' +
    '<button class="btn" data-act="codex">人物图鉴</button>' +
    '<button class="btn" data-act="open-phone">手机</button>' +
    '<button class="btn" data-act="settings">设置</button>' +
    '<button class="btn" data-act="ask-title">回到标题</button>' +
    "</div></div>"
  );
}

function logHtml() {
  const rows = state.history.length
    ? state.history.map((line) => "<p><b>" + esc(line.speaker) + "</b>" + esc(line.text) + "</p>").join("")
    : "<p>还没有对白。</p>";
  return (
    '<div class="overlay-wrap">' +
    '<button class="backdrop" data-act="close-overlay" aria-label="关闭日志"></button>' +
    '<div class="sheet log-sheet"><h2>日志</h2><div class="log-list">' + rows + "</div>" +
    '<button class="btn" data-act="close-overlay">关闭</button></div></div>'
  );
}

function confirmHtml(text, yesAct, noLabel) {
  return (
    '<div class="overlay-wrap">' +
    '<div class="sheet"><p>' + esc(text) + "</p>" +
    '<button class="btn primary" data-act="' + yesAct + '">回到标题</button>' +
    '<button class="btn" data-act="close-overlay">' + esc(noLabel) + "</button></div></div>"
  );
}

function pushHere() {
  if (!TRANSIENT.includes(state.screen)) state.stack.push(state.screen);
}

function openSettings() {
  pushHere();
  state.overlay = null;
  show("settings");
}

function openCodex() {
  pushHere();
  state.overlay = null;
  show("codex");
}

function openSave(mode) {
  pushHere();
  state.saveMode = mode;
  state.pendingSlot = null;
  state.previewSaves = null;
  state.overlay = null;
  show("save");
}

function goBack() {
  const target = state.stack.pop() || "title";
  state.pendingSlot = null;
  state.previewSaves = null;
  state.overlay = null;
  if (target === "dialogue") {
    state.resume = true;
    state.lineDone = true;
    state.screen = "dialogue";
    render();
    return;
  }
  show(target);
}

function underlyingScreen() {
  if (TRANSIENT.includes(state.screen)) return state.stack[state.stack.length - 1] || "title";
  return state.screen;
}

function snapshot() {
  const screen = underlyingScreen();
  return {
    day: state.day,
    phase: state.phase,
    scene: state.scene,
    scriptIndex: state.scriptIndex,
    screen: screen,
    player: { name: state.player.name, gender: state.player.gender },
    met: Object.assign({}, state.met),
    hearts: Object.assign({}, state.hearts),
    history: state.history.slice(-40),
    flags: Object.assign({}, state.flags),
    savedAt: Date.now(),
  };
}

function restore(data) {
  state.day = data.day;
  state.phase = data.phase;
  state.scene = data.scene;
  state.scriptIndex = data.scriptIndex;
  state.player = { name: data.player.name, gender: data.player.gender };
  state.met = Object.assign({}, data.met);
  state.hearts = Object.assign({}, data.hearts);
  state.history = (data.history || []).slice();
  state.flags = Object.assign(freshState().flags, data.flags);
  state.previewSaves = null;
  state.pendingSlot = null;
  state.overlay = null;
  state.auto = false;
  state.skip = false;
  state.stack = [];
  if (data.screen === "dialogue") {
    state.resume = true;
    state.screen = "dialogue";
    render();
    return;
  }
  if (data.screen === "minigame") {
    state.mini = { step: 0, pours: 0, bloom: false, pos: 8, dir: 1 };
  }
  show(data.screen || "map");
}

function saveToSlot(index) {
  const under = underlyingScreen();
  if (under === "title" || under === "newgame") {
    toast("先进入故事，再存档。");
    return;
  }
  const slots = loadSaves();
  slots[index] = snapshot();
  writeSaves(slots);
  state.previewSaves = null;
  state.pendingSlot = null;
  toast("已存入栏位 " + (index + 1));
  render();
}

function loadSlot(index) {
  const slots = state.previewSaves || loadSaves();
  const slot = slots[index];
  if (!slot) {
    toast("这个栏位是空的。");
    return;
  }
  if (!slot.scene) {
    toast("这是示意栏位。");
    return;
  }
  restore(slot);
}

function beginGame() {
  const input = $("#player-name");
  const name = (input ? input.value : state.player.name).trim();
  if (!state.player.gender) {
    toast("先选择男主或女主。");
    return;
  }
  if (!name) {
    toast("先写一个名字。");
    return;
  }
  const gender = state.player.gender;
  const settings = state.settings;
  state = freshState();
  state.settings = settings;
  state.player = { name: name.slice(0, 8), gender: gender };
  state.scene = "main";
  state.scriptIndex = 0;
  state.day = 1;
  enterNode();
}

function onPlace(id) {
  const place = CafeData.places.find((item) => item.id === id);
  if (!place) return;
  if (place.locked) {
    toast(place.lockText);
    return;
  }
  if (place.landmark) {
    toast(place.blurb);
    return;
  }
  const roaming = state.phase === "evening" && state.flags.roamOpen && state.day >= 6;
  if (!roaming) {
    if (id === "cafe" && state.phase === "day" && !state.flags.shiftDone) {
      playScene("day3");
      return;
    }
    if (id === "cafe" && state.flags.shiftDone) {
      toast("今天的班次已经做完。");
      return;
    }
    toast(state.phase === "day" ? "白天还在营业，傍晚再出门。" : "自由行动从第 6 天傍晚开始。");
    return;
  }
  if (place.everyday) {
    playScene("evening-street");
    return;
  }
  if (id === "cafe") {
    toast("「潮汐」今天已经打烊。二楼朝海，人已经出来了。");
    return;
  }
  if (state.flags.outing) {
    toast("今晚已经出过门了。");
    return;
  }
  if (!CafeData.scenes["evening-" + id]) {
    toast("这里今晚没有事。");
    return;
  }
  playScene("evening-" + id);
}

function setPhase(phase) {
  if (phase === "evening" && !state.flags.roamOpen) {
    toast(state.flags.shiftDone
      ? "第 3 天傍晚是夏栀留下来擦窗，还有沈若的消息。自由行动从第 6 天起。"
      : "先把今天的班次做完。自由行动从第 6 天傍晚开始。");
    return;
  }
  state.phase = phase;
  render();
}

function startMini() {
  cancelAnimationFrame(miniRaf);
  const loop = () => {
    if (state.screen !== "minigame" || state.mini.step !== 1) return;
    state.mini.pos += state.mini.dir * 1.4;
    if (state.mini.pos > 100 || state.mini.pos < 0) {
      state.mini.dir *= -1;
      state.mini.pos = Math.max(0, Math.min(100, state.mini.pos));
    }
    const marker = $("#marker");
    if (marker) marker.style.left = state.mini.pos + "%";
    miniRaf = requestAnimationFrame(loop);
  };
  if (state.mini.step === 1) miniRaf = requestAnimationFrame(loop);
}

function brew() {
  const mini = state.mini;
  if (mini.step === 0) {
    mini.step = 1;
    mini.pos = 8;
    render();
    return;
  }
  if (mini.step === 1) {
    mini.bloom = mini.pos >= 38 && mini.pos <= 62;
    mini.step = 2;
    mini.pours = 0;
    render();
    return;
  }
  if (mini.step === 2) {
    mini.pours += 1;
    if (mini.pours >= 3) {
      mini.step = 3;
      state.flags.miniResult = mini.bloom ? "good" : "plain";
    }
    render();
    return;
  }
  finishMini(state.flags.miniResult || "plain");
}

function skipMini() {
  state.flags.miniResult = "plain";
  toast("已跳过，按普通表现结算");
  finishMini(true);
}

function finishMini(skipped) {
  state.flags.shiftDone = true;
  state.day = 3;
  state.phase = "day";
  cancelAnimationFrame(miniRaf);
  playScene("day3-evening");
  if (!skipped) toast(state.flags.miniResult === "good" ? "这杯还算顺手" : "这杯可以上桌");
}

function openPhone() {
  pushHere();
  if (state.flags.phoneReady) {
    state.flags.phoneRead = true;
    meet("shen-ruo");
  }
  state.overlay = null;
  show("phone");
}

function replyPhone(id) {
  const option = CafeData.replies.find((item) => item.id === id);
  if (!option || state.flags.phoneReply === "warm" || state.flags.phoneReply === "cool") return;
  state.flags.phoneReply = id;
  if (option.bond) {
    addHeart(option.bond);
    flickerBond(option.bond);
  }
  render();
}

function closePhone() {
  if (state.flags.phoneReady && state.flags.phoneReply !== "warm" && state.flags.phoneReply !== "cool") {
    state.flags.phoneReply = "later";
  }
  if (!state.flags.roamOpen && state.flags.phoneReady && state.day < 6) {
    openDay6();
    return;
  }
  goBack();
}

function openDay6() {
  state.day = 6;
  state.phase = "evening";
  state.flags.roamOpen = true;
  state.flags.shiftDone = true;
  state.flags.outing = "";
  state.stack = [];
  show("map");
}

function onDialogueClick() {
  if (state.overlay) return;
  const node = currentNode();
  if (!node || node.type !== "line") return;
  if (!state.lineDone) finishTyping();
  else advance();
}

function handle(act, el) {
  if (act === "advance") {
    onDialogueClick();
    return;
  }
  if (act === "noop") return;
  if (act === "new") {
    state.player = { name: "", gender: "" };
    show("newgame");
    return;
  }
  if (act === "back-title" || act === "title-yes") {
    stopLoops();
    const settings = state.settings;
    state = freshState();
    state.settings = settings;
    show("title");
    return;
  }
  if (act === "gender") {
    state.player.gender = el.dataset.gender;
    const input = $("#player-name");
    if (input) state.player.name = input.value;
    render();
    const again = $("#player-name");
    if (again) again.focus();
    return;
  }
  if (act === "begin") {
    beginGame();
    return;
  }
  if (act === "continue") {
    const slot = latestSave();
    if (!slot) {
      toast("还没有可以继续的进度。");
      return;
    }
    restore(slot);
    return;
  }
  if (act === "settings") {
    openSettings();
    return;
  }
  if (act === "gallery-locked") {
    toast("图鉴还锁着。通关以后再打开。");
    return;
  }
  if (act === "load") {
    openSave("load");
    return;
  }
  if (act === "save") {
    openSave("save");
    return;
  }
  if (act === "save-mode") {
    state.saveMode = el.dataset.mode;
    state.pendingSlot = null;
    render();
    return;
  }
  if (act === "back") {
    goBack();
    return;
  }
  if (act === "auto") {
    state.auto = !state.auto;
    if (state.auto) state.skip = false;
    paintHudToggles();
    if (state.auto && state.lineDone) scheduleAuto();
    else clearTimeout(autoTimer);
    return;
  }
  if (act === "skip") {
    state.skip = !state.skip;
    if (state.skip) {
      state.auto = false;
      paintHudToggles();
      if (state.lineDone) advance();
      else finishTyping();
    } else {
      clearTimeout(autoTimer);
      paintHudToggles();
    }
    return;
  }
  if (act === "log") {
    openOverlay("log");
    return;
  }
  if (act === "menu") {
    openOverlay("menu");
    return;
  }
  if (act === "close-overlay") {
    closeOverlay();
    return;
  }
  if (act === "ask-title") {
    openOverlay("confirm-title");
    return;
  }
  if (act === "codex") {
    openCodex();
    return;
  }
  if (act === "choice") {
    choose(Number(el.dataset.index));
    return;
  }
  if (act === "phase") {
    setPhase(el.dataset.phase);
    return;
  }
  if (act === "place") {
    onPlace(el.dataset.place);
    return;
  }
  if (act === "brew") {
    brew();
    return;
  }
  if (act === "brew-skip") {
    skipMini();
    return;
  }
  if (act === "open-phone") {
    openPhone();
    return;
  }
  if (act === "reply") {
    replyPhone(el.dataset.reply);
    return;
  }
  if (act === "phone-close") {
    closePhone();
    return;
  }
  if (act === "chapter") {
    show("chapter");
    return;
  }
  if (act === "ending") {
    show("ending");
    return;
  }
  if (act === "fullscreen") {
    toggleFullscreen();
    return;
  }
  if (act === "slot") {
    onSlot(Number(el.dataset.slot));
    return;
  }
  if (act === "overwrite") {
    saveToSlot(state.pendingSlot);
    return;
  }
  if (act === "cancel-overwrite") {
    state.pendingSlot = null;
    render();
  }
}

function paintHudToggles() {
  document.querySelectorAll(".hud-btn").forEach((btn) => {
    if (btn.dataset.act === "auto") btn.classList.toggle("is-on", state.auto);
    if (btn.dataset.act === "skip") btn.classList.toggle("is-on", state.skip);
  });
}

function onSlot(index) {
  if (state.saveMode === "load") {
    loadSlot(index);
    return;
  }
  const slots = loadSaves();
  if (slots[index]) {
    state.pendingSlot = index;
    state.previewSaves = null;
    render();
    return;
  }
  saveToSlot(index);
}

function toggleFullscreen() {
  const root = document.documentElement;
  if (!document.fullscreenElement) {
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!req) {
      toast("这个环境进不了全屏。");
      return;
    }
    req.call(root).catch(() => toast("这个环境进不了全屏。"));
  } else {
    document.exitFullscreen();
  }
}

function onSettingInput(target) {
  const key = target.dataset.setting;
  if (!key) return;
  if (key === "lang") {
    state.settings.lang = target.value;
    saveSettings();
    render();
    return;
  }
  state.settings[key] = Number(target.value);
  saveSettings();
  const out = document.querySelector('[data-out="' + key + '"]');
  if (out) out.textContent = String(state.settings[key]);
  if (key === "volume") blip();
}

function bootFromHash(hash) {
  const lead = new URLSearchParams(location.search).get("lead") === "female" ? "female" : "male";
  state.player = { name: "林夏", gender: lead };
  state.instant = false;
  const preset = {
    title() { show("title"); },
    newgame() {
      state.player.gender = lead;
      state.player.name = "";
      show("newgame");
    },
    dialogue() { bootMid("main", "p8", { "lu-yu": true }, { "lu-yu": 1 }, 2); },
    choice() { bootMid("main", "c-day2", { "lu-yu": true }, { "lu-yu": 1 }, 2); },
    map() {
      state.day = 3;
      state.phase = "day";
      state.met = { "lu-yu": true };
      state.hearts = { "lu-yu": 1 };
      show("map");
    },
    "map-evening"() {
      state.day = 6;
      state.phase = "evening";
      state.flags.shiftDone = true;
      state.flags.roamOpen = true;
      state.flags.phoneReady = true;
      state.flags.phoneRead = true;
      state.flags.phoneReply = "warm";
      state.met = { "lu-yu": true, "xia-zhi": true, "shen-ruo": true };
      state.hearts = { "lu-yu": 2, "xia-zhi": 1, "shen-ruo": 2 };
      show("map");
    },
    "day3-evening"() {
      state.flags.shiftDone = true;
      bootMid("day3-evening", "w1", { "lu-yu": true, "xia-zhi": true }, { "lu-yu": 2, "xia-zhi": 1 }, 3);
    },
    minigame() {
      state.day = 3;
      state.met = { "lu-yu": true, "xia-zhi": true };
      state.hearts = { "lu-yu": 1, "xia-zhi": 1 };
      state.mini.step = 1;
      show("minigame");
    },
    phone() {
      state.day = 3;
      state.scene = "day3-evening";
      state.scriptIndex = nodeIndex("day3-evening", "to-phone");
      state.flags.shiftDone = true;
      state.flags.phoneReady = true;
      state.flags.phoneRead = true;
      state.met = { "lu-yu": true, "xia-zhi": true, "shen-ruo": true };
      state.hearts = { "lu-yu": 2, "xia-zhi": 1, "shen-ruo": 1 };
      show("phone");
    },
    codex() {
      state.day = 3;
      state.met = { "lu-yu": true, "xia-zhi": true, "shen-ruo": true };
      state.hearts = { "lu-yu": 2, "xia-zhi": 1, "shen-ruo": 1 };
      state.stack = ["map"];
      show("codex");
    },
    save() {
      state.day = 3;
      state.phase = "evening";
      state.saveMode = "load";
      state.stack = ["title"];
      state.previewSaves = [
        {
          day: 2,
          phase: "day",
          scene: "main",
          scriptIndex: nodeIndex("main", "p8"),
          screen: "dialogue",
          player: { name: "林夏", gender: lead },
          met: { "lu-yu": true },
          hearts: { "lu-yu": 1 },
          history: [{ speaker: "陆屿", text: "啧，你别动，我来。……城里待久了，连箱子都搬不动了？" }],
          flags: freshState().flags,
          savedAt: Date.now() - 3600 * 1000,
        },
        {
          day: 6,
          phase: "evening",
          scene: "day3-evening",
          scriptIndex: nodeIndex("day3-evening", "to-phone"),
          screen: "map",
          player: { name: "林夏", gender: lead },
          met: { "lu-yu": true, "xia-zhi": true, "shen-ruo": true },
          hearts: { "lu-yu": 2, "xia-zhi": 1, "shen-ruo": 1 },
          history: [],
          flags: Object.assign(freshState().flags, { shiftDone: true, roamOpen: true, phoneReady: true, phoneRead: true, phoneReply: "warm" }),
          savedAt: Date.now() - 600 * 1000,
        },
        null, null, null, null,
      ];
      show("save");
    },
    chapter() { show("chapter"); },
    ending() { show("ending"); },
    settings() {
      state.stack = ["title"];
      show("settings");
    },
    menu() {
      bootMid("main", "p8", { "lu-yu": true }, { "lu-yu": 1 }, 2);
      openOverlay("menu");
    },
    log() {
      bootMid("main", "p10", { "lu-yu": true }, { "lu-yu": 1 }, 2);
      state.history = [
        { speaker: "旁白", text: "第 2 天。你还在打扫。门口的光被一个扛着工具箱的人挡住了。" },
        { speaker: "陆屿", text: "啧，你别动，我来。……城里待久了，连箱子都搬不动了？" },
      ];
      state.resume = true;
      render();
      openOverlay("log");
    },
  };
  (preset[hash] || preset.title)();
}

function bootMid(scene, id, met, hearts, day) {
  state.scene = scene;
  state.scriptIndex = nodeIndex(scene, id);
  state.met = Object.assign({}, met);
  state.hearts = Object.assign({}, hearts);
  state.day = day;
  state.resume = true;
  state.screen = "dialogue";
  const node = currentNode();
  if (node && node.type === "line") {
    state.history = [{ speaker: node.speaker, text: resolveText(node.text) }];
  }
  render();
}

function onKey(event) {
  const tag = event.target && event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    if (event.key === "Enter" && event.target.id === "player-name") beginGame();
    return;
  }
  if (event.key === "Escape") {
    if (state.overlay) closeOverlay();
    else if (state.screen !== "title" && state.screen !== "newgame") openOverlay("menu");
    return;
  }
  if ((event.key === " " || event.key === "Enter") && state.screen === "dialogue" && !state.overlay) {
    event.preventDefault();
    onDialogueClick();
  }
}

function init() {
  state = freshState();
  document.addEventListener("fullscreenchange", () => {
    if (state.screen === "settings") render();
  });
  $("#stage").addEventListener("submit", (event) => event.preventDefault());
  $("#stage").addEventListener("click", (event) => {
    const target = event.target.closest("[data-act]");
    if (!target || target.dataset.act === "") return;
    if (target.dataset.act !== "advance") blip();
    handle(target.dataset.act, target);
  });
  $("#stage").addEventListener("input", (event) => onSettingInput(event.target));
  $("#stage").addEventListener("change", (event) => onSettingInput(event.target));
  document.addEventListener("keydown", onKey);
  const hash = (location.hash || "").replace("#", "");
  if (hash) bootFromHash(hash);
  else show("title");
  window.addEventListener("hashchange", () => {
    const next = (location.hash || "").replace("#", "");
    if (!next) return;
    const settings = state.settings;
    state = freshState();
    state.settings = settings;
    bootFromHash(next);
  });
}

document.addEventListener("DOMContentLoaded", init);
