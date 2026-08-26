# Cardio Tracker

A mobile-first cardio/running tracker for marathon training. Log workouts manually, bulk-import your
Strava history, and see the stats that matter for avoiding over/under-training: miles per week (MPW),
4-week rolling average, acute:chronic workload ratio (ACWR), long-run share of weekly volume, pace,
and more.

All data is stored locally in the browser (`localStorage`) — there is no backend and nothing is sent
anywhere. Use the **Settings → Export backup** button periodically to save a copy.

## Stats tracked

- **MPW** — miles this calendar week (Mon–Sun), and a 4-week rolling average
- **Week-over-week % change** — flags jumps over the "10% rule"
- **ACWR** (acute:chronic workload ratio) — 7-day mileage vs. 28-day weekly average; the classic
  0.8–1.3 "sweet spot" injury-risk indicator used in sports science
- **Cumulative overload** — 4-week vs. ~13-week (≈3-month) weekly average. ACWR's 7:28-day window
  is tuned for short-term spikes; this longer window is closer to the adaptation timescale reported
  for tendon, ligament, and bone, and catches slow-building overuse that ACWR alone can miss
- **Combined injury-risk status** — a banner at the top of the dashboard that takes the more
  concerning of ACWR and cumulative overload and summarizes it in plain language, the same way a
  training-load app flags risk after each run
- **Longest run** — trailing 4 weeks and all-time
- **Long run % of weekly volume** — a single run dominating the week is an overuse-injury signal
- **Active days** in the last 28 days
- **Average pace**, total time, and monthly/yearly totals
- 12-week volume chart
- All stats can be filtered to Running only or across all cardio types (Bike, Swim, Walk, Elliptical, Row, Hike, Other)

## History

Every logged or imported activity is listed and searchable in the **History** tab: filter by
cardio type, date range, distance range, or duration range (tap **More filters** to expand them),
with a live count of how many activities match.

## Forecast & planner

A dedicated **Forecast** tab lets you plan your next 6 weeks day by day and see the projected
injury-risk zone for each planned day *before* you run it — the chart tracks your trailing 7-day
total rather than single-day mileage, so recent history is shown as smooth solid bars, with your
plan continuing as a dashed projected line.

- Each day shows a suggested **max** — the most that day can hold while keeping your trailing
  7-day load at or under 1.3x your recent 28-day baseline — recalculated live as you fill in other
  days, so an early big day visibly tightens what later days can safely hold
- **Fill with safe daily max** auto-fills all 42 days at that day-by-day ceiling
- **Return-to-running plan**: coming back from time off or injury? Enter your comfortable current
  weekly mileage, a target, and how many weeks to build over, and it spreads a conservative
  ~10%/week ramp across the weekdays you actually run on (detected from your history, or
  Tue/Thu/Sat/Sun by default)
- Every planned day is tagged with its projected load-ratio zone (Sweet spot / Caution / High risk)
  so you can pull a day back before committing to it
- Your plan is saved locally and persists across visits

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview   # serve the production build locally
```

## Getting it on your iPhone

This is an installable Progressive Web App (PWA) — it works offline and behaves like a native app
once added to your home screen.

The repo auto-deploys to **GitHub Pages** on every push via `.github/workflows/deploy-pages.yml`.
One-time setup (already done if you're reading this after that step): in the repo, go to
**Settings → Pages → Build and deployment → Source**, and select **GitHub Actions**. After that,
every push rebuilds and redeploys automatically — check the **Actions** tab for progress.

Once deployed, the app is live at:

```
https://dolomitiinvestor.github.io/cardio/
```

1. Open that URL in **Safari** on your iPhone.
2. Tap the **Share** icon → **Add to Home Screen**.
3. Launch it from the home screen icon — it opens full-screen, no browser chrome, and keeps working
   offline. Data stays on that device only.

Prefer Vercel or Netlify instead? Both work too — connect the repo at vercel.com/new or
app.netlify.com and they'll auto-detect the Vite app (build command `npm run build`, output `dist`).
Note the production `base` path in `vite.config.ts` is set to `/cardio/` for GitHub Pages; on a
platform that serves from the domain root, change it back to `/`.

## Importing from Strava

1. On strava.com: **Settings → My Account → Download or Delete Your Account → Download Request**.
2. Strava emails a link to a zip with an `activities.csv` file.
3. In the app's **Import** tab, upload that CSV. Column mapping (date/type/distance/duration) and
   units are auto-detected but can be adjusted before confirming. Re-importing the same file is safe
   — already-imported activities are detected and skipped.

## Tech

Vite + React + TypeScript + Tailwind CSS, `date-fns` for week/date math, `papaparse` for CSV import,
`recharts` for the volume chart, and `vite-plugin-pwa` for the offline/installable app shell.
