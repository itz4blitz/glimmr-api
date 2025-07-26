# Type Sharing Strategy: Drizzle ORM + NestJS + React

## Overview

This document outlines the comprehensive type sharing strategy for the Glimmr monorepo, which uses:
- **Backend**: NestJS with Drizzle ORM and PostgreSQL
- **Frontend**: React with TypeScript
- **Monorepo**: Turborepo with pnpm workspaces

## Key Principles

1. **Single Source of Truth**: Database schemas (Drizzle) are the source of truth for data types
2. **Type Safety**: End-to-end type safety from database to UI
3. **DRY**: Don't repeat type definitions across packages
4. **Runtime Validation**: Share Zod schemas for validation on both frontend and backend

## Architecture

```
glimmr-api/
├── apps/
│   ├── api/                 # NestJS backend
│   │   └── src/
│   │       └── database/
│   │           └── schema/  # Drizzle schemas (source of truth)
│   └── web/                 # React frontend
│       └── src/
│           └── types/       # Frontend-specific types only
└── packages/
    └── shared-types/        # Shared type definitions
        └── src/
            ├── generated-types.ts  # Auto-generated from Drizzle
            ├── validation.ts       # Shared Zod schemas
            └── utils.ts           # Utility types
```

## Implementation Steps

### 1. Install Shared Types Package

In both frontend and backend:

```bash
# Backend
cd apps/api
pnpm add @glimmr/shared-types@workspace:*

# Frontend
cd apps/web
pnpm add @glimmr/shared-types@workspace:*
```

### 2. Update Backend DTOs

Replace manual type definitions with generated types:

```typescript
// Before
export class UserDto {
  id: string;
  email: string;
  // ... manually maintained
}

// After
import { User } from '@glimmr/shared-types';
export type UserDto = User;
```

### 3. Update Frontend Types

Remove duplicate type definitions and import from shared package:

```typescript
// Before (apps/web/src/types/auth.ts)
export interface User {
  id: string;
  email: string;
  // ... manually maintained
}

// After
export { User, UserWithProfile } from '@glimmr/shared-types';
```

### 4. Use Shared Validation

Replace separate validation logic with shared Zod schemas:

```typescript
// Backend (NestJS)
import { loginSchema } from '@glimmr/shared-types';

@Post('login')
async login(@Body() body: unknown) {
  const validated = loginSchema.parse(body);
  // ... use validated data
}

// Frontend (React)
import { loginSchema } from '@glimmr/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm({
  resolver: zodResolver(loginSchema),
});
```

## Type Generation Workflow

### Automatic Generation

1. **Development**: Types are inferred directly from Drizzle schemas
2. **Build Time**: Run type generation script
3. **CI/CD**: Validate types match schemas

### Manual Process

```bash
# Generate types from Drizzle schemas
cd apps/api
pnpm run generate-types

# This runs: ts-node scripts/sync-types.ts
```

### Add to package.json scripts:

```json
{
  "scripts": {
    "generate-types": "ts-node scripts/sync-types.ts",
    "db:push": "drizzle-kit push:pg",
    "db:generate": "drizzle-kit generate:pg && pnpm generate-types"
  }
}
```

## Best Practices

### 1. Type Inference

Always use Drizzle's type inference:

```typescript
// Good
export type User = InferSelectModel<typeof users>;

// Also good (alternative syntax)
export type User = typeof users.$inferSelect;

// Bad - manually maintaining types
export interface User {
  id: string;
  // ...
}
```

### 2. Separate Select and Insert Types

```typescript
// Select type - all fields, including defaults
export type User = InferSelectModel<typeof users>;

// Insert type - only required fields
export type NewUser = InferInsertModel<typeof users>;
```

### 3. API Response Types

Create consistent API response wrappers:

```typescript
// In shared-types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
```

### 4. Complex Types

For types that combine multiple tables:

```typescript
// In shared-types
export interface UserWithProfile extends User {
  profile?: UserProfile;
  roles?: Role[];
  permissions?: Permission[];
}
```

### 5. Frontend-Only Types

Keep UI-specific types in the frontend:

```typescript
// apps/web/src/types/ui.ts
export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
}

export interface FormState<T> {
  data: T;
  errors: Record<string, string>;
  isDirty: boolean;
}
```

## Common Patterns

### 1. DTO Transformation

```typescript
// Backend service
import { User, UserWithProfile } from '@glimmr/shared-types';

async findOne(id: string): Promise<UserWithProfile> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    with: {
      profile: true,
      roles: true,
    },
  });
  
  return user; // Type-safe!
}
```

### 2. Form Validation

```typescript
// Shared validation schema
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  bio: z.string().max(500).optional(),
});

// Frontend
const form = useForm<UpdateProfileInput>({
  resolver: zodResolver(updateProfileSchema),
});

// Backend
@Put('profile')
async updateProfile(@Body() body: unknown) {
  const data = updateProfileSchema.parse(body);
  // ... data is type-safe
}
```

### 3. Type Guards

```typescript
// In shared-types/utils.ts
export function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj
  );
}

// Usage
if (isUser(data)) {
  // data is typed as User
}
```

## Troubleshooting

### Issue: Types resolve to 'any' in monorepo

This is a known issue with Drizzle's `$inferSelect` across packages. Workaround:

```typescript
// Use InferSelectModel instead
export type User = InferSelectModel<typeof users>;

// Or create explicit type exports
export type UserSelect = typeof users.$inferSelect;
```

### Issue: Circular dependencies

Keep shared-types independent:
- Don't import from apps/ in shared-types
- Use type imports when possible: `import type { ... }`

### Issue: Type changes not reflected

1. Rebuild the shared-types package
2. Restart TypeScript server in your IDE
3. Clear build caches if needed

## Migration Guide

To migrate existing code:

1. **Audit current types**: List all manually defined types
2. **Map to Drizzle schemas**: Identify corresponding database tables
3. **Update imports**: Replace local types with shared imports
4. **Remove duplicates**: Delete redundant type definitions
5. **Add validation**: Replace validation logic with Zod schemas
6. **Test thoroughly**: Ensure type safety is maintained

## Future Enhancements

1. **Auto-generate on migration**: Hook into Drizzle migrations
2. **Runtime type validation**: Add middleware for automatic validation
3. **OpenAPI generation**: Generate API specs from types
4. **GraphQL schema**: Generate GraphQL types from Drizzle schemas
5. **Type versioning**: Handle breaking changes in types

## Conclusion

This type sharing strategy provides:
- ✅ End-to-end type safety
- ✅ Single source of truth
- ✅ Reduced maintenance
- ✅ Better developer experience
- ✅ Runtime validation
- ✅ Consistent API contracts

Follow these patterns to maintain a robust, type-safe codebase across your full-stack TypeScript application.