import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";

type GoogleEnv = {
  JWT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
};

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

// Cached per isolate. jose refreshes this automatically if it sees a `kid`
// it doesn't recognise, so this is safe to reuse across requests/deploys.
let googleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getGoogleJwks() {
  if (!googleJwks) {
    googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  }
  return googleJwks;
}

function getStateSecret(env: GoogleEnv) {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  // Reuses the same server-side secret that signs access tokens. Scoped
  // apart from access tokens via issuer/audience claims (see below) so a
  // state token can never be mistaken for — or misused as — a session token.
  return new TextEncoder().encode(env.JWT_SECRET);
}

function requireGoogleConfig(env: GoogleEnv) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth is not configured");
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
  };
}

/**
 * Mirrors src/lib/authReturnTo.js on the frontend: only ever allow a single
 * same-origin relative path. Rejects protocol-relative ("//evil.com") and
 * backslash tricks that can normalize into an off-site redirect.
 */
export function sanitizeReturnTo(raw: string | undefined | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.includes("\\")) return "/";
  return raw;
}

/**
 * Signed, short-lived state token. `nonce` is also set as an httpOnly cookie
 * on the redirect to Google; the callback requires both to match, which
 * defends against login CSRF (an attacker can't set a victim's cookie for
 * this domain), not just state forgery (which the signature already blocks).
 */
export async function createOAuthState(nonce: string, returnTo: string, env: GoogleEnv) {
  return new SignJWT({ nonce, returnTo })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("zimrent-oauth")
    .setAudience("zimrent-oauth-callback")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getStateSecret(env));
}

export async function verifyOAuthState(token: string, env: GoogleEnv) {
  const { payload } = await jwtVerify(token, getStateSecret(env), {
    issuer: "zimrent-oauth",
    audience: "zimrent-oauth-callback",
  });

  return {
    nonce: payload.nonce as string,
    returnTo: payload.returnTo as string,
  };
}

export function buildGoogleAuthUrl(state: string, env: GoogleEnv) {
  const { clientId, redirectUri } = requireGoogleConfig(env);

  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

/** Server-side authorization-code exchange. Client secret never leaves the Worker. */
export async function exchangeCodeForIdToken(code: string, env: GoogleEnv) {
  const { clientId, clientSecret, redirectUri } = requireGoogleConfig(env);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status})`);
  }

  const data = await response.json<{ id_token?: string }>();
  if (!data.id_token) {
    throw new Error("Google token response did not include an id_token");
  }
  return data.id_token;
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

/**
 * This is the actual identity check: verifies the id_token's signature
 * against Google's live JWKS, and validates issuer, audience (our client
 * id) and expiry. Nothing here trusts a bare "email" value from anywhere
 * unsigned.
 */
export async function verifyGoogleIdToken(idToken: string, env: GoogleEnv): Promise<GoogleProfile> {
  const { clientId } = requireGoogleConfig(env);

  const { payload } = await jwtVerify(idToken, getGoogleJwks(), {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  const email = payload.email as string | undefined;
  if (!email) {
    throw new Error("Google identity token did not include an email");
  }

  return {
    sub: payload.sub as string,
    email: email.toLowerCase(),
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: (payload.name as string | undefined) || null,
    picture: (payload.picture as string | undefined) || null,
  };
}
