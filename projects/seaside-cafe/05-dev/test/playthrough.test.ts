import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import initial from "../src/data/initial.json";
import presentation from "../src/data/presentation.json";
import schedule from "../src/data/schedule.json";
import { parseStory } from "../src/engine/parse";
import { Player, type View } from "../src/engine/player";
import { scriptVersionOf } from "../src/engine/script-version";
import { createState } from "../src/engine/state";
import { memoryStorage, readSave, writeSave, type SaveData } from "../src/engine/storage";

const scriptDir = path.resolve(process.cwd(), "../03-script");
const files = fs
  .readdirSync(scriptDir)
  .filter((name) => /^day-\d+\.md$/.test(name))
  .sort()
  .map((filename) => ({ filename, markdown: fs.readFileSync(path.join(scriptDir, filename), "utf8") }));
const story = parseStory(files);
const version = scriptVersionOf(story.days);
const cues: Record<string, string> = {};
for (const [key, value] of Object.entries(presentation)) {
  if ("shift" in value && value.shift) cues[key] = value.shift.includes;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function option(view: Extract<View, { kind: "choice" }>, text: string): number {
  const index = view.options.findIndex((item) => item.label.includes(text));
  if (index < 0) throw new Error(`没有选项：${text}`);
  return index;
}

function fingerprint(player: Player): string {
  const view = player.view();
  const text = view.kind === "line" ? view.text : view.kind === "choice" ? view.id : view.kind;
  return JSON.stringify({ pos: player.pos, state: player.state, text });
}

async function run(seed: number, lead: "女生" | "男生"): Promise<void> {
  const rand = mulberry32(seed);
  const storage = memoryStorage();
  let player = Player.start(story, createState(initial.vars), schedule.totalDays, cues);
  const saveAt = 40 + Math.floor(rand() * 180);
  let saved = false;
  const limit = 15000;

  for (let steps = 0; steps < limit; steps += 1) {
    const view = player.view();
    if (view.kind === "end") {
      if (!saved) throw new Error("还没存读档就结束了");
      if (view.day !== 60 || view.chapter !== "第三章") {
        throw new Error(`停在第 ${view.day} 天 ${view.chapter}`);
      }
      if (player.state.gender !== (lead === "女生" ? "女" : "男")) throw new Error("性别不对");
      return;
    }

    if (!saved && steps >= saveAt && view.kind !== "minigame") {
      const data: SaveData = {
        v: 1,
        scriptVersion: version,
        savedAt: "2026-10-21T00:00:00.000Z",
        pos: structuredClone(player.pos),
        state: structuredClone(player.state),
        summary: {
          day: "day" in view ? view.day : 1,
          name: player.state.playerName,
          gender: player.state.gender,
          chapter: "chapter" in view ? view.chapter : "",
        },
      };
      await writeSave(storage, "mid", data);
      const loaded = await readSave(storage, "mid");
      if (!loaded || loaded.scriptVersion !== version) throw new Error("存档没有剧本版本");
      const before = fingerprint(player);
      player = new Player(story, loaded.state, loaded.pos, schedule.totalDays, cues);
      if (fingerprint(player) !== before) throw new Error("读档后进度变了");
      saved = true;
      continue;
    }

    if (view.kind === "day" || view.kind === "line") {
      player.advance();
      continue;
    }
    if (view.kind === "input") {
      player.submitName(lead === "女生" ? "阿海" : "小林");
      continue;
    }
    if (view.kind === "minigame") {
      const index = Math.floor(rand() * view.options.length);
      const before = JSON.stringify(player.pos);
      player.choose(index);
      if (JSON.stringify(player.pos) === before) player.skipMinigame();
      continue;
    }
    if (view.kind === "choice") {
      const index = view.id === schedule.genderChoiceId ? option(view, lead) : Math.floor(rand() * view.options.length);
      player.choose(index);
      continue;
    }
    throw new Error(`不知道怎么处理 ${(view as View).kind}`);
  }

  const stuck = player.view();
  const where = "scene" in stuck ? `第 ${stuck.day} 天 ${stuck.scene}` : stuck.kind;
  throw new Error(`走了 ${limit} 步还停在${where}`);
}

describe("随机周目", () => {
  it("男女主各 200 次都能读完到第 60 天，中途存读档也不卡住", async () => {
    const runs = 200;
    for (const lead of ["女生", "男生"] as const) {
      for (let n = 0; n < runs; n += 1) {
        const seed = (lead === "女生" ? 100_000 : 200_000) + n;
        try {
          await run(seed, lead);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`${lead} seed=${seed} ${message}`);
        }
      }
    }
    expect(runs).toBe(200);
  }, 120_000);
});
