"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, type WorldEvent } from "./api";
import type { Coin, LiveEvent } from "@/types";

type Updater<T> = T | ((prev: T) => T);

interface AsyncResult<T> {
  key: string;
  nonce: number;
  data: T | null;
  error: string | null;
}

/** Load async data with loading / error state. `deps` re-run the loader. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]) {
  const key = JSON.stringify(deps);
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<AsyncResult<T>>({ key: "", nonce: -1, data: null, error: null });
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let alive = true;
    loaderRef
      .current()
      .then((d) => alive && setResult({ key, nonce, data: d, error: null }))
      .catch((e: unknown) => alive && setResult({ key, nonce, data: null, error: e instanceof Error ? e.message : "Something went wrong" }));
    return () => {
      alive = false;
    };
  }, [key, nonce]);

  const loading = result.key !== key || result.nonce !== nonce;
  const data = result.key === key ? result.data : null;
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((u: Updater<T | null>) => {
    setResult((r) => ({ ...r, data: typeof u === "function" ? (u as (p: T | null) => T | null)(r.data) : u }));
  }, []);
  return { data, loading, error: loading ? null : result.error, reload, setData };
}

/** Subscribe to world events (trades, coin updates, live feed). */
export function useWorldEvents(handler: (e: WorldEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => api.subscribe((e) => ref.current(e)), []);
}

/** Keep a coin object fresh as trades land. */
export function useLiveCoin(initial: Coin | null) {
  const [state, setState] = useState<{ initial: Coin | null; coin: Coin | null }>({ initial, coin: initial });
  if (state.initial !== initial) {
    // Adjust state while rendering when the source object changes (React-documented pattern)
    setState({ initial, coin: initial });
  }
  useWorldEvents((e) => {
    if (e.type === "coin" && initial && e.coin.mint === initial.mint) setState((s) => ({ ...s, coin: e.coin }));
  });
  return state.initial === initial ? state.coin : initial;
}

/** Rolling list of live events, newest first. */
export function useLiveFeed(limit = 30) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  useEffect(() => {
    let alive = true;
    api.getRecentEvents(limit).then((e) => alive && setEvents(e));
    return () => {
      alive = false;
    };
  }, [limit]);
  useWorldEvents((e) => {
    if (e.type === "live") setEvents((prev) => [e.event, ...prev].slice(0, limit));
  });
  return events;
}

/** Starts polling the server for live updates (idempotent, client only). */
export function useLiveUpdates() {
  useEffect(() => {
    api.startLive();
  }, []);
}

/** Current time, updated every `ms`. 0 during SSR. */
export function useNow(ms = 1000) {
  return useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, ms);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / ms) * ms,
    () => 0,
  );
}

/** Re-render every `ms` (for "x seconds ago" labels). */
export function useTick(ms = 1000) {
  useNow(ms);
}

/** Returns true only after hydration — for client-only bits that would otherwise mismatch SSR. */
export function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** A stable projected-graduation timestamp per coin, so the countdown ticks smoothly. */
export function useGraduationTarget(coin: Coin | null) {
  const now = useNow(1000);
  const [state, setState] = useState<{ mint: string; target: number } | null>(null);
  if (coin && now > 0 && (!state || state.mint !== coin.mint)) {
    const target = now + Math.max(1, 100 - coin.curvePct) * 48_000 + 90_000;
    setState({ mint: coin.mint, target });
    return target;
  }
  return state && coin && state.mint === coin.mint ? state.target : now;
}
