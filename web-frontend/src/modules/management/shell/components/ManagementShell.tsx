"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { ManagementPortal } from "../config/module-registry";
import { useManagementNavigationCounts } from "../use-management-navigation-counts";
import { ManagementAccessGuard } from "./ManagementAccessGuard";
import ManagementSidebar from "./ManagementSidebar";
import ManagementMobileHeader from "./ManagementMobileHeader";

export function ManagementShell({ portal, children }: { portal: ManagementPortal; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { counts, error } = useManagementNavigationCounts();

  return (
    <div
      className="flex min-h-screen overflow-x-hidden"
      style={{ "--management-sidebar-width": collapsed ? "72px" : "256px" } as CSSProperties}
    >
      <ManagementSidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        counts={counts}
        countsError={error}
        portal={portal}
      />
      <div className="min-w-0 flex-1 lg:pl-[var(--management-sidebar-width)]">
        <ManagementMobileHeader counts={counts} countsError={error} portal={portal} />
        <main className="bg-background">
          <div className="mx-auto w-full max-w-[1440px]">
            <ManagementAccessGuard portal={portal}>{children}</ManagementAccessGuard>
          </div>
        </main>
      </div>
    </div>
  );
}
