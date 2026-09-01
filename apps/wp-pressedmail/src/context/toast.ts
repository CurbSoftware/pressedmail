import { toast } from "@kit/ui/plugin";

type ToastType = "default" | "success" | "error" | "warning" | "info";
type ToastOptions = Parameters<typeof toast>[1];

/**
 * Display application message/notification
 * @param message - Message to display
 * @param type - Toast variant
 */
export const appMessage = (
  message: string = "",
  type: ToastType = "default",
  options?: ToastOptions,
): void => {
  switch (type) {
    case "success":
      toast.success(message, options);
      break;
    case "error":
      toast.error(message, options);
      break;
    case "warning":
      toast.warning(message, options);
      break;
    case "info":
      toast.info(message, options);
      break;
    default:
      toast(message, options);
  }
};
