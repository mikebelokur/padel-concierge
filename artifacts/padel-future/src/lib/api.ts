const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api/pf`;

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function registerUser(data: { name: string; email: string; phone?: string }) {
  const res = await fetch(`${API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitQuiz(data: Record<string, unknown>) {
  const res = await fetch(`${API}/quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getUser(id: number) {
  const res = await fetch(`${API}/users/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAdmin() {
  const res = await fetch(`${API}/admin`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface AdminUsersParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export type OnboardingStatus = "pending" | "approved" | "verified";

export interface AdminUser {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  created_at: string;
  verified: boolean;
  approval_status: string;
  location_name: string | null;
  neighbourhood: string | null;
  quiz_level: string | null;
  real_level: string | null;
  personality_type: string | null;
  quiz_completed_at: string | null;
  levelSelf: number | null;
  onboardingStatus: OnboardingStatus;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export async function getAdminUsers(params: AdminUsersParams = {}): Promise<AdminUsersResponse> {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.status) q.set("status", params.status);
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  const res = await fetch(`${API}/admin/users?${q}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface AdminUserDetail {
  user: {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    created_at: string;
    verified: boolean;
    approval_status: string;
    location_name: string | null;
    neighbourhood: string | null;
    availability: string[];
    levelSelf: number | null;
    onboardingStatus: OnboardingStatus;
  };
  quizResult: Record<string, unknown> | null;
  matches: unknown[];
}

export async function getAdminUser(id: number | string): Promise<AdminUserDetail> {
  const res = await fetch(`${API}/admin/users/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function getAdminCsvUrl(): string {
  return `${API}/admin/users/export.csv`;
}
