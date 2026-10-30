import { createHash, randomBytes, randomUUID } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";


export const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60; // 15 min

export class JwtConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtConfigurationError";
  }
}

export function getJwtSecret(
  environment: NodeJS.ProcessEnv = process.env,
): Uint8Array {
  const secret = environment["JWT_SECRET"];

  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new JwtConfigurationError(
      "JWT_SECRET must contain at least 32 bytes",
    );
  }

  return new TextEncoder().encode(secret);
}

export async function createAccessToken(
  userId: string,
  secret: Uint8Array = getJwtSecret(),
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ACCESS_TOKEN_LIFETIME_SECONDS)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
  secret: Uint8Array = getJwtSecret(),
): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
  });

  if (!payload.sub) {
    throw new Error("Access token is missing its subject");
  }
  return { userId: payload.sub };
}

export function createRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
