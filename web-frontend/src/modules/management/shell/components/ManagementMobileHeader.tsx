"use client";

import Image from "next/image";
import { useState } from "react";
import { Bell, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { ManagementPortal } from "../config/module-registry";
import { ManagementSidebarNav } from "./ManagementSidebarNav";

interface ManagementMobileHeaderProps {
  portal: ManagementPortal;
  pendingReservations: number;
}

export default function ManagementMobileHeader({ portal, pendingReservations }: ManagementMobileHeaderProps) {
  const [navOpen, setNavOpen] = useState(false);
  const pendingLabel = pendingReservations > 99 ? "99+" : String(pendingReservations);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-surface/90 px-2 backdrop-blur lg:hidden">
      <button
        type="button"
        aria-expanded={navOpen}
        aria-controls="management-mobile-nav"
        aria-label="Open navigation menu"
        onClick={() => setNavOpen(true)}
        className="flex size-11 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
        <Image src="/JamJadeLogo-gradient.png" alt="" width={28} height={28} sizes="28px" className="object-contain" />
        <span className="text-sm font-semibold tracking-tight text-foreground">JamJade Car Rental</span>
      </div>

      <div className="ml-auto flex items-center">
        <button
          type="button"
          aria-label={pendingReservations > 0 ? `${pendingReservations} pending reservations` : "No pending reservations"}
          title={pendingReservations > 0 ? `${pendingReservations} pending reservations` : "No pending reservations"}
          className="relative flex size-11 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell size={19} aria-hidden="true" />
          {pendingReservations > 0 ? (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full border-2 border-surface bg-warning px-1 text-[9px] font-bold leading-4 text-warning-foreground">
              {pendingLabel}
            </span>
          ) : null}
        </button>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent id="management-mobile-nav" side="left" className="w-72 max-w-[288px] gap-0 border-r border-border p-0" showCloseButton>
          <SheetTitle className="sr-only">{portal === "admin" ? "Admin" : "Staff"} navigation</SheetTitle>
          <div className="mx-3 mb-1 mt-3 flex h-11 items-center gap-2.5">
            <Image src="/JamJadeLogo-gradient.png" alt="JamJade" width={36} height={36} sizes="36px" className="object-contain" />
            <p className="text-sm font-semibold tracking-tight text-foreground">JamJade Car Rental</p>
          </div>
          <div className="mx-3 my-1.5 h-px shrink-0 bg-border" />
          <ManagementSidebarNav onNavigate={() => setNavOpen(false)} pendingReservations={pendingReservations} portal={portal} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
