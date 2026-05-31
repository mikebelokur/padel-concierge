import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import {
  db,
  matchesTable,
  matchParticipantsTable,
  matchJoinRequestsTable,
  notificationsTable,
  usersTable,
  activityLogsTable,
  upsertMatchLog,
  upsertProfileMatchRecord,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { fireAndForget } from "../lib/fireAndForget.js";
import { sendPushToUser, type LocalizedText } from "../lib/push";

const router: IRouter = Router();
router.use(requireAuth);

// ── Level helpers ────────────────────────────────────────────────────────────
const LEVEL_ORDER = ["D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A"];
function levelIdx(l: string | null | undefined): number {
  if (!l) return -1;
  return LEVEL_ORDER.indexOf(l);
}
const LEVEL_GAP = 2;

const MIN_SLOT_MINUTES = 60;
const MAX_SLOT_MINUTES = 120;
const MATCH_FORMAT = "2v2";
const MAX_PLAYERS = 4;
const FORMING_STATUS = "forming";

function authUserId(req: unknown): number {
  return (req as { auth: { userId: number } }).auth.userId;
}

// ── Schemas ──────────────────────────────────────────────────────────────────
const PERSONAL_GOALS = ["competitive", "social", "learning", "energy"] as const;
const CreateSchema = z
  .object({
    kind: z.enum(["unranked", "competitive", "personal"]),
    date: z.string().min(1),
    time: z.string().min(1),
    clubName: z.string().min(1),
    slotMinutes: z.number().int(),
    visibility: z.enum(["private", "open"]).default("private"),
    goal: z.enum(PERSONAL_GOALS).nullish(),
    styleNote: z.string().nullish(),
  })
  .refine((d) => d.kind !== "personal" || d.goal != null, {
    message: "Personal matches require a goal",
    path: ["goal"],
  });

const InviteSchema = z.object({ userIds: z.array(z.number().int()).min(1) });
const RespondInviteSchema = z.object({ accept: z.boolean() });
const RespondRequestSchema = z.object({ approve: z.boolean() });

// ── Roster mirroring ─────────────────────────────────────────────────────────
type DbUser = typeof usersTable.$inferSelect;

async function loadParticipants(matchId: number) {
  const rows = await db
    .select({
      pid: matchParticipantsTable.id,
      userId: matchParticipantsTable.userId,
      role: matchParticipantsTable.role,
      joinedAt: matchParticipantsTable.joinedAt,
      name: usersTable.name,
      level: usersTable.level,
      avatar: usersTable.avatar,
    })
    .from(matchParticipantsTable)
    .innerJoin(usersTable, eq(usersTable.id, matchParticipantsTable.userId))
    .where(eq(matchParticipantsTable.matchId, matchId));
  // leader first, then by join order
  rows.sort((a, b) => {
    if (a.role === "leader" && b.role !== "leader") return -1;
    if (b.role === "leader" && a.role !== "leader") return 1;
    return a.joinedAt.getTime() - b.joinedAt.getTime();
  });
  return rows;
}

// Keep the legacy `players` JSON column and level range in sync with the
// participants table so existing match pages keep working.
async function mirrorRoster(matchId: number): Promise<void> {
  const parts = await loadParticipants(matchId);
  const players = parts.map((p) => ({
    userId: p.userId,
    name: p.name,
    level: p.level,
    confirmed: true,
    avatar: p.avatar ?? null,
  }));
  const idxs = parts.map((p) => levelIdx(p.level)).filter((i) => i >= 0);
  const levelMin = idxs.length ? LEVEL_ORDER[Math.min(...idxs)] : null;
  const levelMax = idxs.length ? LEVEL_ORDER[Math.max(...idxs)] : null;
  await db
    .update(matchesTable)
    .set({ players: JSON.stringify(players), levelMin, levelMax })
    .where(eq(matchesTable.id, matchId));
}

// ── Response shape builders ──────────────────────────────────────────────────
async function buildRoom(matchId: number, viewerId: number) {
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) return null;

  const parts = await loadParticipants(matchId);
  const myPart = parts.find((p) => p.userId === viewerId);
  const isLeader = myPart?.role === "leader";

  let joinRequests: Array<{
    id: number;
    matchId: number;
    userId: number;
    name: string;
    level: string | null;
    avatar: string | null;
    type: string;
    status: string;
    createdAt: string;
  }> = [];
  if (isLeader) {
    const reqRows = await db
      .select({
        id: matchJoinRequestsTable.id,
        matchId: matchJoinRequestsTable.matchId,
        userId: matchJoinRequestsTable.userId,
        type: matchJoinRequestsTable.type,
        status: matchJoinRequestsTable.status,
        createdAt: matchJoinRequestsTable.createdAt,
        name: usersTable.name,
        level: usersTable.level,
        avatar: usersTable.avatar,
      })
      .from(matchJoinRequestsTable)
      .innerJoin(usersTable, eq(usersTable.id, matchJoinRequestsTable.userId))
      .where(
        and(
          eq(matchJoinRequestsTable.matchId, matchId),
          eq(matchJoinRequestsTable.type, "request"),
          eq(matchJoinRequestsTable.status, "pending"),
        ),
      );
    joinRequests = reqRows.map((r) => ({
      id: r.id,
      matchId: r.matchId,
      userId: r.userId,
      name: r.name,
      level: r.level ?? null,
      avatar: r.avatar ?? null,
      type: r.type,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  const leader = parts.find((p) => p.role === "leader");
  const participantCount = parts.length;

  return {
    id: match.id,
    date: match.date,
    time: match.time,
    clubName: match.clubName,
    format: match.format,
    kind: match.matchKind ?? null,
    visibility: match.visibility,
    goal: match.goal ?? null,
    styleNote: match.styleNote ?? null,
    slotMinutes: match.slotMinutes ?? null,
    status: match.status,
    levelMin: match.levelMin ?? null,
    levelMax: match.levelMax ?? null,
    maxPlayers: match.maxPlayers,
    participantCount,
    spotsLeft: Math.max(0, match.maxPlayers - participantCount),
    inviteToken: myPart ? match.inviteToken ?? null : null,
    leaderName: leader?.name ?? null,
    myRole: myPart?.role ?? null,
    participants: parts.map((p) => ({
      userId: p.userId,
      name: p.name,
      level: p.level ?? null,
      avatar: p.avatar ?? null,
      role: p.role,
    })),
    joinRequests,
    createdAt: match.createdAt.toISOString(),
  };
}

function buildSummary(
  match: typeof matchesTable.$inferSelect,
  participantCount: number,
  leaderName: string | null,
) {
  return {
    id: match.id,
    date: match.date,
    time: match.time,
    clubName: match.clubName,
    format: match.format,
    kind: match.matchKind ?? null,
    visibility: match.visibility,
    goal: match.goal ?? null,
    styleNote: match.styleNote ?? null,
    slotMinutes: match.slotMinutes ?? null,
    status: match.status,
    levelMin: match.levelMin ?? null,
    levelMax: match.levelMax ?? null,
    maxPlayers: match.maxPlayers,
    participantCount,
    spotsLeft: Math.max(0, match.maxPlayers - participantCount),
    leaderName,
    createdAt: match.createdAt.toISOString(),
  };
}

function levelSuitable(candidate: string | null | undefined, match: typeof matchesTable.$inferSelect): boolean {
  const ci = levelIdx(candidate);
  const minI = levelIdx(match.levelMin);
  const maxI = levelIdx(match.levelMax);
  if (ci < 0 || minI < 0 || maxI < 0) return true; // can't determine → allow
  return ci >= minI - LEVEL_GAP && ci <= maxI + LEVEL_GAP;
}

async function countsForMatches(matchIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (matchIds.length === 0) return map;
  const rows = await db
    .select({ matchId: matchParticipantsTable.matchId, userId: matchParticipantsTable.userId })
    .from(matchParticipantsTable)
    .where(inArray(matchParticipantsTable.matchId, matchIds));
  for (const r of rows) map.set(r.matchId, (map.get(r.matchId) ?? 0) + 1);
  return map;
}

// ── Notifications ─────────────────────────────────────────────────────────────
// Fire-and-forget: persist an in-app bell notification and send a web push so
// invitees / leaders / requesters learn about roster changes in real time.
function notifyPlayMatch(opts: {
  userId: number;
  kind: string;
  titleEn: string;
  titleRu: string;
  bodyEn: string;
  bodyRu: string;
  link: string;
  pushTitle: LocalizedText;
  pushBody: LocalizedText;
  tag: string;
}): void {
  fireAndForget(
    db
      .insert(notificationsTable)
      .values({
        userId: opts.userId,
        kind: opts.kind,
        titleEn: opts.titleEn,
        titleRu: opts.titleRu,
        bodyEn: opts.bodyEn,
        bodyRu: opts.bodyRu,
        link: opts.link,
      }),
    { route: "play-matches notify", userId: opts.userId, kind: opts.kind },
  );
  fireAndForget(
    sendPushToUser(opts.userId, {
      title: opts.pushTitle,
      body: opts.pushBody,
      url: opts.link,
      tag: opts.tag,
    }),
    { route: "play-matches push", userId: opts.userId, kind: opts.kind },
  );
}

// ── POST /play-matches ───────────────────────────────────────────────────────
router.post("/play-matches", async (req, res): Promise<void> => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  if (data.slotMinutes < MIN_SLOT_MINUTES) {
    res.status(400).json({ error: `Slot must be at least ${MIN_SLOT_MINUTES} minutes`, code: "SLOT_TOO_SHORT" });
    return;
  }
  if (data.slotMinutes > MAX_SLOT_MINUTES) {
    res.status(400).json({ error: `Slot must be at most ${MAX_SLOT_MINUTES} minutes`, code: "SLOT_TOO_LONG" });
    return;
  }
  const userId = authUserId(req);
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!me) { res.status(404).json({ error: "User not found" }); return; }

  const token = randomUUID();
  const [match] = await db
    .insert(matchesTable)
    .values({
      date: data.date,
      time: data.time,
      clubName: data.clubName,
      format: MATCH_FORMAT,
      status: FORMING_STATUS,
      matchType: "balanced",
      creatorId: userId,
      matchKind: data.kind,
      visibility: data.visibility,
      goal: data.kind === "personal" ? data.goal ?? null : null,
      styleNote: data.kind === "personal" ? data.styleNote ?? null : null,
      slotMinutes: data.slotMinutes,
      maxPlayers: MAX_PLAYERS,
      inviteToken: token,
      levelMin: me.level ?? null,
      levelMax: me.level ?? null,
    })
    .returning();

  await db.insert(matchParticipantsTable).values({ matchId: match.id, userId, role: "leader" });
  await mirrorRoster(match.id);

  fireAndForget(
    db.insert(activityLogsTable).values({
      userId: me.id,
      userName: me.name,
      action: "match_created",
      details: `Match at ${data.clubName} on ${data.date}`,
      detailsParams: { clubName: data.clubName, date: data.date },
    }),
    { route: "POST /play-matches", matchId: match.id },
  );

  // Silently log stats (competitive surfaces no numbers in UI).
  fireAndForget(
    upsertMatchLog({
      matchId: match.id,
      date: data.date,
      participants: [{ userId: me.id, name: me.name, levelAtPlay: me.level, archetype: me.archetype ?? null }],
      setScores: match.setScores,
      conflictOccurred: false,
    }),
    { route: "POST /play-matches", matchId: match.id },
  );
  fireAndForget(upsertProfileMatchRecord(me.id, match.id), { route: "POST /play-matches", userId: me.id });

  const room = await buildRoom(match.id, userId);
  res.status(201).json(room);
});

// ── GET /play-matches/open ───────────────────────────────────────────────────
router.get("/play-matches/open", async (req, res): Promise<void> => {
  const userId = authUserId(req);
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  const open = await db
    .select()
    .from(matchesTable)
    .where(and(eq(matchesTable.visibility, "open"), eq(matchesTable.status, FORMING_STATUS)));

  const ids = open.map((m) => m.id);
  const counts = await countsForMatches(ids);

  // Participant ids + my pending requests, to exclude matches I'm already in.
  const myParts = ids.length
    ? await db
        .select({ matchId: matchParticipantsTable.matchId })
        .from(matchParticipantsTable)
        .where(and(inArray(matchParticipantsTable.matchId, ids), eq(matchParticipantsTable.userId, userId)))
    : [];
  const myReqs = ids.length
    ? await db
        .select({ matchId: matchJoinRequestsTable.matchId })
        .from(matchJoinRequestsTable)
        .where(
          and(
            inArray(matchJoinRequestsTable.matchId, ids),
            eq(matchJoinRequestsTable.userId, userId),
            eq(matchJoinRequestsTable.status, "pending"),
          ),
        )
    : [];
  const excluded = new Set<number>([...myParts.map((p) => p.matchId), ...myReqs.map((r) => r.matchId)]);

  const leaderIds = open.map((m) => m.creatorId).filter((x): x is number => x != null);
  const leaders = leaderIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, leaderIds))
    : [];
  const leaderMap = new Map(leaders.map((l) => [l.id, l.name]));

  const result = open
    .filter((m) => !excluded.has(m.id))
    .filter((m) => (counts.get(m.id) ?? 0) < m.maxPlayers)
    .filter((m) => levelSuitable(me?.level, m))
    .map((m) => buildSummary(m, counts.get(m.id) ?? 0, m.creatorId != null ? leaderMap.get(m.creatorId) ?? null : null));

  res.json(result);
});

