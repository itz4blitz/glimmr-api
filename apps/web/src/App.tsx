import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { initializeTheme } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { router } from '@/router'

function App() {
  const { token } = useAuthStore()

  useEffect(() => {
    // Initialize theme on app start
    initializeTheme()

    // Initialize auth state from localStorage
    if (token) {
      // Token exists, user should be authenticated
      // The auth store will handle token validation
    }
  }, [token])

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}

export default App
