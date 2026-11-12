"use client";

import Link from "next/link";
import { PendingCountBadge } from "@/components/common/PendingCountBadge";
import type { ManagementNavigationCounts } from "@/services/management/navigation.service";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FlaskConical, ChevronDown, LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/forms/FormDialogLayout";
import { Button } from "@/components/ui/button";
import { getUserRoleNames, logout as logoutUser } from "@/services/auth";
import {
  managementModulesForPortal,
  managementPath,
  type ManagementModule,
  type ManagementPortal,
} from "../config/module-registry";
import { useManagementSession } from "../context/ManagementSessionProvider";

interface ManagementSidebarNavProps {
  portal: ManagementPortal;
  collapsed?: boolean;
  counts: ManagementNavigationCounts;
  countsError: boolean;
  onExpandSidebar?: () => void;
  onNavigate?: () => void;
}

const directModuleIds = new Set<ManagementModule["id"]>([
  "dashboard",
  "bookings",
  "history",
  "geofences",
  "verification",
  "fleetTracker",
  "drivingAnalysis",
  "reports",
]);

function initials(name?: string) {
  return (name ?? "User")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function compactTooltip(label: string) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-none transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {label}
    </span>
  );
}

function ManagementSidebarNavContent({
  portal,
  collapsed = false,
  counts,
  countsError,
  onExpandSidebar,
  onNavigate,
  pathname,
}: ManagementSidebarNavProps & { pathname: string }) {
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user } = useManagementSession();
  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);

  const visibleModules = useMemo(
    () => managementModulesForPortal(portal, permissions)
      .filter((module) => module.id !== "driveMonitoring")
      .flatMap((module) => {
        const href = managementPath(portal, module.id);
        return href ? [{ ...module, href }] : [];
      }),
    [permissions, portal],
  );
  const modelItems = visibleModules.filter((module) => module.section === "Model Development")
    .sort((a, b) => ["research", "modelExplorer"].indexOf(a.id) - ["research", "modelExplorer"].indexOf(b.id));
  const mainItems = visibleModules.filter((module) => directModuleIds.has(module.id));
  const managementItems = visibleModules.filter((module) => !directModuleIds.has(module.id) && module.section !== "Model Development");
  const managementIsActive = managementItems.some(
    (module) => pathname === module.href || pathname.startsWith(`${module.href}/`),
  );
  const [managementOpen, setManagementOpen] = useState(true);
  const [modelOpen, setModelOpen] = useState(true);

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

  const toggleManagement = () => {
    if (collapsed) {
      onExpandSidebar?.();
      setManagementOpen(true);
      return;
    }

    setManagementOpen((open) => !open);
  };

  const roleNames = user ? getUserRoleNames(user) : [];
  const roleLabel = roleNames.includes("owner") ? "Owner" : roleNames.includes("admin") ? "Administrator" : roleNames.includes("staff") ? "Staff" : user?.email;

  const renderLink = (module: (typeof visibleModules)[number], nested = false) => {
    const Icon = module.icon;
    const active = pathname === module.href || (module.id !== "dashboard" && pathname.startsWith(`${module.href}/`));
    const hasCounter = module.id === "bookings" || module.id === "verification";
    const count = module.id === "bookings" ? counts.bookings : counts.verification;
    const countLabel = module.id === "bookings" ? "bookings awaiting pickup" : "documents pending review";
    const countDescription = countsError ? "count unavailable" : count === null ? "checking count" : `${count} ${countLabel}`;
    const accessibleLabel = hasCounter ? `${module.label}, ${countDescription}` : module.label;

    return (
      <Link
        key={module.href}
        href={module.href}
        aria-current={active ? "page" : undefined}
        aria-label={accessibleLabel}
        title={accessibleLabel}
        onClick={onNavigate}
        className={`group relative flex w-full items-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
          nested
            ? "min-h-9 gap-2 px-3 text-sm font-medium"
            : collapsed
              ? "min-h-11 justify-center px-0"
              : "min-h-11 gap-3 px-3 text-sm"
        } ${
          active
            ? "bg-primary font-medium text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <span className="relative flex shrink-0">
          <Icon size={18} strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
        </span>
        {!collapsed && <span className={`min-w-0 flex-1 truncate ${hasCounter ? "pr-3" : ""}`}>{module.label}</span>}
        {hasCounter ? <PendingCountBadge count={count} label={countLabel} error={countsError} className="-right-1 -top-1" /> : null}
        {collapsed ? compactTooltip(accessibleLabel) : null}
      </Link>
    );
  };

  const renderGroup = (label: string, navigationId: string, items: typeof visibleModules,
    Icon: typeof Settings, open: boolean, active: boolean, toggle: () => void) => (
    <>
        {items.length > 0 ? (
          <div className="mt-1">
            <button
              type="button"
              aria-controls={navigationId}
              aria-expanded={open}
              aria-label={collapsed ? label : undefined}
              onClick={toggle}
              className={`group relative flex min-h-11 w-full items-center rounded-lg text-sm outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring ${
                collapsed ? "justify-center px-0 text-muted-foreground" : "gap-3 px-3 text-muted-foreground"
              } ${active ? "font-medium text-foreground" : ""}`}
            >
              <Icon size={18} aria-hidden="true" />
              {!collapsed ? (
                <>
                  <span className="flex-1 text-left">{label}</span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                  />
                </>
              ) : compactTooltip(label)}
            </button>

            {!collapsed && open ? (
              <div id={navigationId} className="ml-[21px] mt-2 flex flex-col gap-0.5 border-l border-border pl-2">
                {items.map((module) => renderLink(module, true))}
              </div>
            ) : null}
          </div>
        ) : null}
    </>
  );

  return (
    <>
      <nav
        aria-label={`${portal === "admin" ? "Admin" : "Staff"} navigation`}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-2"
      >
        {mainItems.map((module) => renderLink(module))}

        {renderGroup("Management", "management-subnavigation", managementItems, Settings, managementOpen, managementIsActive, toggleManagement)}
        {renderGroup("Model Development", "model-development-subnavigation", modelItems, FlaskConical, modelOpen,
          modelItems.some((module) => pathname === module.href || pathname.startsWith(`${module.href}/`)),
          () => { if (collapsed) { onExpandSidebar?.(); setModelOpen(true); } else { setModelOpen((open) => !open); } })}
      </nav>

      <div className="mt-3 border-t border-border px-3 pb-3 pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={collapsed ? "Open account menu" : undefined}
              className={`group relative flex min-h-11 w-full items-center rounded-lg text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${
                collapsed ? "justify-center px-0" : "gap-2.5 px-2"
              }`}
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-muted text-xs font-semibold text-primary">{initials(user?.name)}</AvatarFallback>
              </Avatar>
              {!collapsed ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{user?.name ?? "Account"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{roleLabel ?? user?.email ?? ""}</span>
                </span>
              ) : compactTooltip(user?.name ? `Account: ${user.name}` : "Account")}
              {!collapsed ? <span aria-hidden="true" className="text-lg leading-none text-muted-foreground">⋯</span> : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align={collapsed ? "start" : "end"} sideOffset={8} className="w-56 rounded-lg border-border p-1 shadow-none">
            <DropdownMenuLabel className="px-2 py-1.5">
              <span className="block truncate text-xs font-semibold text-foreground">{user?.name ?? "Account"}</span>
              <span className="block truncate pt-0.5 text-xs font-normal text-muted-foreground">{user?.email ?? ""}</span>
              <span className="block truncate pt-0.5 text-xs font-normal text-muted-foreground">{roleLabel ?? ""}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(event) => event.preventDefault()} variant="destructive" className="min-h-9 gap-2 px-2 text-sm">
                  <LogOut size={16} aria-hidden="true" />
                  Log Out
                </DropdownMenuItem>
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
                  You&apos;re about to sign out of your JamJade account. Any unsaved changes may be lost.
                </p>
                <FormDialogFooter>
                  <Button variant="outline" onClick={() => setLogoutOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleLogout} disabled={isLoggingOut}>
                    {isLoggingOut ? "Logging out..." : "Yes, Log Out"}
                  </Button>
                </FormDialogFooter>
              </FormDialogContent>
            </Dialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

export function ManagementSidebarNav(props: ManagementSidebarNavProps) {
  const pathname = usePathname();

  return <ManagementSidebarNavContent key={pathname} {...props} pathname={pathname} />;
}
