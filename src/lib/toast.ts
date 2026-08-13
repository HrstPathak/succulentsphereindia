type ToastType = "success" | "error";

function dispatchToast(message: string, type: ToastType) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("app-toast", {
      detail: { message, type },
    })
  );
}

export function showSuccessToast(message: string) {
  dispatchToast(message, "success");
}

export function showErrorToast(message: string) {
  dispatchToast(message, "error");
}
