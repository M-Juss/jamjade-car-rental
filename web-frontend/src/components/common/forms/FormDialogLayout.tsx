"use client";

import { Children, type ComponentProps, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const dialogWidths = {
  compact: "sm:max-w-[540px]",
  default: "sm:max-w-[760px]",
  wide: "sm:max-w-[900px]",
} as const;

type FormDialogContentProps = Omit<ComponentProps<typeof DialogContent>, "showCloseButton"> & {
  width?: keyof typeof dialogWidths;
};

export function FormDialogContent({
  width = "default",
  className,
  ...props
}: FormDialogContentProps) {
  return (
    <DialogContent
      aria-describedby={undefined}
      showCloseButton={false}
      className={cn(
        "flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-surface p-0 shadow-[0_24px_64px_rgba(0,0,0,0.14)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)]",
        dialogWidths[width],
        className,
      )}
      {...props}
    />
  );
}

type FormDialogHeaderProps = {
  title: ReactNode;
  icon: LucideIcon;
  onClose: () => void;
  closeLabel: string;
  endContent?: ReactNode;
  closeDisabled?: boolean;
  iconClassName?: string;
  className?: string;
};

export function FormDialogHeader({
  title,
  icon: Icon,
  onClose,
  closeLabel,
  endContent,
  closeDisabled = false,
  iconClassName,
  className,
}: FormDialogHeaderProps) {
  return (
    <DialogHeader className={cn("shrink-0 border-b border-border px-4 py-4 sm:px-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary", iconClassName)}>
            <Icon className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <DialogTitle className="min-w-0 whitespace-normal text-base font-bold leading-tight text-foreground [overflow-wrap:anywhere]">
            {title}
          </DialogTitle>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {endContent}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={closeLabel}
            disabled={closeDisabled}
            className="size-9 shrink-0 rounded-xl text-muted-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </DialogHeader>
  );
}

export function FormDialogFooter({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogFooter>) {
  const actionCount = Children.toArray(children).length;

  return (
    <DialogFooter
      className={cn(
        "mx-0 mb-0 grid shrink-0 grid-cols-1 gap-2.5 rounded-b-2xl border-t border-border bg-surface px-4 py-4 sm:px-6 [&>*]:h-auto [&>*]:min-h-11 [&>*]:min-w-0 [&>*]:w-full [&>*]:whitespace-normal [&>*]:rounded-xl [&>*]:py-2.5",
        actionCount > 1 ? "sm:grid-cols-2" : "sm:grid-cols-1",
        className,
      )}
      {...props}
    >
      {children}
    </DialogFooter>
  );
}
