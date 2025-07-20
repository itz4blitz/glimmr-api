import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { toast } from 'sonner'
import { userManagementApi } from '@/services/userManagement'
import type {
  UserListItem,
  UserWithProfile,
  UserStats,
  UserFilters,
  PaginationState,
  LoadingState,
  ErrorState,
  UserListParams,
  BulkUserActionDto,
  UpdateUserDto,
  ProfileUpdateData,
  PreferencesUpdateData,
  UserActivityLog,
  UserFile
} from '@/types/userManagement'

interface UserManagementState {
  // Data
  users: UserListItem[]
  selectedUser: UserWithProfile | null
  userStats: UserStats | null
  userActivity: UserActivityLog[]
  userFiles: UserFile[]
  
  // UI State
  loading: LoadingState
  error: ErrorState
  selectedUserIds: string[]
  
  // Filters and pagination
  filters: UserFilters
  pagination: PaginationState
  
  // Actions - User Management
  loadUsers: (params?: UserListParams) => Promise<void>
  loadUserById: (id: string) => Promise<void>
  updateUser: (id: string, data: UpdateUserDto) => Promise<void>
  updateUserRole: (id: string, role: string) => Promise<void>
  deleteUser: (id: string) => Promise<void>
  activateUser: (id: string) => Promise<void>
  deactivateUser: (id: string) => Promise<void>
  
  // Actions - Profile Management
  updateUserProfile: (id: string, data: ProfileUpdateData) => Promise<void>
  updateUserPreferences: (id: string, data: PreferencesUpdateData) => Promise<void>
  
  // Actions - Bulk Operations
  bulkAction: (action: BulkUserActionDto) => Promise<void>
  
  // Actions - Statistics and Activity
  loadUserStats: () => Promise<void>
  loadUserActivity: (userId: string, page?: number) => Promise<void>
  loadUserFiles: (userId: string) => Promise<void>
  
  // Actions - Selection Management
  selectUser: (userId: string) => void
  deselectUser: (userId: string) => void
  selectAllUsers: (selected: boolean) => void
  clearSelection: () => void
  
  // Actions - Filter Management
  setFilters: (filters: Partial<UserFilters>) => void
  resetFilters: () => void
  setPagination: (pagination: Partial<PaginationState>) => void
  
  // Actions - Admin Operations
  sendPasswordReset: (userId: string) => Promise<void>
  resendEmailVerification: (userId: string) => Promise<void>
  generateApiKey: (userId: string) => Promise<string>
  revokeApiKey: (userId: string) => Promise<void>
  
  // Actions - File Management
  deleteUserFile: (userId: string, fileId: string) => Promise<void>
  downloadUserFile: (fileId: string) => Promise<void>
  
  // Actions - Error Management
  clearError: (key: keyof ErrorState) => void
  clearAllErrors: () => void
}

const initialFilters: UserFilters = {
  search: '',
  role: 'all',
  status: 'all',
  emailVerified: 'all',
  dateRange: 'all'
}

const initialPagination: PaginationState = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
}

const initialLoading: LoadingState = {
  users: true, // Start with loading true to prevent flash on initial load
  userDetail: false,
  stats: true, // Start with loading true to prevent flash on initial load
  bulkAction: false,
  export: false,
  import: false
}

const initialError: ErrorState = {
  users: null,
  userDetail: null,
  stats: null,
  bulkAction: null,
  export: null,
  import: null
}

