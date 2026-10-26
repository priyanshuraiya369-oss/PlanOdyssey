import { NextResponse } from "next/server";
import { z } from "zod";
import { saveOtp } from "@/lib/otp-store";

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(request: Request) {
  try {
    const parsed = emailSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 5 * 60 * 1000;
    saveOtp(parsed.data.email, otp, expiresAt);
    const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    if (smtpConfigured) {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000
      });
      await Promise.race([
        transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: parsed.data.email,
        subject: "Your PlanOdyssey sign-in code",
        text: `Your PlanOdyssey verification code is ${otp}. It expires in 5 minutes.`
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP delivery timed out.")), 10000))
      ]);
    }
    return NextResponse.json({ ok: true, email: parsed.data.email, demoCode: smtpConfigured ? undefined : otp });
  } catch {
    return NextResponse.json({ error: "We could not send a verification code right now." }, { status: 500 });
  }
}
