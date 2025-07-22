import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { eq, and, or, like, desc, asc, count, sql, inArray } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { 
  users, 
  userProfiles, 
  userPreferences, 
  userActivityLogs, 
  userSessions,
  passwordResetTokens,
  userFiles,
  User,
  UserProfile,
  UserPreferences,
  UserActivityLog,
  UserWithProfile,
  UserListItem
} from '../database/schema';
import * as bcrypt from 'bcrypt';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

export interface UserSearchFilters {
  search?: string;
  role?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  lastLoginAfter?: Date;
  lastLoginBefore?: Date;
}

export interface UserListOptions {
  page?: number;
  limit?: number;
  sortBy?: 'email' | 'firstName' | 'lastName' | 'createdAt' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
  filters?: UserSearchFilters;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  adminUsers: number;
  regularUsers: number;
  newUsersThisMonth: number;
  newUsersThisWeek: number;
}

@Injectable()
export class UserManagementService {
  constructor(
    private readonly databaseService: DatabaseService,
    @InjectPinoLogger(UserManagementService.name)
    private readonly logger: PinoLogger,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  // User CRUD Operations
  async getUserById(id: string): Promise<UserWithProfile | null> {
    const [userResult] = await this.db
      .select()
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .leftJoin(userPreferences, eq(users.id, userPreferences.userId))
      .where(eq(users.id, id))
      .limit(1);

    if (!userResult) {
      return null;
    }

    // Get latest activity
    const [latestActivity] = await this.db
      .select()
      .from(userActivityLogs)
      .where(eq(userActivityLogs.userId, id))
      .orderBy(desc(userActivityLogs.timestamp))
      .limit(1);

    // Get file count
    const [fileCountResult] = await this.db
      .select({ count: count() })
      .from(userFiles)
      .where(and(eq(userFiles.userId, id), eq(userFiles.isActive, true)));

    return {
      user: userResult.users,
      profile: (userResult.user_profiles as UserProfile) || undefined,
      preferences: (userResult.user_preferences as UserPreferences) || undefined,
      lastActivity: (latestActivity as UserActivityLog) || undefined,
      fileCount: fileCountResult?.count || 0,
    };
  }

  async getUserList(options: UserListOptions = {}): Promise<{
    users: UserListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filters = {}
    } = options;

    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [];
    
    if (filters.search) {
      whereConditions.push(
        or(
          like(users.email, `%${filters.search}%`),
          like(users.firstName, `%${filters.search}%`),
          like(users.lastName, `%${filters.search}%`)
        )
      );
    }

    if (filters.role) {
      whereConditions.push(eq(users.role, filters.role));
    }

    if (filters.isActive !== undefined) {
      whereConditions.push(eq(users.isActive, filters.isActive));
    }

    if (filters.emailVerified !== undefined) {
      whereConditions.push(eq(users.emailVerified, filters.emailVerified));
    }

    if (filters.createdAfter) {
      whereConditions.push(sql`${users.createdAt} >= ${filters.createdAfter}`);
    }

    if (filters.createdBefore) {
      whereConditions.push(sql`${users.createdAt} <= ${filters.createdBefore}`);
    }

    if (filters.lastLoginAfter) {
      whereConditions.push(sql`${users.lastLoginAt} >= ${filters.lastLoginAfter}`);
    }

    if (filters.lastLoginBefore) {
      whereConditions.push(sql`${users.lastLoginAt} <= ${filters.lastLoginBefore}`);
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    const total = totalResult?.count || 0;

    // Build sort order
    const sortColumn = users[sortBy] || users.createdAt;
    const orderBy = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get users with profiles
    const userResults = await this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        avatarUrl: userProfiles.avatarUrl,
        company: userProfiles.company,
        jobTitle: userProfiles.jobTitle,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get activity counts for each user
    const userIds = userResults.map(u => u.id);
    const activityCounts = userIds.length > 0 ? await this.db
      .select({
        userId: userActivityLogs.userId,
        count: count()
      })
      .from(userActivityLogs)
      .where(inArray(userActivityLogs.userId, userIds))
      .groupBy(userActivityLogs.userId) : [];

    const activityCountMap = new Map(
      activityCounts.map(ac => [ac.userId, ac.count])
    );

    const userList: UserListItem[] = userResults.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt || undefined,
      createdAt: user.createdAt,
      profile: {
        avatarUrl: user.avatarUrl || undefined,
        company: user.company || undefined,
        jobTitle: user.jobTitle || undefined,
      },
      activityCount: activityCountMap.get(user.id) || 0,
    }));

    return {
      users: userList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User> {
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Remove sensitive fields that shouldn't be updated directly
    const { password, apiKey, id: _, ...rawUpdateData } = updateData;

    // Type-safe update data
    const safeUpdateData: any = {};
    if (rawUpdateData.email !== undefined) safeUpdateData.email = rawUpdateData.email;
    if (rawUpdateData.firstName !== undefined) safeUpdateData.firstName = rawUpdateData.firstName;
    if (rawUpdateData.lastName !== undefined) safeUpdateData.lastName = rawUpdateData.lastName;
    if (rawUpdateData.role !== undefined) safeUpdateData.role = rawUpdateData.role;
    if (rawUpdateData.isActive !== undefined) safeUpdateData.isActive = rawUpdateData.isActive;
    if (rawUpdateData.emailVerified !== undefined) safeUpdateData.emailVerified = rawUpdateData.emailVerified;
    if (rawUpdateData.emailVerifiedAt !== undefined) safeUpdateData.emailVerifiedAt = rawUpdateData.emailVerifiedAt;
    if (rawUpdateData.lastLoginAt !== undefined) safeUpdateData.lastLoginAt = rawUpdateData.lastLoginAt;

    const [updatedUser] = await this.db
      .update(users)
      .set({
        ...safeUpdateData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    this.logger.info({
      msg: 'User updated',
      userId: id,
      updatedFields: Object.keys(safeUpdateData),
    });

    return updatedUser;
  }

  async updateUserRole(id: string, newRole: string, updatedBy: string): Promise<User> {
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const [updatedUser] = await this.db
      .update(users)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    // Log the role change
    await this.logActivity({
      userId: updatedBy,
      action: 'role_change',
      resourceType: 'user',
      resourceId: id,
      metadata: {
        oldRole: existingUser.user.role,
        newRole,
        targetUserId: id,
      },
    });

    this.logger.info({
      msg: 'User role updated',
      userId: id,
      oldRole: existingUser.user.role,
      newRole,
      updatedBy,
    });

    return updatedUser;
  }

  async activateUser(id: string, activatedBy: string): Promise<User> {
    return this.updateUserStatus(id, true, activatedBy);
  }

  async deactivateUser(id: string, deactivatedBy: string): Promise<User> {
    return this.updateUserStatus(id, false, deactivatedBy);
  }

  private async updateUserStatus(id: string, isActive: boolean, updatedBy: string): Promise<User> {
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const [updatedUser] = await this.db
      .update(users)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    // Log the status change
    await this.logActivity({
      userId: updatedBy,
      action: isActive ? 'user_activated' : 'user_deactivated',
      resourceType: 'user',
      resourceId: id,
      metadata: {
        targetUserId: id,
        previousStatus: existingUser.user.isActive,
        newStatus: isActive,
      },
    });

    this.logger.info({
      msg: `User ${isActive ? 'activated' : 'deactivated'}`,
      userId: id,
      updatedBy,
    });

    return updatedUser;
  }

  // Activity Logging
  async logActivity(activityData: {
    userId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
    success?: boolean;
    errorMessage?: string;
  }): Promise<UserActivityLog> {
    const [activity] = await this.db
      .insert(userActivityLogs)
      .values({
        ...activityData,
        metadata: activityData.metadata ? JSON.stringify(activityData.metadata) : null,
        timestamp: new Date(),
      })
      .returning();

    return activity as UserActivityLog;
  }

  async getUserActivity(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<UserActivityLog[]> {
    const { limit = 50, offset = 0 } = options;

    const activities = await this.db
      .select()
      .from(userActivityLogs)
      .where(eq(userActivityLogs.userId, userId))
      .orderBy(desc(userActivityLogs.timestamp))
      .limit(limit)
      .offset(offset);

    return activities as UserActivityLog[];
  }

  async getUserActivityCount(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(userActivityLogs)
      .where(eq(userActivityLogs.userId, userId));

    return result?.count || 0;
  }

  async getUserActivityPaginated(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ activities: UserActivityLog[]; total: number }> {
    const { limit = 10, offset = 0 } = options;
    
    // Get activities
    const activities = await this.db
      .select()
      .from(userActivityLogs)
      .where(eq(userActivityLogs.userId, userId))
      .orderBy(desc(userActivityLogs.timestamp))
      .limit(limit)
      .offset(offset);
    
    // Get total count
    const total = await this.getUserActivityCount(userId);
    
    return {
      activities: activities as UserActivityLog[],
      total,
    };
  }

  // User Files
  async getUserFiles(userId: string): Promise<any[]> {
    const files = await this.db
      .select()
      .from(userFiles)
      .where(and(eq(userFiles.userId, userId), eq(userFiles.isActive, true)))
      .orderBy(desc(userFiles.uploadedAt));

    return files.map(file => ({
      id: file.id,
      fileName: file.fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      filePath: file.filePath,
      uploadedAt: file.uploadedAt,
      fileType: file.fileType,
      metadata: file.metadata ? JSON.parse(file.metadata as string) : null,
    }));
  }

  // User Statistics
  async getUserStats(): Promise<UserStats> {
    try {
      this.logger.info('Starting getUserStats');

      // Test basic query first
      const totalUsersResult = await this.db.select({ count: count() }).from(users);
      const totalUsers = totalUsersResult[0]?.count || 0;
      this.logger.info({ totalUsers }, 'Total users query successful');

      // Test active users query
      const activeUsersResult = await this.db.select({ count: count() }).from(users).where(eq(users.isActive, true));
      const activeUsers = activeUsersResult[0]?.count || 0;
      this.logger.info({ activeUsers }, 'Active users query successful');

      // Test verified users query
      const verifiedUsersResult = await this.db.select({ count: count() }).from(users).where(eq(users.emailVerified, true));
      const verifiedUsers = verifiedUsersResult[0]?.count || 0;
      this.logger.info({ verifiedUsers }, 'Verified users query successful');

      // Test admin users query with simpler approach
      const adminUsersResult = await this.db.select({ count: count() }).from(users).where(eq(users.role, 'admin'));
      const adminUsers = adminUsersResult[0]?.count || 0;
      this.logger.info({ adminUsers }, 'Admin users query successful');

      // For now, return simplified stats without date queries
      const result = {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        verifiedUsers,
        unverifiedUsers: totalUsers - verifiedUsers,
        adminUsers,
        regularUsers: totalUsers - adminUsers,
        newUsersThisMonth: 0, // Temporarily disabled
        newUsersThisWeek: 0,  // Temporarily disabled
      };

      this.logger.info(result, 'getUserStats completed successfully');
      return result;
    } catch (error) {
      this.logger.error({ error: error.message, stack: error.stack }, 'getUserStats failed');
      throw error;
    }
  }
}
