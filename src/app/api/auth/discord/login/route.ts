import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/auth";
import { launcherContext } from "@/lib/launcher-protocol";

export async function GET(request: Request) {
  let launcher;
  try {
    launcher = launcherContext(new URL(request.url).searchParams);
  } catch {
    return NextResponse.json({ error: "Paramètres launcher invalides" }, { status: 400 });
  }
  const clientId = process.env.DISCORD_CLIENT_ID?.replace(/^[|"'\s]+|[|"'\s]+$/g, "");
  const origin = new URL(request.url).origin;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${origin}/api/auth/discord/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "DISCORD_CLIENT_ID is not configured in .env" },
      { status: 500 }
    );
  }

  // Generate cryptographically signed anti-CSRF state token
  const state = createOAuthState();

  const scope = encodeURIComponent(launcher ? "identify" : "identify guilds");
  const encodedRedirect = encodeURIComponent(redirectUri);

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=${scope}&state=${state}`;

  const response = NextResponse.redirect(discordAuthUrl);

  const isLocalhost =
    (process.env.NEXT_PUBLIC_APP_URL || "").includes("localhost") ||
    (process.env.NEXT_PUBLIC_APP_URL || "").includes("127.0.0.1") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1");

  // Store state in a short-lived secure HttpOnly cookie (10 minutes)
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !isLocalhost,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });
  if (launcher) {
    response.cookies.set("oauth_launcher", JSON.stringify({ ...launcher, oauthState: state }), {
      httpOnly: true, secure: process.env.NODE_ENV === "production" && !isLocalhost,
      sameSite: "lax", path: "/", maxAge: 10 * 60,
    });
  } else {
    response.cookies.delete("oauth_launcher");
  }

  return response;
}
