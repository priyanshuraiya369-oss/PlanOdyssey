import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccount } from "@/lib/account-db";

const schema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(80)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Use a valid username, email, name, and password of at least 8 characters." }, { status: 400 });
  try {
    const account = await createAccount(parsed.data);
    return NextResponse.json({ ok: true, profile: account }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("UNIQUE") ? "That username or email is already registered. Try logging in." : "Registration failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
