import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Save, Trash2 } from "lucide-react";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSave?: () => void;
  title?: string;
  description?: string;
  canSave?: boolean;
}

export function UnsavedChangesModal({
  isOpen,
  onClose,
  onDiscard,
  onSave,
  title = "Unsaved Changes",
  description = "You have unsaved changes that will be lost if you continue. What would you like to do?",
  canSave = true,
}: UnsavedChangesModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="shadow-card-elevated">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-semibold">
                {title}
              </AlertDialogTitle>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogDescription className="text-muted-foreground leading-relaxed">
          {description}
        </AlertDialogDescription>

        <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <AlertDialogCancel
            onClick={onClose}
            className="button-enhanced w-full sm:w-auto order-3 sm:order-1"
          >
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={onDiscard}
            className="w-full sm:w-auto order-2 sm:order-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Discard Changes
          </AlertDialogAction>

          {canSave && onSave && (
            <AlertDialogAction
              onClick={onSave}
              className="button-primary-enhanced w-full sm:w-auto order-1 sm:order-3"
            >
              <Save className="h-4 w-4 mr-2" />
              Save & Continue
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
