import { ScriptError, parseEffectText } from "./effects";
import type {
  Block,
  ChoiceBlock,
  ChoiceOption,
  Cond,
  Day,
  Fireworks,
  Gender,
  JumpRef,
  Line,
  Scene,
  Story,
} from "./types";

type ChoiceFrame = { kind: "choice"; id: string; choiceType: string; options: ChoiceOption[] };
type Frame =
  | { kind: "replace"; id: string; byGender: Record<Gender, Line[]>; current: Gender | null }
  | ChoiceFrame
  | { kind: "minigame"; id: string; instructions: string[]; fail: string | null; choice: ChoiceBlock | null }
  | { kind: "branch"; id: string; arms: { condition: Cond | null; items: Line[] }[] }
  | { kind: "input"; id: string; note: string };

const BLOCKS = new Set(["替换", "选择", "小游戏", "分支", "输入"]);

export type ParseOptions = {
  /** 冒号后的表情。构建时用来核对 `<拼音>_<表情>.png` 在不在。 */
  onExpression?: (filename: string, line: number, speaker: string, expr: string) => void;
};

export function parseStory(files: { filename: string; markdown: string }[], options?: ParseOptions): Story {
  const days = files.map((file) => parseDay(file.markdown, file.filename, options));
  days.sort((a, b) => a.day - b.day);
  const seen = new Set<number>();
  for (const day of days) {
    if (seen.has(day.day)) throw new ScriptError("story", 0, `重复的第 ${day.day} 天`);
    seen.add(day.day);
  }
  const scenes = new Map<string, true>();
  for (const day of days) {
    for (const scene of day.scenes) scenes.set(`${day.day}:${scene.id}`, true);
  }
  for (const day of days) {
    for (const scene of day.scenes) {
      for (const jump of scene.jumps) {
        if (!scenes.has(`${jump.day}:${jump.scene}`)) {
          throw new ScriptError(`day-${String(day.day).padStart(2, "0")}.md`, 0, `去向不存在：第${jump.day}天${jump.scene}`);
        }
      }
    }
  }
  return { days };
}