// ── GET /play-matches/invites ────────────────────────────────────────────────
router.get("/play-matches/invites", async (req, res): Promise<void> => {
  const userId = authUserId(req);
  const invites = await db
    .select()
    .from(matchJoinRequestsTable)
    .where(
      and(
        eq(matchJoinRequestsTable.userId, userId),
        eq(matchJoinRequestsTable.type, "invite"),
        eq(matchJoinRequestsTable.status, "pending"),
      ),
    );

  const matchIds = invites.map((i) => i.matchId);
  if (matchIds.length === 0) { res.json([]); return; }

  const matches = await db.select().from(matchesTable).where(inArray(matchesTable.id, matchIds));
  const matchMap = new Map(matches.map((m) => [m.id, m]));
  const counts = await countsForMatches(matchIds);
  const leaderIds = matches.map((m) => m.creatorId).filter((x): x is number => x != null);
  const leaders = leaderIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, leaderIds))
    : [];
  const leaderMap = new Map(leaders.map((l) => [l.id, l.name]));

  const result = invites
    .filter((i) => matchMap.has(i.matchId))
    .map((i) => {
      const m = matchMap.get(i.matchId)!;
      return {
        id: i.id,
        matchId: i.matchId,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
        match: buildSummary(m, counts.get(m.id) ?? 0, m.creatorId != null ? leaderMap.get(m.creatorId) ?? null : null),
      };
    });
  res.json(result);
});

