"use client";

import { Fragment, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TableActionVariant = "default" | "success" | "warning" | "danger";

export type TableActionMenuItem = {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
  variant?: TableActionVariant;
};

type TableActionMenuProps = {
  label: string;
  items: TableActionMenuItem[];
};

const itemVariantClass: Record<TableActionVariant, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

export function TableActionMenu({ label, items }: TableActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring md:h-9 md:w-9"
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl border-border bg-popover p-1 shadow-dialog">
        {items.map((item) => (
          <Fragment key={item.label}>
            {item.separatorBefore && <DropdownMenuSeparator className="my-1 bg-border" />}
            <DropdownMenuItem
              disabled={item.disabled}
              onClick={item.onClick}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${itemVariantClass[item.variant ?? "default"]}`}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
