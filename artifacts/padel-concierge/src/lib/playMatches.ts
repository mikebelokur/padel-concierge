import { apiFetch } from "@/lib/api";

export type MatchKind = "unranked" | "competitive" | "personal";
export type MatchVisibility = "private" | "open";
export type MatchGoal = "competitive" | "social" | "learning" | "energy";
export const PERSONAL_GOALS: MatchGoal[] = ["competitive", "social", "learning", "energy"];

export interface PlayMatchParticipant {
  userId: number;
  name: string;
  level: string | null;
  avatar: string | null;
  role: "leader" | "player";
}

export interface PlayMatchJoinRequest {
  id: number;
  matchId: number;
  userId: number;
  name: string;
  level: string | null;
  avatar: string | null;
  type: "invite" | "request";
  status: "pending" | "approved" | "declined";
  createdAt: string;
}

export interface PlayMatchSummary {
  id: number;
  date: string;
  time: string;
  clubName: string;
  format: string;
  kind: MatchKind | null;
  visibility: MatchVisibility;
  goal: string | null;
  styleNote: string | null;
  slotMinutes: number | null;
  status: string;
  levelMin: string | null;
  levelMax: string | null;
  maxPlayers: number;
  participantCount: number;
  spotsLeft: number;
  leaderName: string | null;
  createdAt: string;
}

export interface PlayMatchRoom extends PlayMatchSummary {
  myRole: "leader" | "player" | null;
  inviteToken: string | null;
  participants: PlayMatchParticipant[];
  joinRequests: PlayMatchJoinRequest[];
}

export interface PlayMatchJoinPending {
  pending: true;
  matchId: number;
}

export interface PlayMatchInvite {
  id: number;
  matchId: number;
  status: string;
  createdAt: string;
  match: PlayMatchSummary;
}

export interface CreatePlayMatchBody {
  kind: MatchKind;
  date: string;
  time: string;
  clubName: string;
  slotMinutes: number;
  visibility: MatchVisibility;
  goal?: MatchGoal | null;
  styleNote?: string | null;
}

export function createPlayMatch(body: CreatePlayMatchBody) {
  return apiFetch<PlayMatchRoom>("/play-matches", { method: "POST", body: JSON.stringify(body) });
}

export function getPlayMatchRoom(id: number) {
  return apiFetch<PlayMatchRoom>(`/play-matches/${id}`);
}

export function listOpenPlayMatches() {
  return apiFetch<PlayMatchSummary[]>("/play-matches/open");
}

export function listMyPlayMatchInvites() {
  return apiFetch<PlayMatchInvite[]>("/play-matches/invites");
}

export function getPlayMatchByToken(token: string) {
  return apiFetch<PlayMatchSummary>(`/play-matches/by-token/${token}`);
}

export function joinPlayMatchByToken(token: string) {
  return apiFetch<PlayMatchRoom | PlayMatchJoinPending>(`/play-matches/join/${token}`, { method: "POST" });
}

export function invitePlayMatchFriends(id: number, userIds: number[]) {
  return apiFetch<PlayMatchRoom>(`/play-matches/${id}/invite`, {
    method: "POST",
    body: JSON.stringify({ userIds }),
  });
}

export function respondPlayMatchInvite(id: number, accept: boolean) {
  return apiFetch<PlayMatchRoom>(`/play-matches/${id}/invite/respond`, {
    method: "POST",
    body: JSON.stringify({ accept }),
  });
}

export function requestJoinPlayMatch(id: number) {
  return apiFetch<PlayMatchJoinRequest>(`/play-matches/${id}/request`, { method: "POST" });
}

export function respondPlayMatchJoinRequest(id: number, requestId: number, approve: boolean) {
  return apiFetch<PlayMatchRoom>(`/play-matches/${id}/requests/${requestId}/respond`, {
    method: "POST",
    body: JSON.stringify({ approve }),
  });
}

export const KIND_META: Record<MatchKind, { icon: string; accent: string }> = {
  unranked: { icon: "🎾", accent: "#7dd3fc" },
  competitive: { icon: "🏆", accent: "#D4AF37" },
  personal: { icon: "🎯", accent: "#c4b5fd" },
};
