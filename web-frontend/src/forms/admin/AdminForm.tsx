"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { appToast as toast } from "@/lib/toast";
import {
  Eye,
  KeyRound,
  Lock,
  Mail,
  Pencil,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { InputWithLabel } from "@/components/common/InputWithLabel";
import { SelectWithLabel } from "@/components/common/SelectWithLabel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { AdminRole, AdminUser, AdminUserPayload } from "@/services/admin";
import { ApiError, GENERIC_ERROR_MESSAGE } from "@/services/http";
import {
  createAdminAccountSchema,
  sanitizeMobileNumber,
  sanitizePersonName,
  type AdminAccountFormValues,
} from "@/validations/admin/schemas";

type AdminFormMode = "add" | "edit" | "view";

type AdminFormProps = {
  open: boolean;
  mode: AdminFormMode;
  admin?: AdminUser | null;
  roles: AdminRole[];
  onOpenChange: (open: boolean) => void;
  onSave: (payload: AdminUserPayload) => Promise<void>;
};

function AbsoluteFieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p className="pointer-events-none absolute bottom-0 left-1 text-[10.5px] font-medium leading-tight text-rose-500">
      {message}
    </p>
  );
}

function getAdminSaveErrorMessage() {
  return GENERIC_ERROR_MESSAGE;
}

