import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const value = request.headers.get("cookie")?.match(/(?:^|;\s*)planodyssey_session=([^;]+)/)?.[1] || "";
  if (!value.startsWith("google:")) return NextResponse.json({ signedIn: false });
  try {
    const profile = JSON.parse(Buffer.from(value.slice(7), "base64url").toString("utf8"));
    if (!profile?.email || !profile?.name) throw new Error("Invalid session");
    return NextResponse.json({ signedIn: true, profile });
  } catch {
    return NextResponse.json({ signedIn: false });
  }
}

