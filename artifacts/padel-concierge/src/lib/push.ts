import { apiFetch } from "./api";

const PROMPT_KEY = "push_prompt_state";
const TRIGGER_KEY = "push_trigger_count";

type PromptState = "pending" | "asked" | "subscribed" | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export type PushStatus = "unsupported" | "blocked" | "subscribed" | "off";

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "subscribed" : "off";
  } catch {
    return "off";
  }
}

export function getPromptState(): PromptState {
  if (typeof localStorage === "undefined") return "pending";
  return (localStorage.getItem(PROMPT_KEY) as PromptState | null) ?? "pending";
}

export function setPromptState(s: PromptState): void {
  try {
    localStorage.setItem(PROMPT_KEY, s);
  } catch {
    // ignore
  }
}

/**
 * Increment the "successful match interaction" counter. After the first
 * interaction we may show the opt-in prompt. Returns whether the caller
 * should show the prompt now.
 */
export function recordMatchInteraction(): boolean {
  if (!pushSupported()) return false;
  if (getPromptState() !== "pending") return false;
  if (Notification.permission !== "default") {
    if (Notification.permission === "denied") setPromptState("denied");
    return false;
  }
  try {
    const n = parseInt(localStorage.getItem(TRIGGER_KEY) ?? "0", 10) + 1;
    localStorage.setItem(TRIGGER_KEY, String(n));
    return n >= 1;
  } catch {
    return true;
  }
}

export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const { publicKey, configured } = await apiFetch<{
      publicKey: string;
      configured: boolean;
    }>("/push/vapid-public-key");
    if (!configured || !publicKey) return false;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPromptState(permission === "denied" ? "denied" : "asked");
      return false;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });
    }
    const json = sub.toJSON();
    await apiFetch("/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      }),
    });
    setPromptState("subscribed");
    return true;
  } catch (err) {
    console.warn("Push subscribe failed", err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try {
    await apiFetch("/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch {
    // ignore
  }
  await sub.unsubscribe().catch(() => {});
  setPromptState("pending");
}
