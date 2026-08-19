import Image from "next/image";
import type { ManagementPortal } from "../config/module-registry";
import { ManagementSidebarNav } from "./ManagementSidebarNav";

interface ManagementSidebarProps {
  portal: ManagementPortal;
}

export default function ManagementSidebar({ portal }: ManagementSidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[var(--sidebar-w)] shrink-0 flex-col overflow-hidden border-r border-border bg-white shadow-[4px_0_24px_rgba(52,110,246,0.06)] lg:flex">
      {/* Logo / Brand */}
      <div className="px-6 pb-6 pt-8">
        <div className="flex items-center gap-3">
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
      </div>

      {/* Divider */}
      <div className="mx-6 mb-4 h-px bg-border" />

      <ManagementSidebarNav portal={portal} />
    </aside>
  );
}
