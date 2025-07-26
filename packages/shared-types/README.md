# @glimmr/shared-types

This package contains shared TypeScript types, interfaces, and validation schemas used across the Glimmr monorepo.

## Overview

The shared-types package provides:

1. **Database Types** - Automatically generated from Drizzle ORM schemas
2. **API Types** - DTOs, request/response interfaces
3. **Validation Schemas** - Zod schemas for runtime validation
4. **Utility Types** - Common TypeScript utility types

## Usage

### In Backend (NestJS)

```typescript
import { User, UpdateUserDto, loginSchema } from '@glimmr/shared-types';
import { z } from 'zod';

// Use types
const user: User = await this.userService.findOne(id);

// Use validation
const validatedData = loginSchema.parse(requestBody);
```

### In Frontend (React)

```typescript
import { User, UserWithProfile, loginSchema } from '@glimmr/shared-types';
import type { ApiResponse } from '@glimmr/shared-types';

// Use types
const [user, setUser] = useState<User | null>(null);

// Use for API responses
const response: ApiResponse<User> = await api.get('/users/me');

// Use validation
const form = useForm({
  resolver: zodResolver(loginSchema),
});
```

## Type Generation

Types are generated from Drizzle schemas using the following pattern:

```typescript
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Select type - for querying data
export type User = InferSelectModel<typeof users>;

// Insert type - for creating new records
export type NewUser = InferInsertModel<typeof users>;
```

## Best Practices

1. **Always use shared types** - Don't duplicate type definitions
2. **Keep types close to schemas** - Database types should be generated from Drizzle schemas
3. **Use validation schemas** - Share Zod schemas between frontend and backend
4. **Version carefully** - Changes to types can break both frontend and backend

## Adding New Types

1. Add your Drizzle schema to the backend
2. Import and export the type in `generate-types.ts`
3. Add any related DTOs or API types
4. Create validation schemas if needed
5. Run type checking to ensure everything compiles

## Type Safety Tips

- Use branded types for IDs, emails, etc.
- Leverage utility types for common patterns
- Use type guards for runtime type checking
- Keep API response types consistent