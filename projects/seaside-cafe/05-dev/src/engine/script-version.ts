import { createHash } from "node:crypto";
import type { Day } from "./types";

/** 编译后 days 的 SHA-256。不算 version 字段自己，键顺序跟解析结果一致。 */
export function scriptVersionOf(days: Day[]): string {
  return createHash("sha256").update(JSON.stringify(days)).digest("hex");
}
