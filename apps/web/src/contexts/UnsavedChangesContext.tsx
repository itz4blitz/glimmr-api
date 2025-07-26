import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { toast } from "sonner";
import { UnsavedChangesModal } from "@/components/common/UnsavedChangesModal";

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  checkUnsavedChanges: (onProceed: () => void, onSave?: () => void) => void;
  registerSaveFunction: (saveFunction: () => Promise<void>) => void;
  showUnsavedChangesToast: () => void;
}

const UnsavedChangesContext = createContext<
  UnsavedChangesContextType | undefined
>(undefined);

interface UnsavedChangesProviderProps {
  children: ReactNode;
}

export function UnsavedChangesProvider({
  children,
}: UnsavedChangesProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [saveFunction, setSaveFunction] = useState<
    (() => Promise<void>) | null
  >(null);

  const registerSaveFunction = useCallback((fn: () => Promise<void>) => {
    setSaveFunction(() => fn);
  }, []);

  const showUnsavedChangesToast = useCallback(() => {
    toast.warning("You have unsaved changes", {
      description: "Please save your changes before continuing.",
      duration: 4000,
    });
  }, []);

  const checkUnsavedChanges = useCallback(
    (onProceed: () => void, onCancel?: () => void) => {
      if (hasUnsavedChanges) {
        setPendingAction(() => onProceed);
        setIsModalOpen(true);
        showUnsavedChangesToast();
      } else {
        onProceed();
      }
    },
    [hasUnsavedChanges, showUnsavedChangesToast],
  );

  const handleDiscard = useCallback(() => {
    setHasUnsavedChanges(false);
    setIsModalOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  const handleSave = useCallback(async () => {
    if (saveFunction) {
      try {
        await saveFunction();
        setHasUnsavedChanges(false);
        setIsModalOpen(false);
        if (pendingAction) {
          pendingAction();
          setPendingAction(null);
        }
        toast.success("Changes saved successfully!", {
          description: "Your changes have been saved and you can now continue.",
          duration: 3000,
        });
      } catch (error) {
        toast.error("Failed to save changes", {
          description: "Please try saving again before continuing.",
          duration: 5000,
        });
      }
    }
  }, [saveFunction, pendingAction]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setPendingAction(null);
  }, []);

  return (
    <UnsavedChangesContext.Provider
      value={{
        hasUnsavedChanges,
        setHasUnsavedChanges,
        checkUnsavedChanges,
        registerSaveFunction,
        showUnsavedChangesToast,
      }}
    >
      {children}
      <UnsavedChangesModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onDiscard={handleDiscard}
        onSave={saveFunction ? handleSave : undefined}
        canSave={!!saveFunction}
      />
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesContext() {
  const context = useContext(UnsavedChangesContext);
  if (context === undefined) {
    throw new Error(
      "useUnsavedChangesContext must be used within an UnsavedChangesProvider",
    );
  }
  return context;
}
