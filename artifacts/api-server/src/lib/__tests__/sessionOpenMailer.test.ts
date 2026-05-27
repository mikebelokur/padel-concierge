import { describe, it, expect, beforeEach, vi } from "vitest";

const dbResults: unknown[][] = [];
const insertCalls: unknown[][] = [];

function pushResult(rows: unknown[]): void {
  dbResults.push(rows);
}
function shiftResult(): unknown[] {
  return dbResults.shift() ?? [];
}

function makeChain(getRows: () => unknown[], onValues?: (rows: unknown[]) => void): any {
  const chain: any = {};
  const passthrough = () => chain;
  for (const m of ["from", "where", "orderBy", "limit", "offset", "groupBy", "set", "onConflictDoNothing", "onConflictDoUpdate"]) {
    chain[m] = vi.fn(passthrough);
  }
  chain.values = vi.fn((rows: unknown) => {
    if (onValues) onValues(Array.isArray(rows) ? rows : [rows]);
    return chain;
  });
  chain.returning = vi.fn(() => Promise.resolve(getRows()));
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(getRows()).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(getRows()).catch(reject);
  chain.finally = (cb: any) => Promise.resolve(getRows()).finally(cb);
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeChain(shiftResult)),
  insert: vi.fn(() => makeChain(shiftResult, (rows) => insertCalls.push(rows))),
  update: vi.fn(() => makeChain(shiftResult)),
  delete: vi.fn(() => makeChain(shiftResult)),
};

vi.mock("@workspace/db", async () => {
  const passthrough = new Proxy({}, { get: () => () => undefined });
  return {
    db: mockDb,
    pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
    usersTable: passthrough,
    notificationsTable: passthrough,
  };
});

const sendNotificationEmail = vi.fn(async () => ({ sent: true }));
vi.mock("../mail", () => ({
  sendNotificationEmail: (...args: unknown[]) =>
    (sendNotificationEmail as unknown as (...a: unknown[]) => unknown)(...args),
}));

const { dispatchSessionOpenEmails, SESSION_OPEN_EMAIL_COOLDOWN_HOURS } =
  await import("../sessionOpenMailer");

const training = {
  id: "11111111-1111-1111-1111-111111111111",
  category: "C",
  dateTime: new Date("2026-06-01T18:00:00Z"),
  courtName: "Padel Edition",
};

const players = [
  { id: 1, name: "Alice", email: "alice@example.com", level: "C" },
  { id: 2, name: "Bob", email: "bob@example.com", level: "C+" },
  { id: 3, name: "Charlie", email: "charlie@example.com", level: "D" }, // level below category → filtered
  { id: 4, name: "NoEmail", email: null, level: "C" }, // no email → filtered
];

beforeEach(() => {
  dbResults.length = 0;
  insertCalls.length = 0;
  sendNotificationEmail.mockClear();
  mockDb.select.mockClear();
  mockDb.insert.mockClear();
});

describe("dispatchSessionOpenEmails", () => {
  it("sends to eligible players and inserts cooldown markers", async () => {
    pushResult(players); // eligible players query
    pushResult([]); // recent cooldown rows — none
    pushResult([]); // insert returning (not used)

    await dispatchSessionOpenEmails(training);

    // alice + bob are eligible; charlie below level; noemail filtered
    expect(sendNotificationEmail).toHaveBeenCalledTimes(2);
    expect(insertCalls).toHaveLength(1);
    const ledgerRows = insertCalls[0] as Array<{ userId: number; kind: string; trainingId: string }>;
    expect(ledgerRows.map((r) => r.userId).sort()).toEqual([1, 2]);
    for (const row of ledgerRows) {
      expect(row.kind).toBe("session_open_email");
      expect(row.trainingId).toBe(training.id);
    }
  });

  it("is idempotent within the 12h cooldown for the same user", async () => {
    // First call — both Alice and Bob are sent.
    pushResult(players);
    pushResult([]); // no recent cooldown
    pushResult([]);

    await dispatchSessionOpenEmails(training);
    expect(sendNotificationEmail).toHaveBeenCalledTimes(2);

    sendNotificationEmail.mockClear();
    insertCalls.length = 0;

    // Second call — same users already have a session_open_email row inside
    // the 12h cooldown window. Should send to zero users and insert nothing.
    pushResult(players);
    pushResult([{ userId: 1 }, { userId: 2 }]); // cooldown rows for both

    await dispatchSessionOpenEmails(training);

    expect(sendNotificationEmail).not.toHaveBeenCalled();
    expect(insertCalls).toHaveLength(0);
  });

  it("only sends to users not currently on cooldown", async () => {
    pushResult(players);
    pushResult([{ userId: 1 }]); // alice on cooldown
    pushResult([]); // ledger insert

    await dispatchSessionOpenEmails(training);

    expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
    const ledgerRows = insertCalls[0] as Array<{ userId: number }>;
    expect(ledgerRows.map((r) => r.userId)).toEqual([2]);
  });

  it("noop when no eligible targets exist", async () => {
    pushResult([
      { id: 3, name: "Charlie", email: "c@example.com", level: "D" }, // below cat
      { id: 4, name: "NoEmail", email: null, level: "C" },
    ]);

    await dispatchSessionOpenEmails(training);

    expect(sendNotificationEmail).not.toHaveBeenCalled();
    expect(insertCalls).toHaveLength(0);
    // cooldown query should not even be issued
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it("exports a 12h cooldown constant", () => {
    expect(SESSION_OPEN_EMAIL_COOLDOWN_HOURS).toBe(12);
  });
});
