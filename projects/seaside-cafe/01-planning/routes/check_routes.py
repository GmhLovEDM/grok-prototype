#!/usr/bin/env python3
"""Cross-check routes/*.md against timeline.md and story-flow.md.

Prints disagreements. Does not edit files.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ROOT / "routes"
TIMELINE = (ROOT / "timeline.md").read_text()
FLOW = (ROOT / "story-flow.md").read_text()

NAMES = {
    "xia-zhi.md": "夏栀",
    "tang-tang.md": "唐棠",
    "ye-fan.md": "叶帆",
    "su-nian.md": "苏念",
    "cheng-lu.md": "程鹭",
    "shen-ruo.md": "沈若",
    "lu-yu.md": "陆屿",
    "jiang-xubai.md": "江叙白",
    "xu-zhiyan.md": "许之言",
    "song-zhiyuan.md": "宋知远",
}

COUNTS = {"共通", "自由", "专属"}
ALLOWED = COUNTS | {"并入", "前情", "结局内"}
KEY_DAYS = {
    "tang-tang.md": 51,
    "cheng-lu.md": 51,
    "xu-zhiyan.md": 51,
    "xia-zhi.md": 52,
    "shen-ruo.md": 52,
    "song-zhiyuan.md": 52,
    "ye-fan.md": 53,
    "lu-yu.md": 53,
    "su-nian.md": 54,
    "jiang-xubai.md": 54,
}


def split_row(line: str) -> list[str]:
    if not line.startswith("|"):
        return []
    return [p.strip() for p in line.strip().strip("|").split("|")]


def day_rows(text: str) -> dict[int, str]:
    rows: dict[int, str] = {}
    for line in text.splitlines():
        cells = split_row(line)
        if not cells:
            continue
        head = cells[0].replace(" ", "")
        m = re.fullmatch(r"第?(\d+)天?", head)
        m2 = re.fullmatch(r"第?(\d+)到(\d+)天?", head)
        if m and m.group(1).isdigit() and not m2:
            # timeline uses a bare number; story-flow uses 第N天
            day = int(m.group(1))
            if 1 <= day <= 60:
                rows.setdefault(day, "")
                rows[day] += "\n" + line
        elif m2:
            a, b = int(m2.group(1)), int(m2.group(2))
            for day in range(a, b + 1):
                rows.setdefault(day, "")
                rows[day] += "\n" + line
    return rows


def covered(rows: dict[int, str], whole: str, name: str, day: int) -> bool:
    blob = rows.get(day, "")
    if name in blob:
        return True
    pointed = re.search(r"同第\s*(\d+)\s*天", blob)
    if pointed and name in rows.get(int(pointed.group(1)), ""):
        return True
    # A range written inside some other row, e.g. day 10 says 第 10 到 14 天许之言.
    for line in whole.splitlines():
        if name not in line:
            continue
        for a, b in re.findall(r"第\s*(\d+)\s*到\s*(\d+)\s*天", line):
            if int(a) <= day <= int(b):
                return True
        if re.search(rf"第\s*{day}\s*天", line):
            return True
    return False


def beat_rows(text: str) -> list[tuple[int, str, str]]:
    lines = text.splitlines()
    start = None
    for i, line in enumerate(lines):
        if line.startswith("## 个人线事件节拍"):
            start = i
            break
    if start is None:
        return []
    found = []
    for line in lines[start + 1 :]:
        if line.startswith("## "):
            break
        cells = split_row(line)
        if len(cells) < 7 or not cells[0].isdigit():
            continue
        found.append((int(cells[0]), cells[2] + cells[3], cells[-1]))
    return found


def main() -> int:
    problems: list[str] = []
    t_rows = day_rows(TIMELINE)
    f_rows = day_rows(FLOW)
    if set(t_rows) != set(range(1, 61)):
        missing = [d for d in range(1, 61) if d not in t_rows]
        problems.append(f"年表缺天: {missing}")

    photo_files = []
    for path in sorted(ROUTES.glob("*.md")):
        if path.name not in NAMES:
            continue
        name = NAMES[path.name]
        text = path.read_text()
        m = re.search(r"登场：第\s*(\d+)\s*天", text)
        if not m:
            problems.append(f"{path.name} 没有登场日")
            continue
        debut = int(m.group(1))
        beats = beat_rows(text)
        if not beats:
            problems.append(f"{path.name} 没有节拍表")
            continue
        per_day: dict[int, int] = {}
        choice_days = []
        for day, what, slot in beats:
            if not 1 <= day <= 60:
                problems.append(f"{path.name} 第{day}天不在 1 到 60")
            if slot not in ALLOWED:
                problems.append(f"{path.name} 第{day}天占额无法识别: {slot}")
            if slot in COUNTS:
                per_day[day] = per_day.get(day, 0) + 1
            if slot != "前情" and day < debut:
                problems.append(f"{path.name} 第{day}天早于登场第{debut}天")
            if "关键选择" in what and slot == "专属":
                choice_days.append(day)
            if slot in COUNTS | {"结局内"}:
                if not covered(t_rows, TIMELINE, name, day):
                    problems.append(f"{path.name} 第{day}天年表没有写到{name}")
                if not covered(f_rows, FLOW, name, day):
                    problems.append(f"{path.name} 第{day}天流程没有写到{name}")
        for day, n in per_day.items():
            if n > 2:
                problems.append(f"{path.name} 第{day}天占额 {n} 件，超过两件")
        expect = KEY_DAYS[path.name]
        if choice_days != [expect]:
            problems.append(f"{path.name} 关键选择在 {choice_days}，应为第{expect}天")
        if "旧照片" in text:
            photo_files.append(path.name)

    if photo_files != ["song-zhiyuan.md"]:
        problems.append(f"旧照片应只在宋知远的线，现在在: {photo_files}")

    song = (ROUTES / "song-zhiyuan.md").read_text()
    photo_days = [d for d, what, _slot in beat_rows(song) if "旧照片" in what]
    if photo_days != [34]:
        problems.append(f"旧照片应在第 34 天，现在是 {photo_days}")

    clues = [
        ("tang-tang.md", "特别海盐", 15, 5),
        ("su-nian.md", "夏天结束就回来", 31, 23),
        ("cheng-lu.md", "海况记录", 30, 16),
        ("xu-zhiyan.md", "海难", 19, 9),
    ]
    for fname, token, day, debut in clues:
        text = (ROUTES / fname).read_text()
        hit = [d for d, what, slot in beat_rows(text) if token in what]
        if hit != [day]:
            problems.append(f"{fname} 的「{token}」应只在第{day}天，现在是 {hit}")
        elif not (debut < day < 44):
            problems.append(f"{fname} 的「{token}」不在登场之后、第 44 天之前")
        if token not in t_rows.get(day, ""):
            problems.append(f"年表第{day}天缺少「{token}」")
        if token not in f_rows.get(day, ""):
            problems.append(f"流程第{day}天缺少「{token}」")

    if "旧照片" not in t_rows.get(34, "") or "旧照片" not in f_rows.get(34, ""):
        problems.append("第 34 天年表或流程没有旧照片")

    lu = beat_rows((ROUTES / "lu-yu.md").read_text())
    d43 = [what for d, what, _s in lu if d == 43]
    d46 = [what for d, what, _s in lu if d == 46]
    if not d43 or "发呆" not in d43[0]:
        problems.append("陆屿第 43 天没有讲窗口发呆")
    if any("发呆" in what for what in d46):
        problems.append("陆屿第 46 天不该讲窗口发呆")
    if "发呆" not in t_rows.get(43, "") or "发呆" in t_rows.get(46, ""):
        problems.append("年表里窗口发呆的日子不对")

    cheng = beat_rows((ROUTES / "cheng-lu.md").read_text())
    if any(d == 10 for d, _w, _s in cheng):
        problems.append("程鹭不应有第 10 天的节拍")

    xia = beat_rows((ROUTES / "xia-zhi.md").read_text())
    d54 = [what for d, what, slot in xia if d == 54]
    if not d54 or "建议" not in d54[0] or "关键选择" in d54[0]:
        problems.append("夏栀第 54 天应是关停建议，不是关键选择")
    if "建议" not in t_rows.get(54, "") or "建议" not in f_rows.get(54, ""):
        problems.append("第 54 天年表或流程没有灯塔建议")

    print("---")
    if problems:
        print(f"{len(problems)} 处不一致:")
        for p in problems:
            print(" -", p)
        return 1
    print("没有不一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())
