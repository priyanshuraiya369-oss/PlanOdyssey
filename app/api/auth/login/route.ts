import { NextResponse } from "next/server";

/** Ends the session by expiring the same cookie that /api/auth/login sets. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("planodyssey_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    expires: new Date(0),
    path: "/"
  });
  return response;
}