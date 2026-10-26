import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeOtp } from "@/lib/otp-store";

const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: z.string().regex(/^\d{6}$/)
});

export async function POST(request: Request) {
  try {
    const parsed = verifySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter the six-digit code." }, { status: 400 });
    const result = consumeOtp(parsed.data.email, parsed.data.otp);
    if (result === "expired") return NextResponse.json({ error: "That code has expired. Request a new one." }, { status: 400 });
    if (result === "mismatch") return NextResponse.json({ error: "That code does not match." }, { status: 400 });
    const response = NextResponse.json({ ok: true, profile: { name: parsed.data.email.split("@")[0], email: parsed.data.email } });
    response.cookies.set("planodyssey_session", `otp:${parsed.data.email}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
    return response;
  } catch {
    return NextResponse.json({ error: "Verification is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
