import { useState, useEffect, useMemo, useCallback } from 'react'
import { useUnsavedChangesContext } from '@/contexts/UnsavedChangesContext'

// Simple deep equality check to replace lodash isEqual
function isEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!keysB.includes(key)) return false
      if (!isEqual(a[key], b[key])) return false
    }

    return true
  }

  return false
}

export interface UseFormStateOptions<T> {
  initialData: T
  onSave?: (data: T) => Promise<void> | void
  onCancel?: () => void
  validateOnChange?: boolean
  autoSave?: boolean
  autoSaveDelay?: number
}

export interface UseFormStateReturn<T> {
  formData: T
  originalData: T
  isDirty: boolean
  isSubmitting: boolean
  errors: Record<string, string>
  
  // Actions
  setFormData: (data: T | ((prev: T) => T)) => void
  setFieldValue: (field: keyof T, value: any) => void
  setErrors: (errors: Record<string, string>) => void
  setFieldError: (field: string, error: string) => void
  clearErrors: () => void
  reset: () => void
  save: () => Promise<void>
  cancel: () => void
  
  // Validation
  validate: () => boolean
  validateField: (field: keyof T) => boolean
  
  // Utilities
  getFieldError: (field: string) => string | undefined
  hasErrors: boolean
  canSave: boolean
}

export function useFormState<T extends Record<string, any>>(
  options: UseFormStateOptions<T>
): UseFormStateReturn<T> {
  const {
    initialData,
    onSave,
    onCancel,
    validateOnChange = false,
    autoSave = false,
    autoSaveDelay = 2000
  } = options

  const [formData, setFormDataState] = useState<T>(initialData)
  const [originalData, setOriginalData] = useState<T>(initialData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  const { setHasUnsavedChanges } = useUnsavedChangesContext()

  // Calculate if form is dirty (has changes)
  const isDirty = useMemo(() => {
    return !isEqual(formData, originalData)
  }, [formData, originalData])

  // Calculate if form has errors
  const hasErrors = useMemo(() => {
    return Object.keys(errors).length > 0
  }, [errors])

  // Calculate if form can be saved
  const canSave = useMemo(() => {
    return isDirty && !hasErrors && !isSubmitting
  }, [isDirty, hasErrors, isSubmitting])

  // Update unsaved changes context when dirty state changes
  useEffect(() => {
    setHasUnsavedChanges(isDirty)
  }, [isDirty, setHasUnsavedChanges])

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && isDirty && !hasErrors && onSave) {
      // Clear existing timeout
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
      }

      // Set new timeout
      const timeout = setTimeout(async () => {
        try {
          await onSave(formData)
          setOriginalData(formData)
        } catch (error) {
          console.error('Auto-save failed:', error)
        }
      }, autoSaveDelay)

      setAutoSaveTimeout(timeout)
    }

    // Cleanup timeout on unmount
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
      }
    }
  }, [formData, isDirty, hasErrors, autoSave, autoSaveDelay, onSave])

  // Update form data when initial data changes
  useEffect(() => {
    if (!isDirty) {
      setFormDataState(initialData)
      setOriginalData(initialData)
    }
  }, [initialData, isDirty])

  const setFormData = useCallback((data: T | ((prev: T) => T)) => {
    setFormDataState(prev => {
      const newData = typeof data === 'function' ? data(prev) : data
      
      // Validate on change if enabled
      if (validateOnChange) {
        // Clear errors for changed fields
        const changedFields = Object.keys(newData).filter(
          key => !isEqual(newData[key], prev[key])
        )
        
        setErrors(prevErrors => {
          const newErrors = { ...prevErrors }
          changedFields.forEach(field => {
            delete newErrors[field]
          })
          return newErrors
        })
      }
      
      return newData
    })
  }, [validateOnChange])

  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }, [setFormData])

  const setFieldError = useCallback((field: string, error: string) => {
    setErrors(prev => ({
      ...prev,
      [field]: error
    }))
  }, [])

  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])

  const getFieldError = useCallback((field: string) => {
    return errors[field]
  }, [errors])

  const validate = useCallback(() => {
    // Basic validation - can be extended with validation schema
    const newErrors: Record<string, string> = {}
    
    // Add custom validation logic here
    // For now, just check for required fields
    Object.entries(formData).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) {
        // Only add error if field was originally required
        if (originalData[key] !== '' && originalData[key] !== null && originalData[key] !== undefined) {
          newErrors[key] = `${key} is required`
        }
      }
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, originalData])

  const validateField = useCallback((field: keyof T) => {
    const value = formData[field]
    const newErrors = { ...errors }
    
    // Basic field validation
    if (value === '' || value === null || value === undefined) {
      if (originalData[field] !== '' && originalData[field] !== null && originalData[field] !== undefined) {
        newErrors[field as string] = `${String(field)} is required`
      }
    } else {
      delete newErrors[field as string]
    }
    
    setErrors(newErrors)
    return !newErrors[field as string]
  }, [formData, errors, originalData])

  const save = useCallback(async () => {
    if (!canSave || !onSave) return

    setIsSubmitting(true)
    
    try {
      // Validate before saving
      if (!validate()) {
        throw new Error('Form validation failed')
      }

      await onSave(formData)
      
      // Update original data to reflect saved state
      setOriginalData(formData)
      clearErrors()
    } catch (error) {
      console.error('Save failed:', error)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }, [canSave, onSave, formData, validate, clearErrors])

  const cancel = useCallback(() => {
    setFormDataState(originalData)
    clearErrors()
    onCancel?.()
  }, [originalData, clearErrors, onCancel])

  const reset = useCallback(() => {
    setFormDataState(initialData)
    setOriginalData(initialData)
    clearErrors()
  }, [initialData, clearErrors])

  return {
    formData,
    originalData,
    isDirty,
    isSubmitting,
    errors,
    
    // Actions
    setFormData,
    setFieldValue,
    setErrors,
    setFieldError,
    clearErrors,
    reset,
    save,
    cancel,
    
    // Validation
    validate,
    validateField,
    
    // Utilities
    getFieldError,
    hasErrors,
    canSave
  }
}

// Hook for handling form submission with loading states
export function useFormSubmission<T>(
  onSubmit: (data: T) => Promise<void>,
  options?: {
    onSuccess?: () => void
    onError?: (error: Error) => void
    resetOnSuccess?: boolean
  }
) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (data: T) => {
    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit(data)
      options?.onSuccess?.()
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred'
      setError(errorMessage)
      options?.onError?.(err)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [onSubmit, options])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    submit,
    isSubmitting,
    error,
    clearError
  }
}

// Hook for debounced form updates
export function useDebouncedFormUpdate<T>(
  value: T,
  callback: (value: T) => void,
  delay: number = 500
) {
  useEffect(() => {
    const timeout = setTimeout(() => {
      callback(value)
    }, delay)

    return () => clearTimeout(timeout)
  }, [value, callback, delay])
}

export default useFormState
