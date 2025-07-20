import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { users, User, NewUser } from '../database/schema/users';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(and(eq(users.id, id), eq(users.isActive, true))).limit(1);
    return result[0] as User || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(and(eq(users.email, email), eq(users.isActive, true))).limit(1);
    return result[0] as User || null;
  }

  async findByApiKey(apiKey: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(and(eq(users.apiKey, apiKey), eq(users.isActive, true))).limit(1);
    return result[0] as User || null;
  }

  async create(userData: {
    password: string;
    role?: 'user' | 'admin' | 'super_admin';
    email: string;
    firstName?: string;
    lastName?: string;
    apiKey?: string;
  }): Promise<User> {
    const result = await this.db
      .insert(users)
      .values(userData)
      .returning();
    return result[0] as User;
  }

  async updateApiKey(id: string, apiKey: string): Promise<User> {
    const result = await this.db
      .update(users)
      .set({ 
        apiKey,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return result[0] as User;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async findAll(): Promise<User[]> {
    return this.db.select().from(users).where(eq(users.isActive, true));
  }

  async deactivate(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }
}