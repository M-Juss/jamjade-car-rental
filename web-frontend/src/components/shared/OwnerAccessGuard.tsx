"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthenticatedUser, getDashboardPathForUser, getUserRoleNames } from "@/services/auth";

export function OwnerAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [access, setAccess] = useState<{ pathname: string; isAuthorized: boolean } | null>(null);

  useEffect(() => {
    let mounted = true;

    getAuthenticatedUser()
      .then(({ user }) => {
        if (!mounted) return;

        const roles = getUserRoleNames(user);

        if (roles.includes("owner")) {
          setAccess({ pathname, isAuthorized: true });
          return;
        }

        router.replace(getDashboardPathForUser(user));
      })
      .catch(() => {
        if (mounted) {
          router.replace("/login");
        }
      });

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!access?.isAuthorized || access.pathname !== pathname) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] text-sm font-medium text-[#6B7589]">
        <Loader2 size={16} className="mr-2 animate-spin" />
        Loading access
      </div>
    );
  }

  return <>{children}</>;
}
