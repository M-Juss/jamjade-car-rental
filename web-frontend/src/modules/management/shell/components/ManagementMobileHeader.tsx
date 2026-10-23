"use client";

import Image from "next/image";
import { PendingCountBadge } from "@/components/common/PendingCountBadge";
import type { ManagementNavigationCounts } from "@/services/management/navigation.service";
import { useState } from "react";
import { Bell, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { ManagementPortal } from "../config/module-registry";
import { ManagementSidebarNav } from "./ManagementSidebarNav";
import { useManagementSession } from "../context/ManagementSessionProvider";

interface ManagementMobileHeaderProps {
  portal: ManagementPortal;
  counts: ManagementNavigationCounts;
  countsError: boolean;
}

export default function ManagementMobileHeader({ portal, counts, countsError }: ManagementMobileHeaderProps) {
  const [navOpen, setNavOpen] = useState(false);
  const { user } = useManagementSession();
  const canManageBookings = user?.permissions?.includes("manage bookings") === true;
  const bookingLabel = countsError ? "Booking count unavailable" : counts.bookings === null ? "Checking booking count" : `${counts.bookings} bookings awaiting pickup`;

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
        <Image src="/JamJadeLogo-solid.png" alt="" width={28} height={28} sizes="28px" className="object-contain" />
        <span className="text-sm font-semibold tracking-tight text-foreground">JamJade Car Rental</span>
      </div>

      {canManageBookings ? <div className="ml-auto flex items-center">
        <button
          type="button"
          aria-label={bookingLabel}
          title={bookingLabel}
          className="relative flex size-11 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell size={19} aria-hidden="true" />
          <PendingCountBadge count={counts.bookings} label="bookings awaiting pickup" error={countsError} className="right-0 top-0" />
        </button>
      </div> : null}

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent id="management-mobile-nav" side="left" className="w-72 max-w-[288px] gap-0 border-r border-border p-0" showCloseButton>
          <SheetTitle className="sr-only">{portal === "admin" ? "Admin" : "Staff"} navigation</SheetTitle>
          <div className="mx-3 mb-1 mt-3 flex h-11 items-center gap-2.5">
            <Image src="/JamJadeLogo-solid.png" alt="JamJade" width={36} height={36} sizes="36px" className="object-contain" />
            <p className="text-sm font-semibold tracking-tight text-foreground">JamJade Car Rental</p>
          </div>
          <div className="mx-3 my-1.5 h-px shrink-0 bg-border" />
          <ManagementSidebarNav onNavigate={() => setNavOpen(false)} counts={counts} countsError={countsError} portal={portal} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