// ── GET /play-matches/by-token/:token ────────────────────────────────────────
router.get("/play-matches/by-token/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token);
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.inviteToken, token));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  const counts = await countsForMatches([match.id]);
  let leaderName: string | null = null;
  if (match.creatorId != null) {
    const [leader] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, match.creatorId));
    leaderName = leader?.name ?? null;
  }
  res.json(buildSummary(match, counts.get(match.id) ?? 0, leaderName));
});

// ── POST /play-matches/join/:token ───────────────────────────────────────────
router.post("/play-matches/join/:token", async (req, res): Promise<void> => {
  const userId = authUserId(req);
  const token = String(req.params.token);
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.inviteToken, token));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  const existing = await db
    .select()
    .from(matchParticipantsTable)
    .where(and(eq(matchParticipantsTable.matchId, match.id), eq(matchParticipantsTable.userId, userId)));
  if (existing.length > 0) {
    res.json(await buildRoom(match.id, userId));
    return;
  }

  if (match.status !== FORMING_STATUS) {
    res.status(409).json({ error: "Match is no longer accepting players", code: "MATCH_CLOSED" });
    return;
  }

  const counts = await countsForMatches([match.id]);
  if ((counts.get(match.id) ?? 0) >= match.maxPlayers) {
    res.status(409).json({ error: "Match is full", code: "MATCH_FULL" });
    return;
  }
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!levelSuitable(me?.level, match)) {
    res.status(403).json({ error: "Level not suitable for this match", code: "LEVEL_NOT_SUITABLE" });
    return;
  }

  // Open matches require leader approval: a shared link must NOT grant instant
  // entry. Direct token-join is only honoured for private matches or when the
  // user was explicitly invited / already approved. Otherwise we funnel the
  // user into the request/approve flow.
  const priorRequests = await db
    .select()
    .from(matchJoinRequestsTable)
    .where(and(eq(matchJoinRequestsTable.matchId, match.id), eq(matchJoinRequestsTable.userId, userId)));
  const hasInvite = priorRequests.some(
    (r) => r.type === "invite" && (r.status === "pending" || r.status === "approved"),
  );
  const isApproved = priorRequests.some((r) => r.status === "approved");
  // A declined row means the user was removed (or turned down an invite); they
  // must not slide back in directly — funnel them into the request/approve flow.
  const wasBlocked = priorRequests.some((r) => r.status === "declined");
  const mayJoinDirectly = (match.visibility === "private" || hasInvite || isApproved) && !wasBlocked;

  if (!mayJoinDirectly) {
    const pendingReq = priorRequests.find((r) => r.type === "request" && r.status === "pending");
    if (!pendingReq) {
      await db
        .insert(matchJoinRequestsTable)
        .values({ matchId: match.id, userId, type: "request", status: "pending" });
    }
    res.status(202).json({ pending: true, matchId: match.id });
    return;
  }

  await db.insert(matchParticipantsTable).values({ matchId: match.id, userId, role: "player" });
  // Resolve any pending invite for this user.
  await db
    .update(matchJoinRequestsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(matchJoinRequestsTable.matchId, match.id),
        eq(matchJoinRequestsTable.userId, userId),
        eq(matchJoinRequestsTable.status, "pending"),
      ),
    );
  await mirrorRoster(match.id);
  fireAndForget(upsertProfileMatchRecord(userId, match.id), { route: "POST /play-matches/join", userId });
  res.json(await buildRoom(match.id, userId));
});

