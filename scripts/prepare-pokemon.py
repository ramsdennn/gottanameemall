"""Build the local catalogue and composited animation sheets; keep source sprites intact."""
import csv, io, json, re, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'pokemon'
OUT.mkdir(parents=True, exist_ok=True)
TYPE_OUT = ROOT / 'public' / 'types'
TYPE_OUT.mkdir(parents=True, exist_ok=True)
CACHE = ROOT / '.cache' / 'pokemon'
CACHE.mkdir(parents=True, exist_ok=True)

def table(name):
    path = CACHE / (name + '.csv')
    if not path.exists():
        urllib.request.urlretrieve('https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/' + name + '.csv', path)
    return list(csv.DictReader(io.StringIO(path.read_text(encoding='utf-8'))))

names = {int(r['pokemon_species_id']): r['name'] for r in table('pokemon_species_names') if r['local_language_id'] == '9' and int(r['pokemon_species_id']) <= 386}
versions = {r['id']: r['identifier'] for r in table('versions')}
preference = ['emerald', 'firered', 'leafgreen', 'ruby', 'sapphire']
type_names = {1: 'normal', 2: 'fighting', 3: 'flying', 4: 'poison', 5: 'ground', 6: 'rock', 7: 'bug', 8: 'ghost', 9: 'steel', 10: 'fire', 11: 'water', 12: 'grass', 13: 'electric', 14: 'psychic', 15: 'ice', 16: 'dragon', 17: 'dark', 18: 'fairy'}
default_pokemon = {int(r['id']): int(r['species_id']) for r in table('pokemon') if r['is_default'] == '1' and int(r['species_id']) <= 386}
types = {}
for r in table('pokemon_types'):
    pokemon_id = int(r['pokemon_id'])
    type_id = int(r['type_id'])
    if pokemon_id in default_pokemon and type_id in type_names:
        types.setdefault(default_pokemon[pokemon_id], []).append((int(r['slot']), type_names[type_id]))
past_types = {}
for r in table('pokemon_types_past'):
    pokemon_id = int(r['pokemon_id'])
    generation_id = int(r['generation_id'])
    type_id = int(r['type_id'])
    if pokemon_id in default_pokemon and generation_id >= 3 and type_id in type_names:
        species_id = default_pokemon[pokemon_id]
        past_types.setdefault((species_id, generation_id), []).append((int(r['slot']), type_names[type_id]))
for species_id in names:
    applicable = sorted(generation for candidate, generation in past_types if candidate == species_id)
    if applicable:
        types[species_id] = past_types[(species_id, applicable[0])]
    if not types.get(species_id) or any(type_name == 'fairy' for _, type_name in types[species_id]):
        raise ValueError(f'Missing Generation 3 typing for species {species_id}')
descriptions = {}
for r in table('pokemon_species_flavor_text'):
    id = int(r['species_id'])
    if id > 386 or r['language_id'] != '9': continue
    version = versions[r['version_id']]
    priority = preference.index(version) if version in preference else 99
    if id not in descriptions or priority < descriptions[id][0]:
        descriptions[id] = (priority, ' '.join(r['flavor_text'].split()), version)

description_replacements = {
    46: [('This Pokémonitic', 'parasitic')],
    47: [('This Pokémon are known', 'These Pokémon are known')],
    49: [('This Pokémon are nocturnal--they', 'These Pokémon are nocturnal—they')],
    50: [('This Pokémon are raised', 'These Pokémon are raised'), ('simple--wherever', 'simple—wherever')],
    97: [('This Pokémonsis', 'hypnosis')],
    137: [('copy- protected', 'copy-protected')],
    178: [('This Pokémon are emissaries', 'these Pokémon are emissaries')],
    203: [('herbivore--it eats', 'herbivore—it eats')],
    219: [("have turned This Pokémon’s bodies into magma", 'have turned their bodies into magma')],
    227: [('feathers fallen from This Pokémon', 'feathers fallen from this Pokémon')],
    250: [('feathers--which glow', 'feathers—which glow'), ('light--are thought', 'light—are thought')],
    302: [('food--raw gems', 'food—raw gems')],
    333: [('This Pokémon flocks move', 'flocks of these Pokémon move')],
    342: [('A veteran This Pokémon that has prevailed', 'A veteran of this type of Pokémon that has prevailed')],
    370: [('This Pokémon make', 'These Pokémon make')],
}

