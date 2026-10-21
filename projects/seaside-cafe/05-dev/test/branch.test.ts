import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import initial from "../src/data/initial.json";
import schedule from "../src/data/schedule.json";
import presentation from "../src/data/presentation.json";
import { fireworksWinner } from "../src/engine/conditions";
import { parseStory } from "../src/engine/parse";
import { Player, type View } from "../src/engine/player";
import { createState, readStat } from "../src/engine/state";
import type { GameState } from "../src/engine/types";

const scriptDir = path.resolve(process.cwd(), "../03-script");
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

function play(choose: (view: Extract<View, { kind: "choice" }>, state: GameState, player: Player) => number): Player {
  const player = Player.start(story, createState(initial.vars), schedule.totalDays, cues);
  for (let guard = 0; guard < 20000; guard += 1) {
    const view = player.view();
    if (view.kind === "end") return player;
    if (view.kind === "day" || view.kind === "line") {
      player.advance();
      continue;
    }
    if (view.kind === "input") {
      player.submitName("阿海");
      continue;
    }
    if (view.kind === "minigame") {
      player.skipMinigame();
      continue;
    }
    if (view.kind === "choice") player.choose(choose(view, player.state, player));
  }
  throw new Error("这一周目没有走到结尾");
}

function option(view: Extract<View, { kind: "choice" }>, text: string): number {
  const index = view.options.findIndex((item) => item.label.includes(text));
  if (index < 0) throw new Error(`没有选项：${text} / ${view.options.map((item) => item.label).join("、")}`);
  return index;
}

