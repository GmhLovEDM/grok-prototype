"""Restore the attic image explicitly selected by the user, retaining variants."""
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil

from save_image import sha256

batch = Path(__file__).resolve().parent
assets = batch.parents[1]
source = Path('C:/Users/Administrator/.codex/generated_images/01a16a41-4dfc-7653-9483-12bc90050d11/exec-f4062ce0-68e0-42e2-b833-5e19cd8e4718.png')
log = batch / 'progress.jsonl'
history = [json.loads(line) for line in log.read_text(encoding='utf-8').splitlines() if line.strip()]
original = next(row for row in history if row['id'] == 'bg-attic-day' and Path(row['source']) == source)
draft = batch / 'drafts/bg-attic-day-v1.png'
target = assets / original['planned_file']
assert sha256(batch / original['native_file']) == sha256(source)
assert sha256(draft) == original['sha256']
backup = batch / 'drafts/bg-attic-day-phone-center.png'
if target.exists() and sha256(target) != original['sha256']:
    if backup.exists():
        assert sha256(backup) == sha256(target)
    else:
        shutil.copy2(target, backup)
    shutil.copy2(draft, target)
assert sha256(target) == original['sha256']
selection = dict(original, file=original['planned_file'],
                 saved_at=datetime.now(timezone.utc).isoformat(),
                 event='user explicitly selected original attic image',
                 previous_canonical_backup=backup.relative_to(batch).as_posix())
with log.open('a', encoding='utf-8', newline='\n') as stream:
    stream.write(json.dumps(selection, ensure_ascii=False) + '\n')
selections_path = batch / 'selections.json'
selections = json.loads(selections_path.read_text(encoding='utf-8'))
for row in selections:
    if row['id'] == 'bg-attic-day':
        row.update(sha256=selection['sha256'], selected_version='original; confirmed by user',
                   selected_source=str(source), previous_canonical_backup=selection['previous_canonical_backup'])
selections_path.write_text(json.dumps(selections, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'file': selection['file'], 'sha256': selection['sha256'], 'selection': 'original confirmed by user'}, ensure_ascii=True))
