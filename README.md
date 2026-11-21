# Rulebreaker

Rulebreaker is a daily visual logic game. Each daily challenge has five puzzles with distinct visual formats. Players infer the rule from examples, choose an output, and see the explanation.

## Develop

Use Node.js 22 or later. The game has no npm dependencies.

```sh
npm run dev
npm test
npm run build
```

The local game is at `http://localhost:4173`. Use `?playtest=workshop`, `?playtest=routes`, `?playtest=variety`, or `?playtest=first-month` to open a fixed sample with separate progress. Build a private preview with `npm run build -- --playtest`. The standard `dist/` build serves only the daily game off localhost.

## Daily play

New challenges start at midnight in the player’s local time zone. Everyone playing on the same calendar date receives the same puzzles in the same order. Started challenges can be resumed after midnight. Finishing a set on its scheduled date counts toward streaks.

A short worked example opens on the first visit and stays available from How to play. Scheduled warm-ups use three examples, four answer choices, and one visible change.

A first-try solve without hints earns two points. A solve with a hint or a retry earns one. Each puzzle has two guesses. Players can reveal the answer at any time. The app derives statistics and achievements from saved daily rounds in the browser, and shared results omit answers.

## Prepare and review puzzle sets

`content/season-one.json` assigns 30 sets to December 2–31, 2026. The earlier prototypes are available on their existing dates and through their private sample links. Once the dated calendar starts, the app serves a set only when that date has content. It shows an availability message at the end of the schedule.

To extend the schedule, append dated authoring entries, run `npm run content`, and commit the resulting `public/content/daily.json`. Keep previously served IDs, versions, dates, and puzzle choices stable so saved progress still matches. The offline draft generator in `scripts/draft-season.mjs` demonstrates how to create candidates for editorial review.

The compiler tests the intended rule against alternatives in its supported library, requires five distinct formats per new set, and emits stable choices. It also checks that scheduled clues show the transitions the player needs, such as every link in a color cycle and both sides of a condition. Before public launch, review the first month's examples, distractors, explanations, and difficulty progression in the browser. The current static build includes future puzzle assets in its catalog. A server-side delivery policy can keep future sets out of the browser until their scheduled date.

## Deploy on Cloudflare Pages

Set the build command to `npm run build` and the output directory to `dist`. Configure the game domain in Pages when it is chosen. The links in `public/src/games.mjs` are shared by the header and result screen.

First-party analytics is opt-in. To enable it, apply `migrations/0001_analytics.sql` to a Rulebreaker D1 database, bind it to Pages Functions as `RULEBREAKER_ANALYTICS`, and set the build command to `npm run build -- --analytics`. The endpoint accepts small same-origin batches and stores the random browser ID and an allowlisted set of gameplay fields. It omits guess selections and full referrer URLs. The client and endpoint respect Do Not Track and Global Privacy Control.

Use D1 counts by day and event type to measure starts, completions, sharing, and return visits. Compare `puzzle_open` with the next puzzle being opened or the set being completed, grouped by browser and challenge date, to estimate abandonment. The daily game works with the default analytics-off build.
