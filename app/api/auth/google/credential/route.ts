import { NextResponse } from "next/server";
import { createOrFindGoogleAccount } from "@/lib/account-db";

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  error_description?: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { credential?: string } | null;
  const credential = body?.credential;
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!credential || !clientId) return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 503 });
  try {
    const tokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { cache: "no-store" });
    const token = await tokenResponse.json() as GoogleTokenInfo;
    const emailVerified = token.email_verified === true || token.email_verified === "true";
    if (!tokenResponse.ok || token.aud !== clientId || !token.email || !emailVerified) {
      return NextResponse.json({ error: "Google returned an invalid or unverified account." }, { status: 401 });
    }
    const account = createOrFindGoogleAccount({ email: token.email, displayName: token.name || token.email.split("@")[0] });
    const session = Buffer.from(JSON.stringify(account), "utf8").toString("base64url");
    const response = NextResponse.json({ ok: true, profile: account });
    response.cookies.set("planodyssey_session", `google:${session}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
    return response;
  } catch {
    return NextResponse.json({ error: "Google sign-in is temporarily unavailable." }, { status: 502 });
  }
}
