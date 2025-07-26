import { createContext } from "react";

export interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  checkUnsavedChanges: (onProceed: () => void, onSave?: () => void) => void;
  registerSaveFunction: (saveFunction: () => Promise<void>) => void;
  showUnsavedChangesToast: () => void;
}

export const UnsavedChangesContext = createContext<
  UnsavedChangesContextType | undefined
>(undefined);