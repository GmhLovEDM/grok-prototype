import type { GameState, Pos } from "./types";

export interface SaveStorage {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export type SaveData = {
  v: 1;
  savedAt: string;
  pos: Pos;
  state: GameState;
  summary: { day: number; name: string; gender: string | null; chapter: string };
};

const PREFIX = "sc/save/";

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
  return parsed;
}