// ── GET /play-matches/:id ────────────────────────────────────────────────────
router.get("/play-matches/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const userId = authUserId(req);
  const room = await buildRoom(id, userId);
  if (!room) { res.status(404).json({ error: "Match not found" }); return; }

  // Authorization: participants always see their room; open matches are
  // publicly viewable so suitable players can decide to join. Private matches
  // are only visible to participants or users who have an invite/request.
  if (room.myRole == null && room.visibility !== "open") {
    const [link] = await db
      .select({ id: matchJoinRequestsTable.id })
      .from(matchJoinRequestsTable)
      .where(
        and(
          eq(matchJoinRequestsTable.matchId, id),
          eq(matchJoinRequestsTable.userId, userId),
          inArray(matchJoinRequestsTable.status, ["pending", "approved"]),
        ),
      );
    if (!link) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  res.json(room);
});

// ── POST /play-matches/:id/invite ────────────────────────────────────────────
router.post("/play-matches/:id/invite", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const userId = authUserId(req);
  const parsed = InviteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body", details: parsed.error.issues }); return; }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.creatorId !== userId) { res.status(403).json({ error: "Only the leader can invite" }); return; }
  if (match.status !== FORMING_STATUS) { res.status(409).json({ error: "Match is no longer forming", code: "MATCH_CLOSED" }); return; }

  const parts = await loadParticipants(id);
  const partSet = new Set(parts.map((p) => p.userId));
  const pending = await db
    .select({ userId: matchJoinRequestsTable.userId })
    .from(matchJoinRequestsTable)
    .where(and(eq(matchJoinRequestsTable.matchId, id), eq(matchJoinRequestsTable.status, "pending")));
  const pendingSet = new Set(pending.map((p) => p.userId));

  for (const target of parsed.data.userIds) {
    if (partSet.has(target) || pendingSet.has(target)) continue;
    await db.insert(matchJoinRequestsTable).values({ matchId: id, userId: target, type: "invite", status: "pending" });
    notifyPlayMatch({
      userId: target,
      kind: "play_match_invited",
      titleEn: "Match invitation",
      titleRu: "Приглашение на матч",
      bodyEn: `You've been invited to play at ${match.clubName} on ${match.date}.`,
      bodyRu: `Вас пригласили сыграть в ${match.clubName} ${match.date}.`,
      link: "/play",
      pushTitle: {
        en: "Match invitation",
        ru: "Приглашение на матч",
        ar: "دعوة لمباراة",
      },
      pushBody: {
        en: `You've been invited to play at ${match.clubName} on ${match.date}.`,
        ru: `Вас пригласили сыграть в ${match.clubName} ${match.date}.`,
        ar: `تمت دعوتك للعب في ${match.clubName} في ${match.date}.`,
      },
      tag: `play-match-invite-${id}`,
    });
  }
  res.json(await buildRoom(id, userId));
});

