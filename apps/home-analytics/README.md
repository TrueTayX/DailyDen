# Daily Den homepage analytics

Use one Cloudflare D1 database named `dailyden-analytics` for the homepage and future Daily Den game analytics. The homepage owns `homepage_activity` and its reporting views. Gameplay can use its own tables in the same database. Lineup.Day has a separate deployment and keeps its existing database.

## Production setup

1. Create `dailyden-analytics` in Cloudflare D1. Run [the homepage migration](migrations/0001_homepage.sql) in its D1 Console.
2. In [wrangler.jsonc](wrangler.jsonc), replace `REPLACE_WITH_DATABASE_ID` with the database UUID. Deploy from this directory with `npx wrangler deploy`. The config binds the database as `HOME_ANALYTICS` and attaches the Worker to the exact `dailyden.games/api/home-analytics/events` route. Existing site hosting continues to serve the homepage and game assets. The database UUID is a resource identifier.
3. If deploying through the Cloudflare dashboard, create a Worker named `dailyden-home-analytics` using [worker.mjs](worker.mjs), add the same D1 binding and route, and deploy. Leave the public workers.dev and preview URLs disabled.
4. Visit the production homepage with browser privacy signals off. Open a game tile, return from one of the owned games using its Daily Den link, and check the reporting views below. Network requests to the collector should return HTTP 204. The site works if the analytics endpoint is absent or unavailable.

## Dashboard

Open [Daily Den analytics](https://dailyden.games/analytics/). In **Workers & Pages → dailyden-home-analytics → Settings → Variables and Secrets**, add a **Secret** named `ANALYTICS_ADMIN_SECRET` with a randomly generated password of at least 32 characters. Save it in your password manager. Replace the Worker code with the current [worker.mjs](worker.mjs) and deploy. Existing installations keep their D1 binding and exact route. The dashboard calls the same route for sign-in, sign-out, and reports. No new D1 migration is needed for the dashboard.

The dashboard shows date-filtered daily uniques, total views, referral sources, clicks by action and day, and a CSV download. Its 12-hour sign-in is stored in a secure, HttpOnly cookie. Replacing the secret invalidates existing sessions. Use a distinct, randomly generated password for this dashboard.

## D1 Console queries

```sql
SELECT * FROM homepage_daily ORDER BY day DESC LIMIT 30;
SELECT * FROM homepage_referrals ORDER BY day DESC, unique_browsers DESC;
SELECT * FROM homepage_clicks ORDER BY day DESC, clicks DESC;
```

Use the first query for unique browsers and total homepage loads. The second breaks visits down by source. A browser arriving from several sources counts under each source and once in the daily total. The third shows total clicks and unique clickers per game tile and footer action. For a source-by-click report, group `homepage_activity` by `day, source, target` and filter out `target = 'visit'`. Clicking a game tile measures intent to open the game.

Days start at midnight Pacific. Browser storage resets, separate devices, privacy signals, and blockers affect the totals. Tracking begins after setup. Referrals use the referring hostname and recognize the paths of Daily Den’s games. A link from an owned game can explicitly use `?from=lineup`, `?from=unruled`, `?from=switchlight`, or `?from=cropweave`. Lineup links that send a normal `lineup.day` referrer are recognized without a tag. Missing or suppressed referrers are counted as direct unless an owned-game tag is present.

The dashboard report is accessible only with a signed-in session. D1 stores a daily hash of the browser’s random ID, the day, source, tracked action, and a count. The client sends its random ID to the collector for hashing. Its requests omit credentials and respect GPC and DNT.
