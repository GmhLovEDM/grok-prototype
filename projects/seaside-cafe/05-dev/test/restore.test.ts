import { describe, expect, it } from "vitest";
import { tryRestore } from "../src/engine/player";
import { createState } from "../src/engine/state";
import type { Pos, Story } from "../src/engine/types";

const story: Story = {
  days: [
    {
      day: 1,
      chapter: "序章",
      notes: [],
      fireworks: null,
      scenes: [
        {
          id: "潮汐",
          condition: null,
          fast: false,
          jumps: [],
          blocks: [
            {
              type: "replace",
              id: "重逢",
              byGender: {
                女: [{ type: "narration", text: "她看见他。" }],
                男: [{ type: "narration", text: "他看见他。" }],
              },
            },
            { type: "lines", items: [{ type: "narration", text: "后来店里只剩水管的声音。" }] },
          ],
        },
      ],
    },
  ],
};

const saved: Pos = {
  dayIndex: 0,
  sceneIndex: 0,
  blockIndex: 1,
  lineIndex: 0,
  screen: "play",
  jump: null,
};

describe("仍要读取", () => {
  it("进度还在时能解析出这一帧", () => {
    const state = createState({});
    state.gender = "女";
    const result = tryRestore(story, state, saved, 60);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.player.view()).toMatchObject({ kind: "line", text: "后来店里只剩水管的声音。" });
  });

  it("新剧本里这一格已经对不上时，解析失败并给出回到标题的说明", () => {
    const state = createState({});
    const pos: Pos = structuredClone(saved);
    const result = tryRestore(story, state, pos, 60);
    expect(result).toEqual({ ok: false, notice: "这份存档和当前剧本对不上，已经回到标题。" });
    expect(pos).toEqual(saved);
    expect(state.gender).toBeNull();
  });

  it("去向指向已经没有的天，也不会把调用方卡在抛错外面", () => {
    const state = createState({});
    state.gender = "女";
    const pos: Pos = {
      dayIndex: 0,
      sceneIndex: 0,
      blockIndex: 0,
      lineIndex: 0,
      screen: "play",
      jump: {
        queue: [{ dayIndex: 9, sceneIndex: 0 }],
        index: 0,
        blockIndex: 0,
        lineIndex: 0,
        returnSceneIndex: 1,
      },
    };
    const before = structuredClone(pos);
    const result = tryRestore(story, state, pos, 60);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.notice).toContain("回到标题");
    expect(pos).toEqual(before);
  });
});
