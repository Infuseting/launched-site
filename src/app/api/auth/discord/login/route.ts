import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const origin = new URL(request.url).origin;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${origin}/api/auth/discord/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "DISCORD_CLIENT_ID is not configured in .env" },
      { status: 500 }
    );
  }

  // Generate cryptographically secure anti-CSRF state token
  const state = crypto.randomBytes(32).toString("hex");

  const scope = encodeURIComponent("identify");
  const encodedRedirect = encodeURIComponent(redirectUri);

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=${scope}&state=${state}`;

  const response = NextResponse.redirect(discordAuthUrl);

  // Store state in a short-lived secure HttpOnly cookie (10 minutes)
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });

  return response;
}
