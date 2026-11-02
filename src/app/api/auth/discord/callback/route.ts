import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie, isDiscordAdmin, verifyOAuthState } from "@/lib/auth";
import { syncSftpUser } from "@/lib/sftpgo";
import { launcherContext } from "@/lib/launcher-protocol";
import { createLauncherCode, privateHeaders } from "@/lib/launcher-auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const origin = new URL(request.url).origin;

  const cookieStore = await cookies();
  const savedState = cookieStore.get("oauth_state")?.value;
  const savedLauncher = cookieStore.get("oauth_launcher")?.value;
  cookieStore.delete("oauth_launcher");

  // Clear state cookie
  cookieStore.delete("oauth_state");

  let launcher = null;
  try {
    const context = savedLauncher ? JSON.parse(savedLauncher) : null;
    // A valid browser-bound context can report an error to its launcher even
    // when Discord returns a bad/missing state. It must never authorize a login.
    if (context?.oauthState === savedState && verifyOAuthState(savedState ?? null)) {
      launcher = launcherContext(new URLSearchParams({
        launcher_redirect: context.redirect, code_challenge: context.challenge, launcher_state: context.state,
      }));
    }
  } catch {
    return NextResponse.json({ error: "Contexte launcher invalide" }, { status: 400 });
  }
  const failure = (error: string) => {
    const target = new URL(launcher ? launcher.redirect : '/', origin);
    target.searchParams.set('error', error);
    if (launcher) target.searchParams.set('state', launcher.state);
    return NextResponse.redirect(target, { headers: { ...privateHeaders, 'Referrer-Policy': 'no-referrer' } });
  };
  // Credentials are only issued after both the signature and browser binding pass.
  const isStateValid = verifyOAuthState(state) && Boolean(savedState && state && state === savedState);
  if (!isStateValid) return failure('invalid_csrf_state');
  if (!code) return failure(searchParams.get('error') === 'access_denied' ? 'access_denied' : 'missing_code');

  const clientId = process.env.DISCORD_CLIENT_ID?.replace(/^[|"'\s]+|[|"'\s]+$/g, "");
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.replace(/^[|"'\s]+|[|"'\s]+$/g, "");
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${origin}/api/auth/discord/callback`;

  if (!clientId || !clientSecret) {
    return failure('server_configuration');
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
      return failure('auth_failed');
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
      return failure('profile_failed');
    }

    const discordProfile = await userRes.json();
    const discordId = discordProfile.id;
    const username = discordProfile.username;
    const avatar = discordProfile.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordProfile.avatar}.png`
      : null;

    const isAdmin = isDiscordAdmin(discordId);

    if (launcher) {
      // Players use the same Discord identity but receive no creator/SFTP rights.
      const player = await prisma.user.upsert({
        where: { discordId },
        create: { discordId, username, avatar, role: 'PLAYER' },
        update: { username, avatar },
      });
      await prisma.sessionAccess.updateMany({
        where: { identifier: username.toLowerCase(), discordId: null }, data: { discordId },
      });
      const launcherCode = await createLauncherCode(player.id, launcher.challenge);
      const target = new URL(launcher.redirect);
      target.searchParams.set('code', launcherCode);
      target.searchParams.set('state', launcher.state);
      return NextResponse.redirect(target, { headers: { ...privateHeaders, 'Referrer-Policy': 'no-referrer' } });
    }

    // Verify user is a member of the Launched Discord server
    const requiredGuildId = process.env.DISCORD_GUILD_ID || "1496947207847411965";
    const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let isInGuild = false;
    if (guildsRes.ok) {
      const guilds = await guildsRes.json();
      if (Array.isArray(guilds)) {
        isInGuild = guilds.some((g: { id: string }) => g.id === requiredGuildId);
      }
    } else {
      console.error("[Discord OAuth] Failed to fetch user guilds:", await guildsRes.text());
    }

    if (!isInGuild && !isAdmin) {
      console.warn(`[Discord OAuth] User ${username} (${discordId}) is not in guild ${requiredGuildId}`);
      const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
      const baseOrigin = host ? `${proto}://${host}` : origin;
      return NextResponse.redirect(`${baseOrigin}/dashboard?error=not_in_guild`);
    }

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
      const sftpUser = `u_${cleanUsername || "creator"}_${discordId.slice(-4)}`;

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

      if (user.sftpUsername) {
        try {
          await syncSftpUser({
            username: user.sftpUsername,
            password: generatedPassword,
            diskQuotaBytes: user.diskQuotaBytes,
            sessions: [],
          });
        } catch (sftpErr) {
          console.warn("[Discord OAuth] SFTP initial sync warning:", sftpErr);
        }
      }
    } else {
      const needsSftpGen = !user.sftpUsername || !user.sftpPassword || user.sftpPassword === "dummy-encrypted-password";
      const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      const generatedPassword = crypto.randomBytes(8).toString("hex");
      const sftpUser = user.sftpUsername || `u_${cleanUsername || "creator"}_${discordId.slice(-4)}`;
      const sftpPass = (user.sftpPassword && user.sftpPassword !== "dummy-encrypted-password")
        ? user.sftpPassword
        : generatedPassword;

      // Update username, avatar, admin role and sftp credentials if needed
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          username,
          avatar,
          ...(user.role === 'PLAYER' ? { role: 'CREATOR' as const } : {}),
          ...(needsSftpGen ? { sftpUsername: sftpUser, sftpPassword: sftpPass } : {}),
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

      // Sync SFTP only if the user already has sessions
      if (user.sftpUsername && user.sessionMembers.length > 0) {
        try {
          await syncSftpUser({
            username: user.sftpUsername,
            password: user.sftpPassword || undefined,
            diskQuotaBytes: user.diskQuotaBytes,
            sessions: user.sessionMembers.map((m) => ({
              sessionId: m.session.id,
              slug: m.session.slug,
              sessionName: m.session.name,
            })),
          });
        } catch (sftpErr) {
          console.warn("[Discord OAuth] SFTP sync warning for existing user:", sftpErr);
        }
      }
    }

    await prisma.sessionAccess.updateMany({
      where: { identifier: username.toLowerCase(), discordId: null }, data: { discordId },
    });

    // 4. Create JWT and set cookie
    const token = await createSessionToken({
      userId: user.id,
      discordId: user.discordId,
      role: user.role,
    });

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
    const baseOrigin = host ? `${proto}://${host}` : origin;
    const targetUrl = new URL("/dashboard", baseOrigin);
    targetUrl.searchParams.set("token", token);
    const response = NextResponse.redirect(targetUrl);
    await setSessionCookie(token, response);

    return response;
  } catch (err) {
    console.error("[Discord OAuth] Callback error:", err);
    return failure('server_error');
  }
}
