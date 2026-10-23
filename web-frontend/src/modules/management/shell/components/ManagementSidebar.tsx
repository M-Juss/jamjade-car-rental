import Image from "next/image";
import type { ManagementNavigationCounts } from "@/services/management/navigation.service";
import { PanelLeftClose } from "lucide-react";
import type { ManagementPortal } from "../config/module-registry";
import { ManagementSidebarNav } from "./ManagementSidebarNav";

interface ManagementSidebarProps {
  portal: ManagementPortal;
  collapsed: boolean;
  counts: ManagementNavigationCounts;
  countsError: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export default function ManagementSidebar({
  portal,
  collapsed,
  counts,
  countsError,
  onCollapsedChange,
}: ManagementSidebarProps) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col overflow-hidden border-r border-border bg-surface lg:flex motion-reduce:transition-none"
      style={{ width: "var(--management-sidebar-width)", transition: "width 200ms ease" }}
    >
      <div className="mx-3 mb-1 mt-3 flex h-11 shrink-0 items-center">
        {collapsed ? (
          <button
            type="button"
            aria-label="Expand JamJade navigation"
            title="Expand navigation"
            onClick={() => onCollapsedChange(false)}
            className="group relative flex size-11 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image src="/JamJadeLogo-solid.png" alt="" width={36} height={36} sizes="36px" className="object-contain" />
            <span role="tooltip" className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              Expand navigation
            </span>
          </button>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Image src="/JamJadeLogo-solid.png" alt="JamJade" width={36} height={36} sizes="36px" className="object-contain" />
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">JamJade Car Rental</p>
            </div>
            <button
              type="button"
              aria-label="Collapse navigation"
              title="Collapse navigation"
              onClick={() => onCollapsedChange(true)}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PanelLeftClose size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <div className="mx-3 my-1.5 h-px shrink-0 bg-border" />

      <ManagementSidebarNav
        collapsed={collapsed}
        onExpandSidebar={() => onCollapsedChange(false)}
        counts={counts}
        countsError={countsError}
        portal={portal}
      />
    </aside>
  );
}
