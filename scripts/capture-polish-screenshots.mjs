#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:80";
const OUT_DIR = resolve(process.cwd(), "docs/polish-sweep");
const PREFIX = process.env.PREFIX ?? "after";

const ROUTES = [
  ["dashboard", "/dashboard"],
  ["play", "/play"],
  ["training", "/training"],
  ["matches", "/matches"],
  ["bookings", "/bookings"],
  ["group-trainings", "/group-trainings"],
  ["news", "/news"],
  ["profile", "/profile"],
  ["settings", "/settings"],
  ["rules", "/rules"],
  ["members", "/members"],
  ["courts", "/courts"],
  ["match-requests", "/match-requests"],
  ["video-analysis", "/video-analysis"],
  ["find-match", "/find-match"],
  ["assessment", "/assessment"],
  ["quiz", "/quiz"],
];

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "player@padelconcierge.com",
      password: "player123",
    }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  const data = await res.json();
  return { token: data.token, user: data.user };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const { token, user } = await login();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
    },
    { token, user },
  );

  for (const [name, path] of ROUTES) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(800);
      const out = resolve(OUT_DIR, `${PREFIX}-${name}.jpg`);
      await page.screenshot({ path: out, type: "jpeg", quality: 80, fullPage: false });
      console.log(`✓ ${name} → ${out}`);
    } catch (err) {
      console.warn(`✗ ${name}: ${err.message}`);
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
