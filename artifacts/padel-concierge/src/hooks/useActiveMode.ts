import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type Mode = "player" | "coach" | "admin" | "developer";

const STORAGE_KEY = "active_mode";
const ORDER: Mode[] = ["developer", "admin", "coach", "player"];

function readAvailable(user: any): Mode[] {
  if (!user) return [];
  const out: Mode[] = [];
  if (user.modeDeveloper) out.push("developer");
  if (user.modeAdmin) out.push("admin");
  if (user.modeCoach) out.push("coach");
  if (user.modePlayer) out.push("player");
  if (out.length === 0) {
    // Legacy fallback from role when mode flags aren't present on the user object.
    if (user.role === "admin" || user.role === "owner") out.push("admin");
    if (user.role === "coach") out.push("coach");
    out.push("player");
  }
  return out;
}

function highest(available: Mode[]): Mode {
  for (const m of ORDER) if (available.includes(m)) return m;
  return "player";
}

// External store so all useActiveMode() consumers stay in sync across the app.
const subscribers = new Set<() => void>();
function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
function getSnapshot(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}
function getServerSnapshot(): string {
  return "";
}
function notify() {
  for (const cb of subscribers) cb();
}

export function useActiveMode() {
  const { user } = useAuth();
  const available = readAvailable(user);
  const availableKey = available.join(",");

  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) as Mode | "";

  // Resolve active mode: prefer stored if still valid, otherwise highest available.
  // When user is not yet loaded (available empty), fall back to stored or "player".
  let activeMode: Mode;
  if (available.length === 0) {
    activeMode = (stored as Mode) || "player";
  } else if (stored && (available as string[]).includes(stored)) {
    activeMode = stored as Mode;
  } else {
    activeMode = highest(available);
  }

  // Persist a deterministic default once user is known and storage is empty or
  // points at a mode the user no longer has.
  useEffect(() => {
    if (available.length === 0) return;
    const current = localStorage.getItem(STORAGE_KEY) as Mode | null;
    if (!current || !(available as string[]).includes(current)) {
      localStorage.setItem(STORAGE_KEY, activeMode);
      notify();
    }
  }, [availableKey, activeMode]);

  const setActiveMode = useCallback(
    (mode: Mode) => {
      if (available.length > 0 && !(available as string[]).includes(mode)) return;
      localStorage.setItem(STORAGE_KEY, mode);
      notify();
    },
    [availableKey],
  );

  return { activeMode, setActiveMode, availableModes: available };
}
