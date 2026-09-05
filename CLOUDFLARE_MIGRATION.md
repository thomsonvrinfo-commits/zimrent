# ZimRent Cloudflare Migration

This repository is the frontend checkpoint for ZimRent after removing the previous hosted-platform runtime.

## Frontend

- React 18
- Vite 6
- Tailwind CSS
- React Router
- Deploy target: Cloudflare Pages

## API contract

The frontend uses `src/api/zimrentClient.js` as the single API boundary. Configure:

`VITE_API_BASE_URL=/api`

The independent backend should expose:

- `GET /auth/me`
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/verify-otp`
- `POST /auth/resend-otp`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /public-settings`
- `GET/POST/PATCH/DELETE /entities/:entity`
- `POST /functions/:name`
- `POST /uploads`

The API implementation should be backed by Cloudflare Workers, D1, and R2. Reservation and payment state changes must be authoritative on the server.

## Deployment

Build:

`npm run build`

Cloudflare Pages build command:

`npm run build`

Output directory:

`dist`

Set production environment variables in Cloudflare Pages rather than committing secrets.
