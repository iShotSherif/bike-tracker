# Bike component tracker

Small web app to track cumulative kilometers per bike (from [Intervals.icu](https://intervals.icu)) and remind you when to service components: chain wax, brake check, etc.

## Setup

```bash
cd bike-tracker
npm install
```

## Run locally

```bash
npm run dev
```

Open http://localhost:5173. Enter your Intervals.icu API key (Settings → Developer settings). It is stored only in your browser (localStorage).

## Build for production

```bash
npm run build
```

Output is in `dist/`. Serve with any static host (e.g. `npx serve dist`).

## Usage

- **Load bikes**: Enter your API key and click “Load bikes”. Your bikes and their total distance from Intervals.icu appear.
- **Add component**: For each bike, add items like “Chain wax” (e.g. every 3000 km), “Brake check” (every 5000 km). Optionally set “Last done at km” so the app can show “Due in X km” or “Overdue”.
- **Mark done**: When you service a component, click “Done” to set “last done” to the current bike total km.

All component data is stored in your browser only.
