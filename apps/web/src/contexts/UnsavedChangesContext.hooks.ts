import { useContext } from "react";
import { UnsavedChangesContext } from "./UnsavedChangesContext.types";

export function useUnsavedChangesContext() {
  const context = useContext(UnsavedChangesContext);
  if (context === undefined) {
    throw new Error(
      "useUnsavedChangesContext must be used within an UnsavedChangesProvider",
    );
  }
  return context;
}