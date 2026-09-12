import { Hono } from "hono";
import { cors } from "hono/cors";
import register from "./routes/auth/register";
import login from "./routes/auth/login";
import me from "./routes/auth/me";
import google from "./routes/auth/google";
import forgotPassword from "./routes/auth/forgotPassword";
import resetPassword from "./routes/auth/resetPassword";
import createListing from "./routes/listings/create";
import manageListings from "./routes/listings/manage";
import properties from "./routes/properties";
import uploads from "./routes/uploads";
import media from "./routes/media";
import messages from "./routes/messages/conversations";
import sendMessage from "./routes/messages/send";
import viewings from "./routes/viewings";
import profiles from "./routes/profiles";
import savedProperties from "./routes/saved-properties";
import capabilities from "./routes/capabilities";
import identityVerification from "./routes/verification/identity";
import propertyAuthority from "./routes/verification/propertyAuthority";
import adminVerification from "./routes/admin/verification";


type Env = {
  Bindings: {
    DB: D1Database;
    zimrent_media: R2Bucket;
    APP_ENV: string;
    JWT_SECRET?: string;
    ALLOWED_ORIGINS?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REDIRECT_URI?: string;
    FRONTEND_URL?: string;
    BREVO_API_KEY?: string;
    BREVO_FROM_EMAIL?: string;
    BREVO_FROM_NAME?: string;
  };
};

const app = new Hono<Env>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = (c.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

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
app.route("/auth/forgot-password", forgotPassword);
app.route("/auth/reset-password", resetPassword);

app.route("/properties", properties);

app.route("/listings", createListing);
app.route("/listings", manageListings);

app.route("/messages/conversations", messages);
app.route("/messages/conversations", sendMessage);

app.route("/viewings", viewings);

app.route("/profiles", profiles);
app.route("/saved-properties", savedProperties);
app.route("/uploads", uploads);
app.route("/media", media);
app.route("/capabilities", capabilities);
app.route("/identity-verification", identityVerification);
app.route("/property-authority", propertyAuthority);
app.route("/admin", adminVerification);

export default app;
