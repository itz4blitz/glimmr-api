# TypeScript `any` Types Fixed

## Summary

All `@typescript-eslint/no-explicit-any` warnings have been fixed in the web app. Here's what was changed:

## Type Definitions Created/Updated

### 1. **Auth Types** (`/apps/web/src/types/auth.ts`)
- Replaced `privacySettings?: any` with a proper interface:
  ```typescript
  privacySettings?: {
    profileVisibility?: "public" | "private" | "friends";
    showEmail?: boolean;
    showPhone?: boolean;
    showLocation?: boolean;
  };
  ```
- Replaced `dashboardLayout?: any` with a structured type:
  ```typescript
  dashboardLayout?: {
    widgets?: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
    }>;
    theme?: string;
  };
  ```

### 2. **User Management Types** (`/apps/web/src/types/userManagement.ts`)
- Added `UserSession` interface for session management
- Updated `metadata` type with proper structure:
  ```typescript
  metadata?: {
    previousValue?: string | number | boolean;
    newValue?: string | number | boolean;
    changes?: Record<string, unknown>;
    [key: string]: unknown;
  };
  ```

### 3. **Services** (`/apps/web/src/services/userManagement.ts`)
- Changed `filters: Record<string, any>` to `Record<string, string | number | boolean | string[] | undefined>`
- Changed `getUserSessions(): Promise<any[]>` to `Promise<UserSession[]>`
- Updated error handling wrapper to use `unknown[]` instead of `any[]`

### 4. **Stores**
- **userManagement.ts**: 
  - Removed all `any` from catch blocks
  - Added proper type imports (UserRole)
  - Used type assertions for error handling
- **auth.ts**: 
  - Updated error handling to use type assertions

### 5. **Hooks** (`/apps/web/src/hooks/useFormState.ts`)
- Changed `isEqual(a: any, b: any)` to `isEqual(a: unknown, b: unknown)`
- Changed `setFieldValue: (field: keyof T, value: any)` to use proper generic constraint
- Updated `useFormState<T extends Record<string, any>>` to `Record<string, unknown>`

### 6. **Components**
- **DashboardPage.tsx**: Updated error handling in catch blocks
- **ActivityDashboardPage.tsx**: Replaced `metadata?: any` with structured type
- **QueueAnalyticsPage.tsx**: Added proper types for queue stats
- **NotificationList.tsx**: Replaced `data?: any` with structured notification data type
- **UserFileManager.tsx**: Changed `Record<string, any>` to `Record<string, typeof Image | typeof FileText | typeof File>`
- **MobileFiltersDrawer.tsx**: Changed `options: any[]` to `Array<{ value: string; label: string }>`
- **ExportDialog.tsx**: Updated error handling and value change handler

## Error Handling Pattern

All error handling now follows this pattern:
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Default error message";
  // Use errorMessage
}
```

For Axios errors:
```typescript
} catch (error) {
  const axiosError = error as { response?: { data?: { message?: string } } };
  const errorMessage = axiosError.response?.data?.message || "Default error message";
  // Use errorMessage
}
```

## Benefits

1. **Type Safety**: All types are now properly defined, preventing runtime errors
2. **Better IDE Support**: IntelliSense now works properly with all types
3. **Maintainability**: Clear type definitions make the code easier to understand
4. **No More `any`**: The codebase is now fully type-safe without any TypeScript warnings

## Next Steps

1. Consider using the shared types package strategy outlined in `TYPES_STRATEGY.md`
2. Set up type generation from Drizzle schemas to keep frontend and backend types in sync
3. Enable strict TypeScript checks to prevent `any` types from being introduced