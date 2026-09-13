# PokéGuesser

A browser game for all 386 Pokémon in Generations 1–3. Select any combination of generations and easy, medium, hard, or very hard difficulty. The timer starts on your first correct answer. Shared leaderboards support Kanto, Kanto + Johto, and all three regions, independently for each difficulty.

## Run locally

Requires Node.js 24 (or newer with TypeScript stripping for tests).

- Install: `npm run install:ci`
- Develop: `npm run dev` — http://127.0.0.1:5173
- Build: `npm run build`
- Hosted production builds run as Cloudflare Workers with the `DB` D1 binding.
- Check rules, catalogue, ranking, capacity and retry handling: `npm test`
- Check TypeScript: `npm run typecheck`

If the system npm wrapper is broken on Windows, invoke its JavaScript entrypoint directly: `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run dev`.

Windows development uses a durable SQLite database at `.cache/leaderboard.sqlite`, exposed through the same prepared-statement and atomic-batch interface used by D1. `npm run dev` applies pending generated migrations before starting. This avoids the Windows workerd emulator crash; production builds always use D1 and never import the development adapter. The local database is separate from the hosted leaderboard.

On other platforms, after building, apply each pending local migration with `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/<migration>.sql`. Sites applies hosted migrations during publication.

## Sprite pipeline

Original supplied assets remain in `sprites/normal` and `sprites/shiny`. Names end in the three-digit National Pokédex ID and an optional form suffix (including Unown EX/QM); shiny files end in `_s`. Forms are variants of one answer, not extra Pokémon.

Run `npm run assets` with Python and Pillow installed to regenerate `public/pokemon`. The script obtains English names and descriptions from the PokeAPI repository and caches source CSVs in ignored `.cache/pokemon`. Generated files are committed-ready and the game makes no external data requests at runtime.

Every APNG is composited with its frame timings and fitted to a 64×64 pixel display using nearest-neighbour sampling. Supplied canvases range from 64×64 to 96×96. Originals are never modified. Static first frames power silhouettes and resting sprites; animation sheets are loaded only when a correct answer reveals them. Reduced-motion users get static reveals.

A correct answer rolls a 1/500 shiny chance, then independently chooses a form from the selected pool. The missing shiny Unown A and Castform A/N mismatch are recorded in `public/pokemon/asset-report.json` and are supported. Repeated guesses never reroll.

## Rules

- Easy: silhouettes and Pokédex hints; medium: silhouettes; hard: numbered blanks; very hard: numbered blanks in strict order, skipping unselected generations.
- Matching ignores case, spaces, punctuation and accents. Bare `nidoran` reveals both sexes except in very hard, where it reveals only the next required one. Explicit female/male and f/m aliases also work.
- Mew/Porygon matches briefly wait for continued typing when Mewtwo/Porygon2 is still available. Enter submits immediately.
- Giving up stops the timer and shows unanswered Pokémon in light grey without animation. Previously correct answers remain coloured.
- Refresh discards the run; background-tab time counts. Results remain in memory only.
- Pokédex entries show the species' Generation 3 type labels. Easy mode exposes entries before a guess; every mode exposes them after reveal, including pale-grey Give up results.
- Menu choices use the supplied FireRed sound effect. The pixel speaker button mutes it, and the preference is remembered on the device. Pokémon answers remain silent.
- Correct answers outside very hard mode scroll into view only when off-screen. Very hard mode continues following the next required Pokédex cell.

## Leaderboards

Each of the 12 boards retains its best 999 runs, ordered by Pokémon count descending, elapsed milliseconds ascending, then submission time and entry ID. The client loads 50 entries at a time as the standings are scrolled. A qualifying submission to a full board atomically replaces the lowest entry; a tie with rank 999 favors the earlier submission.

After completing the Pokédex or giving up, an eligible run may submit a trimmed 1–10 character name and any supplied avatar. Names are not unique. Each run has one final submission decision. Minimal receipts retain that decision after rejection or eviction, so retries cannot duplicate or resurrect entries. Receipts contain no score, name, or avatar. There are no accounts and the client reports the score; this is a casual leaderboard, not a cheat-proof competitive timing service.

`GET /api/leaderboard?category=kanto&difficulty=easy` returns `{entries,nextCursor,total}`. Pass its opaque `nextCursor` as `cursor` to continue. Categories are `kanto`, `kanto-johto`, and `kanto-johto-hoenn`; difficulties match the game. `POST /api/leaderboard` accepts a UUID v4 `runId`, category, difficulty, name, avatar key, correct count, integer `elapsedMs`, and finished status (`complete` or `gave-up`). It returns `{accepted,entryId,rank}`; evicted accepted entries return null IDs/ranks on retry. Storage failures return recoverable 503 responses.

The 393 supplied avatar APNGs live in `public/avatars`, alongside extracted first frames for reduced motion; `lib/avatars.json` maps them to names. Re-import from a source folder with `python scripts/prepare-avatars.py "path/to/small sprites"`. Button color variants use the existing action border artwork through CSS, preserving the original Poké Ball behavior.

For browser regression checks on Windows, start an isolated test server in PowerShell:

```powershell
$env:POKEGUESSER_LOCAL_DB = '.cache/leaderboard-e2e.sqlite'
node scripts/migrate-local.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174
```

In another terminal, run `node tests/leaderboard-browser.mjs <absolute-path-to-playwright/index.mjs>` with Chrome installed. Tests exercise submission, failure/retry, a complete run, avatars, 999-row scrolling, shared persistence, and mobile/reduced-motion layouts. Only exact test run IDs are cleaned up afterward; the ordinary local leaderboard and hosted data remain separate.

## Structure and future work

`lib/game.ts` owns pure rules and run state; `components/game-board.tsx` owns the grid and animation; `app/page.tsx` owns setup and screen transitions. `components/leaderboard.tsx` owns standings and submissions; `lib/leaderboard-store.ts` owns atomic D1 queries. Database schema changes are generated from `db/schema.ts` into `drizzle`.

Pokérap mode and accounts remain future work.

Names and Pokédex text: https://github.com/PokeAPI/pokeapi. Sprites supplied by the user. Pokémon belongs to its respective owners; this is an unofficial fan project.
