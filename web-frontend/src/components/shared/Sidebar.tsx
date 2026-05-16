"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Car,
  Settings,
  CalendarCheck,
  ShieldCheck,
  BarChart3,
  LogOut,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ownerNavItems = [
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/fleet", label: "Fleet Tracker", icon: Car },
  { href: "/owner/vehicle", label: "Vehicle Management", icon: Settings },
  { href: "/owner/booking", label: "Booking Management", icon: CalendarCheck },
  { href: "/owner/admin", label: "Admin Management", icon: ShieldCheck },
  { href: "/owner/report", label: "Reports & Analytics", icon: BarChart3 },
];

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/fleet", label: "Fleet Tracker", icon: Car },
  { href: "/admin/vehicle", label: "Vehicle Management", icon: Settings },
  { href: "/admin/booking", label: "Booking Management", icon: CalendarCheck },
  { href: "/admin/report", label: "Reports & Analytics", icon: BarChart3 },
];

type SidebarRole = "owner" | "admin";

interface SidebarProps {
  role?: SidebarRole;
}

export default function Sidebar({ role = "owner" }: SidebarProps) {
  const pathname = usePathname();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const navItems = role === "admin" ? adminNavItems : ownerNavItems;

  const handleLogout = () => {
    // Add your logout logic here
    setLogoutOpen(false);
    console.log("Logged out");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[var(--sidebar-w)] shrink-0 flex-col overflow-hidden bg-white border-r border-[#E8ECF4] shadow-[4px_0_24px_rgba(52,110,246,0.06)]">
      
      {/* Logo / Brand */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#346EF6] flex items-center justify-center shadow-[0_4px_12px_rgba(52,110,246,0.35)]">
            <Car size={18} className="text-white" strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[13px] font-bold tracking-[0.12em] uppercase text-[#1A2340] leading-none">
              JamJade
            </p>
            <p className="text-[13px] font-bold text-[#1A2340] leading-tight mt-0.5">
              Car Rental
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-[#EEF1F8] mb-4" />

      {/* Nav label */}
      <p className="px-6 text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[#A0AABF] mb-2">
        Main Menu
      </p>

      {/* Navigation */}
      <nav className="flex-1 px-3 flex flex-col gap-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs  font-medium transition-all duration-200
                ${
                  isActive
                    ? "bg-[#346EF6] text-white shadow-[0_4px_14px_rgba(52,110,246,0.32)]"
                    : "text-[#4A5568] hover:bg-[#F5F5F5] hover:text-[#346EF6]"
                }
              `}
            >
              {/* Active left accent bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white/40 rounded-r-full" />
              )}

              <Icon
                size={17}
                strokeWidth={isActive ? 2.4 : 2}
                className={`flex-shrink-0 transition-colors duration-200 ${
                  isActive
                    ? "text-white"
                    : "text-[#8896A7] group-hover:text-[#346EF6]"
                }`}
              />
              <span className="flex-1 tracking-[-0.01em]">{label}</span>

              {isActive && (
                <ChevronRight
                  size={14}
                  className="text-white/60 flex-shrink-0"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-6 pt-4">
        <div className="mx-3 h-px bg-[#EEF1F8] mb-4" />

        {/* Logout */}
        <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <DialogTrigger asChild>
            <button className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#E05252] hover:bg-[#FEF2F2] transition-all duration-200">
              <LogOut
                size={17}
                strokeWidth={2}
                className="flex-shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
              />
              <span className="tracking-[-0.01em]">Log Out</span>
            </button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[400px] rounded-2xl border-[#EEF1F8] shadow-2xl">
            <DialogHeader className="text-left pb-1">
              <DialogTitle className="text-[17px] font-bold text-[#1A2340] leading-tight">
                Confirm Logout
              </DialogTitle>
              <DialogDescription className="text-[13.5px] text-[#6B7589] mt-1.5 leading-relaxed">
                You're about to sign out of your JamJade account. Any unsaved
                changes may be lost.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex gap-2 pt-2 sm:flex-row flex-col">
              <Button
                variant="outline"
                onClick={() => setLogoutOpen(false)}
                className="flex-1 rounded-xl border-[#E2E8F0] text-[#4A5568] hover:bg-[#F5F5F5] hover:border-[#CBD5E1] text-[13.5px] font-medium h-10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleLogout}
                className="flex-1 rounded-xl bg-[#346EF6] hover:bg-[#2558D8] text-white text-[13.5px] font-semibold h-10 shadow-[0_4px_14px_rgba(52,110,246,0.32)] transition-all duration-200"
              >
                Yes, Log Out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </aside>
  );
}
