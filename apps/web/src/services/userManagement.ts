import { apiClient } from "@/lib/api";
import type {
  UserListParams,
  UserListResponse,
  UserWithProfile,
  UpdateUserDto,
  UpdateUserRoleDto,
  ProfileUpdateData,
  PreferencesUpdateData,
  BulkUserActionDto,
  BulkActionResult,
  UserStats,
  ActivityLogResponse,
  PaginationParams,
  UserFile,
  ExportOptions,
  ImportResult,
} from "@/types/userManagement";

export class UserManagementService {
  // User CRUD Operations
  static async getUsers(
    params: UserListParams = {},
  ): Promise<UserListResponse> {
    const response = await apiClient.get("/users", { params });
    return response.data;
  }

  static async getUserById(id: string): Promise<UserWithProfile> {
    const response = await apiClient.get(`/users/${id}`);
    // Handle both response formats
    return response.data.user || response.data;
  }

  static async updateUser(
    id: string,
    data: UpdateUserDto,
  ): Promise<UserWithProfile> {
    const response = await apiClient.put(`/users/${id}`, data);
    return response.data;
  }

  static async updateUserRole(
    id: string,
    data: UpdateUserRoleDto,
  ): Promise<UserWithProfile> {
    const response = await apiClient.put(`/users/${id}/role`, data);
    return response.data;
  }

  static async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  }

  static async activateUser(id: string): Promise<UserWithProfile> {
    const response = await apiClient.put(`/users/${id}/activate`);
    return response.data;
  }

  static async deactivateUser(id: string): Promise<UserWithProfile> {
    const response = await apiClient.put(`/users/${id}/deactivate`);
    return response.data;
  }

  // Profile Management
  static async updateUserProfile(
    id: string,
    data: ProfileUpdateData,
  ): Promise<UserWithProfile> {
    const response = await apiClient.put(`/users/${id}/profile`, data);
    return response.data;
  }

  static async updateUserPreferences(
    id: string,
    data: PreferencesUpdateData,
  ): Promise<UserWithProfile> {
    const response = await apiClient.put(`/users/${id}/preferences`, data);
    return response.data;
  }

  // Bulk Operations
  static async bulkUserAction(
    action: BulkUserActionDto,
  ): Promise<BulkActionResult> {
    const response = await apiClient.post("/users/bulk", action);
    return response.data;
  }

  // Statistics and Analytics
  static async getUserStats(): Promise<UserStats> {
    const response = await apiClient.get("/users/stats");
    return response.data;
  }

  static async getUserActivity(
    userId: string,
    params: PaginationParams = {},
  ): Promise<ActivityLogResponse> {
    const response = await apiClient.get(`/users/${userId}/activity`, {
      params,
    });
    return response.data;
  }

  // File Management
  static async getUserFiles(userId: string): Promise<UserFile[]> {
    const response = await apiClient.get(`/users/${userId}/files`);
    return response.data;
  }

  static async deleteUserFile(userId: string, fileId: string): Promise<void> {
    await apiClient.delete(`/users/${userId}/files/${fileId}`);
  }

  static async downloadUserFile(fileId: string): Promise<Blob> {
    const response = await apiClient.get(`/users/files/${fileId}`, {
      responseType: "blob",
    });
    return response.data;
  }

  // Admin Actions
  static async sendPasswordReset(userId: string): Promise<void> {
    await apiClient.post(`/users/${userId}/password-reset`);
  }

  static async resendEmailVerification(userId: string): Promise<void> {
    await apiClient.post(`/users/${userId}/resend-verification`);
  }

  static async generateApiKey(userId: string): Promise<{ apiKey: string }> {
    const response = await apiClient.post(`/users/${userId}/api-key`);
    return response.data;
  }

  static async revokeApiKey(userId: string): Promise<void> {
    await apiClient.delete(`/users/${userId}/api-key`);
  }

  // Export/Import
  static async exportUsers(options: ExportOptions): Promise<Blob> {
    const response = await apiClient.post("/users/export", options, {
      responseType: "blob",
    });
    return response.data;
  }

  static async importUsers(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post("/users/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  // Search and Filtering Helpers
  static buildSearchParams(filters: Record<string, any>): URLSearchParams {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v.toString()));
        } else {
          params.append(key, value.toString());
        }
      }
    });

    return params;
  }

  // Utility Methods
  static async checkEmailAvailability(
    email: string,
    excludeUserId?: string,
  ): Promise<boolean> {
    const params = excludeUserId ? { excludeUserId } : {};
    const response = await apiClient.get("/users/check-email", {
      params: { email, ...params },
    });
    return response.data.available;
  }

  static async getUserPermissions(userId: string): Promise<string[]> {
    const response = await apiClient.get(`/users/${userId}/permissions`);
    return response.data.permissions;
  }

  static async updateUserPermissions(
    userId: string,
    permissions: string[],
  ): Promise<void> {
    await apiClient.put(`/users/${userId}/permissions`, { permissions });
  }

  // Session Management
  static async getUserSessions(userId: string): Promise<any[]> {
    const response = await apiClient.get(`/users/${userId}/sessions`);
    return response.data;
  }

  static async revokeUserSession(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    await apiClient.delete(`/users/${userId}/sessions/${sessionId}`);
  }

  static async revokeAllUserSessions(userId: string): Promise<void> {
    await apiClient.delete(`/users/${userId}/sessions`);
  }
}

