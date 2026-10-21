import type { GameState, Pos } from "./types";

export interface SaveStorage {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export type SaveData = {
  v: 1;
  /** 编译剧本的内容哈希。旧档可能没有。 */
  scriptVersion?: string;
  savedAt: string;
  pos: Pos;
  state: GameState;
  summary: { day: number; name: string; gender: string | null; chapter: string };
};

export type TextSpeed = "slow" | "mid" | "fast" | "instant";
export type TextScale = "small" | "mid" | "large";
export type Settings = { speed: TextSpeed; scale: TextScale };

const PREFIX = "sc/save/";
export const SETTINGS_KEY = "sc/settings";

const SPEEDS = new Set<TextSpeed>(["slow", "mid", "fast", "instant"]);
const SCALES = new Set<TextScale>(["small", "mid", "large"]);

export function defaultSettings(): Settings {
  return { speed: "mid", scale: "mid" };
}

/** 空字符串或旧档缺字段都算对不上。格式版本 v 仍由 readSave 单独拒绝。 */
export function saveScriptMatches(saved: string | undefined, current: string): boolean {
  return typeof saved === "string" && saved.length > 0 && saved === current;
}

export async function readSettings(storage: SaveStorage): Promise<Settings> {
  const fallback = defaultSettings();
  try {
    const raw = await storage.read(SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      speed: parsed.speed && SPEEDS.has(parsed.speed) ? parsed.speed : fallback.speed,
      scale: parsed.scale && SCALES.has(parsed.scale) ? parsed.scale : fallback.scale,
    };
  } catch {
    return fallback;
  }
}

export async function writeSettings(storage: SaveStorage, settings: Settings): Promise<void> {
  await storage.write(SETTINGS_KEY, JSON.stringify(settings));
}

export function browserStorage(): SaveStorage {
  return {
    async read(key) {
      return localStorage.getItem(key);
    },
    async write(key, value) {
      localStorage.setItem(key, value);
    },
    async remove(key) {
      localStorage.removeItem(key);
    },
    async list(prefix) {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) keys.push(key);
      }
      return keys;
    },
  };
}

export function memoryStorage(): SaveStorage {
  const data = new Map<string, string>();
  return {
    async read(key) {
      return data.get(key) ?? null;
    },
    async write(key, value) {
      data.set(key, value);
    },
    async remove(key) {
      data.delete(key);
    },
    async list(prefix) {
      return [...data.keys()].filter((key) => key.startsWith(prefix));
    },
  };
}

export function saveKey(slot: string): string {
  return `${PREFIX}${slot}`;
}

export async function writeSave(storage: SaveStorage, slot: string, data: SaveData): Promise<void> {
  await storage.write(saveKey(slot), JSON.stringify(data));
}

export async function readSave(storage: SaveStorage, slot: string): Promise<SaveData | null> {
  const raw = await storage.read(saveKey(slot));
  if (!raw) return null;
  const parsed = JSON.parse(raw) as SaveData;
  if (parsed.v !== 1) throw new Error("这份存档版本对不上");
  if (parsed.scriptVersion !== undefined && typeof parsed.scriptVersion !== "string") {
    throw new Error("这份存档版本对不上");
  }
  return parsed;
}
