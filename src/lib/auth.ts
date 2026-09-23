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

// Base64URL encoding/decoding
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString();
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
  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

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
    const signatureBytes = Uint8Array.from(
      Buffer.from(encodedSignature.replace(/-/g, "+").replace(/_/g, "/"), "base64")
    );

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
  const isLocalhost =
    (process.env.NEXT_PUBLIC_APP_URL || "").includes("localhost") ||
    (process.env.NEXT_PUBLIC_APP_URL || "").includes("127.0.0.1");

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !isLocalhost,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 3600,
  };

  if (response) {
    response.cookies.set(COOKIE_NAME, token, cookieOptions);
  } else {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, cookieOptions);
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
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
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
