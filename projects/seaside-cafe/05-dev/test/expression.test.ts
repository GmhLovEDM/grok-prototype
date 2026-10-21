import { describe, expect, it } from "vitest";
import { ScriptError } from "../src/engine/effects";
import { parseDay } from "../src/engine/parse";
import { Player } from "../src/engine/player";
import { createState } from "../src/engine/state";
import type { Story } from "../src/engine/types";

function storyFrom(markdown: string): Story {
  return { days: [parseDay(markdown, "day-01.md")] };
}

function read(player: Player) {
  const out: { scene: string; speaker: string | null; text: string; expr: string | null }[] = [];
  for (let guard = 0; guard < 500; guard += 1) {
    const view = player.view();
    if (view.kind === "end") return out;
    if (view.kind === "day") {
      player.advance();
      continue;
    }
    if (view.kind === "line") {
      out.push({ scene: view.scene, speaker: view.speaker, text: view.text, expr: view.expr });
      player.advance();
      continue;
    }
    if (view.kind === "choice") {
      out.push({
        scene: view.scene,
        speaker: null,
        text: view.options.map((option) => option.label).join("|"),
        expr: view.expr,
      });
      player.choose(0);
      continue;
    }
    throw new Error(view.kind);
  }
  throw new Error("没走完");
}

describe("表情和主角名", () => {
  it("冒号后的表情会剥掉，全角括号留在台词里", () => {
    const day = parseDay(
      ["# 第 1 天", "> 章节：序章", "## 场景：试", "陆屿：[shy]……别看。", "陆屿：［看什么］喝水。", "陆屿：你好[shy]"].join("\n"),
      "day-01.md",
    );
    const lines = day.scenes[0].blocks[0];
    expect(lines.type).toBe("lines");
    if (lines.type !== "lines") return;
    expect(lines.items[0]).toEqual({ type: "dialogue", speaker: "陆屿", text: "……别看。", expr: "shy" });
    expect(lines.items[1]).toEqual({ type: "dialogue", speaker: "陆屿", text: "［看什么］喝水。", expr: null });
    expect(lines.items[2]).toEqual({ type: "dialogue", speaker: "陆屿", text: "你好[shy]", expr: null });
  });

  it("不是已有表情写法的半角方括号会指出文件和行", () => {
    const markdown = ["# 第 1 天", "> 章节：序章", "## 场景：试", "陆屿：[看什么]喝水。"].join("\n");
    const line = markdown.split("\n").findIndex((item) => item.startsWith("陆屿")) + 1;
    expect(() => parseDay(markdown, "day-01.md")).toThrow(ScriptError);
    try {
      parseDay(markdown, "day-01.md");
    } catch (error) {
      expect((error as Error).message).toContain(`day-01.md:${line}`);
      expect((error as Error).message).toContain("全角");
    }
  });

  it("构建时对不上的立绘也带文件和行", () => {
    const markdown = ["# 第 2 天", "> 章节：第一章", "## 场景：试", "陆屿：[nope]喝水。"].join("\n");
    const line = 4;
    expect(() =>
      parseDay(markdown, "day-02.md", {
        onExpression(filename, at, _speaker, expr) {
          throw new ScriptError(filename, at, `「陆屿」没有立绘 lu-yu_${expr}.png`);
        },
      }),
    ).toThrow(`day-02.md:${line} 「陆屿」没有立绘 lu-yu_nope.png`);
  });

  it("替换和分支里沿用本场表情，换场回到 normal", () => {
    const markdown = `# 第 1 天

> 章节：序章

## 场景：甲

陆屿：[shy]第一句

<<<替换 脸
女主
陆屿：女主没标
男主
陆屿：[smile]男主标了
陆屿：男主再来
>>>

陆屿：块后面

<<<分支 喝
条件：饮品=汽水
陆屿：汽水沿用
条件：饮品=手冲
陆屿：[normal]手冲改口
陆屿：手冲沿用
>>>

陆屿：分支后

## 场景：乙

陆屿：换场了
`;
    const female = createState({ 饮品: "汽水" });
    female.gender = "女";
    const femaleLines = read(Player.start(storyFrom(markdown), female, 60)).filter((line) => line.speaker);
    expect(femaleLines.map((line) => `${line.scene}:${line.text}:${line.expr}`)).toEqual([
      "甲:第一句:shy",
      "甲:女主没标:shy",
      "甲:块后面:shy",
      "甲:汽水沿用:shy",
      "甲:分支后:shy",
      "乙:换场了:normal",
    ]);

    const male = createState({ 饮品: "手冲" });
    male.gender = "男";
    const maleLines = read(Player.start(storyFrom(markdown), male, 60)).filter((line) => line.speaker);
    expect(maleLines.map((line) => `${line.text}:${line.expr}`)).toEqual([
      "第一句:shy",
      "男主标了:smile",
      "男主再来:smile",
      "块后面:smile",
      "手冲改口:normal",
      "手冲沿用:normal",
      "分支后:normal",
      "换场了:normal",
    ]);
  });

  it("男女主都会把 {主角} 换成输入的名字", () => {
    const markdown = `# 第 1 天

> 章节：序章

## 场景：名

叙述里是{主角}。
陆屿：{主角}，来了。
「给{主角}」

<<<选择 叫
类型：日常
选项：叫{主角} | 效果：好感+0
>>>
`;
    for (const [gender, name] of [
      ["女", "阿海"],
      ["男", "小林"],
    ] as const) {
      const state = createState({});
      state.gender = gender;
      state.playerName = name;
      const lines = read(Player.start(storyFrom(markdown), state, 60));
      expect(lines.map((line) => line.text)).toEqual([`叙述里是${name}。`, `${name}，来了。`, `「给${name}」`, `叫${name}`]);
    }
    const unnamed = createState({});
    const raw = read(Player.start(storyFrom(markdown), unnamed, 60));
    expect(raw[0].text).toBe("叙述里是{主角}。");
  });
});
