/**
 * 一条周目的字数，和口碑 / 锁定的随机模拟。
 * 字数只算玩家看见的正文：对白和叙述、选中的选项标签、小游戏说明和选中的那一项。
 * 空白不计。`{主角}` 按两字名字「阿海」计。
 *
 * 用法：npx tsx scripts/route-report.ts
 */
import fs from "node:fs";
import path from "node:path";
import initial from "../src/data/initial.json";
import presentation from "../src/data/presentation.json";
import schedule from "../src/data/schedule.json";
import { parseStory } from "../src/engine/parse";
import { Player, type View } from "../src/engine/player";
import { createState, readStat } from "../src/engine/state";
import type { GameState } from "../src/engine/types";

const scriptDir = path.resolve(import.meta.dirname, "../../03-script");
const files = fs
  .readdirSync(scriptDir)
  .filter((name) => /^day-\d+\.md$/.test(name))
  .sort()
  .map((filename) => ({ filename, markdown: fs.readFileSync(path.join(scriptDir, filename), "utf8") }));
const story = parseStory(files);
const cues: Record<string, string> = {};
for (const [key, value] of Object.entries(presentation)) {
  if ("shift" in value && value.shift) cues[key] = value.shift.includes;
}

type ChoiceView = Extract<View, { kind: "choice" }>;
type Picker = (view: ChoiceView, state: GameState) => number;

function visible(text: string): number {
  return [...text.replace(/\s+/g, "")].length;
}

function play(choose: Picker): {
  counts: Record<string, number>;
  lock: string;
  reputation: number;
  romance: Record<string, number>;
  ending: string;
  recentFree: string | null;
} {
  const player = Player.start(story, createState({ ...initial.vars }), schedule.totalDays, cues);
  const counts: Record<string, number> = {};
  const add = (chapter: string, text: string) => {
    counts[chapter] = (counts[chapter] ?? 0) + visible(text);
  };
  for (let guard = 0; guard < 40000; guard += 1) {
    const view = player.view();
    if (view.kind === "end") break;
    if (view.kind === "day") {
      player.advance();
      continue;
    }
    if (view.kind === "line") {
      add(view.chapter, view.text);
      player.advance();
      continue;
    }
    if (view.kind === "input") {
      player.submitName("阿海");
      continue;
    }
    if (view.kind === "minigame") {
      add(view.chapter, view.instructions.join(""));
      add(view.chapter, view.options[view.normalIndex]?.label ?? "");
      player.skipMinigame();
      continue;
    }
    const index = choose(view, player.state);
    add(view.chapter, view.options[index]?.label ?? "");
    player.choose(index);
  }
  if (player.view().kind !== "end") throw new Error("没有在步数内结束");
  const ending =
    player.visited.map((visit) => visit.scene).find((scene) => scene.startsWith("好") || scene.startsWith("普通") || scene.startsWith("不足") || scene === "通用") ??
    "";
  const romance: Record<string, number> = {};
  for (const name of ["夏栀", "唐棠", "叶帆", "程鹭", "沈若", "苏念", "陆屿", "许之言", "宋知远", "江叙白"]) {
    romance[name] = readStat(player.state, name, "romance");
  }
  return {
    counts,
    lock: player.state.vars["锁定"] ?? "",
    reputation: player.state.reputation,
    romance,
    ending,
    recentFree: player.state.recentFree,
  };
}

function option(view: ChoiceView, labelPart: string): number {
  const index = view.options.findIndex((item) => item.label.includes(labelPart));
  if (index < 0) throw new Error(`没有选项「${labelPart}」于 ${view.id}`);
  return index;
}

function prefer(view: ChoiceView, parts: string[]): number | null {
  for (const part of parts) {
    const index = view.options.findIndex((item) => item.label.includes(part));
    if (index >= 0) return index;
  }
  return null;
}

const stay = (view: ChoiceView) => prefer(view, ["留在店里"]) ?? 0;

/** 女主陆屿：第一章脚本路径，自由行动优先陆屿。 */
const femaleLuyu: Picker = (view) => {
  if (view.id === "性别") return option(view, "女生");
  if (view.id === "推荐饮品") return option(view, "橘子汽水");
  if (view.id === "傍晚") return option(view, "码头");
  if (view.id === "码头") return option(view, "修网");
  if (view.id === "留谁") return option(view, "陆屿");
  if (view.id === "邀谁") return option(view, "陆屿");
  if (view.id === "回复") return option(view, "回她");
  if (view.id === "猜谜") return option(view, "旧咖啡壶");
  if (view.id === "台阶") return option(view, "坐下");
  if (view.id === "复学") return option(view, "读完");
  if (view.id === "苏念饮品") return option(view, "水");
  return prefer(view, ["天亮前送咖啡", "看看那封录取", "去把书读完", "摆到散席", "去敲门", "照常接待", "把纸条贴出来", "从后门送他", "把话说开"]) ?? stay(view);
};