// ── POST /play-matches/:id/invite/respond ────────────────────────────────────
router.post("/play-matches/:id/invite/respond", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const userId = authUserId(req);
  const parsed = RespondInviteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const [invite] = await db
    .select()
    .from(matchJoinRequestsTable)
    .where(
      and(
        eq(matchJoinRequestsTable.matchId, id),
        eq(matchJoinRequestsTable.userId, userId),
        eq(matchJoinRequestsTable.type, "invite"),
        eq(matchJoinRequestsTable.status, "pending"),
      ),
    );
  if (!invite) { res.status(404).json({ error: "Invitation not found" }); return; }

  if (!parsed.data.accept) {
    await db.update(matchJoinRequestsTable).set({ status: "declined", updatedAt: new Date() }).where(eq(matchJoinRequestsTable.id, invite.id));
    res.json(await buildRoom(id, userId));
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.status !== FORMING_STATUS) { res.status(409).json({ error: "Match is no longer forming", code: "MATCH_CLOSED" }); return; }
  const counts = await countsForMatches([id]);
  if ((counts.get(id) ?? 0) >= match.maxPlayers) {
    res.status(409).json({ error: "Match is full", code: "MATCH_FULL" });
    return;
  }
  await db.insert(matchParticipantsTable).values({ matchId: id, userId, role: "player" });
  await db.update(matchJoinRequestsTable).set({ status: "approved", updatedAt: new Date() }).where(eq(matchJoinRequestsTable.id, invite.id));
  await mirrorRoster(id);
  fireAndForget(upsertProfileMatchRecord(userId, id), { route: "POST /play-matches/:id/invite/respond", userId });
  res.json(await buildRoom(id, userId));
});

