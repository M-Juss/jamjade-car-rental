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
  default: "text-[#4A5568]",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-rose-500",
};

export function TableActionMenu({ label, items }: TableActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A0AABF] transition-colors duration-150 hover:bg-[#EEF4FF] hover:text-[#346EF6]"
        >
          <MoreHorizontal size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl border-[#EEF1F8] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
        {items.map((item) => (
          <Fragment key={item.label}>
            {item.separatorBefore && <DropdownMenuSeparator className="my-1 bg-[#F0F2F7]" />}
            <DropdownMenuItem
              disabled={item.disabled}
              onClick={item.onClick}
              className={`cursor-pointer rounded-lg px-3 py-2 text-[12.5px] ${itemVariantClass[item.variant ?? "default"]}`}
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
