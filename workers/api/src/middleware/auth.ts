import { createMiddleware } from "hono/factory";
import { verifyAccessToken } from "../services/auth";

type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
    JWT_SECRET?: string;
  };
  Variables: {
    userId: string;
    userEmail?: string;
    userRole?: string;
  };
};

export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const authorization = c.req.header("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const token = authorization.slice(7);

  try {
    const auth = await verifyAccessToken(token, c.env);

    c.set("userId", auth.userId);
    c.set("userEmail", auth.email);
    c.set("userRole", auth.role);

    await next();
  } catch {
    return c.json({ message: "Unauthorized" }, 401);
  }
});