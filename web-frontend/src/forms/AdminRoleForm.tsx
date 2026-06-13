"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { appToast as toast } from "@/lib/toast";
import { KeyRound, Save, ShieldCheck, X } from "lucide-react";
import { InputWithLabel } from "@/components/common/InputWithLabel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { AdminModule, AdminRole, AdminRolePayload } from "@/services/admin";
import { GENERIC_ERROR_MESSAGE } from "@/services/http";
import {
  adminRoleSchema,
  type AdminRoleFormValues,
} from "@/validations/admin.validation";

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

function getRoleSaveErrorMessage() {
  return GENERIC_ERROR_MESSAGE;
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
      toast.success(
        mode === "add"
          ? "Admin role created successfully."
          : "Admin role updated successfully.",
      );
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error(getRoleSaveErrorMessage());
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit(handleSave)(event);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] lg:w-[50vw]
          max-w-[900px] sm:max-w-none p-0 gap-0 rounded-2xl border-0
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
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-[#F0F2F7]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                  <ShieldCheck
                    size={17}
                    className="text-[#346EF6]"
                    strokeWidth={2.2}
                  />
                </div>
                <div>
                  <DialogTitle className="text-[16px] font-bold text-[#1A2340] leading-tight">
                    {mode === "add" ? "Add Role" : "Edit Role"}
                  </DialogTitle>
                  <DialogDescription className="text-[12px] text-[#8896A7] mt-0.5">
                    Configure the role name and available admin modules.
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#A0AABF] hover:text-[#4A5568] hover:bg-[#F5F5F5] transition-all duration-150 flex-shrink-0 mt-0.5"
              >
                <X size={15} />
              </button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                    <KeyRound size={12} className="text-[#346EF6]" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-[#1A2340]">
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
                    labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                    {...register("name")}
                  />
                  <AbsoluteFieldError message={errors.name?.message} />
                </div>
              </div>

              <Separator className="bg-[#F0F2F7]" />

              <div className="relative pb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                      <ShieldCheck size={12} className="text-[#346EF6]" />
                    </div>
                    <h3 className="text-[12.5px] font-bold text-[#1A2340]">
                      Module Access <span className="text-rose-400">*</span>
                    </h3>
                  </div>
                  {selectedModules.length > 0 && (
                    <span className="text-[11px] font-semibold text-[#346EF6] bg-[#EEF4FF] px-2.5 py-1 rounded-lg">
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
                            ? "border-[#346EF6] bg-[#EEF4FF]"
                            : "border-[#E8ECF4] bg-[#F8F9FC] hover:border-[#B8CEFD] hover:bg-[#F0F5FF]"
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
                          <span className="block text-[12px] font-semibold text-[#1A2340]">
                            {module.label}
                          </span>
                          <span className="mt-1 block text-[10.5px] leading-relaxed text-[#8896A7]">
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

          <div className="flex-shrink-0 border-t border-[#F0F2F7] px-6 py-4 bg-white rounded-b-2xl">
            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border-[#E2E8F0] text-[#4A5568] h-10 text-[13px] font-medium hover:bg-[#F5F5F5]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-[#346EF6] hover:bg-[#2558D8] text-white h-10 text-[13px] font-semibold shadow-[0_4px_14px_rgba(52,110,246,0.28)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Save size={14} className="mr-2" />
                {isSubmitting
                  ? "Saving..."
                  : mode === "add"
                    ? "Save Role"
                    : "Update Role"}
              </Button>
            </div>
            <p className="text-center text-[10.5px] text-[#A0AABF] mt-2.5">
              Fields marked{" "}
              <span className="text-rose-400 font-semibold">*</span> are
              required
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
