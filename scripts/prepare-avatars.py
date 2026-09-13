"""Import supplied APNGs unchanged and extract their first frames for reduced motion."""
import json
import re
import shutil
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'sprites' / 'avatars'
out = root / 'public' / 'avatars'
out.mkdir(parents=True, exist_ok=True)
names = {p['id']: p['name'] for p in json.loads((root / 'public/pokemon/catalogue.json').read_text())}
forms = {'201QU': 'Question mark', '351HMS': 'Snowy', '351RMS': 'Rainy', '351SMS': 'Sunny', '386AMS': 'Attack', '386DMS': 'Defense', '386SMS': 'Speed'}
avatars = []
for path in sorted(source.glob('*.png')):
    match = re.fullmatch(r'Ani(\d{3})(.*)', path.stem)
    if not match:
        raise ValueError(f'Unrecognized sprite: {path.name}')
    number = int(match[1])
    key = path.stem.removeprefix('Ani')
    name = names[number] if number else 'Default'
    if key in forms:
        name += ' (' + forms[key] + ')'
    shutil.copyfile(path, out / path.name)
    with Image.open(path) as image:
        image.seek(0)
        image.convert('RGBA').save(out / (path.stem + '-still.png'))
    avatars.append({'key': key, 'id': number, 'name': name, 'animated': '/avatars/' + path.name, 'still': '/avatars/' + path.stem + '-still.png'})
avatars.sort(key=lambda avatar: (avatar['id'], avatar['key'] != f"{avatar['id']:03}MS", avatar['key']))
(root / 'lib/avatars.json').write_text(json.dumps(avatars, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Imported {len(avatars)} avatars with static first frames.')
