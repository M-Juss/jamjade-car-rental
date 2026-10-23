import { Children, type ReactNode } from "react";
import { FormDialogFooter } from "@/components/common/forms/FormDialogLayout";

export function BookingDialogFooter({ children }: { children: ReactNode }) {
  return <FormDialogFooter className={Children.toArray(children).length > 1
    ? "grid-cols-2 py-3 [&>*]:whitespace-normal [&>*]:px-2 [&>*]:text-xs sm:[&>*]:text-sm"
    : "py-3"}>{children}</FormDialogFooter>;
}
