import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const storePath = path.join(process.cwd(), "planodyssey.otps.json");

function readStore(): Record<string, { otp: string; expiresAt: number }> {
  if (!existsSync(storePath)) return {};
  try { return JSON.parse(readFileSync(storePath, "utf8")) as Record<string, { otp: string; expiresAt: number }>; } catch { return {}; }
}

export function saveOtp(email: string, otp: string, expiresAt: number) {
  const store = readStore();
  store[email] = { otp, expiresAt };
  writeFileSync(storePath, JSON.stringify(store), "utf8");
}

export function consumeOtp(email: string, otp: string) {
  const store = readStore();
  const pending = store[email];
  if (!pending || Date.now() > pending.expiresAt) {
    delete store[email];
    writeFileSync(storePath, JSON.stringify(store), "utf8");
    return "expired" as const;
  }
  if (pending.otp !== otp) return "mismatch" as const;
  delete store[email];
  writeFileSync(storePath, JSON.stringify(store), "utf8");
  return "valid" as const;
}
