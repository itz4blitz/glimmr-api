---
name: full-feature
description: Implements a complete feature across the stack including database schema, API endpoints, services, jobs, React components, and tests
allowed-tools:
  - bash
  - read
  - write
  - edit
  - grep
---

# Full Feature Implementation Command

Implements a complete feature across the entire Glimmr stack.

## Usage
```
/full-feature <feature-name> "<feature-description>"
```

Example: `/full-feature price-alerts "Allow users to set price alerts for specific services and get notified when prices change"`

## Steps

1. Analyze the feature requirements and plan the implementation:

```bash
# Check existing related code
echo "=== Analyzing codebase for related features ==="
grep -r "${featureName}" apps/api/src/ apps/web/src/ || echo "No existing references found"

# List relevant schemas
ls -la apps/api/src/database/schema/
ls -la apps/api/src/*/

# Check for similar features
find apps/web/src/components -name "*${featureName}*" -o -name "*alert*" -o -name "*notification*" 2>/dev/null || true
```

2. Create database schema for the feature:

```typescript
// Create schema file at apps/api/src/database/schema/${featureName}.ts
cat > apps/api/src/database/schema/${featureName}.ts << 'EOF'
import { pgTable, text, timestamp, boolean, numeric, jsonb, uuid, index, primaryKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { hospitals } from './hospitals';
import { prices } from './prices';

// Main feature table
export const ${featureName} = pgTable('${feature_name}', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  
  // Feature-specific fields based on description
  ${generateSchemaFields(featureDescription)}
  
  // Common fields
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  // Indexes for common queries
  userIdx: index('${feature_name}_user_idx').on(table.userId),
  activeIdx: index('${feature_name}_active_idx').on(table.isActive),
  createdIdx: index('${feature_name}_created_idx').on(table.createdAt),
  ${generateIndexes(featureName)}
}));

// Relations
export const ${featureName}Relations = relations(${featureName}, ({ one, many }) => ({
  user: one(users, {
    fields: [${featureName}.userId],
    references: [users.id],
  }),
  ${generateRelations(featureName)}
}));

// History/audit table if needed
export const ${featureName}History = pgTable('${feature_name}_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  ${featureName}Id: uuid('${feature_name}_id').references(() => ${featureName}.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  action: text('action', { enum: ['created', 'updated', 'deleted', 'triggered'] }).notNull(),
  changes: jsonb('changes').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  ${featureName}Idx: index('${feature_name}_history_${feature_name}_idx').on(table.${featureName}Id),
  createdIdx: index('${feature_name}_history_created_idx').on(table.createdAt),
}));

// Types
export type ${FeatureName} = typeof ${featureName}.$inferSelect;
export type New${FeatureName} = typeof ${featureName}.$inferInsert;
export type ${FeatureName}History = typeof ${featureName}History.$inferSelect;
EOF

# Add to main schema index
echo "export * from './${featureName}';" >> apps/api/src/database/schema/index.ts
```

3. Create the API module structure:

```bash
# Create module directory
mkdir -p apps/api/src/${featureName}/{dto,entities,guards}

# Create DTOs
cat > apps/api/src/${featureName}/dto/create-${featureName}.dto.ts << 'EOF'
import { IsString, IsNumber, IsOptional, IsBoolean, IsUUID, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Create${FeatureName}Dto {
  ${generateDtoFields(featureDescription)}

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class Update${FeatureName}Dto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  ${generateOptionalDtoFields(featureDescription)}

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ${FeatureName}FilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  ${generateFilterDtoFields(featureDescription)}
}

export class ${FeatureName}ResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  ${generateResponseDtoFields(featureDescription)}

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
EOF
```

4. Create the service:

