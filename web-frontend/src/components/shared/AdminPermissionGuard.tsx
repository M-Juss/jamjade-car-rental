"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthenticatedUser, getDashboardPathForUser, getUserRoleNames } from "@/services/auth";

const adminRoutePermissions = [
  { path: "/admin/fleet", permission: "view fleet tracker" },
  { path: "/admin/video-auditing", permission: "view video auditing" },
  { path: "/admin/vehicle", permission: "manage vehicles" },
  { path: "/admin/booking", permission: "manage bookings" },
  { path: "/admin/verification-queue", permission: "review documents" },
  { path: "/admin/report", permission: "view reports" },
  { path: "/admin", permission: "view dashboard", exact: true },
];

export function AdminPermissionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [access, setAccess] = useState<{ pathname: string; isAuthorized: boolean } | null>(null);

  const requiredPermission = useMemo(() => {
    return adminRoutePermissions.find((route) => (
      route.exact ? pathname === route.path : pathname.startsWith(route.path)
    ))?.permission;
  }, [pathname]);

  useEffect(() => {
    let mounted = true;

    getAuthenticatedUser()
      .then(({ user }) => {
        if (!mounted) return;

        const roles = getUserRoleNames(user);

        if (roles.includes("owner")) {
          router.replace("/owner");
          return;
        }

        const permissions = new Set(user.permissions ?? []);

        if (!requiredPermission || permissions.has(requiredPermission)) {
          setAccess({ pathname, isAuthorized: true });
          return;
        }

        router.replace(getDashboardPathForUser(user));
      })
      .catch(() => {
        if (mounted) router.replace("/login");
      });

    return () => {
      mounted = false;
    };
  }, [pathname, requiredPermission, router]);

  if (!access?.isAuthorized || access.pathname !== pathname) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm font-medium text-muted-foreground">
        <Loader2 size={16} className="mr-2 animate-spin" />
        Loading access
      </div>
    );
  }

  return <>{children}</>;
}
