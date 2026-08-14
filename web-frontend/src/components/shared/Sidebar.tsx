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
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/FormDialogLayout";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { getAuthenticatedUser, logout as logoutUser } from "@/services/auth";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const ownerNavSections: NavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/owner", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Rental Operations",
    items: [
      { href: "/owner/booking", label: "Booking", icon: CalendarCheck },
      { href: "/owner/verification-queue", label: "ID Verification", icon: ClipboardCheck },
    ],
  },
  {
    label: "Fleet Operations",
    items: [
      { href: "/owner/vehicle", label: "Vehicle", icon: Settings },
      { href: "/owner/maintenance", label: "Maintenance", icon: Wrench },
      { href: "/owner/fleet", label: "Fleet Tracker", icon: Car },
      { href: "/owner/video-auditing", label: "Video Auditing", icon: Video },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/owner/report", label: "Reports & Analytics", icon: BarChart3 }],
  },
  {
    label: "Administration",
    items: [{ href: "/owner/admin", label: "Admin", icon: ShieldCheck }],
  },
];

const adminNavSections: NavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "view dashboard" }],
  },
  {
    label: "Rental Operations",
    items: [
      { href: "/admin/booking", label: "Booking", icon: CalendarCheck, permission: "manage bookings" },
      { href: "/admin/verification-queue", label: "ID Verification", icon: ClipboardCheck, permission: "review documents" },
    ],
  },
  {
    label: "Fleet Operations",
    items: [
      { href: "/admin/vehicle", label: "Vehicle", icon: Settings, permission: "manage vehicles" },
      { href: "/admin/maintenance", label: "Maintenance", icon: Wrench, permission: "manage maintenance" },
      { href: "/admin/fleet", label: "Fleet Tracker", icon: Car, permission: "view fleet tracker" },
      { href: "/admin/video-auditing", label: "Video Auditing", icon: Video, permission: "view video auditing" },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/admin/report", label: "Reports & Analytics", icon: BarChart3, permission: "view reports" }],
  },
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

  const navSections = useMemo(() => {
    if (role === "owner") return ownerNavSections;
    if (!permissions) return [];

    return adminNavSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.permission || permissions.has(item.permission)),
      }))
      .filter((section) => section.items.length > 0);
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
          <p className="bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] bg-clip-text text-lg font-semibold text-transparent">
            JAMJADE
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-border mb-4" />

      {/* Navigation */}
      <nav
        aria-label={`${role === "owner" ? "Owner" : "Admin"} navigation`}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-2"
      >
        {navSections.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">
              {section.label}
            </p>

            {section.items.map(({ href, label, icon: Icon }) => {
              const isDashboard = href === "/owner" || href === "/admin";
              const isActive = pathname === href || (!isDashboard && pathname.startsWith(`${href}/`));

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`
                    group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-200
                    ${
                      isActive
                        ? "bg-primary text-white shadow-[0_4px_14px_rgba(52,110,246,0.32)]"
                        : "text-muted-foreground hover:bg-background hover:text-primary"
                    }
                  `}
                >
                  {/* Active left accent bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/40" />
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
                      className="flex-shrink-0 text-white/60"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
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

          <FormDialogContent width="compact">
            <FormDialogHeader
              title="Confirm Logout"
              icon={LogOut}
              onClose={() => setLogoutOpen(false)}
              closeLabel="Close logout confirmation"
              iconClassName="bg-destructive-surface text-destructive"
            />
            <p className="px-4 py-5 text-sm leading-6 text-muted-foreground sm:px-6">
              You&apos;re about to sign out of your JamJade account. Any unsaved
              changes may be lost.
            </p>
            <FormDialogFooter>
              <Button
                variant="outline"
                onClick={() => setLogoutOpen(false)}
                className="border-border text-[13.5px] font-medium text-muted-foreground hover:bg-background"
              >
                Cancel
              </Button>
              <Button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="bg-primary text-[13.5px] font-semibold text-white shadow-[0_4px_14px_rgba(52,110,246,0.32)] hover:bg-primary-hover"
              >
                {isLoggingOut ? "Logging out..." : "Yes, Log Out"}
              </Button>
            </FormDialogFooter>
          </FormDialogContent>
        </Dialog>
      </div>
    </aside>
  );
}