```typescript
cat > apps/api/src/${featureName}/${featureName}.service.ts << 'EOF'
import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { and, eq, desc, sql, gte, lte } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import { Database } from '@/database/database.service';
import { ${featureName}, ${featureName}History } from '@/database/schema';
import { Create${FeatureName}Dto, Update${FeatureName}Dto, ${FeatureName}FilterDto } from './dto/create-${featureName}.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ${FeatureName}Service {
  constructor(
    @Inject('DB') private readonly db: Database,
    @InjectQueue('${featureName}-processor') private readonly ${featureName}Queue: Queue,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(${FeatureName}Service.name);
  }

  async create(userId: string, dto: Create${FeatureName}Dto) {
    this.logger.info({ userId, dto }, 'Creating ${featureName}');

    try {
      const [created] = await this.db.transaction(async (tx) => {
        // Create the main record
        const [record] = await tx
          .insert(${featureName})
          .values({
            userId,
            ...dto,
          })
          .returning();

        // Create history entry
        await tx.insert(${featureName}History).values({
          ${featureName}Id: record.id,
          userId,
          action: 'created',
          changes: dto,
        });

        return [record];
      });

      // Emit event for other services
      this.eventEmitter.emit('${featureName}.created', {
        ${featureName}: created,
        userId,
      });

      // Queue any async processing
      await this.${featureName}Queue.add('process-new', {
        ${featureName}Id: created.id,
        userId,
      });

      return created;
    } catch (error) {
      this.logger.error({ err: error, userId, dto }, 'Failed to create ${featureName}');
      throw new BadRequestException('Failed to create ${featureName}');
    }
  }

  async findAll(filters: ${FeatureName}FilterDto, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    try {
      const conditions = this.buildFilterConditions(filters);

      const [items, [{ count }]] = await Promise.all([
        this.db
          .select()
          .from(${featureName})
          .where(conditions)
          .orderBy(desc(${featureName}.createdAt))
          .limit(limit)
          .offset(offset),
        this.db
          .select({ count: sql<number>\`count(*)\` })
          .from(${featureName})
          .where(conditions),
      ]);

      return {
        items,
        total: Number(count),
        page,
        pageSize: limit,
        totalPages: Math.ceil(Number(count) / limit),
      };
    } catch (error) {
      this.logger.error({ err: error, filters }, 'Failed to find ${featureName}s');
      throw error;
    }
  }

  async findOne(id: string, userId?: string) {
    const conditions = [
      eq(${featureName}.id, id),
      userId ? eq(${featureName}.userId, userId) : undefined,
    ].filter(Boolean);

    const [record] = await this.db
      .select()
      .from(${featureName})
      .where(and(...conditions));

    if (!record) {
      throw new NotFoundException('${FeatureName} not found');
    }

    return record;
  }

  async update(id: string, userId: string, dto: Update${FeatureName}Dto) {
    this.logger.info({ id, userId, dto }, 'Updating ${featureName}');

    try {
      const existing = await this.findOne(id, userId);

      const [updated] = await this.db.transaction(async (tx) => {
        const [record] = await tx
          .update(${featureName})
          .set({
            ...dto,
            updatedAt: new Date(),
          })
          .where(and(
            eq(${featureName}.id, id),
            eq(${featureName}.userId, userId),
          ))
          .returning();

        // Track changes
        const changes = Object.entries(dto).reduce((acc, [key, value]) => {
          if (existing[key] !== value) {
            acc[key] = { old: existing[key], new: value };
          }
          return acc;
        }, {});

        if (Object.keys(changes).length > 0) {
          await tx.insert(${featureName}History).values({
            ${featureName}Id: id,
            userId,
            action: 'updated',
            changes,
          });
        }

        return [record];
      });

      // Emit update event
      this.eventEmitter.emit('${featureName}.updated', {
        ${featureName}: updated,
        userId,
        changes: dto,
      });

      return updated;
    } catch (error) {
      this.logger.error({ err: error, id, userId, dto }, 'Failed to update ${featureName}');
      throw error;
    }
  }

  async delete(id: string, userId: string) {
    this.logger.info({ id, userId }, 'Deleting ${featureName}');

    try {
      await this.findOne(id, userId);

      await this.db.transaction(async (tx) => {
        // Soft delete
        await tx
          .update(${featureName})
          .set({
            deletedAt: new Date(),
            isActive: false,
          })
          .where(and(
            eq(${featureName}.id, id),
            eq(${featureName}.userId, userId),
          ));

        // Record deletion
        await tx.insert(${featureName}History).values({
          ${featureName}Id: id,
          userId,
          action: 'deleted',
        });
      });

      // Emit deletion event
      this.eventEmitter.emit('${featureName}.deleted', {
        ${featureName}Id: id,
        userId,
      });

      return { success: true };
    } catch (error) {
      this.logger.error({ err: error, id, userId }, 'Failed to delete ${featureName}');
      throw error;
    }
  }

  private buildFilterConditions(filters: ${FeatureName}FilterDto) {
    const conditions = [];

    if (filters.userId) {
      conditions.push(eq(${featureName}.userId, filters.userId));
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(${featureName}.isActive, filters.isActive));
    }

    ${generateFilterConditions(featureName)}

    // Exclude soft deleted
    conditions.push(sql\`\${${featureName}.deletedAt} IS NULL\`);

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  // Feature-specific methods
  ${generateFeatureSpecificMethods(featureName, featureDescription)}
}
EOF
```

