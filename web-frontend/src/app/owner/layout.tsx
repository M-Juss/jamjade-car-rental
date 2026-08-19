import { ManagementShell } from "@/modules/management/shell/components/ManagementShell";
import { ManagementSessionProvider } from "@/modules/management/shell/context/ManagementSessionProvider";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ManagementSessionProvider portal="owner">
      <ManagementShell portal="owner">{children}</ManagementShell>
    </ManagementSessionProvider>
  );
}
