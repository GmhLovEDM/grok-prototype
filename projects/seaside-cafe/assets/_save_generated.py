"""Persist each generated asset and its provenance before the next call."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
source, relative, prompt_path = sys.argv[1:4]
target = root / relative
if target.exists():
    raise SystemExit(f'Refusing to overwrite: {target}')
target.parent.mkdir(parents=True, exist_ok=True)
with Image.open(source) as image:
    native = list(image.size)
    portrait = relative.startswith('portraits/')
    size = (1024, 1024) if '/na-tie/' in relative else ((1536, 2304) if portrait else (1920, 1080))
    image = image.convert('RGBA' if portrait else 'RGB')
    if image.size != size:
        image = image.resize(size, Image.Resampling.LANCZOS)
    image.save(target, 'PNG')
with Image.open(target) as check:
    check.verify()
entry = dict(file=relative, source=source, native_size=native,
             final_size=list(size), generator='built-in image_gen',
             prompt=Path(prompt_path).read_text(encoding='utf-8'),
             sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
             bytes=target.stat().st_size)
log = root / '_generation' / 'art-progress.jsonl'
log.parent.mkdir(parents=True, exist_ok=True)
with log.open('a', encoding='utf-8') as stream:
    stream.write(json.dumps(entry, ensure_ascii=False) + '\n')
print(json.dumps({k: entry[k] for k in ('file', 'final_size', 'bytes')}, ensure_ascii=False))
