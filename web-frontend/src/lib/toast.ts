import { toast as sonnerToast } from "sonner";

import { GENERIC_ERROR_MESSAGE } from "@/services/http";

export const appToast = {
  success(message: string, title = "Success!") {
    return sonnerToast.success(title, { description: message });
  },
  info(message: string, title = "Information") {
    return sonnerToast.info(title, { description: message });
  },
  warning(message: string, title = "Warning!") {
    return sonnerToast.warning(title, { description: message });
  },
  error(message = GENERIC_ERROR_MESSAGE, title = "Something went wrong!") {
    return sonnerToast.error(title, { description: message });
  },
};