// Error handling wrapper
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error: any) {
      // Log error for debugging
      console.error("UserManagementService Error:", error);

      // Re-throw with enhanced error information
      const enhancedError = new Error(
        error.response?.data?.message ||
          error.message ||
          "An unexpected error occurred",
      );
      enhancedError.cause = error;
      throw enhancedError;
    }
  };
};

// Export wrapped service methods
export const userManagementApi = {
  getUsers: withErrorHandling(UserManagementService.getUsers),
  getUserById: withErrorHandling(UserManagementService.getUserById),
  updateUser: withErrorHandling(UserManagementService.updateUser),
  updateUserRole: withErrorHandling(UserManagementService.updateUserRole),
  deleteUser: withErrorHandling(UserManagementService.deleteUser),
  activateUser: withErrorHandling(UserManagementService.activateUser),
  deactivateUser: withErrorHandling(UserManagementService.deactivateUser),
  updateUserProfile: withErrorHandling(UserManagementService.updateUserProfile),
  updateUserPreferences: withErrorHandling(
    UserManagementService.updateUserPreferences,
  ),
  bulkUserAction: withErrorHandling(UserManagementService.bulkUserAction),
  getUserStats: withErrorHandling(UserManagementService.getUserStats),
  getUserActivity: withErrorHandling(UserManagementService.getUserActivity),
  getUserFiles: withErrorHandling(UserManagementService.getUserFiles),
  deleteUserFile: withErrorHandling(UserManagementService.deleteUserFile),
  downloadUserFile: withErrorHandling(UserManagementService.downloadUserFile),
  sendPasswordReset: withErrorHandling(UserManagementService.sendPasswordReset),
  resendEmailVerification: withErrorHandling(
    UserManagementService.resendEmailVerification,
  ),
  generateApiKey: withErrorHandling(UserManagementService.generateApiKey),
  revokeApiKey: withErrorHandling(UserManagementService.revokeApiKey),
  exportUsers: withErrorHandling(UserManagementService.exportUsers),
  importUsers: withErrorHandling(UserManagementService.importUsers),
  checkEmailAvailability: withErrorHandling(
    UserManagementService.checkEmailAvailability,
  ),
  getUserPermissions: withErrorHandling(
    UserManagementService.getUserPermissions,
  ),
  updateUserPermissions: withErrorHandling(
    UserManagementService.updateUserPermissions,
  ),
  getUserSessions: withErrorHandling(UserManagementService.getUserSessions),
  revokeUserSession: withErrorHandling(UserManagementService.revokeUserSession),
  revokeAllUserSessions: withErrorHandling(
    UserManagementService.revokeAllUserSessions,
  ),
};

export default userManagementApi;
