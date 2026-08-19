import { Check, Fuel, Gauge, MessageSquareText, PenLine, X } from "lucide-react";
import type { VehicleInspectionRecord } from "@/services/vehicle";
import { VehicleBodyInspection } from "./VehicleBodyInspection";
import { VEHICLE_CHECKLIST_CATEGORY_LABELS } from "./definitions";

type VehicleConditionSnapshotProps = {
  inspection: VehicleInspectionRecord;
};

function formatInspectionType(type: VehicleInspectionRecord["type"]) {
  return type === "condition_update"
    ? "Condition Update"
    : type.charAt(0).toUpperCase() + type.slice(1);
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function VehicleConditionSnapshot({ inspection }: VehicleConditionSnapshotProps) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {inspection.typeLabel ?? formatInspectionType(inspection.type)} inspection
          </p>
          <p className="mt-1 text-sm font-bold text-foreground">
            Finalized {formatDate(inspection.finalizedAt)}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Inspector</p>
          <p className="mt-0.5 font-semibold text-foreground">
            {inspection.creator?.name ?? "Account no longer available"}
          </p>
        </div>
      </div>

      {inspection.type === "condition_update" && (
        <section className="rounded-xl border border-border bg-muted p-4">
          <h3 className="text-sm font-bold text-foreground">Condition Update Record</h3>
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Reason</p>
              <p className="mt-1 font-semibold text-foreground">
                {inspection.conditionUpdateReasonLabel ?? "Not recorded"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Based on</p>
              <p className="mt-1 font-semibold text-foreground">
                {inspection.basedOnInspection
                  ? `${inspection.basedOnInspection.typeLabel} · ${formatDate(inspection.basedOnInspection.finalizedAt)}`
                  : inspection.basedOnInspectionId
                    ? `Inspection #${inspection.basedOnInspectionId}`
                    : "Not recorded"}
              </p>
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Update notes</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-foreground">
              {inspection.conditionUpdateNotes || "No additional update notes."}
            </p>
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-primary"><Gauge size={17} /></span>
          <div><p className="text-xs text-muted-foreground">Odometer</p><p className="font-bold text-foreground">{inspection.odometer.toLocaleString()} km</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-primary"><Fuel size={17} /></span>
          <div><p className="text-xs text-muted-foreground">Fuel level</p><p className="font-bold text-foreground">{inspection.fuelLevel}/8</p></div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {(["exterior", "interior", "equipment"] as const).map((category) => (
          <section key={category} className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-sm font-bold text-foreground">{VEHICLE_CHECKLIST_CATEGORY_LABELS[category]}</h3>
            <div className="mt-3 grid gap-2">
              {(inspection.checklist?.[category] ?? []).map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2">
                  <span className="text-xs font-medium text-foreground">{item.label}</span>
                  <span className={`flex items-center gap-1 text-xs font-bold ${item.value ? "text-success" : "text-destructive"}`}>
                    {item.value ? <Check size={14} /> : <X size={14} />}
                    {item.value ? "Yes" : "No"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section>
        <h3 className="mb-3 text-sm font-bold text-foreground">Vehicle Body Issues</h3>
        <VehicleBodyInspection value={inspection.markers ?? []} mode="readonly" />
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><MessageSquareText size={15} className="text-primary" /> Comments / Other Issues</h3>
          <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{inspection.comments || "No additional comments."}</p>
        </section>
        <section className="rounded-xl border border-border bg-surface p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><PenLine size={15} className="text-primary" /> Personnel Signature</h3>
          {(inspection.signatures ?? []).filter((signature) => signature.signerType === "personnel").map((signature) => (
            <div key={signature.id} className="mt-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">{signature.signerName}</p>
              <p className="mt-1">Signed {formatDate(signature.signedAt)}</p>
              <p className="mt-2">Signature asset stored privately.</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
