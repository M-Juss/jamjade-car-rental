"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { appToast } from "@/lib/toast";
import { KeyRound, Save, ShieldCheck } from "lucide-react";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/FormDialogLayout";
import { InputWithLabel } from "@/components/common/InputWithLabel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { AdminModule, AdminRole, AdminRolePayload } from "@/services/admin";
import { ApiError } from "@/services/http";
import {
  adminRoleSchema,
  type AdminRoleFormValues,
} from "@/validations/admin/schemas";

type AdminRoleFormProps = {
  open: boolean;
  mode: "add" | "edit";
  role?: AdminRole | null;
  modules: AdminModule[];
  onOpenChange: (open: boolean) => void;
  onSave: (payload: AdminRolePayload) => Promise<void>;
};

function AbsoluteFieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p className="pointer-events-none absolute bottom-0 left-1 text-[10.5px] font-medium leading-tight text-rose-500">
      {message}
    </p>
  );
}

export function AdminRoleForm({
  open,
  mode,
  role,
  modules,
  onOpenChange,
  onSave,
}: AdminRoleFormProps) {
  const assignableModules = useMemo(
    () => modules.filter((module) => module.assignable),
    [modules],
  );
  const initialForm = useMemo<AdminRoleFormValues>(() => ({
    name: role?.label ?? "",
    modules: role?.modules?.filter((key) =>
      assignableModules.some((module) => module.key === key)
    ) ?? [],
  }), [assignableModules, role]);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    getValues,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdminRoleFormValues>({
    resolver: zodResolver(adminRoleSchema),
    defaultValues: initialForm,
  });
  const selectedModules = useWatch({ control, name: "modules" }) ?? [];

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

  const toggleModule = (moduleKey: string) => {
    const currentModules = getValues("modules");
    const nextModules = currentModules.includes(moduleKey)
      ? currentModules.filter((key) => key !== moduleKey)
      : [...currentModules, moduleKey];

    setValue("modules", nextModules, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const handleSave = async (values: AdminRoleFormValues) => {
    try {
      await onSave(values);
      appToast.success(
        mode === "add"
          ? "Admin role created successfully."
          : "Admin role updated successfully.",
      );
      resetForm();
      onOpenChange(false);
    } catch (error) {
      let hasFieldErrors = false;

      if (error instanceof ApiError && error.errors) {
        const fieldMap: Record<string, keyof AdminRoleFormValues> = {
          modules: "modules",
          name: "name",
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
          ? "Check the highlighted admin role fields."
          : mode === "add"
            ? "The admin role could not be created. Please try again."
            : "The admin role could not be updated. Please try again.",
      );
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit(handleSave, () => {
      appToast.error("Check the highlighted admin role fields.");
    })(event);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <FormDialogContent width="wide">
        <form
          onSubmit={handleFormSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <FormDialogHeader
            title={mode === "add" ? "Add Role" : "Edit Role"}
            icon={ShieldCheck}
            onClose={handleCancel}
            closeLabel="Close admin role form"
          />

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                    <KeyRound size={12} className="text-primary" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-foreground">
                    Role Information
                  </h3>
                </div>

                <div className="relative pb-5">
                  <InputWithLabel
                    id="admin-role-name"
                    label="Role Name"
                    required
                    icon={<KeyRound size={13} />}
                    placeholder="e.g. Dispatcher"
                    disabled={isSubmitting}
                    labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                    {...register("name")}
                  />
                  <AbsoluteFieldError message={errors.name?.message} />
                </div>
              </div>

              <Separator className="bg-border" />

              <div className="relative pb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                      <ShieldCheck size={12} className="text-primary" />
                    </div>
                    <h3 className="text-[12.5px] font-bold text-foreground">
                      Module Access <span className="text-rose-400">*</span>
                    </h3>
                  </div>
                  {selectedModules.length > 0 && (
                    <span className="text-[11px] font-semibold text-primary bg-muted px-2.5 py-1 rounded-lg">
                      {selectedModules.length} selected
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {assignableModules.map((module) => {
                    const selected = selectedModules.includes(module.key);

                    return (
                      <label
                        key={module.key}
                        className={`
                          flex cursor-pointer gap-3 rounded-xl border p-3 transition-all duration-150
                          ${selected
                            ? "border-primary bg-muted"
                            : "border-border bg-background hover:border-border hover:bg-muted"
                          }
                        `}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleModule(module.key)}
                          disabled={isSubmitting}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-[12px] font-semibold text-foreground">
                            {module.label}
                          </span>
                          <span className="mt-1 block text-[10.5px] leading-relaxed text-muted-foreground">
                            {module.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <AbsoluteFieldError message={errors.modules?.message} />
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(52,110,246,0.28)] hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Save size={14} className="mr-2" />
                {isSubmitting
                  ? "Saving..."
                  : mode === "add"
                    ? "Save Role"
                    : "Update Role"}
              </Button>
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
