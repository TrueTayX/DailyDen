# CropWeave Beta

CropWeave publishes one shared puzzle at Pacific midnight, with the same `getPuzzleDate` used by SwitchLight. Unruled calls the shared helper with its existing browser-local behavior. Lineup is served separately and uses the browser's local date. Pacific time keeps the static release and shared puzzle identical across regions.

The fixed launch date is November 26, 2026. The archive has 70 gate-checked dates through February 3, 2027 and 35 same-date reserves. The public build includes the released dates only. The source repository itself contains the full archive.

## Editorial workflow

```sh
npm run cropweave:review -- 2026-11-26
python3 -m http.server 4174 --directory reports/cropweave
node apps/cropweave/scripts/swap.mjs YYYY-MM-DD
npm run build && npm run cropweave:verify
```

The review page lists the next 14 dates with playable plots and benchmark metrics. Swaps are allowed only for unpublished dates. The scheduled workflow advances the publication marker in Pacific time and verifies published puzzles against its base commit. Clear a missed release by dispatching **Publish daily puzzles** from GitHub Actions. A clock ahead of the release falls back to the latest available plot. Continue extending the archive before the scheduled dates run out.

```sh
node apps/cropweave/scripts/generate.mjs calendar 90 apps/cropweave/content/archive.json
node apps/cropweave/scripts/generate.mjs balance 2000 apps/cropweave/content/balance.json
```

Calendar generation keeps the existing prefix and backtracks among newly generated days. The balance sample uses the weekday templates with staggered unlocks. Contribution means a tile type's average attributed share when it appears on a best layout. Irrigation, protection and pollination are allocated to their sources, and the flower/hive bonus is split between the two cooperating tiles. River coins stay attributed to terrain. The reported layout pattern compares edge and interior occupancy.

Simulated annealing and a separate beam search estimate benchmarks. Bounded exhaustive search labels a score proven only if it finishes and agrees. The release archive retains the selected benchmark and its alternate layouts. Scoring is frozen per puzzle version. A future tuning pass should add a rules version and use it for unplayed dates, and should keep the old rules in the client. Human difficulty and finish-time calibration continue during Beta.

## Hosting and telemetry

The normal build works as static Cloudflare assets. The game writes bounded, anonymous beta event batches to local storage when network telemetry is disabled. For a Pages deployment with Functions, apply `migrations/0001_events.sql` to a D1 database, bind it as `CROPWEAVE_ANALYTICS`, and build with `npm run build -- --cropweave-analytics`. Worker Static Assets hosting requires routing the events handler through its Worker before enabling that build option. The game can load and finish without D1.

The hub and game carry Beta wording, and the game has noindex. The [asset ledger](ASSETS.md) records the Beta sprites. Tiny Fox Art Co. art, broader name and handle clearance, and a separate Lineup promotion are public-launch follow-ups.
