import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

interface DecodedToken {
  userId: number;
  role: string;
  exp: number;
}

function decodeToken(token: string): DecodedToken | null {
  try {
    const payload = JSON.parse(Buffer.from(token, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload as DecodedToken;
  } catch {
    try {
      const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(b64));
      if (payload.exp < Date.now()) return null;
      return payload as DecodedToken;
    } catch {
      return null;
    }
  }
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchCurrentEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.email as string | undefined) ?? null;
  } catch {
    return null;
  }
}

interface Props {
  children: ReactNode;
}

export default function AdminGuard({ children }: Props) {
  const [, setLocation] = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const token = localStorage.getItem("token");
      if (!token) {
        if (!cancelled) setLocation("/");
        return;
      }
      const decoded = decodeToken(token);
      if (!decoded) {
        if (!cancelled) setLocation("/");
        return;
      }

      const adminRoles = ["admin", "owner", "coach"];
      if (adminRoles.includes(decoded.role)) {
        if (!cancelled) setAllowed(true);
        return;
      }

      const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? "")
        .split(",")
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean);

      if (adminEmails.length > 0) {
        const email = await fetchCurrentEmail(token);
        if (!cancelled && email && adminEmails.includes(email.toLowerCase())) {
          setAllowed(true);
          return;
        }
      }

      if (!cancelled) setLocation("/");
    }

    check();
    return () => { cancelled = true; };
  }, [setLocation]);

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#555] text-sm">Проверка доступа...</div>
      </div>
    );
  }

  return <>{children}</>;
}
