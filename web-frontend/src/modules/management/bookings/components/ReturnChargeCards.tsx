import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AdditionalChargeRecord, BookingRecord } from "@/services/booking";

export type ReturnChargeActions = {
  onEdit: (charge: AdditionalChargeRecord) => void;
  onDelete: (charge: AdditionalChargeRecord) => void;
  disabled?: boolean;
};

const money = (amount: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

export function ReturnChargeCards({ booking, actions }: { booking: BookingRecord; actions?: ReturnChargeActions }) {
  const charges = booking.additionalCharges ?? [];
  if (!charges.length) return <Card className="gap-0 rounded-xl border border-border bg-surface py-3 ring-0">
    <CardContent className="px-4"><p className="text-xs text-muted-foreground">No return charge</p></CardContent>
  </Card>;
  return <div className="space-y-5 pt-4">
    {charges.map((charge, index) => {
      const editable = actions && booking.statusKey === "ongoing" && !booking.returnChargesFinalizedAt
        && charge.type !== "late_return" && charge.paymentStatus === "unpaid";
      return <Card key={charge.id} className="relative gap-0 overflow-visible rounded-xl border border-border bg-surface py-3 ring-0">
        <CardContent className="min-w-0 px-4 text-xs">
          <div className="min-w-0">
            <p className={`font-semibold text-foreground ${editable ? "pr-20" : ""}`}>{charge.typeLabel}</p>
            <p className="mt-1 text-right font-semibold tabular-nums text-foreground">{money(charge.amount)}</p>
          </div>
          {editable ? <div className="absolute right-2 top-0 flex -translate-y-1/2 gap-1 rounded-lg bg-surface px-1">
            <Button type="button" variant="ghost" size="icon" disabled={actions.disabled} aria-label={`Edit ${charge.typeLabel} charge ${index + 1}`} onClick={() => actions.onEdit(charge)}><Pencil className="size-3.5" aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" className="text-destructive" disabled={actions.disabled} aria-label={`Delete ${charge.typeLabel} charge ${index + 1}`} onClick={() => actions.onDelete(charge)}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
          </div> : null}
        </CardContent>
      </Card>;
    })}
    <div className="flex items-baseline justify-between gap-3 px-1 py-2 text-xs font-semibold text-foreground">
      <span>Total Charges</span><span className="tabular-nums">{money(charges.reduce((total, charge) => total + charge.amount, 0))}</span>
    </div>
  </div>;
}
