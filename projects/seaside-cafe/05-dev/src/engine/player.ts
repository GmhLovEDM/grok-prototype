import { evalCond } from "./conditions";
import { applyEffects, hasRetry } from "./state";
import type { Block, ChoiceBlock, Day, GameState, Line, Pos, Scene, Story } from "./types";

export type Visit = { calendarDay: number; sourceDay: number; scene: string };

export type View =
  | { kind: "day"; day: number; chapter: string; totalDays: number }
  | { kind: "end"; day: number; chapter: string }
  | {
      kind: "line";
      day: number;
      chapter: string;
      scene: string;
      sourceDay: number;
      text: string;
      lineKind: Line["type"];
      speaker: string | null;
      portrait: string | null;
      expr: string | null;
      fast: boolean;
      cueHit: boolean;
    }
  | {
      kind: "choice";
      day: number;
      chapter: string;
      scene: string;
      sourceDay: number;
      id: string;
      choiceType: string;
      options: { label: string }[];
      cueHit: boolean;
      portrait: string | null;
      expr: string | null;
    }
  | { kind: "input"; day: number; chapter: string; scene: string; sourceDay: number; id: string }
  | {
      kind: "minigame";
      day: number;
      chapter: string;
      scene: string;
      sourceDay: number;
      id: string;
      instructions: string[];
      options: { label: string }[];
      normalIndex: number;
      fail: string | null;
      notice: string | null;
      portrait: string | null;
      expr: string | null;
    };

const startPos = (): Pos => ({
  dayIndex: 0,
  sceneIndex: 0,
  blockIndex: 0,
  lineIndex: 0,
  screen: "day",
  jump: null,
});

export class Player {
  readonly visited: Visit[] = [];
  notice: string | null = null;
  private readonly visits = new Set<string>();

  constructor(
    readonly story: Story,
    public state: GameState,
    public pos: Pos,
    private readonly totalDays: number,
    private readonly cues: Record<string, string> = {},
  ) {
    this.settle();
  }

  static start(story: Story, state: GameState, totalDays: number, cues: Record<string, string> = {}): Player {
    return new Player(story, state, startPos(), totalDays, cues);
  }

  view(): View {
    const calendar = this.story.days[this.pos.dayIndex];
    if (this.pos.screen === "end" || !calendar) {
      const last = this.story.days[this.story.days.length - 1];
      return { kind: "end", day: last?.day ?? 0, chapter: last?.chapter ?? "" };
    }
    if (this.pos.screen === "day") {
      return { kind: "day", day: calendar.day, chapter: calendar.chapter, totalDays: this.totalDays };
    }
    const active = this.active();
    if (!active) throw new Error("播放位置对不上");
    const { scene, source } = active;
    const block = scene.blocks[this.cursor().blockIndex];
    if (!block) throw new Error(`场景没有可显示的内容：${scene.id}`);
    const cueHit = this.cueHit(source.day, scene);
    const face = this.face(scene);
    const name = this.state.playerName;
    if (block.type === "lines" || block.type === "replace" || block.type === "branch") {
      const items = this.lineItems(block);
      const line = items?.[this.cursor().lineIndex];
      if (!line) throw new Error(`读不到这一行：${scene.id}`);
      return {
        kind: "line",
        day: calendar.day,
        chapter: calendar.chapter,
        scene: scene.id,
        sourceDay: source.day,
        text: applyPlayerName(line.text, name),
        lineKind: line.type,
        speaker: line.type === "dialogue" ? line.speaker : null,
        portrait: face.speaker,
        expr: face.expr,
        fast: scene.fast,
        cueHit,
      };
    }
    if (block.type === "choice") {
      return {
        kind: "choice",
        day: calendar.day,
        chapter: calendar.chapter,
        scene: scene.id,
        sourceDay: source.day,
        id: block.id,
        choiceType: block.choiceType,
        options: block.options.map((option) => ({ label: applyPlayerName(option.label, name) })),
        cueHit,
        portrait: face.speaker,
        expr: face.expr,
      };
    }
    if (block.type === "input") {
      return { kind: "input", day: calendar.day, chapter: calendar.chapter, scene: scene.id, sourceDay: source.day, id: block.id };
    }
    if (block.type === "minigame") {
      return {
        kind: "minigame",
        day: calendar.day,
        chapter: calendar.chapter,
        scene: scene.id,
        sourceDay: source.day,
        id: block.id,
        instructions: block.instructions.map((line) => applyPlayerName(line, name)),
        options: block.choice.options.map((option) => ({ label: applyPlayerName(option.label, name) })),
        normalIndex: block.normalIndex,
        fail: block.fail ? applyPlayerName(block.fail, name) : null,
        notice: this.notice,
        portrait: face.speaker,
        expr: face.expr,
      };
    }
    throw new Error(`效果不该停在画面上：${scene.id}`);
  }

