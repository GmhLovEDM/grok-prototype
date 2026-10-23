import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import presentation from "../src/data/presentation.json";
import schedule from "../src/data/schedule.json";
import { evalCond } from "../src/engine/conditions";
import { ScriptError } from "../src/engine/effects";
import { parseDay, parseStory } from "../src/engine/parse";
import { scriptVersionOf } from "../src/engine/script-version";
import { createState } from "../src/engine/state";
import type { Block, Cond, Line } from "../src/engine/types";

const scriptDir = path.resolve(process.cwd(), "../03-script");

function loadStory() {
  const files = fs
    .readdirSync(scriptDir)
    .filter((name) => /^day-\d+\.md$/.test(name))
    .sort()
    .map((filename) => ({ filename, markdown: fs.readFileSync(path.join(scriptDir, filename), "utf8") }));
  return parseStory(files);
}

const story = loadStory();

function collectOps(cond: Cond | null, ops: Set<string>) {
  if (!cond) return;
  ops.add(cond.op);
  if (cond.op === "all") for (const arg of cond.args) collectOps(arg, ops);
}

function linesIn(blocks: Block[]): Line[] {
  const out: Line[] = [];
  for (const block of blocks) {
    if (block.type === "lines") out.push(...block.items);
    if (block.type === "replace") out.push(...block.byGender.女, ...block.byGender.男);
    if (block.type === "branch") for (const arm of block.arms) out.push(...arm.items);
  }
  return out;
}

