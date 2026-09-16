"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getDashboardPathForUser, getUserRoleNames } from "@/services/auth";
import { managementModuleForPath, type ManagementPortal } from "../config/module-registry";
import { useManagementSession } from "../context/ManagementSessionProvider";

export function ManagementAccessGuard({
  portal,
  children,
}: {
  portal: ManagementPortal;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user } = useManagementSession();
  const currentModule = managementModuleForPath(pathname, portal);
  const roles = user ? getUserRoleNames(user) : [];
  const permissions = new Set(user?.permissions ?? []);
  const isAdmin = roles.includes("admin");
  const isAuthorized = status === "ready" && Boolean(
    portal === "admin"
      ? isAdmin
      : !isAdmin && currentModule?.permission && permissions.has(currentModule.permission),
  );

  useEffect(() => {
    if (status === "loading") return;

    if (status === "error" || !user) {
      router.replace("/login");
      return;
    }

    if (portal === "admin" && !isAdmin) {
      router.replace(getDashboardPathForUser(user));
      return;
    }

    if (portal === "staff" && isAdmin) {
      router.replace("/admin");
      return;
    }

    if (!isAuthorized) router.replace(getDashboardPathForUser(user));
  }, [isAuthorized, isAdmin, portal, router, status, user]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm font-medium text-muted-foreground">
        <Loader2 size={16} className="mr-2 animate-spin" />
        Loading access
      </div>
    );
  }

  return <>{children}</>;
}