export function parseDay(markdown: string, filename: string, options?: ParseOptions): Day {
  const lines = markdown.split(/\r?\n/);
  const day: Day = { day: 0, chapter: "", notes: [], fireworks: null, scenes: [] };
  let scene: Scene | null = null;
  const stack: Frame[] = [];
  let sawFire = false;

  function fail(line: number, message: string): never {
    throw new ScriptError(filename, line, message);
  }

  const currentScene = (line: number): Scene => {
    if (!scene) fail(line, "正文还没有场景");
    return scene;
  };

  const pushBlock = (line: number, block: Block) => {
    if (stack.length) fail(line, "块还没结束，不能写入场景");
    currentScene(line).blocks.push(block);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const raw = lines[index] ?? "";
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("```")) fail(lineNo, "未知标记：代码围栏");

    if (line.startsWith("##")) {
      if (stack.length) fail(lineNo, "上一个块没有用 >>> 关上");
      const header = line.match(/^##\s*场景：\s*(.+)$/);
      if (!header) fail(lineNo, `未知场景标题：${line}`);
      const id = header[1].trim();
      if (day.scenes.some((item) => item.id === id)) fail(lineNo, `场景重名：${id}`);
      scene = { id, condition: null, fast: false, jumps: [], blocks: [] };
      day.scenes.push(scene);
      continue;
    }

    const title = line.match(/^#\s*第\s*(\d+)\s*天\s*$/);
    if (line.startsWith("#")) {
      if (!title) fail(lineNo, `未知标题：${line}`);
      if (day.day) fail(lineNo, "一天里有两个标题");
      day.day = Number(title[1]);
      continue;
    }

    if (line === ">>>") {
      closeFrame(stack, scene, fail, lineNo);
      continue;
    }

    if (line.startsWith(">")) {
      const body = line.replace(/^>\s?/, "").trim();
      if (body.startsWith("记：")) {
        const input = [...stack].reverse().find((frame) => frame.kind === "input");
        if (!input || input.kind !== "input") fail(lineNo, "「记」要写在输入块里");
        input.note = body.slice("记：".length).trim();
        continue;
      }
      if (stack.length) fail(lineNo, `块里面不写策划行：${body}`);
      if (body.startsWith("章节：")) {
        day.chapter = body.slice("章节：".length).trim();
        continue;
      }
      if (body.startsWith("在场：")) {
        day.fireworks = parsePresent(body.slice("在场：".length).trim(), fail, lineNo);
        sawFire = true;
        continue;
      }
      if (body.startsWith("低于")) {
        if (!day.fireworks) fail(lineNo, "「低于」前面没有「在场」");
        day.fireworks.threshold = parseThreshold(body, fail, lineNo);
        continue;
      }
      if (body.startsWith("同分：")) {
        if (!day.fireworks) fail(lineNo, "「同分」前面没有「在场」");
        parseTie(body.slice("同分：".length).trim(), fail, lineNo);
        continue;
      }
      if (body.startsWith("效果：") || body.startsWith("登场效果另计：")) {
        const text = body.startsWith("效果：") ? body.slice("效果：".length) : body.slice("登场效果另计：".length);
        pushBlock(lineNo, { type: "effects", effects: safeEffects(text, filename, lineNo) });
        continue;
      }
      if (body.startsWith("快进")) {
        currentScene(lineNo).fast = true;
        continue;
      }
      (scene ? day.notes : day.notes).push(body);
      continue;
    }

    if (line.startsWith("<<<")) {
      const opened = line.match(/^<<<(\S+)\s*(.*)$/);
      if (!opened) fail(lineNo, `未知块：${line}`);
      const kind = opened[1];
      const id = opened[2].trim();
      if (!BLOCKS.has(kind)) fail(lineNo, `未知块：${kind}`);
      if (!id) fail(lineNo, `${kind}缺少名字`);
      const parent = stack[stack.length - 1];
      if (parent && !(parent.kind === "minigame" && kind === "选择")) {
        fail(lineNo, `${kind}不能套在${parent.kind}里面`);
      }
      if (!parent && !scene) fail(lineNo, "块还没有场景");
      if (kind === "替换") {
        stack.push({ kind: "replace", id, byGender: { 男: [], 女: [] }, current: null });
      } else if (kind === "选择") {
        stack.push({ kind: "choice", id, choiceType: "", options: [] });
      } else if (kind === "小游戏") {
        stack.push({ kind: "minigame", id, instructions: [], fail: null, choice: null });
      } else if (kind === "分支") {
        stack.push({ kind: "branch", id, arms: [] });
      } else {
        stack.push({ kind: "input", id, note: "" });
      }
      continue;
    }

    if (line.startsWith("条件：")) {
      if (stack.length) {
        const top = stack[stack.length - 1];
        if (top.kind !== "branch") fail(lineNo, "条件不能写在这个块里");
        top.arms.push({ condition: hold(parseCondition(line.slice("条件：".length).trim(), day, fail, lineNo)), items: [] });
        continue;
      }
      const here = currentScene(lineNo);
      if (here.condition) fail(lineNo, "一场只能有一个条件");
      if (here.blocks.length || here.jumps.length) fail(lineNo, "条件要写在正文前面");
      here.condition = hold(parseCondition(line.slice("条件：".length).trim(), day, fail, lineNo));
      continue;
    }

    if (line.startsWith("去向：")) {
      if (stack.length) fail(lineNo, "去向不能写在块里");
      const here = currentScene(lineNo);
      if (here.blocks.length) fail(lineNo, "去向和正文写在同一场");
      const jump = line.match(/^去向：第(\d+)天(.+)$/);
      if (!jump) fail(lineNo, `看不懂的去向：${line}`);
      const ref: JumpRef = { day: Number(jump[1]), scene: jump[2].trim() };
      if (!ref.scene) fail(lineNo, "去向缺少场景名");
      here.jumps.push(ref);
      continue;
    }

    const top = stack[stack.length - 1];
    if (!top) {
      const here = currentScene(lineNo);
      if (here.jumps.length) fail(lineNo, "去向和正文写在同一场");
      addLine(here, asLine(line, filename, lineNo, options));
      continue;
    }
    if (top.kind === "replace") {
      if (line === "恋爱" || line === "友情") fail(lineNo, "替换分段只认「女主」和「男主」");
      if (line === "女主" || line === "男主") {
        const gender: Gender = line === "男主" ? "男" : "女";
        if (top.current === gender || top.byGender[gender].length) fail(lineNo, `替换里「${line}」重复了`);
        top.current = gender;
        continue;
      }
      if (!top.current) fail(lineNo, "替换还没写女主或男主");
      top.byGender[top.current].push(asLine(line, filename, lineNo, options));
      continue;
    }
    if (top.kind === "choice") {
      if (line.startsWith("类型：")) {
        const choiceType = line.slice("类型：".length).trim();
        if (choiceType !== "日常" && choiceType !== "关键") fail(lineNo, `未知选择类型：${choiceType}`);
        if (top.choiceType) fail(lineNo, "选择类型重复了");
        top.choiceType = choiceType;
        continue;
      }
      if (line.startsWith("选项：")) {
        top.options.push(parseOption(line, filename, lineNo));
        continue;
      }
      fail(lineNo, `选择里有看不懂的行：${line}`);
    }
    if (top.kind === "minigame") {
      if (line.startsWith("失败：")) {
        if (top.fail) fail(lineNo, "失败句重复了");
        top.fail = line.slice("失败：".length).trim();
        if (!top.fail) fail(lineNo, "失败句是空的");
        continue;
      }
      if (line.startsWith("类型：") || line.startsWith("选项：") || line.startsWith("条件：")) {
        fail(lineNo, `小游戏说明里出现了标记：${line}`);
      }
      top.instructions.push(line);
      continue;
    }
    if (top.kind === "branch") {
      const arm = top.arms[top.arms.length - 1];
      if (!arm) fail(lineNo, "分支还没有条件");
      arm.items.push(asLine(line, filename, lineNo, options));
      continue;
    }
    fail(lineNo, `输入块里不写正文：${line}`);
  }

  if (stack.length) fail(lines.length, "文件结束时还有块没关上");
  if (!day.day) fail(1, "缺少「第 N 天」");
  if (!day.chapter) fail(1, "缺少章节");
  const fileDay = filename.match(/^day-(\d+)\.md$/);
  if (fileDay && Number(fileDay[1]) !== day.day) fail(1, `文件名和第 ${day.day} 天对不上`);
  if (sawFire && (!day.fireworks || day.fireworks.threshold <= 0)) {
    fail(1, "烟花比较写了一半");
  }
  if (!day.scenes.length) fail(1, "这一天没有场景");
  for (const item of day.scenes) {
    if (!item.blocks.length && !item.jumps.length) fail(1, `场景是空的：${item.id}`);
  }
  bindSeen(day, filename);
  return day;
}

function closeFrame(stack: Frame[], scene: Scene | null, fail: (line: number, message: string) => never, lineNo: number) {
  const frame = stack.pop();
  if (!frame || !scene) fail(lineNo, "没有需要关上的块");
  if (frame.kind === "choice") {
    if (!frame.choiceType) fail(lineNo, `选择「${frame.id}」缺少类型`);
    if (!frame.options.length) fail(lineNo, `选择「${frame.id}」没有选项`);
    const block: ChoiceBlock = {
      type: "choice",
      id: frame.id,
      choiceType: frame.choiceType,
      options: frame.options,
    };
    const parent = stack[stack.length - 1];
    if (parent?.kind === "minigame") {
      if (parent.choice) fail(lineNo, "小游戏里只能有一组选择");
      parent.choice = block;
      return;
    }
    if (stack.length) fail(lineNo, "选择关在了别的块里");
    scene.blocks.push(block);
    return;
  }
  if (stack.length) fail(lineNo, "块套叠关不上");
  if (frame.kind === "replace") {
    if (!frame.byGender.男.length || !frame.byGender.女.length) fail(lineNo, `替换「${frame.id}」要同时有女主和男主`);
    scene.blocks.push({ type: "replace", id: frame.id, byGender: frame.byGender });
    return;
  }
  if (frame.kind === "minigame") {
    if (!frame.choice) fail(lineNo, `小游戏「${frame.id}」没有选择`);
    scene.blocks.push({
      type: "minigame",
      id: frame.id,
      instructions: frame.instructions,
      fail: frame.fail,
      choice: frame.choice,
      normalIndex: normalIndex(frame.choice, fail, lineNo),
    });
    return;
  }
  if (frame.kind === "branch") {
    if (!frame.arms.length) fail(lineNo, `分支「${frame.id}」没有条件`);
    scene.blocks.push({ type: "branch", id: frame.id, arms: frame.arms });
    return;
  }
  scene.blocks.push({ type: "input", id: frame.id, note: frame.note });
}

function normalIndex(choice: ChoiceBlock, fail: (line: number, message: string) => never, lineNo: number): number {
  const marked = choice.options.findIndex((option) =>
    option.effects.some((effect) => effect.op === "set" && effect.key === "表现" && effect.value === "普通"),
  );
  if (marked >= 0) return marked;
  const playable = choice.options.findIndex((option) => !option.effects.some((effect) => effect.op === "retry"));
  if (playable >= 0) return playable;
  fail(lineNo, "小游戏没有可以按普通表现结算的选项");
}

function addLine(scene: Scene, line: Line) {
  const last = scene.blocks[scene.blocks.length - 1];
  if (last?.type === "lines") last.items.push(line);
  else scene.blocks.push({ type: "lines", items: [line] });
}

function asLine(text: string, filename: string, lineNo: number, options?: ParseOptions): Line {
  return classifyBodyLine(text, filename, lineNo, options);
}

function classifyBodyLine(text: string, filename: string, lineNo: number, options?: ParseOptions): Line {
  if (text.startsWith("「")) return { type: "letter", text };
  const dialogue = text.match(/^([\u4e00-\u9fff]{1,4})：(.+)$/);
  if (!dialogue) return { type: "narration", text };
  const speaker = dialogue[1];
  if (["条件", "选项", "类型", "失败", "效果", "标记", "去向", "占额", "章节"].includes(speaker)) {
    throw new ScriptError(filename, lineNo, `这行看起来像标记：${text}`);
  }
  const spoken = splitExpression(dialogue[2], filename, lineNo, speaker, options);
  return { type: "dialogue", speaker, text: spoken.text, expr: spoken.expr };
}

/** 全角冒号紧后面的半角方括号是表情。字面括号用全角［］。 `{主角}` 留到播放时再换。 */
function splitExpression(
  raw: string,
  filename: string,
  lineNo: number,
  speaker: string,
  options?: ParseOptions,
): { text: string; expr: string | null } {
  const text = raw.trim();
  if (!text.startsWith("[")) return { text, expr: null };
  const matched = text.match(/^\[([^\]]*)\]([\s\S]*)$/);
  if (!matched || !/^[a-z0-9_]+$/.test(matched[1])) {
    const shown = matched ? matched[1] : text;
    throw new ScriptError(
      filename,
      lineNo,
      `「${speaker}」的 [${shown}] 不是已有立绘。台词若要以方括号开头，请改用全角［］。`,
    );
  }
  options?.onExpression?.(filename, lineNo, speaker, matched[1]);
  return { text: matched[2], expr: matched[1] };
}

