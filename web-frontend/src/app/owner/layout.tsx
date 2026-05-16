import Sidebar  from "@/components/shared/Sidebar";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen overflow-x-hidden [--sidebar-w:260px]">
      <Sidebar role="owner" />
      <div aria-hidden className="w-[var(--sidebar-w)] shrink-0" />
      <main className="min-w-0 flex-1 bg-blue-200">{children}</main>
    </div>
  );
}
