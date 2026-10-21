import hashlib
import html
import json
from pathlib import Path
from PIL import Image

folder = Path(__file__).resolve().parent
root = folder.parent
plan = json.loads((folder / 'delivery-plan.json').read_text(encoding='utf-8'))
history = [json.loads(line) for line in (folder / 'art-progress.jsonl').read_text(encoding='utf-8').splitlines()]
by_hash = {entry['sha256']: entry for entry in history}
rows, errors = [], []
for entry in plan:
    path = root / entry['file']
    if not path.exists():
        errors.append('Missing: ' + entry['file'])
        continue
    with Image.open(path) as image:
        image.load()
        expected = (1920, 1080) if entry['kind'] == 'background' else ((1024, 1024) if entry['kind'] == 'cat' else (1536, 2304))
        if image.size != expected or image.format != 'PNG':
            errors.append('Format/size: ' + entry['file'])
        row = dict(entry, size=list(image.size), mode=image.mode, bytes=path.stat().st_size)
        if entry['kind'] != 'background':
            if image.mode != 'RGBA':
                errors.append('Missing alpha: ' + entry['file'])
            else:
                alpha = image.getchannel('A')
                row['alpha_range'] = list(alpha.getextrema())
                row['fully_transparent_pixels'] = alpha.histogram()[0]
                if alpha.getextrema() != (0, 255) or row['fully_transparent_pixels'] < image.width * image.height * 0.05:
                    errors.append('Alpha check: ' + entry['file'])
        row['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        source = by_hash.get(row['sha256'])
        if source:
            row.update(source=source['source'], native_size=source['native_size'], prompt=source['prompt'], generator=source['generator'])
        else:
            errors.append('Missing provenance: ' + entry['file'])
        rows.append(row)
report = dict(status='PASS' if not errors else 'FAIL', generated_deliverables=len(rows), backgrounds=sum(x['kind']=='background' for x in rows), portraits_and_cat=sum(x['kind']!='background' for x in rows), errors=errors, files=rows)
(folder / 'delivery-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
cards = []
for row in rows:
    url = '../' + row['file']
    cards.append('<figure class="' + row['kind'] + '"><a href="' + html.escape(url) + '" target="_blank"><img loading="lazy" src="' + html.escape(url) + '" alt="' + html.escape(row['id']) + '"></a><figcaption>' + html.escape(row['id']) + '</figcaption></figure>')
page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>汐湾咖啡馆 · 本轮出图</title><style>body{margin:32px;background:#f4f1eb;color:#292d2b;font:15px system-ui}h1{font-size:28px}p{line-height:1.8}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}figure{margin:0;background:#fff;border:1px solid #ddd6cb;border-radius:8px;overflow:hidden}figure.background{grid-column:span 2}img{display:block;width:100%;height:330px;object-fit:contain;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 0 0/20px 20px}.background img{height:auto;aspect-ratio:16/9;object-fit:contain}figcaption{padding:12px;font-size:13px;overflow-wrap:anywhere}@media(max-width:520px){figure.background{grid-column:span 1}}</style><h1>汐湾咖啡馆 · 本轮出图</h1><p>29 张场景 · 63 张新增立绘（含拿铁）· 4 张母版修正版。每生成一张即保存一张。点击图片查看原尺寸 PNG。<br>棋盘格仅用于页面展示透明区域，没有写入 PNG。修正母版另存 normal-v2，旧母版保留。</p><div class="grid">'''+''.join(cards)+'</div></html>'
(folder / 'gallery.html').write_text(page, encoding='utf-8')
print(json.dumps({key:report[key] for key in ('status','generated_deliverables','backgrounds','portraits_and_cat','errors')}, ensure_ascii=True))
