export function VerificationDetailItem({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="w-full rounded-xl bg-background px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle-foreground">{label}</p>
      <p className="mt-0.5 text-[12.5px] font-semibold text-foreground">{value || "Not provided"}</p>
    </div>
  );
}
