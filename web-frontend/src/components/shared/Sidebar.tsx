"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Car,
  Settings,
  CalendarCheck,
  ShieldCheck,
  ClipboardCheck,
  BarChart3,
  LogOut,
  ChevronRight,
  Video,
  type LucideIcon,
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
import Image from "next/image";
import { getAuthenticatedUser, logout as logoutUser } from "@/services/auth";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
};

const ownerNavItems: NavItem[] = [
  { href: "/owner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/fleet", label: "Fleet Tracker", icon: Car },
  { href: "/owner/video-auditing", label: "Video Auditing", icon: Video },
  { href: "/owner/vehicle", label: "Vehicle Management", icon: Settings },
  { href: "/owner/booking", label: "Booking Management", icon: CalendarCheck },
  { href: "/owner/verification-queue", label: "Verification Queue", icon: ClipboardCheck },
  { href: "/owner/admin", label: "Admin Management", icon: ShieldCheck },
  { href: "/owner/report", label: "Reports & Analytics", icon: BarChart3 },
];

const adminNavItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "view dashboard" },
  { href: "/admin/fleet", label: "Fleet Tracker", icon: Car, permission: "view fleet tracker" },
  { href: "/admin/video-auditing", label: "Video Auditing", icon: Video, permission: "view video auditing" },
  { href: "/admin/vehicle", label: "Vehicle Management", icon: Settings, permission: "manage vehicles" },
  { href: "/admin/booking", label: "Booking Management", icon: CalendarCheck, permission: "manage bookings" },
  { href: "/admin/verification-queue", label: "Verification Queue", icon: ClipboardCheck, permission: "review documents" },
  { href: "/admin/report", label: "Reports & Analytics", icon: BarChart3, permission: "view reports" },
];

type SidebarRole = "owner" | "admin";

interface SidebarProps {
  role?: SidebarRole;
}

export default function Sidebar({ role = "owner" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [permissions, setPermissions] = useState<Set<string> | null>(role === "owner" ? new Set() : null);

  useEffect(() => {
    if (role === "owner") return;

    let mounted = true;

    getAuthenticatedUser()
      .then(({ user }) => {
        if (mounted) {
          setPermissions(new Set(user.permissions ?? []));
        }
      })
      .catch(() => {
        if (mounted) router.replace("/login");
      });

    return () => {
      mounted = false;
    };
  }, [role, router]);

  const navItems = useMemo(() => {
    if (role === "owner") return ownerNavItems;
    if (!permissions) return [];

    return adminNavItems.filter((item) => !item.permission || permissions.has(item.permission));
  }, [permissions, role]);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logoutUser();
    } catch (error) {
      console.error("Logout request failed.", error);
    } finally {
      setIsLoggingOut(false);
      setLogoutOpen(false);
      router.replace("/login");
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[var(--sidebar-w)] shrink-0 flex-col overflow-hidden bg-white border-r border-border shadow-[4px_0_24px_rgba(52,110,246,0.06)]">
      
      {/* Logo / Brand */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <Image
            src="/JamJadeLogo.png"
            alt="JamJade Logo"
            width={52}
            height={52}
            className="object-contain"
          />
          <div>
          <p className="bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] bg-clip-text text-transparent text-lg font-semibold">
            JAMJADE
          </p>
          <p className="bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] bg-clip-text text-transparent text-lg font-semibold">
            CAR RENTAL
          </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-border mb-4" />

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
                    ? "bg-primary text-white shadow-[0_4px_14px_rgba(52,110,246,0.32)]"
                    : "text-muted-foreground hover:bg-background hover:text-primary"
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
                    : "text-muted-foreground group-hover:text-primary"
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
        <div className="mx-3 h-px bg-border mb-4" />

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

          <DialogContent className="sm:max-w-[400px] rounded-2xl border-border shadow-2xl">
            <DialogHeader className="text-left pb-1">
              <DialogTitle className="text-[17px] font-bold text-foreground leading-tight">
                Confirm Logout
              </DialogTitle>
              <DialogDescription className="text-[13.5px] text-muted-foreground mt-1.5 leading-relaxed">
                You&apos;re about to sign out of your JamJade account. Any unsaved
                changes may be lost.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex gap-2 pt-2 sm:flex-row flex-col">
              <Button
                variant="outline"
                onClick={() => setLogoutOpen(false)}
                className="flex-1 rounded-xl border-border text-muted-foreground hover:bg-background hover:border-[#CBD5E1] text-[13.5px] font-medium h-10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex-1 rounded-xl bg-primary hover:bg-primary-hover text-white text-[13.5px] font-semibold h-10 shadow-[0_4px_14px_rgba(52,110,246,0.32)] transition-all duration-200"
              >
                {isLoggingOut ? "Logging out..." : "Yes, Log Out"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </aside>
  );
}