// ── POST /play-matches/:id/request ───────────────────────────────────────────
router.post("/play-matches/:id/request", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const userId = authUserId(req);
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.visibility !== "open") { res.status(403).json({ error: "Match is not open" }); return; }
  if (match.status !== FORMING_STATUS) { res.status(409).json({ error: "Match is no longer accepting players", code: "MATCH_CLOSED" }); return; }

  const existingPart = await db
    .select()
    .from(matchParticipantsTable)
    .where(and(eq(matchParticipantsTable.matchId, id), eq(matchParticipantsTable.userId, userId)));
  if (existingPart.length > 0) { res.status(409).json({ error: "Already a participant" }); return; }

  const counts = await countsForMatches([id]);
  if ((counts.get(id) ?? 0) >= match.maxPlayers) { res.status(409).json({ error: "Match is full", code: "MATCH_FULL" }); return; }

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!levelSuitable(me?.level, match)) { res.status(403).json({ error: "Level not suitable", code: "LEVEL_NOT_SUITABLE" }); return; }

  const existingReq = await db
    .select()
    .from(matchJoinRequestsTable)
    .where(and(eq(matchJoinRequestsTable.matchId, id), eq(matchJoinRequestsTable.userId, userId), eq(matchJoinRequestsTable.status, "pending")));
  if (existingReq.length > 0) { res.status(409).json({ error: "Already requested" }); return; }

  const [created] = await db
    .insert(matchJoinRequestsTable)
    .values({ matchId: id, userId, type: "request", status: "pending" })
    .returning();

  if (match.creatorId != null) {
    const requesterName = me?.name ?? "A player";
    notifyPlayMatch({
      userId: match.creatorId,
      kind: "play_match_request",
      titleEn: "New join request",
      titleRu: "Новая заявка на матч",
      bodyEn: `${requesterName} wants to join your match at ${match.clubName} on ${match.date}.`,
      bodyRu: `${requesterName} хочет присоединиться к вашему матчу в ${match.clubName} ${match.date}.`,
      link: `/play/match/${id}`,
      pushTitle: {
        en: "New join request",
        ru: "Новая заявка на матч",
        ar: "طلب انضمام جديد",
      },
      pushBody: {
        en: `${requesterName} wants to join your match at ${match.clubName}.`,
        ru: `${requesterName} хочет присоединиться к вашему матчу в ${match.clubName}.`,
        ar: `${requesterName} يريد الانضمام إلى مباراتك في ${match.clubName}.`,
      },
      tag: `play-match-request-${id}`,
    });
  }

  res.status(201).json({
    id: created.id,
    matchId: created.matchId,
    userId: created.userId,
    name: me?.name ?? "",
    level: me?.level ?? null,
    avatar: me?.avatar ?? null,
    type: created.type,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
  });
});

