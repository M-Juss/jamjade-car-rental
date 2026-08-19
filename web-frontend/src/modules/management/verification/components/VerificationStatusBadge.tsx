import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VerificationStatus } from "@/services/verification";

export const verificationStatusMeta: Record<
  VerificationStatus,
  { label: string; badge: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pending",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    badge: "bg-rose-50 text-rose-600 border-rose-200",
    icon: XCircle,
  },
};

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  const Icon = verificationStatusMeta[status].icon;

  return (
    <Badge
      variant="outline"
      className={`h-auto min-h-6 max-w-full whitespace-normal rounded-lg px-2 text-center text-[10px] font-semibold leading-tight ${verificationStatusMeta[status].badge}`}
    >
      <Icon size={12} />
      {verificationStatusMeta[status].label}
    </Badge>
  );
}
