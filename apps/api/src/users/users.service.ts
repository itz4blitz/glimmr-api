import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { users, User, NewUser } from '../database/schema/users';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DatabaseService) private db: NodePgDatabase<any>,
  ) {}

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] as User || null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] as User || null;
  }

  async findByApiKey(apiKey: string): Promise<User | null> {
    const result = await this.db.select().from(users).where(eq(users.apiKey, apiKey)).limit(1);
    return result[0] as User || null;
  }

  async create(userData: { username: string; password: string; role: 'admin' | 'api-user'; apiKey?: string }): Promise<User> {
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

  async findAll(): Promise<User[]> {
    return this.db.select().from(users);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }
}