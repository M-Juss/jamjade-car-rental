"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function NoShowConfirmation({ bookingCode, open, busy, onBack, onConfirm }: {
  bookingCode: string; open: boolean; busy: boolean; onBack: () => void; onConfirm: () => void;
}) {
  return <AlertDialog open={open} onOpenChange={(next) => { if (!next && !busy) onBack(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Confirm no-show</AlertDialogTitle>
        <AlertDialogDescription>Record {bookingCode} as a no-show? This ends the booking and releases its reserved dates. All rental payments are retained; no refund is available.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy} onClick={onBack}>Back</AlertDialogCancel>
        <AlertDialogAction variant="destructive" disabled={busy} onClick={(event) => { event.preventDefault(); onConfirm(); }}>{busy ? "Saving..." : "Confirm no-show"}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
