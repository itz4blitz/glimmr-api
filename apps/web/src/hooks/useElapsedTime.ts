import { useState, useEffect, useRef, useMemo } from 'react'

interface UseElapsedTimeOptions {
  startTime: string | number | Date | null | undefined
  isActive?: boolean
  updateInterval?: number
}

export function useElapsedTime({ 
  startTime, 
  isActive = true, 
  updateInterval = 1000 
}: UseElapsedTimeOptions): string {
  const [elapsed, setElapsed] = useState<string>('0s')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!startTime || !isActive) {
      return
    }

    const calculateElapsed = () => {
      const start = new Date(startTime).getTime()
      const now = Date.now()
      const diff = now - start

      if (diff < 0) {
        return '0s'
      }

      // Convert to human readable format
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)

      if (days > 0) {
        return `${days}d ${hours % 24}h`
      } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`
      } else {
        return `${seconds}s`
      }
    }

    // Calculate immediately
    setElapsed(calculateElapsed())

    // Update periodically
    intervalRef.current = setInterval(() => {
      setElapsed(calculateElapsed())
    }, updateInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [startTime, isActive, updateInterval])

  return elapsed
}

// Batch timer hook for multiple items (more efficient for lists)
export function useBatchElapsedTime(
  items: Array<{ id: string; startTime: string | Date | null; isActive: boolean }>,
  updateInterval = 1000
): Record<string, string> {
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, string>>({})
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Create a stable key to detect real changes
  const itemsKey = useMemo(() => {
    return items
      .filter(item => item.isActive && item.startTime)
      .map(item => `${item.id}:${item.startTime}`)
      .sort() // Sort to ensure consistent key regardless of order
      .join(',')
  }, [items])

  useEffect(() => {
    
    const activeItems = items.filter(item => item.isActive && item.startTime)
    
    if (activeItems.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setElapsedTimes({})
      return
    }

    const calculateAllElapsed = () => {
      const times: Record<string, string> = {}
      const now = Date.now()
      
      for (const item of activeItems) {
        const start = new Date(item.startTime!).getTime()
        const diff = now - start

        if (diff < 0) {
          times[item.id] = '0s'
          continue
        }

        const seconds = Math.floor(diff / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)
        const days = Math.floor(hours / 24)

        if (days > 0) {
          times[item.id] = `${days}d ${hours % 24}h ${minutes % 60}m`
        } else if (hours > 0) {
          times[item.id] = `${hours}h ${minutes % 60}m ${seconds % 60}s`
        } else if (minutes > 0) {
          times[item.id] = `${minutes}m ${seconds % 60}s`
        } else {
          times[item.id] = `${seconds}s`
        }
      }
      
      return times
    }

    // Calculate immediately
    const initialTimes = calculateAllElapsed()
    setElapsedTimes(initialTimes)

    // Clear existing interval before setting new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Update periodically
    intervalRef.current = setInterval(() => {
      const updatedTimes = calculateAllElapsed()
      setElapsedTimes(updatedTimes)
    }, updateInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [itemsKey, updateInterval])

  return elapsedTimes
}