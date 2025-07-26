import { useEffect, useCallback } from "react";
import { useNavigate, useBlocker } from "react-router-dom";

interface UseUnsavedChangesProps {
  hasUnsavedChanges: boolean;
  onConfirmDiscard?: () => void;
  message?: string;
}

export function useUnsavedChanges({
  hasUnsavedChanges,
  onConfirmDiscard,
  message = "You have unsaved changes. Are you sure you want to leave?",
}: UseUnsavedChangesProps) {
  const navigate = useNavigate();

  // Block React Router navigation when there are unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname,
  );

  // Prevent browser navigation (refresh, back button, etc.)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    if (hasUnsavedChanges) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges, message]);

  // Function to check if navigation should be blocked
  const shouldBlockNavigation = useCallback(() => {
    return hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Function to handle confirmed navigation
  const handleConfirmedNavigation = useCallback(
    (path: string) => {
      if (onConfirmDiscard) {
        onConfirmDiscard();
      }
      navigate(path);
    },
    [navigate, onConfirmDiscard],
  );

  return {
    shouldBlockNavigation,
    handleConfirmedNavigation,
    blocker,
  };
}
