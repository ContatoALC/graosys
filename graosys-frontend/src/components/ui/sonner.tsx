import { Toaster as Sonner, type ToasterProps } from "sonner";

// Toasts do shadcn (Sonner) no tema preto e branco do GraoSys. Use `toast.success(...)` / `toast.error(...)` de "sonner".
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "group border border-border bg-background text-foreground shadow-lg",
          title: "text-sm font-semibold",
          description: "text-sm text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          error: "[&_[data-icon]]:text-destructive",
          success: "[&_[data-icon]]:text-green-600",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
