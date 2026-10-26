import { NextResponse } from "next/server";
import { z } from "zod";
import { saveOtp } from "@/lib/otp-store";

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(request: Request) {
  let transporter: { sendMail: (options: Record<string, string>) => Promise<unknown>; close: () => void } | undefined;
  try {
    const parsed = emailSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 5 * 60 * 1000;
    saveOtp(parsed.data.email, otp, expiresAt);
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = process.env.SMTP_SECURE === "true";
    const smtpConfigured = Boolean(host && user && pass);
    if (smtpConfigured && (!Number.isInteger(port) || port < 1 || port > 65535)) {
      return NextResponse.json({ error: "SMTP_PORT must be a valid port number." }, { status: 503 });
    }
    if (host && user && pass) {
      const nodemailer = await import("nodemailer");
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM?.trim() || user,
        to: parsed.data.email,
        subject: "Your PlanOdyssey sign-in code",
        text: `Your PlanOdyssey verification code is ${otp}. It expires in 5 minutes.`
      });
    }
    return NextResponse.json({ ok: true, email: parsed.data.email, demoCode: smtpConfigured ? undefined : otp });
  } catch (error) {
    const smtpError = error as { code?: string; responseCode?: number; message?: string };
    console.error("[otp] SMTP delivery failed", JSON.stringify({
      code: smtpError.code ?? "unknown",
      responseCode: smtpError.responseCode ?? null,
      message: smtpError.message?.slice(0, 180) ?? "unknown error"
    }));
    const timedOut = smtpError.code === "ETIMEDOUT" || smtpError.code === "ESOCKET" || smtpError.code === "ECONNECTION";
    return NextResponse.json({
      error: timedOut
        ? "Email delivery timed out. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, and your network connection, then try again."
        : "Email delivery was rejected. Check your SMTP username, app password, and sender address."
    }, { status: timedOut ? 504 : 502 });
  } finally {
    transporter?.close();
  }
}
