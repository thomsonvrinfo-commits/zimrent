import { Hono } from "hono";
import { cors } from "hono/cors";
import register from "./routes/auth/register";
import login from "./routes/auth/login";
import me from "./routes/auth/me";
import google from "./routes/auth/google";
import createListing from "./routes/listings/create";
import properties from "./routes/properties";
import messages from "./routes/messages/conversations";
import sendMessage from "./routes/messages/send";
import viewings from "./routes/viewings";

type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
    JWT_SECRET?: string;
    // Comma-separated list of allowed frontend origins, e.g.
    // "https://zimrent.pages.dev,https://www.zimrent.co.zw"
    ALLOWED_ORIGINS?: string;
    // Google OAuth — see workers/api/src/routes/auth/google.ts
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REDIRECT_URI?: string;
    FRONTEND_URL?: string;
  };
};

const app = new Hono<Env>();

// The Pages frontend (zimrent.pages.dev) and this Worker are different
// origins, so every browser request needs CORS or it will be blocked
// client-side before it even reaches these routes.
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = (c.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

      // No ALLOWED_ORIGINS configured yet (e.g. first deploy) -> allow any
      // origin so nothing is silently broken; tighten this once the
      // production frontend URL is confirmed.
      if (allowed.length === 0) return origin;

      return allowed.includes(origin) ? origin : null;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "zimrent-api",
    environment: c.env.APP_ENV,
  });
});

// The frontend's AuthContext calls this on every page load before it will
// check the user's session at all — without a response here, every
// protected route in the app treats the user as logged out, even with a
// valid token. This is a stub until real app-level settings exist.
app.get("/public-settings", (c) => {
  return c.json({
    id: "zimrent",
    public_settings: {},
  });
});

app.route("/auth/register", register);
app.route("/auth/login", login);
app.route("/auth/me", me);
app.route("/auth/google", google);

app.route("/properties", properties);
app.route("/listings", createListing);

app.route("/messages/conversations", messages);
app.route("/messages/conversations", sendMessage);

app.route("/viewings", viewings);

export default app;