5. Create the controller:

```typescript
cat > apps/api/src/${featureName}/${featureName}.controller.ts << 'EOF'
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ${FeatureName}Service } from './${featureName}.service';
import {
  Create${FeatureName}Dto,
  Update${FeatureName}Dto,
  ${FeatureName}FilterDto,
  ${FeatureName}ResponseDto,
} from './dto/create-${featureName}.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';

@ApiTags('${featureName}')
@Controller('${featureName}')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ${FeatureName}Controller {
  constructor(private readonly ${featureName}Service: ${FeatureName}Service) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ${featureName}' })
  @ApiResponse({
    status: 201,
    description: '${FeatureName} created successfully',
    type: ${FeatureName}ResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(
    @CurrentUser() user: any,
    @Body() dto: Create${FeatureName}Dto,
  ) {
    return this.${featureName}Service.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List ${featureName}s' })
  @ApiQuery({ type: ${FeatureName}FilterDto })
  @ApiQuery({ type: PaginationDto })
  @ApiResponse({
    status: 200,
    description: 'List of ${featureName}s',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/${FeatureName}ResponseDto' } },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  async findAll(
    @CurrentUser() user: any,
    @Query() filters: ${FeatureName}FilterDto,
    @Query() pagination: PaginationDto,
  ) {
    // Users can only see their own items unless admin
    if (user.role !== 'admin') {
      filters.userId = user.id;
    }
    
    return this.${featureName}Service.findAll(filters, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ${featureName} by ID' })
  @ApiResponse({
    status: 200,
    description: '${FeatureName} details',
    type: ${FeatureName}ResponseDto,
  })
  @ApiResponse({ status: 404, description: '${FeatureName} not found' })
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    // Users can only see their own items unless admin
    const userId = user.role === 'admin' ? undefined : user.id;
    return this.${featureName}Service.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a ${featureName}' })
  @ApiResponse({
    status: 200,
    description: '${FeatureName} updated successfully',
    type: ${FeatureName}ResponseDto,
  })
  @ApiResponse({ status: 404, description: '${FeatureName} not found' })
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: Update${FeatureName}Dto,
  ) {
    return this.${featureName}Service.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a ${featureName}' })
  @ApiResponse({ status: 204, description: '${FeatureName} deleted successfully' })
  @ApiResponse({ status: 404, description: '${FeatureName} not found' })
  async remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.${featureName}Service.delete(id, user.id);
  }

  // Feature-specific endpoints
  ${generateFeatureSpecificEndpoints(featureName, featureDescription)}
}
EOF
```

6. Create the module:

```typescript
cat > apps/api/src/${featureName}/${featureName}.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ${FeatureName}Service } from './${featureName}.service';
import { ${FeatureName}Controller } from './${featureName}.controller';
import { ${FeatureName}Processor } from './${featureName}.processor';
import { DatabaseModule } from '@/database/database.module';
import { ${FeatureName}Gateway } from './${featureName}.gateway';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: '${featureName}-processor',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [${FeatureName}Controller],
  providers: [${FeatureName}Service, ${FeatureName}Processor, ${FeatureName}Gateway],
  exports: [${FeatureName}Service],
})
export class ${FeatureName}Module {}
EOF
```

7. Create the job processor:

```typescript
cat > apps/api/src/${featureName}/${featureName}.processor.ts << 'EOF'
import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { PinoLogger } from 'nestjs-pino';
import { ${FeatureName}Service } from './${featureName}.service';

@Injectable()
@Processor('${featureName}-processor')
export class ${FeatureName}Processor {
  constructor(
    private readonly ${featureName}Service: ${FeatureName}Service,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(${FeatureName}Processor.name);
  }

  @Process('process-new')
  async handleNewProcess(job: Job<{ ${featureName}Id: string; userId: string }>) {
    const { ${featureName}Id, userId } = job.data;
    
    this.logger.info({ ${featureName}Id, userId }, 'Processing new ${featureName}');
    
    try {
      // Implement async processing logic
      ${generateProcessorLogic(featureName, featureDescription)}
      
      this.logger.info({ ${featureName}Id }, '${FeatureName} processed successfully');
    } catch (error) {
      this.logger.error({ err: error, ${featureName}Id }, 'Failed to process ${featureName}');
      throw error;
    }
  }

  ${generateAdditionalProcessors(featureName, featureDescription)}
}
EOF
```

8. Create WebSocket gateway for real-time updates:

```typescript
cat > apps/api/src/${featureName}/${featureName}.gateway.ts << 'EOF'
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '@/auth/guards/ws-jwt.guard';
import { OnEvent } from '@nestjs/event-emitter';
import { PinoLogger } from 'nestjs-pino';

@WebSocketGateway({
  namespace: '${featureName}',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5174',
    credentials: true,
  },
})
export class ${FeatureName}Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(${FeatureName}Gateway.name);
  }

  handleConnection(client: Socket) {
    this.logger.info({ clientId: client.id }, 'Client connected to ${featureName}');
  }

  handleDisconnect(client: Socket) {
    this.logger.info({ clientId: client.id }, 'Client disconnected from ${featureName}');
    
    // Clean up user socket mapping
    for (const [userId, sockets] of this.userSockets.entries()) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const { userId } = data;
    
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(client.id);
    
    client.join(\`user:\${userId}\`);
    
    return { subscribed: true, userId };
  }

  @OnEvent('${featureName}.created')
  handleCreated(payload: { ${featureName}: any; userId: string }) {
    this.server.to(\`user:\${payload.userId}\`).emit('created', payload.${featureName});
  }

  @OnEvent('${featureName}.updated')
  handleUpdated(payload: { ${featureName}: any; userId: string; changes: any }) {
    this.server.to(\`user:\${payload.userId}\`).emit('updated', {
      ${featureName}: payload.${featureName},
      changes: payload.changes,
    });
  }

  @OnEvent('${featureName}.deleted')
  handleDeleted(payload: { ${featureName}Id: string; userId: string }) {
    this.server.to(\`user:\${payload.userId}\`).emit('deleted', {
      ${featureName}Id: payload.${featureName}Id,
    });
  }

  ${generateWebSocketHandlers(featureName, featureDescription)}
}
EOF
```

9. Create React components:

```bash
# Create component directory
mkdir -p apps/web/src/components/${featureName}

# Create main component
cat > apps/web/src/components/${featureName}/${FeatureName}List.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ${FeatureName}CreateDialog } from './${FeatureName}CreateDialog';
import { ${FeatureName}EditDialog } from './${FeatureName}EditDialog';
import { api } from '@/lib/api';
import { format } from 'date-fns';

interface ${FeatureName} {
  id: string;
  ${generateTypeScriptInterface(featureName, featureDescription)}
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function ${FeatureName}List() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected${FeatureName}, setSelected${FeatureName}] = useState<${FeatureName} | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch ${featureName}s
  const { data, isLoading, error } = useQuery({
    queryKey: ['${featureName}s'],
    queryFn: async () => {
      const response = await api.get('/${featureName}');
      return response.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(\`/${featureName}/\${id}\`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['${featureName}s'] });
      toast({
        title: 'Success',
        description: '${FeatureName} deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete ${featureName}',
        variant: 'destructive',
      });
    },
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const socket = api.connectWebSocket('${featureName}');

    socket.on('created', (new${FeatureName}: ${FeatureName}) => {
      queryClient.setQueryData(['${featureName}s'], (old: any) => ({
        ...old,
        items: [new${FeatureName}, ...(old?.items || [])],
        total: (old?.total || 0) + 1,
      }));
    });

    socket.on('updated', ({ ${featureName}, changes }: any) => {
      queryClient.setQueryData(['${featureName}s'], (old: any) => ({
        ...old,
        items: old?.items?.map((item: ${FeatureName}) =>
          item.id === ${featureName}.id ? ${featureName} : item
        ) || [],
      }));
    });

    socket.on('deleted', ({ ${featureName}Id }: any) => {
      queryClient.setQueryData(['${featureName}s'], (old: any) => ({
        ...old,
        items: old?.items?.filter((item: ${FeatureName}) => item.id !== ${featureName}Id) || [],
        total: Math.max((old?.total || 0) - 1, 0),
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-destructive">
            Failed to load ${featureName}s. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleEdit = (${featureName}: ${FeatureName}) => {
    setSelected${FeatureName}(${featureName});
    setEditOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this ${featureName}?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>${FeatureName}s</CardTitle>
              <CardDescription>
                ${featureDescription}
              </CardDescription>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create ${FeatureName}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data?.items?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No ${featureName}s found. Create your first one!
              </p>
              <Button onClick={() => setCreateOpen(true)} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create ${FeatureName}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  ${generateTableHeaders(featureName, featureDescription)}
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items?.map((item: ${FeatureName}) => (
                  <TableRow key={item.id}>
                    ${generateTableCells(featureName, featureDescription)}
                    <TableCell>
                      <Badge variant={item.isActive ? 'default' : 'secondary'}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(item.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <${FeatureName}CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <${FeatureName}EditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        ${featureName}={selected${FeatureName}}
      />
    </>
  );
}
EOF
```

10. Create dialogs for create/edit:

```typescript
cat > apps/web/src/components/${featureName}/${FeatureName}CreateDialog.tsx << 'EOF'
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';

const ${featureName}Schema = z.object({
  ${generateZodSchema(featureName, featureDescription)}
});

type ${FeatureName}FormData = z.infer<typeof ${featureName}Schema>;

interface ${FeatureName}CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ${FeatureName}CreateDialog({
  open,
  onOpenChange,
}: ${FeatureName}CreateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<${FeatureName}FormData>({
    resolver: zodResolver(${featureName}Schema),
    defaultValues: {
      ${generateDefaultValues(featureName, featureDescription)}
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ${FeatureName}FormData) => {
      const response = await api.post('/${featureName}', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['${featureName}s'] });
      toast({
        title: 'Success',
        description: '${FeatureName} created successfully',
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create ${featureName}',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ${FeatureName}FormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create ${FeatureName}</DialogTitle>
          <DialogDescription>
            ${featureDescription}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            ${generateFormFields(featureName, featureDescription)}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
EOF
```

11. Add to app module:

```bash
# Update app.module.ts
cat >> apps/api/src/app.module.ts << EOF

// Add to imports
import { ${FeatureName}Module } from './${featureName}/${featureName}.module';

// Add to imports array
${FeatureName}Module,
EOF
```

