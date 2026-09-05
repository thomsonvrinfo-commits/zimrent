import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

export type AuthUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  email_verified: boolean;
};

function getSecret(env: { JWT_SECRET?: string }) {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
) {
  return bcrypt.compare(password, passwordHash);
}

export async function createAccessToken(
  user: AuthUser,
  env: { JWT_SECRET?: string },
) {
  return new SignJWT({
    email: user.email,
    role: user.role,
    email_verified: user.email_verified,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret(env));
}

export async function verifyAccessToken(
  token: string,
  env: { JWT_SECRET?: string },
) {
  const result = await jwtVerify(token, getSecret(env));

  return {
    userId: result.payload.sub as string,
    email: result.payload.email as string | undefined,
    role: result.payload.role as string | undefined,
  };
}