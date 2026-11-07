import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VerificationStatus } from "@/services/verification";

export const verificationStatusMeta: Record<
  VerificationStatus,
  { label: string; badge: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pending",
    badge: "bg-warning-surface text-warning border-warning-border",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    badge: "bg-success-surface text-success border-success-border",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    badge: "bg-destructive-surface text-destructive border-destructive-border",
    icon: XCircle,
  },
};

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  const Icon = verificationStatusMeta[status].icon;

  return (
    <Badge
      variant="outline"
      className={`h-auto min-h-6 max-w-full whitespace-normal rounded-lg px-2 text-center text-xs font-semibold leading-tight ${verificationStatusMeta[status].badge}`}
    >
      <Icon size={12} />
      {verificationStatusMeta[status].label}
    </Badge>
  );
}