def display_description(id, name, flavor_text):
    description = re.sub(re.escape(name), 'This Pokémon', flavor_text, flags=re.I)
    for old, new in description_replacements.get(id, []):
        description = description.replace(old, new)
    description = description.replace('A This Pokémon', 'This Pokémon')
    description = description.replace('An This Pokémon', 'This Pokémon')
    description = re.sub(r'\ban This Pokémon', 'this Pokémon', description)
    description = re.sub(r'\ba This Pokémon', 'this Pokémon', description)
    description = description.replace('The This Pokémon', 'This Pokémon')
    description = re.sub(r'\bthe This Pokémon', 'this Pokémon', description)
    return description

catalogue = {id: {'id': id, 'name': name, 'generation': 1 if id <= 151 else 2 if id <= 251 else 3, 'types': [name for _, name in sorted(types[id])], 'description': display_description(id, name, descriptions[id][1]), 'descriptionVersion': descriptions[id][2], 'normal': [], 'shiny': []} for id, name in names.items()}
report = {'counts': {}, 'warnings': [], 'source': 'https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv'}

type_sheet_path = ROOT / 'assets' / '64370.png'
if not type_sheet_path.exists():
    raise ValueError('Missing type label sheet: assets/64370.png')
type_sheet = Image.open(type_sheet_path).convert('RGBA')
if type_sheet.size != (128, 79):
    raise ValueError(f'Expected 128x79 type label sheet, got {type_sheet.size}')
type_cells = [
    ('normal', 0, 0), ('fighting', 1, 0), ('flying', 2, 0), ('poison', 3, 0),
    ('ground', 0, 1), ('rock', 1, 1), ('bug', 2, 1), ('ghost', 3, 1),
    ('steel', 0, 2), ('fire', 2, 2), ('water', 3, 2),
    ('grass', 0, 3), ('electric', 1, 3), ('psychic', 2, 3), ('ice', 3, 3),
    ('dragon', 0, 4), ('dark', 1, 4),
]
for type_name, column, row in type_cells:
    type_sheet.crop((column * 32, row * 16, column * 32 + 32, row * 16 + 16)).save(TYPE_OUT / f'{type_name}.png')
for kind in ['normal', 'shiny']:
    files = sorted((ROOT / 'sprites' / kind).glob('*.png'))
    report['counts'][kind] = len(files)
    seen = set()
    for path in files:
        match = re.search(r'(\d{3})([A-Za-z]*)(?:_s)?$', path.stem)
        if not match: raise ValueError('Unrecognised filename: ' + path.name)
        id, form = int(match[1]), match[2].upper()
        if id not in catalogue or (id, form) in seen: raise ValueError('Invalid/duplicate sprite: ' + path.name)
        seen.add((id, form))
        im = Image.open(path)
        if im.width != im.height: raise ValueError('Expected square canvas: ' + path.name)
        start = 1 if im.info.get('default_image') else 0
        frames, durations = [], []
        for n in range(start, getattr(im, 'n_frames', 1)):
            im.seek(n)
            frames.append(im.convert('RGBA').resize((64, 64), Image.Resampling.NEAREST))
            durations.append(max(1, float(im.info.get('duration', 100))))
        stem = f'{id:03}{form}-{kind}'
        frames[0].save(OUT / (stem + '.png'))
        frames[-1].save(OUT / (stem + '-last.png'))
        columns = min(16, len(frames))
        sheet = Image.new('RGBA', (columns * 64, ((len(frames) + columns - 1) // columns) * 64))
        for n, frame in enumerate(frames): sheet.paste(frame, ((n % columns) * 64, (n // columns) * 64))
        sheet.save(OUT / (stem + '-sheet.png'), optimize=True)
        catalogue[id][kind].append({'form': form, 'still': '/pokemon/' + stem + '.png', 'last': '/pokemon/' + stem + '-last.png', 'sheet': '/pokemon/' + stem + '-sheet.png', 'columns': columns, 'durations': durations})
for id, p in catalogue.items():
    if not p['normal'] or not p['shiny']: raise ValueError(f'Missing entire sprite pool: {id}')
    if {s['form'] for s in p['normal']} != {s['form'] for s in p['shiny']}: report['warnings'].append(f"#{id:03} forms differ between pools; independent selection supported")
(OUT / 'catalogue.json').write_text(json.dumps(list(catalogue.values()), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(OUT / 'asset-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
print(f'Prepared {len(catalogue)} species and {sum(report["counts"].values())} sprites.')