// ── POST /play-matches/:id/requests/:requestId/respond ───────────────────────
router.post("/play-matches/:id/requests/:requestId/respond", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const requestId = Number(req.params.requestId);
  const userId = authUserId(req);
  const parsed = RespondRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.creatorId !== userId) { res.status(403).json({ error: "Only the leader can respond" }); return; }

  const [joinReq] = await db
    .select()
    .from(matchJoinRequestsTable)
    .where(and(eq(matchJoinRequestsTable.id, requestId), eq(matchJoinRequestsTable.matchId, id)));
  if (!joinReq || joinReq.status !== "pending") { res.status(404).json({ error: "Request not found" }); return; }

  if (!parsed.data.approve) {
    await db.update(matchJoinRequestsTable).set({ status: "declined", updatedAt: new Date() }).where(eq(matchJoinRequestsTable.id, requestId));
    notifyPlayMatch({
      userId: joinReq.userId,
      kind: "play_match_request_declined",
      titleEn: "Request declined",
      titleRu: "Заявка отклонена",
      bodyEn: `Your request to join the match at ${match.clubName} on ${match.date} was declined.`,
      bodyRu: `Ваша заявка на матч в ${match.clubName} ${match.date} была отклонена.`,
      link: "/play/open",
      pushTitle: {
        en: "Request declined",
        ru: "Заявка отклонена",
        ar: "تم رفض الطلب",
      },
      pushBody: {
        en: `Your request to join the match at ${match.clubName} was declined.`,
        ru: `Ваша заявка на матч в ${match.clubName} была отклонена.`,
        ar: `تم رفض طلبك للانضمام إلى المباراة في ${match.clubName}.`,
      },
      tag: `play-match-respond-${id}`,
    });
    res.json(await buildRoom(id, userId));
    return;
  }

  if (match.status !== FORMING_STATUS) { res.status(409).json({ error: "Match is no longer forming", code: "MATCH_CLOSED" }); return; }
  const counts = await countsForMatches([id]);
  if ((counts.get(id) ?? 0) >= match.maxPlayers) { res.status(409).json({ error: "Match is full", code: "MATCH_FULL" }); return; }

  const already = await db
    .select()
    .from(matchParticipantsTable)
    .where(and(eq(matchParticipantsTable.matchId, id), eq(matchParticipantsTable.userId, joinReq.userId)));
  if (already.length === 0) {
    await db.insert(matchParticipantsTable).values({ matchId: id, userId: joinReq.userId, role: "player" });
  }
  await db.update(matchJoinRequestsTable).set({ status: "approved", updatedAt: new Date() }).where(eq(matchJoinRequestsTable.id, requestId));
  await mirrorRoster(id);
  fireAndForget(upsertProfileMatchRecord(joinReq.userId, id), { route: "POST /play-matches/:id/requests/:requestId/respond", userId: joinReq.userId });
  notifyPlayMatch({
    userId: joinReq.userId,
    kind: "play_match_request_approved",
    titleEn: "Request approved",
    titleRu: "Заявка одобрена",
    bodyEn: `You're in! Your request to join the match at ${match.clubName} on ${match.date} was approved.`,
    bodyRu: `Вы в игре! Ваша заявка на матч в ${match.clubName} ${match.date} одобрена.`,
    link: `/play/match/${id}`,
    pushTitle: {
      en: "Request approved",
      ru: "Заявка одобрена",
      ar: "تمت الموافقة على الطلب",
    },
    pushBody: {
      en: `You're in! Your request to join the match at ${match.clubName} was approved.`,
      ru: `Вы в игре! Ваша заявка на матч в ${match.clubName} одобрена.`,
      ar: `أنت مشترك! تمت الموافقة على طلبك للانضمام إلى المباراة في ${match.clubName}.`,
    },
    tag: `play-match-respond-${id}`,
  });
  res.json(await buildRoom(id, userId));
});

