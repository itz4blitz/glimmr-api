import { createContext } from "react";

export type Theme = "dark" | "light";

export type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const initialState: ThemeProviderState = {
  theme: "light",
  setTheme: () => null,
  toggleTheme: () => null,
};

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState);