import { useThemeStore } from '@/stores/theme'

export const useTheme = () => {
  const { theme, setTheme, toggleTheme } = useThemeStore()
  
  return {
    theme,
    setTheme,
    toggleTheme,
  }
}
