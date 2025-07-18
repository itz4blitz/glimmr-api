import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as bcrypt from 'bcrypt';
import { users } from '../schema/users';

async function seedAdminUser() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Check if admin user already exists
    const existingAdmin = await db.select().from(users).where(eq(users.username, adminUsername)).limit(1);
    
    if (existingAdmin.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const [admin] = await db
      .insert(users)
      .values({
        username: adminUsername,
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log('Admin user created successfully:', {
      id: admin.id,
      username: admin.username,
      role: admin.role,
    });

    console.log('\n=== ADMIN CREDENTIALS ===');
    console.log(`Username: ${adminUsername}`);
    console.log(`Password: ${adminPassword}`);
    console.log('========================\n');

  } catch (error) {
    console.error('Error seeding admin user:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  seedAdminUser()
    .then(() => {
      console.log('Admin user seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Admin user seeding failed:', error);
      process.exit(1);
    });
}

export { seedAdminUser };