import type { Effect, GameState, Gender } from "./types";

const MIN = 0;
const MAX = 100;

export function createState(initialVars: Record<string, string>): GameState {
  return {
    playerName: "",
    gender: null,
    vars: { ...initialVars },
    romance: {},
    friendship: {},
    reputation: 0,
    recentFree: null,
    freeCounts: {},
  };
}

function clamp(n: number): number {
  return Math.max(MIN, Math.min(MAX, n));
}

export function readStat(state: GameState, who: string, stat: "romance" | "friendship"): number {
  return state[stat][who] ?? 0;
}

export function applyEffects(state: GameState, effects: Effect[]): void {
  for (const effect of effects) {
    if (effect.op === "retry") continue;
    if (effect.op === "reputation") {
      state.reputation = clamp(state.reputation + effect.delta);
      continue;
    }
    if (effect.op === "affection") {
      if (effect.when && effect.when !== state.gender) continue;
      const bag = effect.stat === "romance" ? state.romance : state.friendship;
      bag[effect.who] = clamp((bag[effect.who] ?? 0) + effect.delta);
      continue;
    }
    if (effect.op === "flag") {
      state.vars[effect.key] = "是";
      continue;
    }
    state.vars[effect.key] = effect.value;
    if (effect.key === "性别" && (effect.value === "男" || effect.value === "女")) {
      state.gender = effect.value as Gender;
    }
    if (effect.key === "最近自由") {
      state.recentFree = effect.value;
      state.freeCounts[effect.value] = (state.freeCounts[effect.value] ?? 0) + 1;
    }
    if (effect.key === "登场") {
      state.vars[`登场:${effect.value}`] = "是";
    }
  }
}

export function varEquals(state: GameState, key: string, value: string): boolean {
  if (state.vars[key] === value) return true;
  if (key === "登场" && state.vars[`登场:${value}`] === "是") return true;
  return false;
}

export function hasRetry(effects: Effect[]): boolean {
  return effects.some((effect) => effect.op === "retry");
}
