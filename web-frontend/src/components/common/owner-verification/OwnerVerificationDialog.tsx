"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { OwnerVerificationRequest } from "@/services/http/owner-verification";
import { ownerVerificationSchema, type OwnerVerificationValues } from "@/validations/owner-verification/schema";

export function OwnerVerificationDialog() {
  const [request, setRequest] = useState<OwnerVerificationRequest | null>(null);
  const pendingRequest = useRef<OwnerVerificationRequest | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const form = useForm<OwnerVerificationValues>({
    resolver: zodResolver(ownerVerificationSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    const listener = (event: Event) => {
      pendingRequest.current?.reject();
      pendingRequest.current = (event as CustomEvent<OwnerVerificationRequest>).detail;
      setRequest(pendingRequest.current);
      setId(null);
      setError("");
      form.reset();
    };
    window.addEventListener("owner-verification", listener);
    return () => {
      window.removeEventListener("owner-verification", listener);
      pendingRequest.current?.reject();
      pendingRequest.current = null;
    };
  }, [form]);

  useEffect(() => {
    if (!request) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [request]);

  const cancel = () => {
    if (busy) return;
    request?.reject();
    pendingRequest.current = null;
    setRequest(null);
  };

  const send = async () => {
    if (!request || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await request.send(id ?? undefined);
      if (result.verificationRequired === false) {
        const response = await request.verify("", "");
        request.resolve(response);
        pendingRequest.current = null;
        setRequest(null);
        return;
      }
      if (!result.verificationId || !result.resendAvailableAt) throw new Error();
      setId(result.verificationId);
      setResendAt(Date.parse(result.resendAvailableAt));
      setClock(Date.now());
      form.reset();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The code could not be sent. Please try again later.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async ({ code }: OwnerVerificationValues) => {
    if (!request || !id || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await request.verify(id, code);
      if (!response.ok) {
        const result = await response.clone().json().catch(() => null);
        if (result?.errors?.owner_code?.[0]) {
          setError(result.errors.owner_code[0]);
          return;
        }
      }
      request.resolve(response);
      pendingRequest.current = null;
      setRequest(null);
    } catch {
      setError("The action could not be verified. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const seconds = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  return (
    <Dialog open={Boolean(request)} onOpenChange={open => { if (!open) cancel(); }}>
      <FormDialogContent width="compact">
        <FormDialogHeader title="Owner verification" icon={ShieldCheck} onClose={cancel} closeLabel="Close" closeDisabled={busy} />
        <form onSubmit={event => { void form.handleSubmit(verify)(event); }}>
          <div className="space-y-4 p-4 sm:p-6">
            {!id ? <p>Send a verification code to the Owner for approval?</p> : <>
              <p>Ask the Owner for the code after they review this action.</p>
              <InputWithLabel id="owner-code" label="Verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                {...form.register("code")} error={form.formState.errors.code?.message} />
              <Button type="button" variant="ghost" disabled={busy || seconds > 0} onClick={() => void send()}>
                {seconds ? `Resend code in ${seconds}s` : "Resend code"}
              </Button>
            </>}
            {error && <div>
              <p role="alert" className="text-sm text-destructive">{error}</p>
              {id && <Button type="button" variant="ghost" disabled={busy} onClick={() => { setId(null); setError(""); }}>Start again</Button>}
            </div>}
          </div>
          <FormDialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={cancel}>Cancel</Button>
            {id
              ? <Button type="submit" disabled={busy}>{busy ? "Verifying..." : "Confirm action"}</Button>
              : <Button type="button" disabled={busy} onClick={() => void send()}>{busy ? "Sending..." : "Send code"}</Button>}
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
