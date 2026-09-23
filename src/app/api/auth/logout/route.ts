import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function GET(request: Request) {
  await clearSessionCookie();
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/`);
}