export const useUserManagementStore = create<UserManagementState>()(
  devtools(
    (set, get) => ({
      // Initial State
      users: [],
      selectedUser: null,
      userStats: null,
      userActivity: [],
      userFiles: [],
      loading: initialLoading,
      error: initialError,
      selectedUserIds: [],
      filters: initialFilters,
      pagination: initialPagination,

      // User Management Actions
      loadUsers: async (params) => {
        const state = get()
        if (state.loading.users) return // Prevent concurrent requests

        set(state => ({
          loading: { ...state.loading, users: true },
          error: { ...state.error, users: null }
        }))

        try {
          const { filters, pagination } = get()
          const searchParams: UserListParams = {
            page: pagination.page,
            limit: pagination.limit,
            search: filters.search || undefined,
            role: filters.role !== 'all' ? filters.role : undefined,
            isActive: filters.status !== 'all' ? filters.status === 'active' : undefined,
            emailVerified: filters.emailVerified !== 'all' ? filters.emailVerified === 'verified' : undefined,
            ...params
          }

          const response = await userManagementApi.getUsers(searchParams)
          
          set(state => ({
            users: response.users,
            pagination: {
              page: response.page,
              limit: response.limit,
              total: response.total,
              totalPages: response.totalPages
            },
            loading: { ...state.loading, users: false }
          }))
        } catch (error: any) {
          set(state => ({
            loading: { ...state.loading, users: false },
            error: { ...state.error, users: error.message }
          }))
          toast.error('Failed to load users')
        }
      },

      loadUserById: async (id) => {
        set(state => ({
          loading: { ...state.loading, userDetail: true },
          error: { ...state.error, userDetail: null }
        }))

        try {
          const user = await userManagementApi.getUserById(id)
          set(state => ({
            selectedUser: user,
            loading: { ...state.loading, userDetail: false }
          }))
        } catch (error: any) {
          set(state => ({
            loading: { ...state.loading, userDetail: false },
            error: { ...state.error, userDetail: error.message }
          }))
          toast.error('Failed to load user details')
        }
      },

      updateUser: async (id, data) => {
        try {
          const updatedUser = await userManagementApi.updateUser(id, data)
          
          set(state => ({
            selectedUser: state.selectedUser?.id === id ? updatedUser : state.selectedUser,
            users: state.users.map(user => 
              user.id === id ? { ...user, ...data } : user
            )
          }))
          
          toast.success('User updated successfully')
        } catch (error: any) {
          toast.error('Failed to update user')
          throw error
        }
      },

      updateUserRole: async (id, role) => {
        try {
          const updatedUser = await userManagementApi.updateUserRole(id, { role: role as any })
          
          set(state => ({
            selectedUser: state.selectedUser?.id === id ? updatedUser : state.selectedUser,
            users: state.users.map(user => 
              user.id === id ? { ...user, role: role as any } : user
            )
          }))
          
          toast.success('User role updated successfully')
        } catch (error: any) {
          toast.error('Failed to update user role')
          throw error
        }
      },

      deleteUser: async (id) => {
        try {
          await userManagementApi.deleteUser(id)
          
          set(state => ({
            users: state.users.filter(user => user.id !== id),
            selectedUser: state.selectedUser?.id === id ? null : state.selectedUser,
            selectedUserIds: state.selectedUserIds.filter(userId => userId !== id)
          }))
          
          toast.success('User deleted successfully')
        } catch (error: any) {
          toast.error('Failed to delete user')
          throw error
        }
      },

      activateUser: async (id) => {
        try {
          await userManagementApi.activateUser(id)
          
          set(state => ({
            users: state.users.map(user => 
              user.id === id ? { ...user, isActive: true } : user
            )
          }))
          
          toast.success('User activated successfully')
        } catch (error: any) {
          toast.error('Failed to activate user')
          throw error
        }
      },

      deactivateUser: async (id) => {
        try {
          await userManagementApi.deactivateUser(id)
          
          set(state => ({
            users: state.users.map(user => 
              user.id === id ? { ...user, isActive: false } : user
            )
          }))
          
          toast.success('User deactivated successfully')
        } catch (error: any) {
          toast.error('Failed to deactivate user')
          throw error
        }
      },

      // Profile Management Actions
      updateUserProfile: async (id, data) => {
        try {
          const updatedUser = await userManagementApi.updateUserProfile(id, data)
          
          set(state => ({
            selectedUser: state.selectedUser?.id === id ? updatedUser : state.selectedUser
          }))
          
          toast.success('Profile updated successfully')
        } catch (error: any) {
          toast.error('Failed to update profile')
          throw error
        }
      },

      updateUserPreferences: async (id, data) => {
        try {
          const updatedUser = await userManagementApi.updateUserPreferences(id, data)
          
          set(state => ({
            selectedUser: state.selectedUser?.id === id ? updatedUser : state.selectedUser
          }))
          
          toast.success('Preferences updated successfully')
        } catch (error: any) {
          toast.error('Failed to update preferences')
          throw error
        }
      },

      // Bulk Operations
      bulkAction: async (action) => {
        set(state => ({
          loading: { ...state.loading, bulkAction: true },
          error: { ...state.error, bulkAction: null }
        }))

        try {
          const result = await userManagementApi.bulkUserAction(action)
          
          // Refresh users list
          await get().loadUsers()
          
          set(state => ({
            loading: { ...state.loading, bulkAction: false },
            selectedUserIds: []
          }))
          
          if (result.failed.length > 0) {
            toast.warning(`${result.successful.length} users processed, ${result.failed.length} failed`)
          } else {
            toast.success(`${result.successful.length} users processed successfully`)
          }
        } catch (error: any) {
          set(state => ({
            loading: { ...state.loading, bulkAction: false },
            error: { ...state.error, bulkAction: error.message }
          }))
          toast.error('Bulk operation failed')
        }
      },

      // Statistics and Activity
      loadUserStats: async () => {
        const state = get()
        if (state.loading.stats) return // Prevent concurrent requests

        set(state => ({
          loading: { ...state.loading, stats: true },
          error: { ...state.error, stats: null }
        }))

        try {
          const stats = await userManagementApi.getUserStats()
          set(state => ({
            userStats: stats,
            loading: { ...state.loading, stats: false }
          }))
        } catch (error: any) {
          set(state => ({
            loading: { ...state.loading, stats: false },
            error: { ...state.error, stats: error.message }
          }))
          toast.error('Failed to load user statistics')
        }
      },

      loadUserActivity: async (userId, page = 1) => {
        try {
          const response = await userManagementApi.getUserActivity(userId, { page, limit: 20 })
          set({ userActivity: response.activities })
        } catch (error: any) {
          toast.error('Failed to load user activity')
        }
      },

      loadUserFiles: async (userId) => {
        try {
          const files = await userManagementApi.getUserFiles(userId)
          set({ userFiles: files })
        } catch (error: any) {
          // Don't show error for 404 - files endpoint may not be implemented yet
          if (error.response?.status !== 404) {
            toast.error('Failed to load user files')
          }
          set({ userFiles: [] })
        }
      },

      // Selection Management
      selectUser: (userId) => {
        set(state => ({
          selectedUserIds: [...state.selectedUserIds, userId]
        }))
      },

      deselectUser: (userId) => {
        set(state => ({
          selectedUserIds: state.selectedUserIds.filter(id => id !== userId)
        }))
      },

      selectAllUsers: (selected) => {
        if (selected) {
          set(state => ({
            selectedUserIds: state.users.map(user => user.id)
          }))
        } else {
          set({ selectedUserIds: [] })
        }
      },

      clearSelection: () => {
        set({ selectedUserIds: [] })
      },

      // Filter Management
      setFilters: (newFilters) => {
        set(state => ({
          filters: { ...state.filters, ...newFilters },
          pagination: { ...state.pagination, page: 1 }
        }))
        
        // Auto-reload users when filters change
        setTimeout(() => get().loadUsers(), 0)
      },

      resetFilters: () => {
        set({
          filters: initialFilters,
          pagination: { ...initialPagination }
        })
        
        // Auto-reload users when filters reset
        setTimeout(() => get().loadUsers(), 0)
      },

      setPagination: (newPagination) => {
        set(state => ({
          pagination: { ...state.pagination, ...newPagination }
        }))
        
        // Auto-reload users when pagination changes
        setTimeout(() => get().loadUsers(), 0)
      },

      // Admin Operations
      sendPasswordReset: async (userId) => {
        try {
          await userManagementApi.sendPasswordReset(userId)
          toast.success('Password reset email sent')
        } catch (error: any) {
          toast.error('Failed to send password reset')
          throw error
        }
      },

      resendEmailVerification: async (userId) => {
        try {
          await userManagementApi.resendEmailVerification(userId)
          toast.success('Verification email sent')
        } catch (error: any) {
          toast.error('Failed to send verification email')
          throw error
        }
      },

      generateApiKey: async (userId) => {
        try {
          const result = await userManagementApi.generateApiKey(userId)
          toast.success('API key generated successfully')
          return result.apiKey
        } catch (error: any) {
          toast.error('Failed to generate API key')
          throw error
        }
      },

      revokeApiKey: async (userId) => {
        try {
          await userManagementApi.revokeApiKey(userId)
          toast.success('API key revoked successfully')
        } catch (error: any) {
          toast.error('Failed to revoke API key')
          throw error
        }
      },

      // File Management
      deleteUserFile: async (userId, fileId) => {
        try {
          await userManagementApi.deleteUserFile(userId, fileId)
          
          set(state => ({
            userFiles: state.userFiles.filter(file => file.id !== fileId)
          }))
          
          toast.success('File deleted successfully')
        } catch (error: any) {
          toast.error('Failed to delete file')
          throw error
        }
      },

      downloadUserFile: async (fileId) => {
        try {
          const blob = await userManagementApi.downloadUserFile(fileId)
          
          // Create download link
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `file-${fileId}`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
        } catch (error: any) {
          toast.error('Failed to download file')
          throw error
        }
      },

      // Error Management
      clearError: (key) => {
        set(state => ({
          error: { ...state.error, [key]: null }
        }))
      },

      clearAllErrors: () => {
        set({ error: initialError })
      }
    }),
    {
      name: 'user-management-store'
    }
  )
)
