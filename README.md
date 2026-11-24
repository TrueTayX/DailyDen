# Daily Den

Daily Den is a home for daily puzzle games at [dailyden.games](https://dailyden.games/).

- `apps/home/` is the homepage.
- `apps/unruled/` contains Unruled, previously called Rulebreaker, including its source, dated puzzle catalog, tests, and analytics migration.
- Lineup.Day opens the existing site at [lineup.day](https://lineup.day/).

## Upload to Cloudflare Pages

Upload the checked-in `dist/` folder from `main` using Cloudflare Pages Direct Upload. If uploading a zip, put `index.html` and `unruled/` at the top level of the archive. The folder includes the homepage, Unruled, and their assets. Direct Upload uses the static build with analytics off.

## Run checks and build

Use Node.js 22 or later. There are no npm dependencies to install.

```sh
npm test
npm run build
```

Serve `dist/` with a static HTTP server to try the homepage and the game together. The homepage is at `/` and the game is at `/unruled/`. To work on the game by itself, run `npm --prefix apps/unruled run dev`.

After updating either app, run `npm run build` and commit the resulting `dist/` changes. CI rebuilds the site and checks for differences.

The shared footer lives in `packages/shell/`. When adding a game, register its page and a distinct feedback email subject in `scripts/build.mjs`.

## Cloudflare Pages Git deployment

Connect this repository, set the build command to `npm run build`, and set the build output directory to `dist`. Attach `dailyden.games` to that Pages project. Analytics is off by default. To enable it, apply `apps/unruled/migrations/0001_analytics.sql` to a D1 database, bind it as `RULEBREAKER_ANALYTICS`, and set the Pages build command to `npm run build -- --analytics`. The Unruled client sends events to `/unruled/api/events`.

Unruled keeps its existing storage keys. Browser saves from a different origin, such as the private playtest, stay with that origin.