  advance(): void {
    if (this.pos.screen === "end") return;
    if (this.pos.screen === "day") {
      this.pos.screen = "play";
      this.settle();
      return;
    }
    const current = this.view();
    if (current.kind !== "line") throw new Error("现在不能继续");
    this.cursor().lineIndex += 1;
    this.settle();
  }

  choose(index: number): void {
    const active = this.active();
    if (!active || this.pos.screen !== "play") throw new Error("现在不能选择");
    const block = active.scene.blocks[this.cursor().blockIndex];
    const choice = choiceOf(block);
    if (!choice) throw new Error("这里没有选择");
    const option = choice.options[index];
    if (!option) throw new Error("没有这个选项");
    if (hasRetry(option.effects)) {
      const fail = block.type === "minigame" ? block.fail : null;
      this.notice = fail ?? "再选一次";
      return;
    }
    this.notice = null;
    applyEffects(this.state, option.effects);
    this.cursor().blockIndex += 1;
    this.cursor().lineIndex = 0;
    this.settle();
  }

  skipMinigame(): void {
    const active = this.active();
    const block = active?.scene.blocks[this.cursor().blockIndex];
    if (!block || block.type !== "minigame") throw new Error("这里没有小游戏");
    this.choose(block.normalIndex);
  }

  submitName(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("名字不能是空的");
    if ([...trimmed].length > 8) throw new Error("名字太长");
    const active = this.active();
    const block = active?.scene.blocks[this.cursor().blockIndex];
    if (!block || block.type !== "input") throw new Error("这里不用输入");
    this.state.playerName = trimmed;
    this.state.vars["主角名"] = trimmed;
    this.cursor().blockIndex += 1;
    this.cursor().lineIndex = 0;
    this.settle();
  }

  private settle(): void {
    for (let guard = 0; guard < 20000; guard += 1) {
      if (this.pos.screen !== "play") return;
      const calendar = this.story.days[this.pos.dayIndex];
      if (!calendar) {
        this.pos.screen = "end";
        return;
      }
      if (this.pos.jump) {
        const ref = this.pos.jump.queue[this.pos.jump.index];
        if (!ref) {
          this.finishJump();
          continue;
        }
        const source = this.story.days[ref.dayIndex];
        const scene = source.scenes[ref.sceneIndex];
        if (!evalCond(this.state, scene.condition)) {
          this.advanceJump();
          continue;
        }
        this.mark(calendar.day, source.day, scene.id);
        if (!this.finishBlocks(scene)) return;
        this.advanceJump();
        continue;
      }
      const scene = calendar.scenes[this.pos.sceneIndex];
      if (!scene) {
        this.nextDay();
        continue;
      }
      if (!evalCond(this.state, scene.condition)) {
        this.pos.sceneIndex += 1;
        this.pos.blockIndex = 0;
        this.pos.lineIndex = 0;
        continue;
      }
      this.mark(calendar.day, calendar.day, scene.id);
      if (scene.jumps.length) {
        if (scene.blocks.length) throw new Error(`场景同时有正文和去向：${scene.id}`);
        this.pos.jump = {
          queue: scene.jumps.map((jump) => this.locate(jump)),
          index: 0,
          blockIndex: 0,
          lineIndex: 0,
          returnSceneIndex: this.pos.sceneIndex + 1,
        };
        continue;
      }
      if (!this.finishBlocks(scene)) return;
      this.pos.sceneIndex += 1;
      this.pos.blockIndex = 0;
      this.pos.lineIndex = 0;
    }
    throw new Error("播放器卡住了");
  }

  private finishBlocks(scene: Scene): boolean {
    const cursor = this.cursor();
    while (cursor.blockIndex < scene.blocks.length) {
      const block = scene.blocks[cursor.blockIndex];
      if (block.type === "effects") {
        applyEffects(this.state, block.effects);
        cursor.blockIndex += 1;
        cursor.lineIndex = 0;
        continue;
      }
      if (block.type === "lines" || block.type === "replace" || block.type === "branch") {
        const items = this.lineItems(block);
        if (!items || cursor.lineIndex >= items.length) {
          cursor.blockIndex += 1;
          cursor.lineIndex = 0;
          continue;
        }
        return false;
      }
      return false;
    }
    return true;
  }

