"""Rebuild the reusable outline font from the supplied character-sheet image.

Requires: pip install pillow fonttools brotli skia-pathops
Usage: python scripts/build-pixel-font.py [path/to/preview.png]
"""
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.removeOverlaps import removeOverlaps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/fonts/pokeguesser-pixel'
OUT.mkdir(parents=True, exist_ok=True)
source = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT / 'source.png'
im = Image.open(source).convert('RGB')
if source.resolve() != (OUT / 'source.png').resolve():
    im.save(OUT / 'source.png')
glyphs = {}

def extract(char, left, right, top, bottom, baseline):
    # Trace only the dark ink; the light offset shadow is a presentation effect.
    pixels = {(x-left, baseline-y-1) for y in range(top, bottom)
              for x in range(left, right) if max(im.getpixel((x,y))) < 100}
    origin = min((x for x,y in pixels),default=0)
    pixels = {(x-origin,y) for x,y in pixels}
    glyphs[char] = (pixels, max((x for x,y in pixels),default=11)+5)

for i, char in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZ'):
    extract(char, 12+i*24, 36+i*24, 200, 250, 242)
for char, (left,right) in zip('0123456789', [(12,36),(36,56),(60,84),(84,108),(108,132),(132,156),(156,180),(180,204),(204,228),(228,252)]):
    extract(char,left,right,70,120,114)
lower = [12,36,60,84,108,132,156,180,204,216,240,264,280,304,328,352,376,400,420,444,468,492,516,540,564,588,612]
for i,char in enumerate('abcdefghijklmnopqrstuvwxyz'):
    extract(char,lower[i],lower[i+1],328,386,370)
for char,left,right in [('!',12,24),('"',28,48),('#',52,72),('$',76,96),('%',100,120),('&',124,144),("'",148,160),('(',164,176),(')',180,192),('*',196,216),('+',220,240),(',',244,252),('-',256,276),('.',280,288),('/',292,316)]:
    extract(char,left,right,0,64,50)
for char,left,right in [(':',12,20),(';',24,32),('<',36,60),('=',64,88),('>',92,116),('?',116,140),('@',140,172)]:
    extract(char,left,right,134,184,178)
for char,left,right in [('[',12,24),('\\',28,48),(']',52,64),('^',68,88),('_',92,116),('`',124,140)]:
    extract(char,left,right,264,314,306)
for char,left,right in [('{',12,24),('|',28,32),('}',36,48),('~',52,84)]:
    extract(char,left,right,394,442,434)
glyphs[' '] = (set(),16)
glyphs['\u00a0'] = glyphs[' ']
# Added accents are derived, not present in the original reference.
for accented,base in [('é','e'),('É','E')]:
    pixels,advance = glyphs[base]
    accent = {(x,y) for x0,y0 in [(8,40),(12,44)] for x in range(x0,x0+4) for y in range(y0,y0+4)}
    glyphs[accented] = (pixels | accent, advance)
for char in ['–','—']:
    width = 28 if char == '–' else 40
    glyphs[char] = ({(x,y) for x in range(width) for y in range(16,20)},width+8)
for char,base in [('‘',"'"),('’',"'"),('“','"'),('”','"')]:
    glyphs[char] = glyphs[base]
glyphs['…'] = ({(x+offset,y) for offset in (0,12,24) for x,y in glyphs['.'][0]},36)

fb = FontBuilder(960,isTTF=True)
names = {c:f'uni{ord(c):04X}' for c in glyphs}
fb.setupGlyphOrder(['.notdef']+list(names.values()))
fb.setupCharacterMap({ord(c):n for c,n in names.items()})
outlines = {}
metrics = {}
missing = ({(x,y) for x in range(20) for y in range(32) if x<4 or x>=16 or y<4 or y>=28},28)
for name,(pixels,advance) in [('.notdef',missing)]+[(names[c],v) for c,v in glyphs.items()]:
    pen = TTGlyphPen(None)
    # Combine each scanline into runs, retaining exact square corners.
    for y in sorted({y for x,y in pixels}):
        xs = sorted(x for x,py in pixels if py==y)
        runs=[]
        for x in xs:
            if not runs or x != runs[-1][1]: runs.append([x,x+1])
            else: runs[-1][1]=x+1
        for a,b in runs:
            pen.moveTo((a*20,y*20)); pen.lineTo((a*20,(y+1)*20))
            pen.lineTo((b*20,(y+1)*20)); pen.lineTo((b*20,y*20)); pen.closePath()
    outlines[name]=pen.glyph()
    metrics[name]=(advance*20,min((x for x,y in pixels),default=0)*20)
fb.setupGlyf(outlines)
fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=960,descent=-240)
fb.setupNameTable({'familyName':'PokeGuesser Pixel','styleName':'Regular','uniqueFontIdentifier':'PokeGuesser Pixel Reconstruction 1.0','fullName':'PokeGuesser Pixel Regular','psName':'PokeGuesserPixel-Regular','version':'Version 1.0','description':'Reconstructed from a user-supplied raster specimen. Original typeface and license unidentified.'})
fb.setupOS2(sTypoAscender=960,sTypoDescender=-240,sTypoLineGap=0,usWinAscent=960,usWinDescent=240)
fb.setupPost()
removeOverlaps(fb.font)
fb.save(OUT / 'PokeGuesserPixel-Regular.ttf')
fb.font.flavor='woff2'
fb.save(OUT / 'PokeGuesserPixel-Regular.woff2')
preview=Image.new('RGB',(1100,540),'#fffef9')
d=ImageDraw.Draw(preview)
font=ImageFont.truetype(str(OUT/'PokeGuesserPixel-Regular.ttf'),32)
for i,line in enumerate(['PokeGuesser Pixel','ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz','0123456789  !? @#$% &*()','PokéGuesser — Name every Pokémon','Kanto  Johto  Hoenn','Start game   12:34   151 / 386']):
    d.text((32,20+i*70),line,font=font,fill='#223d39')
preview.save(OUT/'specimen.png')
assert set(range(32,127)).issubset(fb.font.getBestCmap())
print(f'Built {len(glyphs)} glyphs in {OUT}')
