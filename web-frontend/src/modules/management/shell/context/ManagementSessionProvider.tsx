"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAuthenticatedUser } from "@/services/auth";
import type { AuthenticatedUser } from "@/services/auth";
import type { ManagementPortal } from "../config/module-registry";

type ManagementSessionState = {
  portal: ManagementPortal;
  status: "loading" | "ready" | "error";
  user: AuthenticatedUser | null;
};

const ManagementSessionContext = createContext<ManagementSessionState | null>(null);

export function ManagementSessionProvider({
  portal,
  children,
}: {
  portal: ManagementPortal;
  children: ReactNode;
}) {
  const [session, setSession] = useState<ManagementSessionState>({ portal, status: "loading", user: null });

  useEffect(() => {
    let active = true;

    getAuthenticatedUser()
      .then(({ user }) => {
        if (active) setSession({ portal, status: "ready", user });
      })
      .catch(() => {
        if (active) setSession({ portal, status: "error", user: null });
      });

    return () => {
      active = false;
    };
  }, [portal]);

  const value = useMemo(() => session, [session]);

  return <ManagementSessionContext.Provider value={value}>{children}</ManagementSessionContext.Provider>;
}

export function useManagementSession() {
  const session = useContext(ManagementSessionContext);

  if (!session) {
    throw new Error("useManagementSession must be used within ManagementSessionProvider.");
  }

  return session;
}

export function useManagementPortal() {
  return useManagementSession().portal;
}
