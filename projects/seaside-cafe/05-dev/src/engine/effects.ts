import characters from "../data/characters.json";
import type { Effect, Gender, Stat } from "./types";

const NAMES = new Set(characters.filter((person) => person.affection).map((person) => person.name));

export class ScriptError extends Error {
  constructor(file: string, line: number, message: string) {
    super(`${file}:${line} ${message}`);
    this.name = "ScriptError";
  }
}

function statOf(word: string): Stat {
  if (word === "恋") return "romance";
  if (word === "友") return "friendship";
  throw new Error(`未知好感种类：${word}`);
}

function genderOf(word: string): Gender {
  if (word === "男主" || word === "男") return "男";
  if (word === "女主" || word === "女") return "女";
  throw new Error(`未知性别：${word}`);
}

function affection(who: string, when: Gender | undefined, word: string, deltaRaw: string): Effect {
  if (!NAMES.has(who)) throw new Error(`不认识的人名：${who}`);
  return { op: "affection", who, stat: statOf(word), delta: Number(deltaRaw), when };
}

function parseStats(who: string, when: Gender | undefined, body: string): Effect[] {
  const bits = body.split("，").filter(Boolean);
  return bits.map((bit) => {
    const matched = bit.match(/^([恋友])([+\-＋])(\d+)$/);
    if (!matched) throw new Error(`看不懂的好感：${bit}`);
    const sign = matched[2] === "-" ? -1 : 1;
    return affection(who, when, matched[1], String(sign * Number(matched[3])));
  });
}

function parseClause(part: string, carryName: string | null): { effects: Effect[]; carryName: string | null } {
  if (part === "返回本选择") return { effects: [{ op: "retry" }], carryName };
  if (part === "口碑不加") return { effects: [{ op: "reputation", delta: 0 }], carryName };
  const rep = part.match(/^口碑([+\-＋－])(\d+)$/);
  if (rep) {
    const sign = rep[1] === "-" || rep[1] === "－" ? -1 : 1;
    return { effects: [{ op: "reputation", delta: sign * Number(rep[2]) }], carryName };
  }
  if (/好感\+0$/.test(part) && !/[恋友=]/.test(part.replace(/好感\+0$/, ""))) {
    return { effects: [], carryName };
  }

  const spaced = part.match(/^(女主|男主)\s*([\u4e00-\u9fff]{2,4})\s*((?:[恋友][+\-＋]\d+)(?:，[恋友][+\-＋]\d+)*)$/);
  if (spaced) {
    const who = spaced[2];
    return { effects: parseStats(who, genderOf(spaced[1]), normalizePlus(spaced[3])), carryName: who };
  }

  const compact = parseCompactAffection(part);
  if (compact) return compact;

  const cont = part.match(/^(女主|男主)((?:[恋友][+\-＋]\d+)(?:，[恋友][+\-＋]\d+)*)$/);
  if (cont) {
    if (!carryName) throw new Error(`好感没有人名：${part}`);
    return { effects: parseStats(carryName, genderOf(cont[1]), normalizePlus(cont[2])), carryName };
  }

  const plain = part.match(/^([\u4e00-\u9fff]{2,4})\s+((?:[恋友][+\-＋]\d+)(?:，[恋友][+\-＋]\d+)*)$/);
  if (plain) {
    return { effects: parseStats(plain[1], undefined, normalizePlus(plain[2])), carryName: plain[1] };
  }

  const zero = part.match(/^([\u4e00-\u9fff]{2,4})\+0$/);
  if (zero) {
    if (!NAMES.has(zero[1])) throw new Error(`不认识的人名：${zero[1]}`);
    return { effects: [], carryName: zero[1] };
  }

  const assign = part.match(/^([\u4e00-\u9fffA-Za-z0-9]{1,12})=([^\s；，。]+)$/);
  if (assign) return { effects: [{ op: "set", key: assign[1], value: assign[2] }], carryName };

  throw new Error(`看不懂的效果：${part}`);
}

function normalizePlus(body: string): string {
  return body.replaceAll("＋", "+");
}

function parseCompactAffection(part: string): { effects: Effect[]; carryName: string | null } | null {
  const re = /([\u4e00-\u9fff]{2,4})?(女主|男主)([恋友])([+\-＋])(\d+)/y;
  let pos = 0;
  let name: string | null = null;
  const effects: Effect[] = [];
  if (!/^(?:[\u4e00-\u9fff]{2,4})?(?:女主|男主)/.test(part)) return null;
  while (pos < part.length) {
    if (part[pos] === "，") pos += 1;
    re.lastIndex = pos;
    const matched = re.exec(part);
    if (!matched || matched.index !== pos) return null;
    if (matched[1]) name = matched[1];
    if (!name) return null;
    const sign = matched[4] === "-" ? -1 : 1;
    effects.push(affection(name, genderOf(matched[2]), matched[3], String(sign * Number(matched[5]))));
    pos = re.lastIndex;
  }
  return effects.length ? { effects, carryName: name } : null;
}

function isNote(sentence: string): boolean {
  if (sentence.includes("返回本选择")) return false;
  if (sentence.includes("口碑")) return false;
  if (sentence.includes("标记")) return false;
  if (/好感\+/.test(sentence)) return false;
  if (/[=+]/.test(sentence)) return false;
  return true;
}

function parseMarks(body: string): Effect[] {
  const effects: Effect[] = [];
  for (const part of body.split("；").map((item) => item.trim()).filter(Boolean)) {
    const assign = part.match(/^([\u4e00-\u9fffA-Za-z0-9]{1,12})=([^\s；，。]+)$/);
    if (assign) {
      effects.push({ op: "set", key: assign[1], value: assign[2] });
      continue;
    }
    if (/^[\u4e00-\u9fffA-Za-z0-9]{1,12}$/.test(part)) {
      effects.push({ op: "flag", key: part });
      continue;
    }
    if (isNote(part)) continue;
    throw new Error(`看不懂的标记：${part}`);
  }
  return effects;
}

export function parseEffectText(text: string): Effect[] {
  const effects: Effect[] = [];
  for (const sentence of text.split("。").map((item) => item.trim()).filter(Boolean)) {
    if (sentence.includes("标记：")) {
      const at = sentence.lastIndexOf("标记：");
      const before = sentence.slice(0, at).replace(/[；\s]+$/, "").trim();
      const marks = sentence.slice(at + "标记：".length).trim();
      if (before && !isNote(before)) effects.push(...parseClauses(before));
      effects.push(...parseMarks(marks));
      continue;
    }
    if (isNote(sentence)) continue;
    effects.push(...parseClauses(sentence));
  }
  return effects;
}

function parseClauses(text: string): Effect[] {
  const effects: Effect[] = [];
  let carryName: string | null = null;
  for (const part of text.split("；").map((item) => item.trim()).filter(Boolean)) {
    if (isNote(part)) continue;
    try {
      const parsed = parseClause(part, carryName);
      carryName = parsed.carryName;
      effects.push(...parsed.effects);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
    }
  }
  return effects;
}