describe("剧本解析", () => {
  it("读完第 1 到 60 天", () => {
    expect(story.days.map((day) => day.day)).toEqual(Array.from({ length: 60 }, (_, index) => index + 1));
    expect(story.days[0].chapter).toBe("序章");
    expect(story.days[1].chapter).toBe("第一章");
    expect(story.days[14].chapter).toBe("第二章");
    expect(story.days[14].day).toBe(15);
    expect(story.days[40].chapter).toBe("第三章");
    expect(story.days[40].day).toBe(41);
  });

  it("说话人只有名单里的这些", () => {
    const speakers = new Set<string>();
    for (const day of story.days) {
      for (const scene of day.scenes) {
        for (const line of linesIn(scene.blocks)) {
          if (line.type === "dialogue") speakers.add(line.speaker);
        }
      }
    }
    expect([...speakers].sort()).toEqual(
      ["叶帆", "周总", "唐棠", "夏栀", "宋知远", "程鹭", "老唐", "老护士", "老夏", "苏念", "许之言", "电话", "秀姨", "陆屿", "陆母", "陆汀", "郑恪", "外婆", "沈若", "江叙白"].sort(),
    );
  });

  it("每个场景都标明地名，开局显式不显示", () => {
    const blank: string[] = [];
    for (const day of story.days) {
      for (const scene of day.scenes) {
        const key = `${day.day}:${scene.id}` as keyof typeof presentation;
        const look = presentation[key];
        expect(look, key).toBeTruthy();
        expect(look && "place" in look, key).toBe(true);
        if (!look || !("place" in look)) continue;
        if (look.place === null) {
          blank.push(key);
          continue;
        }
        expect(typeof look.place, key).toBe("string");
        expect(look.place.trim(), key).toBeTruthy();
      }
    }
    expect(blank).toEqual(["1:开局"]);
    expect(presentation["1:开局"].place).toBeNull();
    expect(presentation["1:潮汐"].place).toBe("潮汐");
  });

  it("不认识的块会失败", () => {
    const markdown = "# 第 1 天\n\n> 章节：序章\n\n## 场景：试\n\n<<<香蕉 皮\n>>>\n";
    expect(() => parseDay(markdown, "fixture.md")).toThrow(ScriptError);
    expect(() => parseDay(markdown, "fixture.md")).toThrow(/未知块：香蕉/);
  });

  it("看不懂的条件会失败", () => {
    const markdown = "# 第 1 天\n\n> 章节：序章\n\n## 场景：试\n\n条件：完全不知道\n\n一句正文。\n";
    expect(() => parseDay(markdown, "fixture.md")).toThrow(/看不懂的条件/);
  });

  it("分支按条件切段", () => {
    const markdown = `# 第 1 天

> 章节：序章

## 场景：试

<<<分支 喝什么
条件：饮品=汽水
你喝了汽水。
条件：饮品=手冲
你喝了手冲。
>>>
`;
    const day = parseDay(markdown, "fixture.md");
    const block = day.scenes[0].blocks[0];
    expect(block.type).toBe("branch");
    if (block.type !== "branch") return;
    expect(block.arms).toHaveLength(2);
    expect(block.arms[0].condition).toEqual({ op: "eq", key: "饮品", value: "汽水" });
  });

  it("对不上标记的未看过会指出文件和行，并要求改写", () => {
    const markdown = ["# 第 1 天", "", "> 章节：序章", "", "## 场景：独自", "", "条件：地点=礁石滩且已看过", "", "一句。", ""].join("\n");
    const line = markdown.split(/\n/).findIndex((item) => item.startsWith("条件：")) + 1;
    expect(() => parseDay(markdown, "day-01.md")).toThrow(ScriptError);
    try {
      parseDay(markdown, "day-01.md");
    } catch (error) {
      expect(error).toBeInstanceOf(ScriptError);
      expect((error as Error).message).toContain(`day-01.md:${line}`);
      expect((error as Error).message).toContain("已看过");
      expect((error as Error).message).toContain("改写");
      expect((error as Error).message).toContain("看过修网=是");
    }
  });

  it("能对上的未看过会收成标记，带名字的未看过不用这场标记", () => {
    const paired = parseDay(
      ["# 第 7 天", "", "> 章节：第一章", "", "## 场景：修网", "", "条件：未看过", "", "一句。", "", "> 效果：标记：看过修网", "", "## 场景：修网已看", "", "条件：已看过", "", "一句。", ""].join("\n"),
      "day-07.md",
    );
    expect(paired.scenes[0].condition).toEqual({ op: "flag", key: "看过修网", on: false });
    expect(paired.scenes[1].condition).toEqual({ op: "flag", key: "看过修网", on: true });

    const named = parseDay(
      ["# 第 8 天", "", "> 章节：第一章", "", "## 场景：深夜消息", "", "条件：沈若消息未看过", "", "一句。", ""].join("\n"),
      "day-08.md",
    );
    expect(named.scenes[0].condition).toEqual({ op: "flag", key: "看过沈若消息", on: false });
  });

  it("正文里的未看过都绑成了标记", () => {
    const day = story.days.find((item) => item.day === 7);
    const fresh = day?.scenes.find((item) => item.id === "修网");
    const again = day?.scenes.find((item) => item.id === "修网已看");
    const light = day?.scenes.find((item) => item.id === "灯塔");
    expect(fresh?.condition).toEqual({
      op: "all",
      args: [
        { op: "eq", key: "傍晚", value: "修网" },
        { op: "flag", key: "看过修网", on: false },
      ],
    });
    expect(again?.condition).toEqual({
      op: "all",
      args: [
        { op: "eq", key: "傍晚", value: "修网" },
        { op: "flag", key: "看过修网", on: true },
      ],
    });
    expect(JSON.stringify(light?.condition)).toContain("看过读报");
    const ops = new Set<string>();
    for (const item of story.days) {
      for (const scene of item.scenes) {
        collectOps(scene.condition, ops);
        for (const block of scene.blocks) {
          if (block.type === "branch") for (const arm of block.arms) collectOps(arm.condition, ops);
        }
      }
    }
    expect(ops.has("seenWord")).toBe(false);
  });

  it("漏进播放器的未看过不再抛错", () => {
    expect(evalCond(createState({}), { op: "seenWord", on: false } as unknown as Cond)).toBe(false);
  });

  it("行前方括号和占位符不会把解析打断", () => {
    const markdown = ["# 第 1 天", "", "> 章节：序章", "", "## 场景：试", "", "[smile]", "陆屿：你好", "[smile]陆屿：再一句", "今天的客人是{主角}。", ""].join("\n");
    expect(() => parseDay(markdown, "fixture.md")).not.toThrow();
    const day = parseDay(markdown, "fixture.md");
    expect(linesIn(day.scenes[0].blocks).length).toBeGreaterThan(0);
  });

  it("剧本版本是编译结果的内容哈希", () => {
    const version = scriptVersionOf(story.days);
    expect(version).toMatch(/^[a-f0-9]{64}$/);
    expect(scriptVersionOf(story.days)).toBe(version);
    const tweaked = structuredClone(story.days);
    tweaked[0].chapter += "改";
    expect(scriptVersionOf(tweaked)).not.toBe(version);
  });

  it("傍晚地图只出现在日程允许的日子", () => {
    const closed = new Set(schedule.eveningMapClosed);
    for (const day of story.days) {
      const hasMap = day.scenes.some((scene) =>
        scene.blocks.some((block) => block.type === "choice" && schedule.mapChoiceIds.includes(block.id)),
      );
      if (day.day > schedule.chapter1.end) continue;
      expect(hasMap, `第 ${day.day} 天`).toBe(!closed.has(day.day));
    }
  });
});
