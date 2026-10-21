import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import presentation from "../src/data/presentation.json";
import schedule from "../src/data/schedule.json";
import { ScriptError } from "../src/engine/effects";
import { parseDay, parseStory } from "../src/engine/parse";
import type { Block, Line } from "../src/engine/types";

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
  it("读完第 1 到 14 天", () => {
    expect(story.days.map((day) => day.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(story.days[0].chapter).toBe("序章");
    expect(story.days[1].chapter).toBe("第一章");
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
    expect([...speakers].sort()).toEqual(["叶帆", "周总", "唐棠", "夏栀", "老唐", "老护士", "许之言", "电话", "秀姨", "陆屿", "沈若"].sort());
  });

  it("每个场景都有背景", () => {
    for (const day of story.days) {
      for (const scene of day.scenes) {
        expect(presentation[`${day.day}:${scene.id}` as keyof typeof presentation], `${day.day}:${scene.id}`).toBeTruthy();
      }
    }
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
