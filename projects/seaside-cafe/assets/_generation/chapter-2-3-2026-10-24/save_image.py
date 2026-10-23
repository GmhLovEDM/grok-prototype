"""Save and verify one generated PNG before starting the next generation."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import uuid

from PIL import Image

BATCH = Path(__file__).resolve().parent
ASSETS = BATCH.parents[1]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alpha_stats(image):
    if image.mode != "RGBA":
        return None
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    return {"range": list(alpha.getextrema()),
            "fully_transparent_pixels": histogram[0],
            "fully_opaque_pixels": histogram[255],
            "transparent_fraction": histogram[0] / (image.width * image.height)}


def require_alpha(image):
    stats = alpha_stats(image)
    if not stats or stats["range"][0] != 0 or stats["range"][1] < 250 or stats["transparent_fraction"] < 0.05:
        raise ValueError("Portrait must contain true alpha with at least 5% fully transparent pixels")
    return stats


def pick_paths(job):
    original = ASSETS / job["file"]
    version = 1
    while True:
        suffix = "" if version == 1 else f"-v{version}"
        target = original.with_name(original.stem + suffix + ".png")
        native = BATCH / "native" / (job["id"] + suffix + ".png")
        prompt = BATCH / "saved-prompts" / (job["id"] + suffix + ".txt")
        if not any(path.exists() for path in (target, native, prompt)):
            return target, native, prompt
        version += 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("id")
    parser.add_argument("source", type=Path)
    parser.add_argument("prompt", type=Path)
    args = parser.parse_args()
    jobs = json.loads((BATCH / "plan.json").read_text(encoding="utf-8"))
    job = next((item for item in jobs if item["id"] == args.id), None)
    if job is None:
        parser.error("Unknown asset id: " + args.id)
    source = args.source.resolve(strict=True)
    prompt_text = args.prompt.read_text(encoding="utf-8-sig")
    portrait = job["kind"] == "portrait"
    size = (1536, 2304) if portrait else (1920, 1080)
    mode = "RGBA" if portrait else "RGB"
    with Image.open(source) as generated:
        generated.load()
        if generated.format != "PNG":
            raise ValueError("Expected PNG source; preserve native bytes without transcoding")
        native_size = list(generated.size)
        native_mode = generated.mode
        if portrait and "A" not in generated.getbands() and "transparency" not in generated.info:
            raise ValueError("Portrait source has no alpha channel or transparency")
        output = generated.convert(mode)
        native_alpha = require_alpha(output) if portrait else None
        if output.size != size:
            output = output.resize(size, Image.Resampling.LANCZOS)
        if portrait:
            require_alpha(output)

    target, native, saved_prompt = pick_paths(job)
    for path in (target, native, saved_prompt):
        path.parent.mkdir(parents=True, exist_ok=True)
    # Preserve the exact native image, and fail rather than overwriting any file.
    with source.open("rb") as src, native.open("xb") as dst:
        shutil.copyfileobj(src, dst)
    with saved_prompt.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(prompt_text)
    temporary = target.with_name(target.stem + "." + uuid.uuid4().hex + ".partial.png")
    try:
        output.save(temporary, "PNG")
        with Image.open(temporary) as check:
            check.load()
            if check.format != "PNG" or check.size != size or check.mode != mode:
                raise ValueError("Saved output failed format, size, or mode validation")
            alpha = require_alpha(check) if portrait else None
        # On Windows rename fails if another process has created the target.
        temporary.rename(target)
    finally:
        if temporary.exists():
            temporary.unlink()

    record = dict(job, file=target.relative_to(ASSETS).as_posix(),
                  planned_file=job["file"], saved_at=datetime.now(timezone.utc).isoformat(),
                  generator="built-in image_gen", source=str(source),
                  native_file=native.relative_to(BATCH).as_posix(),
                  native_size=native_size, native_mode=native_mode,
                  native_sha256=sha256(native), native_alpha=native_alpha,
                  output_size=list(size), mode=mode, alpha=alpha,
                  sha256=sha256(target), bytes=target.stat().st_size,
                  prompt_file=saved_prompt.relative_to(BATCH).as_posix(),
                  prompt=prompt_text,
                  processing="Pillow mode conversion and Lanczos resize only; no semantic editing")
    with (BATCH / "progress.jsonl").open("a", encoding="utf-8", newline="\n") as stream:
        stream.write(json.dumps(record, ensure_ascii=False) + "\n")
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps({key: record[key] for key in
                     ("id", "file", "native_file", "native_size", "output_size", "mode", "alpha", "bytes", "sha256")},
                     ensure_ascii=True))


if __name__ == "__main__":
    main()
