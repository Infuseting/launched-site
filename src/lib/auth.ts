import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[SECURITY CRITICAL] JWT_SECRET must be defined in production environment!");
    }
    return "dev_secret_insecure_fallback_do_not_use_in_prod_32c";
  }
  return secret;
}

const COOKIE_NAME = "launched_session";

interface SessionPayload {
  userId: string;
  discordId: string;
  role: string;
  exp: number;
}

/**
 * AES-256-GCM Reversible Encryption according to NIST SP 800-38D
 * Used for sensitive credentials that must be displayed to the user (e.g. SFTP password)
 */
export function encryptSecret(plaintext: string): string {
  const key = crypto.createHash("sha256").update(getJwtSecret()).digest();
  const iv = crypto.randomBytes(12); // 96-bit nonce
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag(); // 128-bit authentication tag

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(cipherData: string): string {
  try {
    const [ivHex, tagHex, encryptedHex] = cipherData.split(":");
    if (!ivHex || !tagHex || !encryptedHex) return cipherData; // Fallback if plaintext legacy

    const key = crypto.createHash("sha256").update(getJwtSecret()).digest();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    // If decryption fails (corrupted or unencrypted legacy data), return raw or empty
    return cipherData;
  }
}

/**
 * Generates a signed, stateless anti-CSRF OAuth state token (RFC 6749 / RFC 9700).
 * Format: <timestamp>.<randomNonce>.<hmacSignature>
 */
export function createOAuthState(): string {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${timestamp}.${nonce}`;
  const hmac = crypto.createHmac("sha256", getJwtSecret()).update(payload).digest("base64url");
  return `${payload}.${hmac}`;
}

/**
 * Cryptographically verifies a signed OAuth state token.
 * Validates HMAC authenticity and checks expiration (15 minutes).
 */
export function verifyOAuthState(state: string | null): boolean {
  if (!state) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;

  const [timestampStr, nonce, hmac] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > 15 * 60 * 1000 || timestamp > Date.now() + 60000) {
    return false; // Expired or invalid timestamp
  }

  const payload = `${timestampStr}.${nonce}`;
  const expectedHmac = crypto.createHmac("sha256", getJwtSecret()).update(payload).digest("base64url");

  if (hmac.length !== expectedHmac.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
}

// Base64URL encoding/decoding
function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(getJwtSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Creates a signed JWT token valid for 30 days.
 */
export async function createSessionToken(payload: Omit<SessionPayload, "exp">): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600, // 30 days
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await getCryptoKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const encodedSignature = Buffer.from(signature).toString("base64url");

  return `${data}.${encodedSignature}`;
}

/**
 * Verifies and decodes a signed JWT token.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const key = await getCryptoKey();
    const signatureBytes = Buffer.from(encodedSignature, "base64url");

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(data)
    );

    if (!isValid) return null;

    const payload: SessionPayload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Sets session cookie.
 */
export async function setSessionCookie(token: string, response?: NextResponse) {
  const isHttps = process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false;

  const cookieOptions = {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 3600,
  };

  if (response) {
    response.cookies.set(COOKIE_NAME, token, cookieOptions);
  }
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, cookieOptions);
  } catch {
    // Ignore if not supported in current context
  }
}

/**
 * Removes session cookie.
 */
export async function clearSessionCookie(response?: NextResponse) {
  if (response) {
    response.cookies.delete(COOKIE_NAME);
  } else {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
  }
}

/**
 * Retrieves the current authenticated user from database.
 * Accepts a Request, an explicit token string, or falls back to cookies.
 */
export async function getCurrentUser(requestOrToken?: Request | string | null) {
  let token: string | null | undefined = null;

  if (typeof requestOrToken === "string") {
    token = requestOrToken;
  } else if (requestOrToken && typeof (requestOrToken as Request).headers?.get === "function") {
    const req = requestOrToken as Request;
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }
    if (!token) {
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(/(?:^|;\s*)launched_session=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    } catch {
      // Ignore if not supported in current context
    }
  }

  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        sessionMembers: {
          include: {
            session: true,
          },
        },
      },
    });
    return user;
  } catch (err) {
    console.error("[Auth] Error fetching user:", err);
    return null;
  }
}

/**
 * Checks if a Discord ID is configured as admin.
 */
export function isDiscordAdmin(discordId: string): boolean {
  const adminIds = (process.env.DISCORD_ADMIN_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return adminIds.includes(discordId);
}
