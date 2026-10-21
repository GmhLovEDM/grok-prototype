import { describe, expect, it } from "vitest";
import { readPlace } from "../src/engine/place-name";

describe("地名", () => {
  it("null 是显式不显示", () => {
    expect(readPlace(null)).toBeNull();
  });

  it("有字的地名会去掉两端空白", () => {
    expect(readPlace(" 潮汐 ")).toBe("潮汐");
  });

  it("没写或空白都算漏了", () => {
    expect(() => readPlace(undefined)).toThrow(/缺少给玩家看的地名/);
    expect(() => readPlace("")).toThrow(/缺少给玩家看的地名/);
    expect(() => readPlace("   ")).toThrow(/缺少给玩家看的地名/);
  });
});
