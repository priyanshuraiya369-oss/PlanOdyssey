import { NextResponse } from "next/server";
import { createOrFindGoogleAccount } from "@/lib/account-db";

type GoogleToken = { access_token?: string; error?: string };
type GoogleProfile = { email?: string; name?: string; verified_email?: boolean };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = request.headers.get("cookie") || "";
  const expectedState = cookies.match(/(?:^|;\s*)google_oauth_state=([^;]+)/)?.[1];
  const fail = (message: string) => NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(message)}`, request.url));
  if (!code || !state || !expectedState || state !== expectedState) return fail("Google sign-in expired. Please try again.");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || new URL("/api/auth/google/callback", request.url).toString();
  if (!clientId || !clientSecret) return fail("Google sign-in is not configured.");
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      cache: "no-store"
    });
    const token = await tokenResponse.json() as GoogleToken;
    if (!tokenResponse.ok || !token.access_token) return fail("Google could not complete sign-in.");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" });
    const profile = await profileResponse.json() as GoogleProfile;
    if (!profileResponse.ok || !profile.email || profile.verified_email === false) return fail("Google did not return a verified email.");
    const account = createOrFindGoogleAccount({ email: profile.email, displayName: profile.name || profile.email.split("@")[0] });
    const session = Buffer.from(JSON.stringify(account), "utf8").toString("base64url");
    const response = NextResponse.redirect(new URL("/?google=success", request.url));
    response.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
    response.cookies.set("planodyssey_session", `google:${session}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
    return response;
  } catch {
    return fail("Google sign-in is temporarily unavailable.");
  }
}

