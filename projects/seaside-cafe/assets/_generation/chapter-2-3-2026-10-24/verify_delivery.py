"""Verify this batch and write its independent manifest and local gallery."""
import html
import json
from pathlib import Path
from urllib.parse import quote

from PIL import Image
from save_image import alpha_stats, sha256

BATCH = Path(__file__).resolve().parent
ASSETS = BATCH.parents[1]


def main():
    plan = json.loads((BATCH / "plan.json").read_text(encoding="utf-8"))
    log = BATCH / "progress.jsonl"
    history = [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines() if line.strip()] if log.exists() else []
    latest = {entry["id"]: entry for entry in history}
    rows, errors, missing = [], [], []
    for job in plan:
        entry = latest.get(job["id"])
        if entry is None:
            missing.append(job["id"])
            continue
        row = dict(entry)
        path = ASSETS / entry["file"]
        try:
            expected = (1536, 2304) if job["kind"] == "portrait" else (1920, 1080)
            expected_mode = "RGBA" if job["kind"] == "portrait" else "RGB"
            with Image.open(path) as image:
                image.load()
                if image.format != "PNG" or image.size != expected or image.mode != expected_mode:
                    errors.append(job["id"] + ": format/size/mode mismatch")
                row.update(output_size=list(image.size), mode=image.mode, alpha=alpha_stats(image))
                if job["kind"] == "portrait":
                    alpha = row["alpha"]
                    if not alpha or alpha["range"][0] != 0 or alpha["range"][1] < 250 or alpha["transparent_fraction"] < 0.05:
                        errors.append(job["id"] + ": missing genuine transparency")
            actual_hash = sha256(path)
            if actual_hash != entry["sha256"]:
                errors.append(job["id"] + ": output SHA-256 mismatch")
            native = BATCH / entry["native_file"]
            if sha256(native) != entry["native_sha256"]:
                errors.append(job["id"] + ": native SHA-256 mismatch")
            with Image.open(native) as image:
                image.load()
                if list(image.size) != entry["native_size"]:
                    errors.append(job["id"] + ": native size mismatch")
            if (BATCH / entry["prompt_file"]).read_text(encoding="utf-8") != entry["prompt"]:
                errors.append(job["id"] + ": prompt record mismatch")
            row.update(sha256=actual_hash, bytes=path.stat().st_size)
        except (OSError, ValueError, KeyError) as exc:
            errors.append(job["id"] + ": " + str(exc))
        rows.append(row)
    status = "FAIL" if errors else ("INCOMPLETE" if missing else "PASS")
    report = dict(status=status, expected_deliverables=len(plan), saved_deliverables=len(rows),
                  backgrounds=sum(row["kind"] == "background" for row in rows),
                  portraits=sum(row["kind"] == "portrait" for row in rows),
                  missing=missing, errors=errors, files=rows)
    (BATCH / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    cards = []
    for row in rows:
        url = "../../" + quote(row["file"], safe="/")
        label = html.escape(row["id"])
        cards.append(f'<figure class="{row["kind"]}"><a href="{url}" target="_blank"><img loading="lazy" src="{url}" alt="{label}"></a><figcaption>{label}</figcaption></figure>')
    page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>汐湾咖啡馆 · 第二、三章美术</title><style>body{margin:32px;background:#f4f1eb;color:#292d2b;font:15px system-ui}h1{font-size:28px}p{line-height:1.8}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}figure{margin:0;background:#fff;border:1px solid #ddd6cb;border-radius:8px;overflow:hidden}figure.background{grid-column:span 2}img{display:block;width:100%;height:330px;object-fit:contain;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 0 0/20px 20px}.background img{height:auto;aspect-ratio:16/9}figcaption{padding:12px;font-size:13px;overflow-wrap:anywhere}@media(max-width:520px){figure.background{grid-column:span 1}}</style><h1>汐湾咖啡馆 · 第二、三章美术</h1>'''
    page += f'<p>已保存 {len(rows)} / {len(plan)} 张。文件校验：{status}。点击图片查看 PNG。<br>棋盘格仅在页面展示透明区域。原图单独保留，交付图按文档尺寸重采样。</p><div class="grid">'
    page += "".join(cards) + "</div></html>"
    (BATCH / "gallery.html").write_text(page, encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("status", "expected_deliverables", "saved_deliverables", "backgrounds", "portraits", "missing", "errors")}, ensure_ascii=True))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
