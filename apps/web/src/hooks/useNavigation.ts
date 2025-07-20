import { useTransition } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Hook for smooth navigation using React's useTransition
 * This prevents jarring loading states during navigation
 */
export function useNavigation() {
  const [isPending, startTransition] = useTransition()
  const navigate = useNavigate()

  const navigateWithTransition = (to: string, options?: { replace?: boolean }) => {
    startTransition(() => {
      navigate(to, options)
    })
  }

  return {
    isPending,
    navigate: navigateWithTransition,
    startTransition
  }
}
