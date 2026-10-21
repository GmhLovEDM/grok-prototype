import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import characters from "../src/data/characters.json";
import presentation from "../src/data/presentation.json";
import { ScriptError } from "../src/engine/effects";
import { parseStory } from "../src/engine/parse";
import { scriptVersionOf } from "../src/engine/script-version";
import type { Block, Line, Story } from "../src/engine/types";

const devRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptDir = path.resolve(devRoot, "../03-script");
const assetsRoot = path.resolve(devRoot, "../assets");
const outDir = path.resolve(devRoot, "src/generated");

const files = fs
  .readdirSync(scriptDir)
  .filter((name) => /^day-\d+\.md$/.test(name))
  .sort()
  .map((filename) => ({ filename, markdown: fs.readFileSync(path.join(scriptDir, filename), "utf8") }));

const cast = new Map(characters.map((person) => [person.name, person]));
const story = parseStory(files, {
  onExpression(filename, line, speaker, expr) {
    const person = cast.get(speaker);
    const portrait = person?.id ? `${person.id}_${expr}.png` : "";
    const file = person?.id ? path.join(assetsRoot, "portraits", person.id, portrait) : "";
    if (!portrait || !fs.existsSync(file)) {
      throw new ScriptError(filename, line, `「${speaker}」没有立绘 ${portrait || expr}。台词若要以方括号开头，请改用全角［］。`);
    }
  },
});
const speakers = new Set<string>();

for (const day of story.days) {
  for (const scene of day.scenes) {
    const key = `${day.day}:${scene.id}`;
    const look = presentation[key as keyof typeof presentation];
    if (!look) throw new Error(`缺少背景对照：${key}`);
    if (!("place" in look) || typeof look.place !== "string" || !look.place.trim()) {
      throw new Error(`缺少给玩家看的地名：${key}`);
    }
    const bg = path.join(assetsRoot, "backgrounds", look.background, `${look.background}.png`);
    if (!fs.existsSync(bg)) throw new Error(`背景文件不存在：${look.background}`);
    if ("shift" in look && look.shift) {
      const shifted = path.join(assetsRoot, "backgrounds", look.shift.background, `${look.shift.background}.png`);
      if (!fs.existsSync(shifted)) throw new Error(`背景文件不存在：${look.shift.background}`);
    }
    for (const line of linesOf(scene.blocks)) {
      if (line.type === "dialogue") speakers.add(line.speaker);
    }
  }
}

for (const speaker of speakers) {
  if (!cast.has(speaker)) throw new Error(`说话人没有立绘条目：${speaker}`);
}
for (const person of characters) {
  if (!person.id) continue;
  const file = path.join(assetsRoot, "portraits", person.id, `${person.id}_normal.png`);
  if (!fs.existsSync(file)) throw new Error(`立绘不存在：${file}`);
}

const manifest = {
  backgrounds: fs
    .readdirSync(path.join(assetsRoot, "backgrounds"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort(),
  portraits: characters.filter((person) => person.id).map((person) => person.id),
};

const version = scriptVersionOf(story.days);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "story.json"), `${JSON.stringify({ version, days: story.days }, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, "assets.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `剧本 ${story.days.length} 天，场景 ${story.days.reduce((sum, day) => sum + day.scenes.length, 0)} 场，版本 ${version.slice(0, 12)}`,
);

function linesOf(blocks: Block[]): Line[] {
  const out: Line[] = [];
  for (const block of blocks) {
    if (block.type === "lines") out.push(...block.items);
    if (block.type === "replace") out.push(...block.byGender.男, ...block.byGender.女);
    if (block.type === "branch") for (const arm of block.arms) out.push(...arm.items);
  }
  return out;
}

export type { Story };
