import { describe, expect, it } from "vitest";
import { createState } from "../src/engine/state";
import {
  memoryStorage,
  readSave,
  readSettings,
  saveKey,
  saveScriptMatches,
  writeSave,
  writeSettings,
  type SaveData,
} from "../src/engine/storage";
import type { Pos } from "../src/engine/types";

const pos: Pos = { dayIndex: 1, sceneIndex: 0, blockIndex: 0, lineIndex: 0, screen: "play", jump: null };

function save(scriptVersion?: string): SaveData {
  return {
    v: 1,
    scriptVersion,
    savedAt: "2026-10-21T00:00:00.000Z",
    pos,
    state: createState({ 看过泡面: "否" }),
    summary: { day: 2, name: "阿海", gender: "女", chapter: "第一章" },
  };
}

describe("存储", () => {
  it("文字速度和字号走同一套存储，不占存档档位", async () => {
    const storage = memoryStorage();
    expect(await readSettings(storage)).toEqual({ speed: "mid", scale: "mid" });
    await writeSettings(storage, { speed: "instant", scale: "small" });
    expect(await readSettings(storage)).toEqual({ speed: "instant", scale: "small" });
    expect(await storage.list("sc/save/")).toEqual([]);
    expect(await storage.read("sc/settings")).toContain("instant");
  });

  it("读坏的设置就回到默认", async () => {
    const storage = memoryStorage();
    await storage.write("sc/settings", "{");
    await storage.write("sc/settings-nope", "1");
    expect(await readSettings(storage)).toEqual({ speed: "mid", scale: "mid" });
    await storage.write("sc/settings", JSON.stringify({ speed: "nope", scale: "large" }));
    expect(await readSettings(storage)).toEqual({ speed: "mid", scale: "large" });
  });

  it("新档记下剧本版本，旧档没有这个字段就算对不上", async () => {
    const storage = memoryStorage();
    const version = "abc123";
    await writeSave(storage, "1", save(version));
    const loaded = await readSave(storage, "1");
    expect(loaded?.scriptVersion).toBe(version);
    expect(saveScriptMatches(loaded?.scriptVersion, version)).toBe(true);
    expect(saveScriptMatches(loaded?.scriptVersion, "other")).toBe(false);

    await storage.write(saveKey("old"), JSON.stringify(save(undefined)));
    const old = await readSave(storage, "old");
    expect(old?.scriptVersion).toBeUndefined();
    expect(saveScriptMatches(old?.scriptVersion, version)).toBe(false);
    expect(saveScriptMatches("", version)).toBe(false);
  });
});
