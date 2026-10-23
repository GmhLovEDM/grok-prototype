"""Promote this batch's selected refinements; preserve all first drafts."""
from datetime import datetime, timezone
import json
from pathlib import Path

from save_image import sha256

BATCH = Path(__file__).resolve().parent
ASSETS = BATCH.parents[1]
log = BATCH / 'progress.jsonl'
history = [json.loads(line) for line in log.read_text(encoding='utf-8').splitlines() if line.strip()]
latest = {entry['id']: entry for entry in history}
selections = []
for asset_id in ('lu-ting_normal', 'bg-inn-corridor-day', 'bg-attic-day'):
    entry = dict(latest[asset_id])
    selected = ASSETS / entry['file']
    canonical = ASSETS / entry['planned_file']
    if selected == canonical:
        continue
    draft = BATCH / 'drafts' / (asset_id + '-v1.png')
    if draft.exists():
        raise FileExistsError(draft)
    if sha256(selected) != entry['sha256']:
        raise ValueError('Selected image hash mismatch: ' + asset_id)
    draft.parent.mkdir(parents=True, exist_ok=True)
    canonical.rename(draft)
    selected.rename(canonical)
    entry.update(file=canonical.relative_to(ASSETS).as_posix(),
                 saved_at=datetime.now(timezone.utc).isoformat(),
                 event='selected refinement promoted to canonical filename',
                 previous_selected_file=selected.relative_to(ASSETS).as_posix(),
                 first_draft_file=draft.relative_to(BATCH).as_posix())
    with log.open('a', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(entry, ensure_ascii=False) + '\n')
    selections.append({key: entry[key] for key in ('id', 'file', 'first_draft_file', 'sha256')})
(BATCH / 'selections.json').write_text(json.dumps(selections, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(selections, ensure_ascii=True))
