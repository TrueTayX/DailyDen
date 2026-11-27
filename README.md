# Daily Den

Daily Den is a home for daily puzzle games at [dailyden.games](https://dailyden.games/).

- `apps/home/` is the homepage.
- `apps/unruled/` contains Unruled, previously called Rulebreaker, including its source, dated puzzle catalog, tests, and analytics migration.
- `apps/crosswired/` contains WireWise, its generator, and the daily calendar.
- `apps/cropweave/` contains CropWeave Beta, its dated archive, solver, and review tools.
- Lineup.Day opens the existing site at [lineup.day](https://lineup.day/).

## Upload to Cloudflare Pages

Upload the checked-in `dist/` folder from `main` using Cloudflare Pages Direct Upload. If uploading a zip, put `index.html`, `unruled/`, `wirewise/`, and `cropweave/` at the top level of the archive. The folder includes the homepage, three games, and their assets. Direct Upload uses the static build with analytics off.

## Run checks and build

Use Node.js 22 or later. There are no npm dependencies to install.

```sh
npm test
npm run build
```

Serve `dist/` with a static HTTP server to try the homepage and all three games. The routes are `/`, `/unruled/`, `/wirewise/`, and `/cropweave/`. To work on Unruled by itself, run `npm --prefix apps/unruled run dev`.

After updating an app, run `npm run build` and commit the resulting `dist/` changes. CI rebuilds the site and checks for differences.

The shared footer lives in `packages/shell/`. When adding a game, register its page and a distinct feedback email subject in `scripts/build.mjs`.

## Cloudflare Pages Git deployment

Connect this repository, set the build command to `npm run build`, and set the build output directory to `dist`. Attach `dailyden.games` to that Pages project. Analytics is off by default. To enable it, apply `apps/unruled/migrations/0001_analytics.sql` to a D1 database, bind it as `RULEBREAKER_ANALYTICS`, and set the Pages build command to `npm run build -- --analytics`. The Unruled client sends events to `/unruled/api/events`.

Unruled keeps its existing storage keys. Browser saves from a different origin, such as the private playtest, stay with that origin.

## WireWise calendar

WireWise uses midnight in `America/Los_Angeles` and has four puzzles per day. Lineup.Day uses the browser’s local date. A fixed timezone keeps the static publication schedule consistent for everyone. The release workflow runs shortly after midnight in both Pacific offsets. It advances `published-through.txt`, rebuilds `dist/`, and pushes the release to `main` for the connected Cloudflare Worker. Only released days are in `dist/`. The future archive and reserves are visible to readers of this repository.

Run `npm run crosswired:review -- YYYY-MM-DD` and serve `reports/crosswired/` locally to play through the next 14 days and read the metrics. Review builds include unreleased puzzles. Use `node apps/crosswired/scripts/swap.mjs RESERVE_ID` to replace an unpublished puzzle with a compatible reserve. Run `npm run build && npm run crosswired:verify` after changes.

The 33 starter families cannot supply at least two new families per day under a 21-day cooldown. The scheduler enforces ten intervening days for each stamp family and ten for each concrete goal board. All-off and all-on warm-ups cycle separately. Five advanced families become eligible at two-week intervals. The generator balances uses within tier and probe limits. Human playtesting and difficulty calibration are editorial steps.

## CropWeave Beta

See the [CropWeave release and review guide](apps/cropweave/README.md) for the daily calendar, reserve swaps, scoring versions, and optional telemetry.

## WireWise interface

Square and round light shapes are reserved for Split. A Split partition assigns square lights to one hidden pattern and round lights to the other. The generator stores the square light positions in `split.marked`. Locks use a dashed tile outline and lock badge. Wrap uses edge arrows.

The goal thumbnail uses the board’s light shapes at the same positions, with filled lights for on and hollow lights for off. Board labels identify each light as square or round before announcing its state.

Homepage tracking and private D1 reports have a separate [setup guide](apps/home-analytics/README.md).
