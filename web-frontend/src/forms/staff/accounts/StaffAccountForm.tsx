"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { appToast } from "@/lib/toast";
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
} from "lucide-react";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/forms/FormDialogLayout";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { StaffRole, StaffUser, StaffUserPayload } from "@/services/staff";
import { ApiError } from "@/services/http";
import {
  createStaffAccountSchema,
  sanitizeMobileNumber,
  sanitizePersonName,
  type StaffAccountFormValues,
} from "@/validations/staff/schemas";
import { AbsoluteFieldError } from "@/components/common/forms/AbsoluteFieldError";

type StaffFormMode = "add" | "edit" | "view";

type StaffFormProps = {
  open: boolean;
  mode: StaffFormMode;
  staff?: StaffUser | null;
  roles: StaffRole[];
  onOpenChange: (open: boolean) => void;
  onSave: (payload: StaffUserPayload) => Promise<void>;
};

export function StaffForm({
  open,
  mode,
  staff,
  roles,
  onOpenChange,
  onSave,
}: StaffFormProps) {
  const assignableRoles = useMemo(
    () => roles.filter((role) => role.canAssign),
    [roles],
  );
  const isViewMode = mode === "view";
  const formSchema = useMemo(
    () => createStaffAccountSchema(mode === "add"),
    [mode],
  );
  const initialForm = useMemo<StaffAccountFormValues>(() => ({
    firstName: staff?.firstName ?? "",
    lastName: staff?.lastName ?? "",
    phoneNumber: staff?.phoneNumber ?? "",
    email: staff?.email ?? "",
    password: "",
    passwordConfirmation: "",
    role: staff?.role?.name ?? assignableRoles[0]?.name ?? "",
    status: staff?.isActive === false ? "inactive" : "active",
  }), [staff, assignableRoles]);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StaffAccountFormValues>({
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

  const handleSave = async (values: StaffAccountFormValues) => {
    const payload: StaffUserPayload = {
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
      appToast.success(
        mode === "add"
          ? "Staff account created successfully."
          : "Staff account updated successfully.",
      );
      resetForm();
      onOpenChange(false);
    } catch (error) {
      let hasFieldErrors = false;

      if (error instanceof ApiError && error.errors) {
        const fieldMap: Record<string, keyof StaffAccountFormValues> = {
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
            hasFieldErrors = true;
          }
        });
      }

      appToast.error(
        hasFieldErrors
          ? "Check the highlighted staff account fields."
          : mode === "add"
            ? "The staff account could not be created. Please try again."
            : "The staff account could not be updated. Please try again.",
      );
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit(handleSave, () => {
      appToast.error("Check the highlighted staff account fields.");
    })(event);
  };

  const title = mode === "add"
    ? "Add Staff"
    : mode === "edit"
      ? "Edit Staff"
      : "View Staff";
  const HeaderIcon = mode === "add" ? Plus : mode === "edit" ? Pencil : Eye;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <FormDialogContent width="wide">
        <form
          onSubmit={handleFormSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <FormDialogHeader
            title={title}
            icon={HeaderIcon}
            onClose={handleCancel}
            closeLabel="Close staff form"
          />

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
                      id="staff-first-name"
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
                      id="staff-last-name"
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
                      id="staff-phone-number"
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
                      id="staff-email"
                      label="Email"
                      required
                      icon={<Mail size={13} />}
                      type="email"
                      autoCapitalize="none"
                      autoComplete="email"
                      maxLength={160}
                      placeholder="staff@jamjade.com"
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
                          id="staff-password"
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
                          id="staff-password-confirmation"
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
                      id="staff-role"
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
                      triggerClassName={`text-[12.5px] rounded-xl border-border bg-background ${
                        isViewMode ? "disabled:opacity-100" : ""
                      }`}
                    />
                    <AbsoluteFieldError message={errors.role?.message} />
                  </div>

                  <div className="relative pb-5">
                    <SelectWithLabel
                      id="staff-status"
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
                          value as StaffAccountFormValues["status"],
                          {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          },
                        )
                      }
                      disabled={isViewMode || isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      triggerClassName={`text-[12.5px] rounded-xl border-border bg-background ${
                        isViewMode ? "disabled:opacity-100" : ""
                      }`}
                    />
                    <AbsoluteFieldError message={errors.status?.message} />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <FormDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="border-border text-[13px] font-medium text-muted-foreground hover:bg-background"
              >
                {isViewMode ? "Close" : "Cancel"}
              </Button>
              {!isViewMode && (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(52,110,246,0.28)] hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Save size={14} className="mr-2" />
                  {isSubmitting
                    ? "Saving..."
                    : mode === "add"
                      ? "Save Staff"
                      : "Update Staff"}
                </Button>
              )}
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
