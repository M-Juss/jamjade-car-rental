"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { ManagementPortal } from "../config/module-registry";
import { getPendingBookingCount } from "@/services/booking";
import { ManagementAccessGuard } from "./ManagementAccessGuard";
import ManagementSidebar from "./ManagementSidebar";
import ManagementMobileHeader from "./ManagementMobileHeader";
import { useManagementSession } from "../context/ManagementSessionProvider";

export function ManagementShell({ portal, children }: { portal: ManagementPortal; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingReservations, setPendingReservations] = useState(0);
  const { user } = useManagementSession();
  const canManageBookings = portal === "admin" || user?.permissions?.includes("manage bookings") === true;

  useEffect(() => {
    if (!canManageBookings) return;

    let active = true;

    getPendingBookingCount()
      .then((count) => {
        if (active) setPendingReservations(count);
      })
      .catch(() => {
        if (active) setPendingReservations(0);
      });

    return () => {
      active = false;
    };
  }, [canManageBookings]);

  return (
    <div
      className="flex min-h-screen overflow-x-hidden"
      style={{ "--management-sidebar-width": collapsed ? "72px" : "256px" } as CSSProperties}
    >
      <ManagementSidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        pendingReservations={pendingReservations}
        portal={portal}
      />
      <div className="min-w-0 flex-1 lg:pl-[var(--management-sidebar-width)]">
        <ManagementMobileHeader pendingReservations={pendingReservations} portal={portal} />
        <main className="bg-background">
          <div className="mx-auto w-full max-w-[1440px]">
            <ManagementAccessGuard portal={portal}>{children}</ManagementAccessGuard>
          </div>
        </main>
      </div>
    </div>
  );
}
