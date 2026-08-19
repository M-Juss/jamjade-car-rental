import type { ReactNode } from "react";
import type { ManagementPortal } from "../config/module-registry";
import { ManagementAccessGuard } from "./ManagementAccessGuard";
import ManagementSidebar from "./ManagementSidebar";
import ManagementMobileHeader from "./ManagementMobileHeader";

export function ManagementShell({ portal, children }: { portal: ManagementPortal; children: ReactNode }) {
  return (
    <div className="flex min-h-screen overflow-x-hidden [--sidebar-w:260px]">
      <ManagementSidebar portal={portal} />
      <div className="min-w-0 flex-1 lg:pl-[var(--sidebar-w)]">
        <ManagementMobileHeader portal={portal} />
        <main className="bg-background">
          <ManagementAccessGuard portal={portal}>{children}</ManagementAccessGuard>
        </main>
      </div>
    </div>
  );
}
