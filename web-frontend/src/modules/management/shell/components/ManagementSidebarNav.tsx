"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, LogOut } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/forms/FormDialogLayout";
import { Button } from "@/components/ui/button";
import { logout as logoutUser } from "@/services/auth";
import {
  managementModulesForPortal,
  managementPath,
  managementSections,
  type ManagementPortal,
} from "../config/module-registry";
import { useManagementSession } from "../context/ManagementSessionProvider";

interface ManagementSidebarNavProps {
  portal: ManagementPortal;
}

export function ManagementSidebarNav({ portal }: ManagementSidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user } = useManagementSession();
  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);

  const navSections = useMemo(() => {
    const modules = managementModulesForPortal(portal, permissions);

    return managementSections
      .map((label) => ({
        label,
        items: modules.flatMap((module) => {
          const href = managementPath(portal, module.id);
          return module.section === label && href ? [{ ...module, href }] : [];
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [permissions, portal]);

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
    <>
      {/* Navigation */}
      <nav
        aria-label={`${portal === "admin" ? "Admin" : "Staff"} navigation`}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-2"
      >
        {navSections.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">
              {section.label}
            </p>

            {section.items.map(({ href, id, label, icon: Icon }) => {
              const isDashboard = id === "dashboard";
              const isActive = pathname === href || (!isDashboard && pathname.startsWith(`${href}/`));

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`
                    group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-200
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
        <div className="mx-3 mb-4 h-px bg-border" />

        {/* Logout */}
        <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <DialogTrigger asChild>
            <button className="group flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#E05252] transition-all duration-200 hover:bg-[#FEF2F2]">
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
    </>
  );
}
