import { ManagementShell } from "@/modules/management/shell/components/ManagementShell";
import { ManagementSessionProvider } from "@/modules/management/shell/context/ManagementSessionProvider";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ManagementSessionProvider portal="staff">
      <ManagementShell portal="staff">{children}</ManagementShell>
    </ManagementSessionProvider>
  );
}
