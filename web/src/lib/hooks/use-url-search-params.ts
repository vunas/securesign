"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

type HistoryMode = "push" | "replace";

const URL_STATE_CHANGE_EVENT = "securesign:url-state-change";

function subscribeToUrlState(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(URL_STATE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(URL_STATE_CHANGE_EVENT, callback);
  };
}

function getSearchSnapshot() {
  return window.location.search;
}

function getServerSearchSnapshot() {
  return "";
}

export function useUrlSearchParams() {
  const search = useSyncExternalStore(
    subscribeToUrlState,
    getSearchSnapshot,
    getServerSearchSnapshot,
  );
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);

  const setSearchParams = useCallback(
    (updates: Record<string, string | null>, mode: HistoryMode = "replace") => {
      const url = new URL(window.location.href);
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          url.searchParams.set(key, value);
        } else {
          url.searchParams.delete(key);
        }
      }

      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl === currentUrl) return;

      if (mode === "push") {
        window.history.pushState(null, "", nextUrl);
      } else {
        window.history.replaceState(null, "", nextUrl);
      }
      window.dispatchEvent(new Event(URL_STATE_CHANGE_EVENT));
    },
    [],
  );
  const setSearchParam = useCallback(
    (key: string, value: string | null, mode: HistoryMode = "replace") =>
      setSearchParams({ [key]: value }, mode),
    [setSearchParams],
  );

  return { searchParams, setSearchParam, setSearchParams };
}