function parseOption(line: string, filename: string, lineNo: number): ChoiceOption {
  const matched = line.match(/^选项：([\s\S]+?)\s*\|\s*效果：([\s\S]+)$/);
  if (!matched) throw new ScriptError(filename, lineNo, `看不懂的选项：${line}`);
  const label = matched[1].trim();
  if (!label) throw new ScriptError(filename, lineNo, "选项标签是空的");
  return { label, effects: safeEffects(matched[2].trim(), filename, lineNo) };
}

function safeEffects(text: string, filename: string, lineNo: number) {
  try {
    return parseEffectText(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ScriptError(filename, lineNo, message);
  }
}

function parsePresent(
  body: string,
  fail: (line: number, message: string) => never,
  lineNo: number,
): Fireworks {
  const matched = body.match(/^女主为(.+)；男主为(.+)。$/);
  if (!matched) fail(lineNo, `看不懂的在场名单：${body}`);
  return {
    threshold: 0,
    tieBreak: ["recentFree", "freeCount", "laterDebut"],
    present: { 女: parsePeople(matched[1], fail, lineNo), 男: parsePeople(matched[2], fail, lineNo) },
  };
}

function parsePeople(body: string, fail: (line: number, message: string) => never, lineNo: number) {
  return body.split("、").map((part) => {
    const matched = part.trim().match(/^([\u4e00-\u9fff]{2,4})（第\s*(\d+)\s*天）$/);
    if (!matched) fail(lineNo, `看不懂的在场人物：${part}`);
    return { name: matched[1], debutDay: Number(matched[2]) };
  });
}

function parseThreshold(body: string, fail: (line: number, message: string) => never, lineNo: number): number {
  const matched = body.match(/^低于\s*(\d+)\s*的不进这场。都低于\s*(\d+)，则秀姨和拿铁。$/);
  if (!matched || matched[1] !== matched[2]) fail(lineNo, `看不懂的低于规则：${body}`);
  return Number(matched[1]);
}

function parseTie(body: string, fail: (line: number, message: string) => never, lineNo: number) {
  if (body !== "先最近自由；仍同分，比自由次数；仍同分，登场更晚的一位。同第 32 天。") {
    fail(lineNo, `同分规则和播放器不一致：${body}`);
  }
}

type SeenWord = { op: "seenWord"; on: boolean; line: number };
type UnresolvedCond = { op: "all"; args: UnresolvedCond[] } | SeenWord | Exclude<Cond, { op: "all" }>;

function hold(cond: UnresolvedCond): Cond {
  return cond as Cond;
}

function parseCondition(
  raw: string,
  day: Day,
  fail: (line: number, message: string) => never,
  lineNo: number,
): UnresolvedCond {
  const winner = raw.match(
    /^(女主|男主)且([\u4e00-\u9fff]{2,4})恋≥(\d+)(?:且(选过\2))?且\2恋为在场最高；([\s\S]+)$/,
  );
  if (raw.includes("恋为在场最高") && !winner) fail(lineNo, `看不懂的最高比较：${raw}`);
  if (winner) {
    if (!day.fireworks || day.fireworks.threshold <= 0) fail(lineNo, "最高比较前面没有完整的在场规则");
    const gender: Gender = winner[1] === "男主" ? "男" : "女";
    const who = winner[2];
    const threshold = Number(winner[3]);
    const picked = winner[4];
    if (threshold !== day.fireworks.threshold) fail(lineNo, `恋≥${threshold}和低于 ${day.fireworks.threshold} 不一致`);
    const present = day.fireworks.present[gender];
    if (!present.some((person) => person.name === who)) fail(lineNo, `${who}不在这一性别的在场名单里`);
    if (who === "沈若" && picked !== "选过沈若") fail(lineNo, "沈若的条件要写且选过沈若");
    if (picked && who !== "沈若") fail(lineNo, `只有沈若要写选过：${raw}`);
    const tailText = winner[5];
    const tail = `并列时先最近自由=${who}，否则自由次数更多，否则`;
    if (!tailText.startsWith(tail)) fail(lineNo, `看不懂的同分写法：${tailText}`);
    const ending = tailText.slice(tail.length);
    const endingOk =
      /^不胜（[^）]*）$/.test(ending) ||
      /^登场更晚由[他她]胜出$/.test(ending) ||
      /^只胜[\u4e00-\u9fff]{2,4}（[^）]*）$/.test(ending);
    if (!endingOk) fail(lineNo, `看不懂的同分收束：${ending}`);
    const args: UnresolvedCond[] = [
      { op: "gender", gender },
      { op: "winner", who, threshold, present: present.map((person) => ({ ...person })) },
    ];
    if (picked) args.push({ op: "flag", key: picked, on: true });
    return { op: "all", args };
  }
  const below = raw.match(/^当前性别在场可攻略角色的恋爱都低于(\d+)$/);
  if (below) {
    if (!day.fireworks || day.fireworks.threshold <= 0) fail(lineNo, "低于比较前面没有完整的在场规则");
    if (Number(below[1]) !== day.fireworks.threshold) fail(lineNo, "低于门槛和在场规则不一致");
    return {
      op: "belowAll",
      threshold: day.fireworks.threshold,
      present: {
        男: day.fireworks.present.男.map((person) => ({ ...person })),
        女: day.fireworks.present.女.map((person) => ({ ...person })),
      },
    };
  }
  const atoms = raw.split("且").map((item) => item.trim()).filter(Boolean);
  if (!atoms.length) fail(lineNo, "条件是空的");
  const args = atoms.map((atom) => parseAtom(atom, fail, lineNo));
  return args.length === 1 ? args[0] : { op: "all", args };
}

function parseAtom(atom: string, fail: (line: number, message: string) => never, lineNo: number): UnresolvedCond {
  if (atom === "女主" || atom === "男主") return { op: "gender", gender: atom === "男主" ? "男" : "女" };
  if (atom === "未看过" || atom === "已看过") return { op: "seenWord", on: atom === "已看过", line: lineNo };
  const seen = atom.match(/^([\u4e00-\u9fff]{1,12})(未看过|已看过)$/);
  if (seen) {
    const key = seen[1].startsWith("看过") ? seen[1] : `看过${seen[1]}`;
    return { op: "flag", key, on: seen[2] === "已看过" };
  }
  const eq = atom.match(/^([\u4e00-\u9fffA-Za-z0-9]{1,12})=([^\s且；，。]+)$/);
  if (eq) return { op: "eq", key: eq[1], value: eq[2] };
  const reputation = atom.match(/^口碑(≥|<)(\d+)$/);
  if (reputation) {
    return { op: "reputation", cmp: reputation[1] === "≥" ? ">=" : "<", value: Number(reputation[2]) };
  }
  const stat = atom.match(/^([\u4e00-\u9fff]{2,4})(恋|友)(≥|<)(\d+)$/);
  if (stat) {
    return {
      op: "stat",
      who: stat[1],
      stat: stat[2] === "恋" ? "romance" : "friendship",
      cmp: stat[3] === "≥" ? ">=" : "<",
      value: Number(stat[4]),
    };
  }
  fail(lineNo, `看不懂的条件：${atom}`);
}

function bindSeen(day: Day, filename: string) {
  const byBase = new Map<string, string>();
  for (const scene of day.scenes) {
    const flags = seenFlags(scene);
    if (flags.length > 1) {
      throw new ScriptError(filename, 0, `场景「${scene.id}」有多个看过标记：${flags.join("、")}`);
    }
    if (flags.length === 1) {
      const base = scene.id.replace(/已看$/, "");
      const previous = byBase.get(base);
      if (previous && previous !== flags[0]) {
        throw new ScriptError(filename, 0, `场景「${base}」的看过标记不一致`);
      }
      byBase.set(base, flags[0]);
    }
  }
  for (const scene of day.scenes) {
    const key = byBase.get(scene.id.replace(/已看$/, ""));
    scene.condition = bindCond(scene.condition, key, filename, scene.id);
    for (const block of scene.blocks) {
      if (block.type !== "branch") continue;
      for (const arm of block.arms) arm.condition = bindCond(arm.condition, key, filename, scene.id);
    }
  }
}

function bindCond(cond: Cond | null, key: string | undefined, filename: string, sceneId: string): Cond | null {
  if (!cond) return null;
  const unresolved = cond as UnresolvedCond;
  if (unresolved.op === "seenWord") {
    const word = unresolved.on ? "已看过" : "未看过";
    const written = unresolved.on ? "是" : "否";
    if (!key) {
      throw new ScriptError(
        filename,
        unresolved.line,
        `「${word}」对不上场景「${sceneId}」的看过标记。请改写成明确条件，例如「看过修网=${written}」。`,
      );
    }
    return { op: "flag", key, on: unresolved.on };
  }
  if (unresolved.op === "all") {
    return {
      op: "all",
      args: unresolved.args.map((arg) => {
        const bound = bindCond(hold(arg), key, filename, sceneId);
        if (!bound) throw new ScriptError(filename, 0, `场景「${sceneId}」的条件是空的`);
        return bound;
      }),
    };
  }
  return unresolved;
}

function seenFlags(scene: Scene): string[] {
  const found = new Set<string>();
  const take = (effects: { op: string; key?: string }[]) => {
    for (const effect of effects) {
      if ((effect.op === "flag" || effect.op === "set") && effect.key?.startsWith("看过")) found.add(effect.key);
    }
  };
  for (const block of scene.blocks) {
    if (block.type === "effects") take(block.effects);
    if (block.type === "choice") for (const option of block.options) take(option.effects);
    if (block.type === "minigame") for (const option of block.choice.options) take(option.effects);
  }
  return [...found];
}