12. Run migrations:

```bash
cd apps/api
pnpm db:generate
pnpm db:migrate
```

13. Create tests:

```bash
# Service tests
cat > apps/api/src/${featureName}/${featureName}.service.spec.ts << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { ${FeatureName}Service } from './${featureName}.service';
import { Database } from '@/database/database.service';
import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PinoLogger } from 'nestjs-pino';

describe('${FeatureName}Service', () => {
  let service: ${FeatureName}Service;
  let mockDb: jest.Mocked<Database>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ${FeatureName}Service,
        {
          provide: 'DB',
          useValue: {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            values: jest.fn().mockReturnThis(),
            returning: jest.fn().mockResolvedValue([{ id: '123' }]),
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            transaction: jest.fn().mockImplementation((cb) => cb({
              insert: jest.fn().mockReturnThis(),
              values: jest.fn().mockReturnThis(),
              returning: jest.fn().mockResolvedValue([{ id: '123' }]),
            })),
          },
        },
        {
          provide: getQueueToken('${featureName}-processor'),
          useValue: { add: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<${FeatureName}Service>(${FeatureName}Service);
    mockDb = module.get('DB');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new ${featureName}', async () => {
      const dto = {
        ${generateTestData(featureName, featureDescription)}
      };

      const result = await service.create('user-123', dto);

      expect(result).toEqual({ id: '123' });
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  // Add more tests...
});
EOF

# E2E tests
cat > apps/api/test/${featureName}.e2e-spec.ts << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('${FeatureName}Controller (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'test123' });
    
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/${featureName} (POST)', () => {
    it('should create a new ${featureName}', () => {
      return request(app.getHttpServer())
        .post('/${featureName}')
        .set('Authorization', \`Bearer \${authToken}\`)
        .send({
          ${generateTestData(featureName, featureDescription)}
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.isActive).toBe(true);
        });
    });
  });

  // Add more e2e tests...
});
EOF
```

14. Add routes to frontend:

```bash
# Update router
cat >> apps/web/src/router/index.tsx << EOF

// Add route
{
  path: '${featureName}',
  element: (
    <ProtectedRoute>
      <${FeatureName}Page />
    </ProtectedRoute>
  ),
},
EOF

# Create page component
cat > apps/web/src/pages/${featureName}/${FeatureName}Page.tsx << 'EOF'
import React from 'react';
import { ${FeatureName}List } from '@/components/${featureName}/${FeatureName}List';

export function ${FeatureName}Page() {
  return (
    <div className="container mx-auto py-6">
      <${FeatureName}List />
    </div>
  );
}
EOF
```

15. Run tests and verify:

```bash
# Backend tests
cd apps/api
pnpm test ${featureName}
pnpm test:e2e ${featureName}

# Check TypeScript
pnpm check-types

# Frontend build
cd apps/web
npm run build

# Start development
cd ../..
pnpm dev

# Open browser
open http://localhost:5174/${featureName}
```

## Helper Functions

The command uses several helper functions to generate code based on the feature description:

```javascript
function generateSchemaFields(description) {
  // Analyzes description to generate appropriate database fields
  // Example: "price alerts" → priceThreshold, serviceCode, etc.
}

function generateDtoFields(description) {
  // Generates DTO validation fields with decorators
}

function generateFormFields(description) {
  // Creates React form fields with proper types
}

function generateProcessorLogic(name, description) {
  // Generates background job processing logic
}

function generateFeatureSpecificMethods(name, description) {
  // Adds feature-specific business logic methods
}
```

## Post-Implementation Checklist

1. ✅ Database schema created and migrated
2. ✅ API endpoints documented in Swagger
3. ✅ Service methods with proper error handling
4. ✅ Background job processing configured
5. ✅ WebSocket real-time updates
6. ✅ React components with forms and tables
7. ✅ Unit and E2E tests
8. ✅ Route added to frontend
9. ✅ TypeScript types generated
10. ✅ Proper authentication and authorization