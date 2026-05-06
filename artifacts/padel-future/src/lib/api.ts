const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api/pf`;

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
  const res = await fetch(`${API}/admin`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
