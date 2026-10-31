import { NextResponse } from "next/server";
import { z } from "zod";
import { accountToken, findAccount, passwordMatches, publicAccount } from "@/lib/account-db";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  username: z.string().trim().min(3).max(60),
  password: z.string().min(1).max(200)
});

export async function POST(request: Request) {
  // Slow down password guessing: 10 attempts per minute per IP.
  if (!rateLimit(`login:${clientKey(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many login attempts. Please wait a minute and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });

  const account = findAccount(parsed.data.username);
  if (!account || !passwordMatches(parsed.data.password, account.passwordHash, account.salt)) {
    return NextResponse.json({ error: "Username or password is incorrect. Register as a new user if you do not have an account." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, profile: publicAccount(account) });
  response.cookies.set("planodyssey_session", accountToken(account), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/"
  });
  return response;
}