  private lineItems(block: Block): Line[] | null {
    if (block.type === "lines") return block.items;
    if (block.type === "replace") {
      if (!this.state.gender) throw new Error("还没选性别就遇到替换");
      return block.byGender[this.state.gender];
    }
    if (block.type === "branch") {
      for (const arm of block.arms) {
        if (evalCond(this.state, arm.condition)) return arm.items;
      }
      return [];
    }
    return null;
  }

  private active(): { calendar: Day; source: Day; scene: Scene } | null {
    const calendar = this.story.days[this.pos.dayIndex];
    if (!calendar || this.pos.screen !== "play") return null;
    if (this.pos.jump) {
      const ref = this.pos.jump.queue[this.pos.jump.index];
      if (!ref) return null;
      const source = this.story.days[ref.dayIndex];
      return { calendar, source, scene: source.scenes[ref.sceneIndex] };
    }
    const scene = calendar.scenes[this.pos.sceneIndex];
    if (!scene) return null;
    return { calendar, source: calendar, scene };
  }

  private cursor(): { blockIndex: number; lineIndex: number } {
    return this.pos.jump ?? this.pos;
  }

  private locate(jump: { day: number; scene: string }): { dayIndex: number; sceneIndex: number } {
    const dayIndex = this.story.days.findIndex((day) => day.day === jump.day);
    if (dayIndex < 0) throw new Error(`去向没有第 ${jump.day} 天`);
    const sceneIndex = this.story.days[dayIndex].scenes.findIndex((scene) => scene.id === jump.scene);
    if (sceneIndex < 0) throw new Error(`去向没有这场：第${jump.day}天${jump.scene}`);
    return { dayIndex, sceneIndex };
  }

  private advanceJump(): void {
    if (!this.pos.jump) return;
    this.pos.jump.index += 1;
    this.pos.jump.blockIndex = 0;
    this.pos.jump.lineIndex = 0;
  }

  private finishJump(): void {
    if (!this.pos.jump) return;
    const next = this.pos.jump.returnSceneIndex;
    this.pos.jump = null;
    this.pos.sceneIndex = next;
    this.pos.blockIndex = 0;
    this.pos.lineIndex = 0;
  }

  private nextDay(): void {
    this.pos.dayIndex += 1;
    this.pos.sceneIndex = 0;
    this.pos.blockIndex = 0;
    this.pos.lineIndex = 0;
    this.pos.jump = null;
    this.pos.screen = this.story.days[this.pos.dayIndex] ? "day" : "end";
  }

  private mark(calendarDay: number, sourceDay: number, scene: string): void {
    const key = `${calendarDay}|${sourceDay}|${scene}|${this.pos.sceneIndex}|${this.pos.jump?.index ?? "-"}`;
    if (this.visits.has(key)) return;
    this.visits.add(key);
    this.visited.push({ calendarDay, sourceDay, scene });
  }

  private shownLines(scene: Scene): Line[] {
    const cursor = this.cursor();
    const out: Line[] = [];
    for (let blockIndex = 0; blockIndex <= cursor.blockIndex && blockIndex < scene.blocks.length; blockIndex += 1) {
      const items = this.lineItems(scene.blocks[blockIndex]);
      if (!items) continue;
      const end = blockIndex === cursor.blockIndex ? cursor.lineIndex : items.length - 1;
      for (let lineIndex = 0; lineIndex <= end && lineIndex < items.length; lineIndex += 1) out.push(items[lineIndex]);
    }
    return out;
  }

  private cueHit(sourceDay: number, scene: Scene): boolean {
    const cue = this.cues[`${sourceDay}:${scene.id}`];
    if (!cue) return false;
    return this.shownLines(scene).some((line) => line.text.includes(cue));
  }

  private face(scene: Scene): { speaker: string | null; expr: string | null } {
    const last = new Map<string, string>();
    let speaker: string | null = null;
    for (const line of this.shownLines(scene)) {
      if (line.type !== "dialogue") continue;
      speaker = line.speaker;
      const expr = line.expr ?? last.get(speaker) ?? "normal";
      last.set(speaker, expr);
    }
    if (!speaker) return { speaker: null, expr: null };
    return { speaker, expr: last.get(speaker) ?? "normal" };
  }
}

export function applyPlayerName(text: string, name: string): string {
  if (!name || !text.includes("{主角}")) return text;
  return text.replaceAll("{主角}", name);
}

function choiceOf(block: Block | undefined): ChoiceBlock | null {
  if (!block) return null;
  if (block.type === "choice") return block;
  if (block.type === "minigame") return block.choice;
  return null;
}
