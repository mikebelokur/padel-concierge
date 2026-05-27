import { test, expect, request as pwRequest } from "@playwright/test";

const ADMIN_EMAIL = "admin@padelconcierge.com";
const ADMIN_PASSWORD = "admin123";

test.describe("Invite + first-time activation flow", () => {
  test("admin creates user → invite URL → password set → /dashboard with member number", async ({ browser, baseURL }) => {
    const apiCtx = await pwRequest.newContext({ baseURL });

    const loginRes = await apiCtx.post("/api/auth/login", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(loginRes.status(), `admin login failed: ${await loginRes.text()}`).toBe(200);
    const { token: adminToken } = (await loginRes.json()) as { token: string };
    expect(adminToken).toBeTruthy();

    const unique = Date.now();
    const newEmail = `e2e-invite-${unique}@example.com`;
    const newName = `E2E Invitee ${unique}`;

    const createRes = await apiCtx.post("/api/admin/users", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: newName, email: newEmail, phone: "", level: "C", role: "player" },
    });
    expect(createRes.status(), `admin create user failed: ${await createRes.text()}`).toBe(201);
    const created = (await createRes.json()) as {
      user: { id: number; email: string; memberNumber: number; inviteStatus: string };
      inviteUrl: string;
    };
    expect(created.user.email).toBe(newEmail);
    expect(created.user.inviteStatus).toBe("invited");
    expect(typeof created.user.memberNumber).toBe("number");
    expect(created.inviteUrl).toMatch(/\/invite\/[0-9a-f-]{36}$/i);

    const token = created.inviteUrl.split("/invite/")[1];
    const memberNumber = created.user.memberNumber;

    // Fresh browser context: simulates the invitee opening the link in their own browser.
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/invite/${token}`);

    await expect(page.getByText(new RegExp(`member\\s*#?\\s*${memberNumber}|Участник\\s*№\\s*${memberNumber}`, "i"))).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(newEmail)).toBeVisible();

    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs).toHaveCount(2);
    const password = "Brandnew!23";
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);

    await Promise.all([
      page.waitForURL("**/dashboard", { timeout: 20_000 }),
      page.locator('button[type="submit"]').click(),
    ]);

    expect(page.url()).toMatch(/\/dashboard$/);

    // Verify the auth context was hydrated with the new member's data.
    const storedUser = await page.evaluate(() => {
      const raw = localStorage.getItem("user");
      return raw ? (JSON.parse(raw) as { id: number; email: string; memberNumber: number; inviteStatus: string }) : null;
    });
    expect(storedUser).not.toBeNull();
    expect(storedUser!.email).toBe(newEmail);
    expect(storedUser!.memberNumber).toBe(memberNumber);
    expect(storedUser!.inviteStatus).toBe("activated");

    const storedToken = await page.evaluate(() => localStorage.getItem("token"));
    expect(storedToken).toBeTruthy();

    await context.close();
    await apiCtx.dispose();
  });
});
