# PokeGuesser Pixel

A reusable outline font reconstructed from the supplied image. The name is a project label, not an identification of the original typeface.

## Files

- `PokeGuesserPixel-Regular.woff2`: compact web font for games and websites.
- `PokeGuesserPixel-Regular.ttf`: installable font for applications that support custom fonts.
- `font.css`: portable font registration and optional utility class.
- `specimen.png`: rendered sample of the actual font.
- `source.png`: original supplied character sheet.

## Use in a website

Copy this folder into the website's public assets, then load its stylesheet:

```html
<link rel="stylesheet" href="/fonts/pokeguesser-pixel/font.css">
```

Apply the family to text:

```css
body, button, input, select, textarea {
  font-family: "PokeGuesser Pixel", sans-serif;
  font-synthesis: none;
}
```

Existing rules that explicitly set another family, including `font` shorthand declarations, must also be updated for a complete game-wide change. The asset is prepared separately; the game's existing stylesheet has not been changed.

Use regular weight. Only one weight is supplied. Sizes divisible by 12px (12, 24, 36, 48) align the source pixel grid most predictably at 100% zoom; other sizes work with browser smoothing. Small sizes should be checked for readability. Text remains selectable, searchable and accessible.

## Coverage and reconstruction

105 character mappings: printable ASCII, non-breaking space, plus derived é/É, typographic quote mappings, en/em dashes and ellipsis. Characters outside this set use the application's fallback font. The accent and extra punctuation are additions, not recovered originals. Curly quote codepoints currently reuse the straight quote shapes.

The dark letterforms are traced into scalable outlines. The pale offset shadow in the reference is omitted so text can take any color. Add a CSS `text-shadow` if desired. Original font metrics and hinting cannot be recovered from the image; spacing is reconstructed.

The source font's identity and license are unknown. This reconstruction does not establish ownership or grant a license to the underlying design. If the original font file becomes available, prefer that for authentic spacing, character coverage and licensing information.

To rebuild within PokeGuesser, install `pillow fonttools brotli skia-pathops` and run `python scripts/build-pixel-font.py`. The script uses the included source image by default.
