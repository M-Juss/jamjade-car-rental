import { ManagementShell } from "@/modules/management/shell/components/ManagementShell";
import { ManagementSessionProvider } from "@/modules/management/shell/context/ManagementSessionProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ManagementSessionProvider portal="admin">
      <ManagementShell portal="admin">{children}</ManagementShell>
    </ManagementSessionProvider>
  );
}
