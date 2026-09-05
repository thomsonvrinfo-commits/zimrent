import { Hono } from "hono";
import register from "./routes/auth/register";
import login from "./routes/auth/login";
import me from "./routes/auth/me";
import createListing from "./routes/listings/create";
import properties from "./routes/properties";

type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
    JWT_SECRET?: string;
  };
};

const app = new Hono<Env>();

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "zimrent-api",
    environment: c.env.APP_ENV,
  });
});

app.route("/auth/register", register);
app.route("/auth/login", login);
app.route("/auth/me", me);

app.route("/properties", properties);
app.route("/listings", createListing);

export default app;