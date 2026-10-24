import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Account = { id: number; username: string; email: string; passwordHash: string; salt: string; displayName: string };
const databasePath = path.join(process.cwd(), "planodyssey.accounts.json");

function readAccounts(): Account[] {
  if (!existsSync(databasePath)) return [];
  try {
    return JSON.parse(readFileSync(databasePath, "utf8")) as Account[];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: Account[]) {
  writeFileSync(databasePath, JSON.stringify(accounts, null, 2), { encoding: "utf8", flag: "w" });
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}

export function passwordMatches(password: string, hash: string, salt: string) {
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createAccount(input: { username: string; email: string; password: string; displayName: string }) {
  const accounts = readAccounts();
  const username = normalizeUsername(input.username);
  const email = input.email.trim().toLowerCase();
  if (accounts.some((account) => account.username === username || account.email === email)) throw new Error("UNIQUE");
  const { salt, hash } = hashPassword(input.password);
  const account: Account = { id: accounts.length ? Math.max(...accounts.map((item) => item.id)) + 1 : 1, username, email, passwordHash: hash, salt, displayName: input.displayName.trim() };
  accounts.push(account);
  writeAccounts(accounts);
  return publicAccount(account);
}

export function findAccount(username: string) {
  return readAccounts().find((account) => account.username === normalizeUsername(username));
}

export function publicAccount(account: Account) {
  return { id: account.id, username: account.username, email: account.email, name: account.displayName };
}

export function accountToken(account: Account) {
  return createHash("sha256").update(`${account.id}:${account.username}:${Date.now()}`).digest("hex");
}
