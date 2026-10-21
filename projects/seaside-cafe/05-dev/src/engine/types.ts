export type Gender = "男" | "女";

export type Stat = "romance" | "friendship";

export type Effect =
  | { op: "set"; key: string; value: string }
  | { op: "flag"; key: string }
  | { op: "affection"; who: string; stat: Stat; delta: number; when?: Gender }
  | { op: "reputation"; delta: number }
  | { op: "retry" };

export type PersonRef = { name: string; debutDay: number };

export type Cond =
  | { op: "all"; args: Cond[] }
  | { op: "gender"; gender: Gender }
  | { op: "eq"; key: string; value: string }
  | { op: "flag"; key: string; on: boolean }
  | { op: "winner"; who: string; threshold: number; present: PersonRef[] }
  | { op: "belowAll"; threshold: number; present: Record<Gender, PersonRef[]> }
  | { op: "seenWord"; on: boolean };

export type Line =
  | { type: "narration"; text: string }
  | { type: "letter"; text: string }
  | { type: "dialogue"; speaker: string; text: string };

export type ChoiceOption = { label: string; effects: Effect[] };

export type ChoiceBlock = {
  type: "choice";
  id: string;
  choiceType: string;
  options: ChoiceOption[];
};

export type Block =
  | { type: "lines"; items: Line[] }
  | { type: "replace"; id: string; byGender: Record<Gender, Line[]> }
  | ChoiceBlock
  | { type: "input"; id: string; note: string }
  | {
      type: "minigame";
      id: string;
      instructions: string[];
      fail: string | null;
      choice: ChoiceBlock;
      normalIndex: number;
    }
  | { type: "branch"; id: string; arms: { condition: Cond | null; items: Line[] }[] }
  | { type: "effects"; effects: Effect[] };

export type JumpRef = { day: number; scene: string };

export type Scene = {
  id: string;
  condition: Cond | null;
  fast: boolean;
  jumps: JumpRef[];
  blocks: Block[];
};

export type Fireworks = {
  threshold: number;
  tieBreak: ["recentFree", "freeCount", "laterDebut"];
  present: Record<Gender, PersonRef[]>;
};

export type Day = {
  day: number;
  chapter: string;
  notes: string[];
  fireworks: Fireworks | null;
  scenes: Scene[];
};

export type Story = { days: Day[] };

export type GameState = {
  playerName: string;
  gender: Gender | null;
  vars: Record<string, string>;
  romance: Record<string, number>;
  friendship: Record<string, number>;
  reputation: number;
  recentFree: string | null;
  freeCounts: Record<string, number>;
};

export type JumpCursor = {
  queue: { dayIndex: number; sceneIndex: number }[];
  index: number;
  blockIndex: number;
  lineIndex: number;
  returnSceneIndex: number;
};

export type Pos = {
  dayIndex: number;
  sceneIndex: number;
  blockIndex: number;
  lineIndex: number;
  screen: "day" | "play" | "end";
  jump: JumpCursor | null;
};
