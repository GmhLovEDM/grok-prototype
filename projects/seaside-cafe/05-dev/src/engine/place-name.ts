/**
 * 玩家看见的地名。
 * null 表示这场不显示地名（开局要等秀姨说出店名）。
 * 没写、undefined、空白都是漏了，构建要失败。
 */
export function readPlace(place: unknown): string | null {
  if (place === null) return null;
  if (typeof place === "string") {
    const text = place.trim();
    if (text) return text;
  }
  throw new Error("缺少给玩家看的地名");
}
