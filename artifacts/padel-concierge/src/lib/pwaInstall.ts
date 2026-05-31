import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    emit();
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // iOS Safari home-screen flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

export function isInstalled(): boolean {
  return installed || isStandalone();
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/** Triggers the native Android/Chrome install prompt. Returns the outcome. */
export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  if (!deferredPrompt) return "unavailable";
  const evt = deferredPrompt;
  await evt.prompt();
  const choice = await evt.userChoice;
  if (choice.outcome === "accepted") {
    installed = true;
  }
  deferredPrompt = null;
  emit();
  return choice.outcome;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): string {
  return `${deferredPrompt ? "1" : "0"}:${installed ? "1" : "0"}`;
}

function getServerSnapshot(): string {
  return "0:0";
}

export interface PwaInstallState {
  isInstallable: boolean;
  isStandalone: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isMobile: boolean;
  promptInstall: typeof promptInstall;
}

export function usePwaInstall(): PwaInstallState {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    isInstallable: canPromptInstall(),
    isStandalone: isStandalone(),
    isInstalled: isInstalled(),
    isIOS: isIOS(),
    isMobile: isMobile(),
    promptInstall,
  };
}
