import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { useAuthStore } from '@/stores/auth'
import { router } from '@/router'

function App() {
  const { token } = useAuthStore()

  useEffect(() => {
    // Initialize auth state from localStorage
    if (token) {
      // Token exists, user should be authenticated
      // The auth store will handle token validation
    }
  }, [token])

  return (
    <ThemeProvider defaultTheme="light">
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  )
}

export default App