// ── POST /play-matches/:id/cancel ────────────────────────────────────────────
// The leader cancels a forming match. Status → cancelled (drops out of the open
// browse list), every other participant is notified, and any pending
// invites/requests are declined so they stop lingering.
router.post("/play-matches/:id/cancel", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const userId = authUserId(req);

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.creatorId !== userId) { res.status(403).json({ error: "Only the leader can cancel" }); return; }
  if (match.status !== FORMING_STATUS) {
    res.status(409).json({ error: "Match can no longer be cancelled", code: "NOT_CANCELLABLE" });
    return;
  }

  await db.update(matchesTable).set({ status: "cancelled" }).where(eq(matchesTable.id, id));
  // Decline any still-pending invites/requests so they disappear from inboxes.
  await db
    .update(matchJoinRequestsTable)
    .set({ status: "declined", updatedAt: new Date() })
    .where(and(eq(matchJoinRequestsTable.matchId, id), eq(matchJoinRequestsTable.status, "pending")));

  const parts = await loadParticipants(id);
  for (const p of parts) {
    if (p.userId === userId) continue;
    notifyPlayMatch({
      userId: p.userId,
      kind: "play_match_cancelled",
      titleEn: "Match cancelled",
      titleRu: "Матч отменён",
      bodyEn: `The match at ${match.clubName} on ${match.date} was cancelled by the organizer.`,
      bodyRu: `Матч в ${match.clubName} ${match.date} был отменён организатором.`,
      link: "/play",
      pushTitle: {
        en: "Match cancelled",
        ru: "Матч отменён",
        ar: "أُلغيت المباراة",
      },
      pushBody: {
        en: `The match at ${match.clubName} on ${match.date} was cancelled.`,
        ru: `Матч в ${match.clubName} ${match.date} был отменён.`,
        ar: `أُلغيت المباراة في ${match.clubName} بتاريخ ${match.date}.`,
      },
      tag: `play-match-cancelled-${id}`,
    });
  }

  res.json(await buildRoom(id, userId));
});

// ── DELETE /play-matches/:id/participants/:userId ────────────────────────────
// The leader removes a non-leader participant, freeing their spot. The removed
// player is notified, and any of their join requests/invites for this match are
// declined so they can't silently slide back in via an old approval/link.
router.delete("/play-matches/:id/participants/:userId", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const targetId = Number(req.params.userId);
  if (!Number.isFinite(id) || !Number.isFinite(targetId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const userId = authUserId(req);

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  if (match.creatorId !== userId) { res.status(403).json({ error: "Only the leader can remove players" }); return; }
  if (targetId === userId) { res.status(400).json({ error: "The leader cannot be removed", code: "CANNOT_REMOVE_LEADER" }); return; }

  const [participant] = await db
    .select()
    .from(matchParticipantsTable)
    .where(and(eq(matchParticipantsTable.matchId, id), eq(matchParticipantsTable.userId, targetId)));
  if (!participant) { res.status(404).json({ error: "Participant not found" }); return; }
  if (participant.role === "leader") { res.status(400).json({ error: "The leader cannot be removed", code: "CANNOT_REMOVE_LEADER" }); return; }

  await db
    .delete(matchParticipantsTable)
    .where(and(eq(matchParticipantsTable.matchId, id), eq(matchParticipantsTable.userId, targetId)));
  // Decline any of their lingering invites/requests for this match so the freed
  // spot can't be reclaimed through an old approval or invite link.
  await db
    .update(matchJoinRequestsTable)
    .set({ status: "declined", updatedAt: new Date() })
    .where(
      and(
        eq(matchJoinRequestsTable.matchId, id),
        eq(matchJoinRequestsTable.userId, targetId),
        inArray(matchJoinRequestsTable.status, ["pending", "approved"]),
      ),
    );
  // If they joined directly via a private link they may have no request row at
  // all. Record a declined marker so the join path knows they were removed and
  // can't slide straight back in — re-entry must go through leader approval.
  const remaining = await db
    .select({ id: matchJoinRequestsTable.id })
    .from(matchJoinRequestsTable)
    .where(and(eq(matchJoinRequestsTable.matchId, id), eq(matchJoinRequestsTable.userId, targetId)));
  if (remaining.length === 0) {
    await db
      .insert(matchJoinRequestsTable)
      .values({ matchId: id, userId: targetId, type: "request", status: "declined" });
  }
  await mirrorRoster(id);

  notifyPlayMatch({
    userId: targetId,
    kind: "play_match_removed",
    titleEn: "Removed from match",
    titleRu: "Удалены из матча",
    bodyEn: `You were removed from the match at ${match.clubName} on ${match.date}.`,
    bodyRu: `Вас удалили из матча в ${match.clubName} ${match.date}.`,
    link: "/play",
    pushTitle: {
      en: "Removed from match",
      ru: "Удалены из матча",
      ar: "تمت إزالتك من المباراة",
    },
    pushBody: {
      en: `You were removed from the match at ${match.clubName} on ${match.date}.`,
      ru: `Вас удалили из матча в ${match.clubName} ${match.date}.`,
      ar: `تمت إزالتك من المباراة في ${match.clubName} بتاريخ ${match.date}.`,
    },
    tag: `play-match-removed-${id}`,
  });

  res.json(await buildRoom(id, userId));
});

export default router;
