import json
import re
from pathlib import Path

p = Path(__file__).resolve().parents[2] / '04-art-prompts' / 'characters'
order = ['xiu-yi', 'lao-tang', 'zhou-zong', 'lao-hushi', 'lao-xia', 'na-tie', 'xia-zhi', 'tang-tang', 'ye-fan', 'lu-yu', 'xu-zhiyan', 'su-nian', 'cheng-lu', 'shen-ruo', 'jiang-xubai', 'song-zhiyuan']
jobs, fixes, headers = [], [], {}
for character in order:
    content = (p / (character + '.md')).read_text(encoding='utf-8')
    header = content.split('### ')[0]
    headers[character] = header
    for match in re.finditer(r'^### ([^\r\n]+\.png)\r?\n(.*?)(?=^### |^## |\Z)', content, re.M | re.S):
        jobs.append(dict(character=character, file=match[1], body=match[2]))
    if character in ['tang-tang', 'ye-fan', 'lu-yu', 'jiang-xubai']:
        fixes.append(dict(character=character, prompt=re.search(r'```text\s*(.*?)```', content, re.S)[1]))
print(json.dumps(dict(jobs=jobs, fixes=fixes, headers=headers), ensure_ascii=True))