export function AdminForm({
  open,
  mode,
  admin,
  roles,
  onOpenChange,
  onSave,
}: AdminFormProps) {
  const assignableRoles = useMemo(
    () => roles.filter((role) => role.canAssign),
    [roles],
  );
  const isViewMode = mode === "view";
  const formSchema = useMemo(
    () => createAdminAccountSchema(mode === "add"),
    [mode],
  );
  const initialForm = useMemo<AdminAccountFormValues>(() => ({
    firstName: admin?.firstName ?? "",
    lastName: admin?.lastName ?? "",
    phoneNumber: admin?.phoneNumber ?? "",
    email: admin?.email ?? "",
    password: "",
    passwordConfirmation: "",
    role: admin?.role?.name ?? assignableRoles[0]?.name ?? "",
    status: admin?.isActive === false ? "inactive" : "active",
  }), [admin, assignableRoles]);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdminAccountFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialForm,
  });

  const selectedRole = useWatch({ control, name: "role" });
  const selectedStatus = useWatch({ control, name: "status" });
  const firstNameField = register("firstName");
  const lastNameField = register("lastName");
  const phoneNumberField = register("phoneNumber");

  const resetForm = () => {
    reset(initialForm);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSave = async (values: AdminAccountFormValues) => {
    const payload: AdminUserPayload = {
      first_name: values.firstName.trim().replace(/\s+/g, " "),
      last_name: values.lastName.trim().replace(/\s+/g, " "),
      phone_number: values.phoneNumber.trim() || null,
      email: values.email.trim().toLowerCase(),
      role: values.role,
      is_active: values.status === "active",
    };

    if (values.password) {
      payload.password = values.password;
      payload.password_confirmation = values.passwordConfirmation;
    }

    try {
      await onSave(payload);
      toast.success(
        mode === "add"
          ? "Admin account created successfully."
          : "Admin account updated successfully.",
      );
      resetForm();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const fieldMap: Record<string, keyof AdminAccountFormValues> = {
          email: "email",
          first_name: "firstName",
          is_active: "status",
          last_name: "lastName",
          password: "password",
          password_confirmation: "passwordConfirmation",
          phone_number: "phoneNumber",
          role: "role",
        };

        Object.entries(error.errors).forEach(([serverField, messages]) => {
          const field = fieldMap[serverField];
          const message = messages[0];

          if (field && message) {
            setError(field, { message, type: "server" });
          }
        });
      }

      toast.error(getAdminSaveErrorMessage());
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit(handleSave)(event);
  };

  const title = mode === "add"
    ? "Add Admin"
    : mode === "edit"
      ? "Edit Admin"
      : "View Admin";
  const description = mode === "add"
    ? "Fill in the details to create a new admin account."
    : mode === "edit"
      ? "Update the admin account details and login credentials."
      : "Review the admin account information and access.";
  const HeaderIcon = mode === "add" ? Plus : mode === "edit" ? Pencil : Eye;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] lg:w-[50vw]
          max-w-[960px] sm:max-w-none p-0 gap-0 rounded-2xl border-0
          shadow-[0_24px_64px_rgba(0,0,0,0.14)]
          flex flex-col max-h-[88vh]
          [&>button]:hidden
        "
      >
        <form
          onSubmit={handleFormSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <HeaderIcon
                    size={17}
                    className="text-primary"
                    strokeWidth={2.2}
                  />
                </div>
                <div>
                  <DialogTitle className="text-[16px] font-bold text-foreground leading-tight">
                    {title}
                  </DialogTitle>
                  <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
                    {description}
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-subtle-foreground hover:text-muted-foreground hover:bg-background transition-all duration-150 flex-shrink-0 mt-0.5"
              >
                <X size={15} />
              </button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                    <User size={12} className="text-primary" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-foreground">
                    Personal Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                  <div className="relative pb-5">
                    <InputWithLabel
                      id="admin-first-name"
                      label="First Name"
                      required
                      icon={<User size={13} />}
                      placeholder="e.g. Maria"
                      disabled={isViewMode || isSubmitting}
                      maxLength={80}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      inputClassName={isViewMode ? "disabled:opacity-100" : undefined}
                      {...firstNameField}
                      onChange={(event) => {
                        event.target.value = sanitizePersonName(event.target.value);
                        void firstNameField.onChange(event);
                      }}
                    />
                    <AbsoluteFieldError message={errors.firstName?.message} />
                  </div>

                  <div className="relative pb-5">
                    <InputWithLabel
                      id="admin-last-name"
                      label="Last Name"
                      required
                      icon={<User size={13} />}
                      placeholder="e.g. Santos"
                      disabled={isViewMode || isSubmitting}
                      maxLength={80}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      inputClassName={isViewMode ? "disabled:opacity-100" : undefined}
                      {...lastNameField}
                      onChange={(event) => {
                        event.target.value = sanitizePersonName(event.target.value);
                        void lastNameField.onChange(event);
                      }}
                    />
                    <AbsoluteFieldError message={errors.lastName?.message} />
                  </div>

                  <div className="relative pb-5 sm:col-span-2">
                    <InputWithLabel
                      id="admin-phone-number"
                      label="Phone Number"
                      icon={<Phone size={13} />}
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="09XX XXX XXXX"
                      disabled={isViewMode || isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      inputClassName={isViewMode ? "disabled:opacity-100" : undefined}
                      {...phoneNumberField}
                      onChange={(event) => {
                        event.target.value = sanitizeMobileNumber(event.target.value);
                        void phoneNumberField.onChange(event);
                      }}
                    />
                    <AbsoluteFieldError message={errors.phoneNumber?.message} />
                  </div>
                </div>
              </div>

              <Separator className="bg-border" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                    <KeyRound size={12} className="text-primary" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-foreground">
                    Login Credentials
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                  <div className="relative pb-5 sm:col-span-2">
                    <InputWithLabel
                      id="admin-email"
                      label="Email"
                      required
                      icon={<Mail size={13} />}
                      type="email"
                      autoCapitalize="none"
                      autoComplete="email"
                      maxLength={160}
                      placeholder="admin@jamjade.com"
                      disabled={isViewMode || isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      inputClassName={isViewMode ? "disabled:opacity-100" : undefined}
                      {...register("email")}
                    />
                    <AbsoluteFieldError message={errors.email?.message} />
                  </div>

                  {!isViewMode && (
                    <>
                      <div className="relative pb-5">
                        <InputWithLabel
                          id="admin-password"
                          label={mode === "add" ? "Password" : "New Password"}
                          required={mode === "add"}
                          icon={<Lock size={13} />}
                          type="password"
                          autoComplete={mode === "add" ? "new-password" : "off"}
                          maxLength={255}
                          placeholder="Enter password"
                          disabled={isSubmitting}
                          labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                          {...register("password")}
                        />
                        <AbsoluteFieldError message={errors.password?.message} />
                      </div>

                      <div className="relative pb-5">
                        <InputWithLabel
                          id="admin-password-confirmation"
                          label="Confirm Password"
                          required={mode === "add"}
                          icon={<Lock size={13} />}
                          type="password"
                          autoComplete={mode === "add" ? "new-password" : "off"}
                          maxLength={255}
                          placeholder="Confirm password"
                          disabled={isSubmitting}
                          labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                          {...register("passwordConfirmation")}
                        />
                        <AbsoluteFieldError
                          message={errors.passwordConfirmation?.message}
                        />
                      </div>

                      {mode === "edit" && (
                        <p className="sm:col-span-2 -mt-3 text-[11px] text-subtle-foreground">
                          Leave both password fields blank to keep the current password.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <Separator className="bg-border" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                    <ShieldCheck size={12} className="text-primary" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-foreground">
                    Access Control
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                  <div className="relative pb-5">
                    <SelectWithLabel
                      id="admin-role"
                      label="Role"
                      required
                      placeholder="Select role"
                      options={assignableRoles.map((role) => ({
                        value: role.name,
                        label: role.label,
                      }))}
                      value={selectedRole}
                      onValueChange={(value) =>
                        setValue("role", value, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        })
                      }
                      disabled={isViewMode || isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      triggerClassName={`h-9 text-[12.5px] rounded-xl border-border bg-background ${
                        isViewMode ? "disabled:opacity-100" : ""
                      }`}
                    />
                    <AbsoluteFieldError message={errors.role?.message} />
                  </div>

                  <div className="relative pb-5">
                    <SelectWithLabel
                      id="admin-status"
                      label="Status"
                      required
                      placeholder="Select status"
                      options={[
                        { value: "active", label: "Active" },
                        { value: "inactive", label: "Inactive" },
                      ]}
                      value={selectedStatus}
                      onValueChange={(value) =>
                        setValue(
                          "status",
                          value as AdminAccountFormValues["status"],
                          {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          },
                        )
                      }
                      disabled={isViewMode || isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      triggerClassName={`h-9 text-[12.5px] rounded-xl border-border bg-background ${
                        isViewMode ? "disabled:opacity-100" : ""
                      }`}
                    />
                    <AbsoluteFieldError message={errors.status?.message} />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="flex-shrink-0 border-t border-border px-6 py-4 bg-white rounded-b-2xl">
            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border-border text-muted-foreground h-10 text-[13px] font-medium hover:bg-background"
              >
                {isViewMode ? "Close" : "Cancel"}
              </Button>
              {!isViewMode && (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-primary hover:bg-primary-hover text-white h-10 text-[13px] font-semibold shadow-[0_4px_14px_rgba(52,110,246,0.28)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Save size={14} className="mr-2" />
                  {isSubmitting
                    ? "Saving..."
                    : mode === "add"
                      ? "Save Admin"
                      : "Update Admin"}
                </Button>
              )}
            </div>
            {!isViewMode && (
              <p className="text-center text-[10.5px] text-subtle-foreground mt-2.5">
                Fields marked{" "}
                <span className="text-rose-400 font-semibold">*</span> are
                required
              </p>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