/** 男主夏栀。 */
const maleXia: Picker = (view) => {
  if (view.id === "性别") return option(view, "男生");
  if (view.id === "推荐饮品") return option(view, "淡味热咖");
  if (view.id === "傍晚") return option(view, "灯塔");
  if (view.id === "留谁") return option(view, "夏栀");
  if (view.id === "邀谁") return option(view, "夏栀");
  if (view.id === "回复") return 0;
  if (view.id === "猜谜") return option(view, "干叶");
  if (view.id === "读研") return option(view, "填上");
  return prefer(view, ["看她改作业", "去灯塔看看", "填上，灯也守", "摆到散席", "去敲门", "照常接待", "把纸条贴出来", "从后门送他", "把话说开"]) ?? stay(view);
};

const maleFirst: Picker = () => 0;

function band(rep: number): "保住" | "改建" | "收购" {
  if (rep >= 70) return "保住";
  if (rep >= 40) return "改建";
  return "收购";
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPick(seed: number, gender: "男" | "女"): Picker {
  const rand = mulberry32(seed);
  return (view) => {
    if (view.id === "性别") return option(view, gender === "男" ? "男生" : "女生");
    return Math.floor(rand() * view.options.length);
  };
}

function directed(mode: "penalties" | "bonuses"): Picker {
  return (view) => {
    if (view.id === "性别") return option(view, "男生");
    if (mode === "penalties") {
      const hit = prefer(view, ["早早收摊", "再看看", "提前打烊", "收进抽屉", "走前门", "当没听见"]);
      if (hit !== null) return hit;
    } else {
      const hit = prefer(view, ["摆到散席", "去敲门", "照常接待", "贴出来", "后门", "把话说开"]);
      if (hit !== null) return hit;
    }
    return 0;
  };
}

function summarize(title: string, rows: ReturnType<typeof play>[]) {
  const bands = { 保住: 0, 改建: 0, 收购: 0 };
  const locks: Record<string, number> = {};
  let generic = 0;
  for (const row of rows) {
    bands[band(row.reputation)] += 1;
    locks[row.lock || "（空）"] = (locks[row.lock || "（空）"] ?? 0) + 1;
    if (row.lock === "无") generic += 1;
  }
  const pct = ((generic / rows.length) * 100).toFixed(1);
  console.log(`\n${title} n=${rows.length} 通用=${generic} (${pct}%) 口碑 ${JSON.stringify(bands)}`);
  console.log("  锁定", JSON.stringify(locks));
}

const positive = ["摆到散席", "去敲门", "照常接待", "把纸条贴出来", "从后门送他", "把话说开"];

const femaleXuyan: Picker = (view) => {
  if (view.id === "性别") return option(view, "女生");
  if (view.id === "推荐饮品") return option(view, "手冲");
  if (view.id === "傍晚") return option(view, "礁石滩");
  if (view.id === "留谁") return option(view, "许之言");
  if (view.id === "邀谁") return option(view, "许之言");
  if (view.id === "回复") return 0;
  if (view.id === "猜谜") return option(view, "旧咖啡壶");
  if (view.id === "台阶") return option(view, "坐下");
  if (view.id === "面对") return option(view, "回城");
  return prefer(view, ["等他三点来", "去卫生所坐坐", "送他去码头", ...positive]) ?? stay(view);
};

const femaleSong: Picker = (view) => {
  if (view.id === "性别") return option(view, "女生");
  if (view.id === "推荐饮品") return option(view, "手冲");
  if (view.id === "傍晚") return option(view, "礁石滩");
  if (view.id === "留谁") return option(view, "夏栀");
  if (view.id === "邀谁") return option(view, "叶帆");
  if (view.id === "回复") return 0;
  if (view.id === "猜谜") return option(view, "干叶");
  if (view.id === "赞助") return option(view, "靠自己");
  return prefer(view, ["去海边烧烤", "去上体验课", "去岸边看浪", ...positive]) ?? stay(view);
};

const femaleJiang: Picker = (view) => {
  if (view.id === "性别") return option(view, "女生");
  if (view.id === "推荐饮品") return option(view, "手冲");
  if (view.id === "江饮") return option(view, "手冲");
  if (view.id === "傍晚") return option(view, "礁石滩");
  if (view.id === "留谁") return option(view, "夏栀");
  if (view.id === "邀谁") return option(view, "叶帆");
  if (view.id === "回复") return 0;
  if (view.id === "猜谜") return option(view, "干叶");
  if (view.id === "画布") return option(view, "现在想画");
  return prefer(view, ["上楼看看画", "再上一次阁楼", "上阁楼看画", ...positive]) ?? stay(view);
};

const maleTang: Picker = (view) => {
  if (view.id === "性别") return option(view, "男生");
  if (view.id === "推荐饮品") return option(view, "手冲");
  if (view.id === "码头") return prefer(view, ["练刀"]) ?? 0;
  if (view.id === "留谁") return option(view, "唐棠");
  if (view.id === "邀谁") return option(view, "唐棠");
  if (view.id === "苏念饮品") return option(view, "水");
  if (view.id === "联营") return option(view, "联营");
  return prefer(view, ["借她后厨", "去唐记救场", "去广场的席", "看唐棠练刀", ...positive]) ?? stay(view);
};

const maleYe: Picker = (view) => {
  if (view.id === "性别") return option(view, "男生");
  if (view.id === "推荐饮品") return option(view, "手冲");
  if (view.id === "傍晚") return option(view, "礁石滩");
  if (view.id === "留谁") return option(view, "陆屿");
  if (view.id === "邀谁") return option(view, "叶帆");
  if (view.id === "苏念饮品") return option(view, "水");
  if (view.id === "旧信") return option(view, "送完");
  return prefer(view, ["去送一封旧信", "送叶帆一程", "帮她对地址", ...positive]) ?? stay(view);
};

const maleCheng: Picker = (view) => {
  if (view.id === "性别") return option(view, "男生");
  if (view.id === "推荐饮品") return option(view, "手冲");
  if (view.id === "傍晚") return option(view, "礁石滩");
  if (view.id === "留谁") return option(view, "陆屿");
  if (view.id === "邀谁") return option(view, "陆屿");
  if (view.id === "苏念饮品") return option(view, "水");
  if (view.id === "研究站") return option(view, "留下");
  return prefer(view, ["去看那块珊瑚", "给她送杯浓缩", "跟她去浮潜", ...positive]) ?? stay(view);
};

const maleShen: Picker = (view) => {
  if (view.id === "性别") return option(view, "男生");
  if (view.id === "推荐饮品") return option(view, "手冲");
  if (view.id === "傍晚") return option(view, "礁石滩");
  if (view.id === "留谁") return option(view, "陆屿");
  if (view.id === "邀谁") return option(view, "陆屿");
  if (view.id === "回复") return option(view, "回她");
  if (view.id === "苏念饮品") return option(view, "水");
  if (view.id === "辞职") return option(view, "辞职");
  return prefer(view, ["送她去卫生所", "去码头看日出", "去听那个期限", ...positive]) ?? stay(view);
};

const maleSu: Picker = (view) => {
  if (view.id === "性别") return option(view, "男生");
  if (view.id === "推荐饮品") return option(view, "手冲");
  if (view.id === "傍晚") return option(view, "礁石滩");
  if (view.id === "留谁") return option(view, "陆屿");
  if (view.id === "邀谁") return option(view, "陆屿");
  if (view.id === "苏念饮品") return option(view, "可可");
  if (view.id === "曲目") return option(view, "现在的歌");
  return prefer(view, ["留在店里听她", "去浪花里", "去礁石滩听琴", ...positive]) ?? stay(view);
};

const femaleGeneric: Picker = (view) => {
  if (view.id === "性别") return option(view, "女生");
  if (view.id === "推荐饮品") return option(view, "手冲");
  if (view.id === "傍晚") return option(view, "礁石滩");
  if (view.id === "留谁") return option(view, "陆屿");
  if (view.id === "邀谁") return option(view, "叶帆");
  if (view.id === "回复") return option(view, "扣下");
  return stay(view);
};

const routes: { name: string; pick: Picker }[] = [
  { name: "女主·陆屿", pick: femaleLuyu },
  { name: "女主·许之言", pick: femaleXuyan },
  { name: "女主·宋知远", pick: femaleSong },
  { name: "女主·江叙白", pick: femaleJiang },
  { name: "男主·夏栀", pick: maleXia },
  { name: "男主·唐棠", pick: maleTang },
  { name: "男主·叶帆", pick: maleYe },
  { name: "男主·程鹭", pick: maleCheng },
  { name: "男主·沈若", pick: maleShen },
  { name: "男主·苏念", pick: maleSu },
  { name: "男主·通用", pick: maleFirst },
  { name: "女主·通用", pick: femaleGeneric },
];

console.log("—— 字数（播放器）——");
for (const route of routes) {
  const row = play(route.pick);
  console.log(
    route.name,
    "锁定",
    row.lock,
    "结局",
    row.ending,
    "口碑",
    row.reputation,
    "恋",
    JSON.stringify(row.romance),
    "字",
    JSON.stringify(row.counts),
  );
}

const first = play(maleFirst);
console.log("\n男主全选第一项", "锁定", first.lock, "口碑", first.reputation, "恋", JSON.stringify(first.romance), "结局", first.ending);

const pen = play(directed("penalties"));
const bon = play(directed("bonuses"));
console.log("全扣分", pen.reputation, band(pen.reputation), "锁定", pen.lock);
console.log("全加分（其余第一项）", bon.reputation, band(bon.reputation), "锁定", bon.lock);

const maleRows = Array.from({ length: 300 }, (_, i) => play(randomPick(1000 + i, "男")));
const femaleRows = Array.from({ length: 300 }, (_, i) => play(randomPick(5000 + i, "女")));
summarize("男主随机", maleRows);
summarize("女主随机", femaleRows);