describe("分支与好感", () => {
  it("女主推荐汽水、看修网，烟花是陆屿，许之言仍有登场好感", () => {
    const player = play((view) => {
      if (view.id === "性别") return option(view, "女生");
      if (view.id === "推荐饮品") return option(view, "橘子汽水");
      if (view.id === "傍晚") return option(view, "码头");
      if (view.id === "码头") return option(view, "修网");
      if (view.id === "留谁") return option(view, "陆屿");
      if (view.id === "邀谁") return option(view, "陆屿");
      if (view.id === "回复") return option(view, "回她");
      if (view.id === "猜谜") return option(view, "旧咖啡壶");
      if (view.id === "台阶") return option(view, "坐下");
      return 0;
    });
    expect(player.view().kind).toBe("end");
    expect(readStat(player.state, "陆屿", "romance")).toBeGreaterThanOrEqual(20);
    expect(readStat(player.state, "许之言", "romance")).toBe(8);
    expect(readStat(player.state, "沈若", "romance")).toBe(0);
    expect(readStat(player.state, "沈若", "friendship")).toBeGreaterThan(0);
    expect(player.state.gender).toBe("女");
    expect(player.visited.some((visit) => visit.scene === "烟花陆屿")).toBe(true);
    expect(player.visited.some((visit) => visit.scene === "烟花很低")).toBe(false);
    expect(player.visited.some((visit) => visit.scene === "来电")).toBe(true);
  });

  it("男主走淡咖和灯塔，烟花是夏栀，恋爱不加在陆屿身上", () => {
    const player = play((view) => {
      if (view.id === "性别") return option(view, "男生");
      if (view.id === "推荐饮品") return option(view, "淡味热咖");
      if (view.id === "傍晚") return option(view, "灯塔");
      if (view.id === "留谁") return option(view, "夏栀");
      if (view.id === "邀谁") return option(view, "夏栀");
      if (view.id === "回复") return 0;
      if (view.id === "猜谜") return option(view, "干叶");
      return 0;
    });
    expect(player.view().kind).toBe("end");
    expect(readStat(player.state, "夏栀", "romance")).toBeGreaterThanOrEqual(20);
    expect(readStat(player.state, "陆屿", "romance")).toBe(0);
    expect(readStat(player.state, "陆屿", "friendship")).toBeGreaterThan(0);
    expect(player.visited.some((visit) => visit.scene === "烟花夏栀")).toBe(true);
  });

  it("好感都不到 20 时烟花场是秀姨和拿铁", () => {
    const player = play((view) => {
      if (view.id === "性别") return option(view, "男生");
      if (view.id === "推荐饮品") return option(view, "手冲");
      if (view.id === "傍晚") return option(view, "礁石滩");
      if (view.id === "留谁") return option(view, "陆屿");
      if (view.id === "邀谁") return option(view, "陆屿");
      if (view.id === "猜谜") return option(view, "旧咖啡壶");
      return 0;
    });
    expect(player.visited.some((visit) => visit.scene === "烟花很低")).toBe(true);
    expect(player.visited.some((visit) => visit.scene.startsWith("烟花") && visit.scene !== "烟花很低")).toBe(false);
    for (const name of ["夏栀", "唐棠", "叶帆", "陆屿", "许之言"]) {
      expect(readStat(player.state, name, "romance")).toBeLessThan(20);
    }
  });

  it("第 10 天去卫生所会接上第 12 天的泡面，之后只剩空台阶", () => {
    const player = play((view, _state, current) => {
      if (view.id === "性别") return option(view, "女生");
      if (view.id === "傍晚" && current.pos.dayIndex === 9) return option(view, "卫生所");
      if (view.id === "傍晚" && current.pos.dayIndex === 11) return option(view, "卫生所");
      if (view.id === "傍晚") return option(view, "礁石滩");
      if (view.id === "台阶") return option(view, "坐下");
      if (view.id === "猜谜") return option(view, "撕掉");
      if (view.id === "推荐饮品") return 0;
      if (view.id === "留谁" || view.id === "邀谁" || view.id === "回复" || view.id === "码头") return 0;
      return 0;
    });
    const noodles = player.visited.filter((visit) => visit.scene === "泡面");
    expect(noodles).toEqual([{ calendarDay: 10, sourceDay: 12, scene: "泡面" }]);
    expect(player.visited.some((visit) => visit.calendarDay === 12 && visit.scene === "卫生所已看")).toBe(true);
    expect(player.state.vars["看过泡面"]).toBe("是");
    expect(player.state.recentFree).toBe("许之言");
  });

  it("看过修网之后再去，只剩已看过的码头", () => {
    const player = play((view, _state, current) => {
      if (view.id === "性别") return option(view, "女生");
      if (view.id === "傍晚" && (current.pos.dayIndex === 5 || current.pos.dayIndex === 6)) return option(view, "码头");
      if (view.id === "码头") return option(view, "修网");
      if (view.id === "傍晚") return option(view, "礁石滩");
      return 0;
    });
    expect(player.visited.some((visit) => visit.calendarDay === 6 && visit.scene === "修网")).toBe(true);
    expect(player.visited.some((visit) => visit.calendarDay === 7 && visit.scene === "修网已看")).toBe(true);
    expect(player.visited.some((visit) => visit.calendarDay === 7 && visit.scene === "修网")).toBe(false);
  });

  it("猜谜选撕掉的页会停在原处", () => {
    const player = Player.start(story, createState(initial.vars), schedule.totalDays);
    const seen = new Set<string>();
    for (let guard = 0; guard < 20000; guard += 1) {
      const view = player.view();
      if (view.kind === "end") break;
      if (view.kind === "day" || view.kind === "line") {
        player.advance();
        continue;
      }
      if (view.kind === "input") {
        player.submitName("阿海");
        continue;
      }
      if (view.kind === "minigame" && view.id === "配方猜谜") {
        player.choose(view.options.findIndex((item) => item.label.includes("撕掉")));
        expect(player.notice).toContain("那一页不在");
        expect(player.view().kind).toBe("minigame");
        player.skipMinigame();
        seen.add("retried");
        continue;
      }
      if (view.kind === "minigame") {
        player.skipMinigame();
        continue;
      }
      player.choose(view.id === "性别" ? 0 : 0);
    }
    expect(seen.has("retried")).toBe(true);
  });

  it("烟花同分先看最近自由，再看次数，最后看谁登场更晚", () => {
    const present = story.days[13].fireworks;
    expect(present).toBeTruthy();
    if (!present) return;
    const female = present.present.女;
    const male = present.present.男;
    const blank = (): GameState => createState(initial.vars);

    const tied = blank();
    tied.romance.陆屿 = 20;
    tied.romance.许之言 = 20;
    expect(fireworksWinner(tied, female, 20)).toBe("许之言");

    const recent = blank();
    recent.romance.陆屿 = 20;
    recent.romance.许之言 = 20;
    recent.recentFree = "陆屿";
    expect(fireworksWinner(recent, female, 20)).toBe("陆屿");

    const counted = blank();
    counted.romance.陆屿 = 20;
    counted.romance.许之言 = 20;
    counted.freeCounts.陆屿 = 2;
    expect(fireworksWinner(counted, female, 20)).toBe("陆屿");

    const three = blank();
    three.romance.夏栀 = 20;
    three.romance.唐棠 = 20;
    three.romance.叶帆 = 20;
    expect(fireworksWinner(three, male, 20)).toBe("叶帆");

    const pair = blank();
    pair.romance.夏栀 = 20;
    pair.romance.唐棠 = 20;
    pair.romance.叶帆 = 10;
    expect(fireworksWinner(pair, male, 20)).toBe("唐棠");

    const low = blank();
    low.romance.陆屿 = 19;
    low.romance.许之言 = 8;
    expect(fireworksWinner(low, female, 20)).toBeNull();
  });
});
