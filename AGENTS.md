# AGENTS.md

## Project Context

This is a ZimRent app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## ZimRent References

- CLI overview: https://docs.zimrent.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.zimrent.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update ZimRent skills before ZimRent-specific work:

```bash
npx skills add zimrent/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/zimrentClient.js`: frontend ZimRent SDK client.
- `vite.config.js`: Vite config and ZimRent Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `zimrent dev` as the default local development command when you need the local ZimRent backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the ZimRent project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `zimrent/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted ZimRent backend.
- Prefer the existing ZimRent CLI workflow over adding new npm scripts for ZimRent-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new ZimRent integration paths.
- Run the relevant checks from `package.json` before finishing code changes.
