"use client";
import { useSyncExternalStore } from "react";

export const REF_COOKIE = "beckpad_ref";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const EVT = "beckpad:ref";

export function setRefCookie(code: string) {
  if (typeof document === "undefined") return;
  const safe = code.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  if (!safe) return;
  document.cookie = `${REF_COOKIE}=${safe}; path=/; max-age=${MAX_AGE}; samesite=lax`;
  window.dispatchEvent(new Event(EVT));
}

export function getRefCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${REF_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function clearRefCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${REF_COOKIE}=; path=/; max-age=0`;
  window.dispatchEvent(new Event(EVT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  const id = setInterval(cb, 1500);
  return () => {
    window.removeEventListener(EVT, cb);
    clearInterval(id);
  };
}

/** The referral code currently attached to this browser, kept in sync with the cookie. */
export function useRefCode() {
  return useSyncExternalStore(subscribe, getRefCookie, () => null);
}

export function absoluteRefUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
