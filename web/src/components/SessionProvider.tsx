"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "@/lib/types/auth";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
  );
}

export function useSessionUser(): SessionUser | null {
  return useContext(SessionContext);
}
