import { readStat, varEquals } from "./state";
import type { Cond, GameState, PersonRef } from "./types";

export function fireworksWinner(
  state: GameState,
  present: PersonRef[],
  threshold: number,
): string | null {
  const eligible = present.filter((person) => readStat(state, person.name, "romance") >= threshold);
  if (eligible.length === 0) return null;
  const top = Math.max(...eligible.map((person) => readStat(state, person.name, "romance")));
  let tied = eligible.filter((person) => readStat(state, person.name, "romance") === top);
  if (state.recentFree && tied.some((person) => person.name === state.recentFree)) {
    tied = tied.filter((person) => person.name === state.recentFree);
  }
  if (tied.length > 1) {
    const best = Math.max(...tied.map((person) => state.freeCounts[person.name] ?? 0));
    tied = tied.filter((person) => (state.freeCounts[person.name] ?? 0) === best);
  }
  if (tied.length > 1) {
    tied = [...tied].sort((a, b) => b.debutDay - a.debutDay || a.name.localeCompare(b.name, "zh"));
  }
  return tied[0]?.name ?? null;
}

export function evalCond(state: GameState, cond: Cond | null): boolean {
  if (!cond) return true;
  // 裸的「未看过 / 已看过」在构建时就要绑成标记，或者直接报错让作者改写。
  // 漏进播放器的不再抛错，当成条件不成立。
  if ((cond as { op: string }).op === "seenWord") return false;
  switch (cond.op) {
    case "all":
      return cond.args.every((arg) => evalCond(state, arg));
    case "gender":
      return state.gender === cond.gender;
    case "eq":
      return varEquals(state, cond.key, cond.value);
    case "flag":
      return (state.vars[cond.key] === "是") === cond.on;
    case "winner":
      return fireworksWinner(state, cond.present, cond.threshold) === cond.who;
    case "belowAll": {
      if (!state.gender) return false;
      const people = cond.present[state.gender];
      return people.every((person) => readStat(state, person.name, "romance") < cond.threshold);
    }
    case "reputation":
      return cond.cmp === ">=" ? state.reputation >= cond.value : state.reputation < cond.value;
    default: {
      const never: never = cond;
      throw new Error(`未知条件：${JSON.stringify(never)}`);
    }
  }
}
