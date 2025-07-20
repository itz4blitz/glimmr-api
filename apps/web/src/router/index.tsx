import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { AuthGuard } from '@/components/common/AuthGuard'
import { UserRole } from '@/types/auth'

// Pages
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'

// Layout components
import { RootLayout } from '@/components/layout/RootLayout'

// Error components
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { NotFoundPage } from '@/pages/error/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'login',
        element: (
          <AuthGuard requireAuth={false}>
            <LoginPage />
          </AuthGuard>
        ),
      },
      {
        path: 'register',
        element: (
          <AuthGuard requireAuth={false}>
            <RegisterPage />
          </AuthGuard>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute requiredRole={UserRole.USER}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute requiredRole={UserRole.USER}>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/*',
        element: (
          <ProtectedRoute requiredRole={UserRole.ADMIN}>
            <div className="min-h-screen bg-background flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">Admin Panel</h1>
                <p className="text-muted-foreground">Coming Soon</p>
              </div>
            </div>
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])
