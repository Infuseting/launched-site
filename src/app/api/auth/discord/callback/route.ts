import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie, isDiscordAdmin } from "@/lib/auth";
import { syncSftpUser } from "@/lib/sftpgo";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const origin = new URL(request.url).origin;

  const cookieStore = await cookies();
  const savedState = cookieStore.get("oauth_state")?.value;

  // Clear state cookie immediately
  cookieStore.delete("oauth_state");

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=missing_code`);
  }

  // Anti-CSRF verification
  if (!state || !savedState || state.length !== savedState.length) {
    return NextResponse.redirect(`${origin}/?error=invalid_csrf_state`);
  }

  const stateBuffer = Buffer.from(state);
  const savedStateBuffer = Buffer.from(savedState);
  if (!crypto.timingSafeEqual(stateBuffer, savedStateBuffer)) {
    return NextResponse.redirect(`${origin}/?error=invalid_csrf_state`);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${origin}/api/auth/discord/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Discord OAuth credentials missing" }, { status: 500 });
  }

  try {
    // 1. Exchange code for token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[Discord OAuth] Token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch user profile
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${origin}/?error=profile_failed`);
    }

    const discordProfile = await userRes.json();
    const discordId = discordProfile.id;
    const username = discordProfile.username;
    const avatar = discordProfile.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordProfile.avatar}.png`
      : null;

    const isAdmin = isDiscordAdmin(discordId);

    // 3. Find or create user
    let user = await prisma.user.findUnique({
      where: { discordId },
      include: {
        sessionMembers: {
          include: {
            session: true,
          },
        },
      },
    });

    if (!user) {
      const generatedPassword = crypto.randomBytes(8).toString("hex");
      const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      const sftpUser = `u_${cleanUsername}_${discordId.slice(-4)}`;

      user = await prisma.user.create({
        data: {
          discordId,
          username,
          avatar,
          role: isAdmin ? "ADMIN" : "CREATOR",
          sessionLimit: isAdmin ? 99 : 0, // Admins get high limit by default
          sftpUsername: sftpUser,
          sftpPassword: generatedPassword,
        },
        include: {
          sessionMembers: {
            include: {
              session: true,
            },
          },
        },
      });

      // If admin, initialize SFTPGo account immediately
      if (isAdmin && user.sftpUsername) {
        await syncSftpUser({
          username: user.sftpUsername,
          password: generatedPassword,
          diskQuotaBytes: user.diskQuotaBytes,
          sessions: [],
        });
      }
    } else {
      // Update username, avatar, and admin role if needed
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username,
          avatar,
          ...(isAdmin && user.role !== "ADMIN" ? { role: "ADMIN", sessionLimit: Math.max(user.sessionLimit, 99) } : {}),
        },
        include: {
          sessionMembers: {
            include: {
              session: true,
            },
          },
        },
      });
    }

    // 4. Create JWT and set cookie
    const token = await createSessionToken({
      userId: user.id,
      discordId: user.discordId,
      role: user.role,
    });

    await setSessionCookie(token);

    return NextResponse.redirect(`${origin}/dashboard`);
  } catch (err) {
    console.error("[Discord OAuth] Callback error:", err);
    return NextResponse.redirect(`${origin}/?error=server_error`);
  }
}
