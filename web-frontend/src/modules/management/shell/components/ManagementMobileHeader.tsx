"use client";

import Image from "next/image";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { ManagementPortal } from "../config/module-registry";
import { ManagementSidebarNav } from "./ManagementSidebarNav";

interface ManagementMobileHeaderProps {
  portal: ManagementPortal;
}

export default function ManagementMobileHeader({ portal }: ManagementMobileHeaderProps) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-white px-4 shadow-[0_2px_12px_rgba(23,49,95,0.05)] lg:hidden">
      <div className="flex items-center gap-2.5">
        <Image
          src="/JamJadeLogo.png"
          alt="JamJade Logo"
          width={36}
          height={36}
          sizes="36px"
          className="object-contain"
        />
        <p className="bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] bg-clip-text text-base font-semibold text-transparent">
          JAMJADE
        </p>
      </div>

      <button
        type="button"
        aria-expanded={navOpen}
        aria-controls="management-mobile-nav"
        aria-label="Open navigation menu"
        onClick={() => setNavOpen(true)}
        className="flex size-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Menu size={24} aria-hidden="true" />
      </button>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          id="management-mobile-nav"
          side="left"
          className="w-[260px] gap-0 border-r border-border p-0"
        >
          <SheetTitle className="sr-only">
            {portal === "admin" ? "Admin" : "Staff"} navigation
          </SheetTitle>

          <div className="flex items-center gap-3 px-6 pb-6 pt-8">
            <Image
              src="/JamJadeLogo.png"
              alt="JamJade Logo"
              width={52}
              height={52}
              sizes="52px"
              className="object-contain"
            />
            <p className="bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] bg-clip-text text-lg font-semibold text-transparent">
              JAMJADE
            </p>
          </div>

          <div className="mx-6 mb-4 h-px bg-border" />

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <ManagementSidebarNav portal={portal} />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
