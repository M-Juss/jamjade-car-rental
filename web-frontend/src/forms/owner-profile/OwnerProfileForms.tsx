"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appToast } from "@/lib/toast";
import { useManagementSession } from "@/modules/management/shell/context/ManagementSessionProvider";
import { getUserRoleNames } from "@/services/auth";
import { ApiError } from "@/services/http";
import { requestEmail, confirmEmail, changePassword } from "@/services/owner-profile/owner-profile.service";
import { emailSchema, codeSchema, passwordSchema } from "@/validations/owner-profile/schemas";

type EmailValues = z.infer<typeof emailSchema>;
type CodeValues = z.infer<typeof codeSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export function OwnerProfileForms() {
  const { user, status } = useManagementSession();
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const email = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "", currentPassword: "" },
  });
  const code = useForm<CodeValues>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } });
  const password = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", password: "", confirmation: "" },
  });
  const emailBusy = email.formState.isSubmitting || code.formState.isSubmitting;
  const passwordBusy = password.formState.isSubmitting;
  const showError = (error: unknown) => appToast.error(
    error instanceof ApiError ? error.message : "Could not complete the request. Try again.",
  );
  const invalid = () => appToast.error("Check the highlighted fields.");

  const sendCode = async (values: EmailValues) => {
    try {
      await requestEmail(values.email, values.currentPassword);
      code.reset();
      setSent(true);
      appToast.success("Verification code sent to your new email.");
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        if (error.errors.email?.[0]) email.setError("email", { message: error.errors.email[0] });
        if (error.errors.current_password?.[0]) email.setError("currentPassword", { message: error.errors.current_password[0] });
      }
      showError(error);
    }
  };
  const verifyCode = async (values: CodeValues) => {
    try {
      await confirmEmail(values.code);
      window.location.reload();
    } catch (error) {
      if (error instanceof ApiError && error.errors?.code?.[0]) code.setError("code", { message: error.errors.code[0] });
      showError(error);
    }
  };
  const savePassword = async (values: PasswordValues) => {
    try {
      await changePassword(values.currentPassword, values.password, values.confirmation);
      router.replace("/login");
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        if (error.errors.current_password?.[0]) password.setError("currentPassword", { message: error.errors.current_password[0] });
        if (error.errors.password?.[0]) password.setError("password", { message: error.errors.password[0] });
        if (error.errors.password_confirmation?.[0]) password.setError("confirmation", { message: error.errors.password_confirmation[0] });
      }
      showError(error);
    }
  };

  if (status === "loading") return <p role="status" className="text-sm text-muted-foreground">Loading profile...</p>;
  if (!user || !getUserRoleNames(user).includes("owner")) return <p role="alert">Profile unavailable.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="break-words">Email <span className="text-sm font-normal text-muted-foreground">({user.email})</span></CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate className="space-y-4" onSubmit={email.handleSubmit(sendCode, invalid)}>
            <InputWithLabel id="profile-new-email" label="New email" type="email" autoComplete="email" required disabled={emailBusy}
              error={email.formState.errors.email?.message} {...email.register("email", { onChange: () => { setSent(false); code.reset(); } })} />
            <InputWithLabel id="profile-email-password" label="Current password" type="password" autoComplete="current-password" required disabled={emailBusy}
              error={email.formState.errors.currentPassword?.message} {...email.register("currentPassword")} />
            <Button disabled={emailBusy}>{email.formState.isSubmitting ? "Sending..." : sent ? "Resend verification code" : "Send verification code"}</Button>
          </form>
          {sent && (
            <form noValidate className="mt-4 space-y-4" onSubmit={code.handleSubmit(verifyCode, invalid)}>
              <InputWithLabel id="profile-verification-code" label="Verification code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} disabled={emailBusy}
                error={code.formState.errors.code?.message} {...code.register("code")} />
              <Button disabled={emailBusy}>{code.formState.isSubmitting ? "Verifying..." : "Verify email"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader><CardTitle>Password</CardTitle></CardHeader>
        <CardContent>
          <form noValidate className="space-y-4" onSubmit={password.handleSubmit(savePassword, invalid)}>
            <InputWithLabel id="profile-current-password" label="Current password" type="password" autoComplete="current-password" required disabled={passwordBusy}
              error={password.formState.errors.currentPassword?.message} {...password.register("currentPassword")} />
            <div>
              <InputWithLabel id="profile-new-password" label="New password" type="password" autoComplete="new-password" required disabled={passwordBusy}
                error={password.formState.errors.password?.message} {...password.register("password")} />
              <p className="mt-1 text-xs text-subtle-foreground">At least 8 characters, including 1 uppercase letter and 1 special character.</p>
            </div>
            <InputWithLabel id="profile-confirm-password" label="Confirm password" type="password" autoComplete="new-password" required disabled={passwordBusy}
              error={password.formState.errors.confirmation?.message} {...password.register("confirmation")} />
            <Button disabled={passwordBusy}>{passwordBusy ? "Updating..." : "Change password"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
