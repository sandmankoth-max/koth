import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * In-app replacement for window.prompt — uses the app's themed AlertDialog so
 * users never see a browser-native popup.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  defaultValue = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  required = false,
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
  destructive?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <Textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="rounded-xl text-sm"
        />
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={required && !value.trim()}
            onClick={() => onConfirm(value)}
            className={
              destructive
                ? "rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90"
                : "rounded-full"
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
