# ZimRent Project

Use this repository to run and edit the app locally, then publish changes back through ZimRent.

Any change pushed to the repo will also be reflected in the ZimRent Builder.

## Prerequisites

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Install the ZimRent CLI: `npm install -g zimrent@latest`.
5. Install [Deno](https://docs.deno.com/runtime/getting_started/installation/) — the local ZimRent backend runs on it.

Run `zimrent --help` (or see the [CLI reference](https://docs.zimrent.com/developers/references/cli/commands/introduction)) for the full command surface.

## Run Locally

Three commands, from the project root:

```bash
zimrent login   # one-time per machine
zimrent link    # one-time per clone
zimrent dev     # local backend + frontend together
```

Open the frontend URL that `zimrent dev` prints (typically `http://localhost:5173`).

Notes:

- **Every fresh clone needs `zimrent link`.** It writes `zimrent/.app.jsonc` (the app-id pointer), which is deliberately gitignored. Your app id is in the Builder URL (`app.zimrent.com/apps/<id>/...`); `zimrent link --help` shows the non-interactive flags.
- **`zimrent dev` runs the frontend for you** (via `site.serveCommand` in this repo's `zimrent/config.jsonc`) — never run `npm run dev` yourself: alone it serves a UI with no backend behind it (`[zimrent] Proxy not enabled`, every `/api` call fails), and alongside `zimrent dev` the second Vite silently takes the next port and you end up looking at the wrong one.
- **The app must be published at least once for the UI to load under `zimrent dev`.** The frontend boots by fetching app settings from the hosted app; before the first publish that fails and every page redirects to login. The local API works regardless.
- Entities, functions, and auth run locally — entity data is **in-memory only**, wiped when `zimrent dev` restarts. Everything else (Core integrations, OAuth login) is forwarded to your deployed app. Full breakdown: [Local development overview](https://docs.zimrent.com/developers/backend/overview/local-dev/local-development-overview).

## Frontend Only, Hosted Backend

To work on just the frontend against your app's live hosted backend:

```bash
zimrent dev --remote
```

⚠️ In this mode writes go to your app's **production data** — plain `zimrent dev` keeps everything local.

## Publish Your Changes

After pushing your changes to git, open the ZimRent dashboard and publish the app:

```bash
zimrent dashboard open
```

This repo syncs to ZimRent through git, so publish from the dashboard rather than `zimrent deploy` — a CLI deploy ships your local tree directly, bypassing the sync, and the deployed state silently diverges from the repo.

## Docs & Support

GitHub integration: [https://docs.zimrent.com/developers/app-code/local-development/github](https://docs.zimrent.com/developers/app-code/local-development/github)

Local development: [https://docs.zimrent.com/developers/backend/overview/local-dev/local-development-overview](https://docs.zimrent.com/developers/backend/overview/local-dev/local-development-overview)

Support: [https://app.zimrent.com/support](https://app.zimrent.com/support)
