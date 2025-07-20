import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UserManagementService } from './user-management.service';
import { ProfileService } from './profile.service';
import { UserManagementController } from './user-management.controller';
import { ProfileController } from './profile.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  ],
  controllers: [UserManagementController, ProfileController],
  providers: [UsersService, UserManagementService, ProfileService],
  exports: [UsersService, UserManagementService, ProfileService],
})
export class UsersModule {}