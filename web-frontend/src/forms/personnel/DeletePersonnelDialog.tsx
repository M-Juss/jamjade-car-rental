"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { appToast } from "@/lib/toast";
import { ApiError } from "@/services/http";
import { deletePersonnel, type PersonnelUser } from "@/services/personnel";

export function DeletePersonnelDialog({ personnel, onClose, onDeleted }: {
  personnel: PersonnelUser;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deletePersonnel(personnel.id);
      appToast.success("Personnel account deleted.");
      onDeleted();
      onClose();
    } catch (failure) {
      const message = failure instanceof ApiError
        ? Object.values(failure.errors ?? {}).flat()[0] ?? failure.message
        : "Unable to delete this account. Please try again.";
      setError(message);
      appToast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return <AlertDialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Personnel?</AlertDialogTitle>
        <AlertDialogDescription>
          Delete “{personnel.name}”? They will lose account access and be removed from Personnel. Their records and activity history will be kept.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
        <AlertDialogAction variant="destructive" disabled={busy} onClick={(event) => { event.preventDefault(); void remove(); }}>
          {busy ? "Deleting..." : "Delete"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
