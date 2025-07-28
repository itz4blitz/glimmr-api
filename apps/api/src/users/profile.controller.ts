import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ProfileService,
  ProfileUpdateData,
  PreferencesUpdateData,
} from "./profile.service";
import { UserManagementService } from "./user-management.service";

// DTOs for API documentation and validation
export class UpdateProfileDto implements ProfileUpdateData {
  bio?: string;
  phoneNumber?: string;
  timezone?: string;
  languagePreference?: string;
  dateOfBirth?: Date;
  company?: string;
  jobTitle?: string;
  city?: string;
  country?: string;
  website?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
}

export class UpdatePreferencesDto implements PreferencesUpdateData {
  notificationEmail?: boolean;
  notificationPush?: boolean;
  notificationSms?: boolean;
  themePreference?: string;
  languagePreference?: string;
  timezonePreference?: string;
  dateFormat?: string;
  timeFormat?: string;
  privacySettings?: Record<string, unknown>;
  dashboardLayout?: Record<string, unknown>;
}

@ApiTags("User Profile")
@ApiBearerAuth()
@Controller("profile")
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly userManagementService: UserManagementService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "Profile retrieved successfully" })
  async getCurrentUserProfile(@Request() req: Express.Request & { user: { id: string } }) {
    const userId = req.user.id;
    const profileData = await this.profileService.getUserProfile(userId);

    // Log activity
    await this.userManagementService.logActivity({
      userId,
      action: "profile_view",
      resourceType: "profile",
      resourceId: userId,
    });

    return profileData;
  }

  @Put()
  @ApiOperation({ summary: "Update current user profile" })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  async updateCurrentUserProfile(
    @Request() req: Express.Request & { user: { id: string } },
    @Body() profileData: UpdateProfileDto,
  ) {
    const userId = req.user.id;
    const updatedProfile = await this.profileService.createOrUpdateProfile(
      userId,
      profileData,
    );

    // Log activity
    await this.userManagementService.logActivity({
      userId,
      action: "profile_update",
      resourceType: "profile",
      resourceId: userId,
      metadata: {
        updatedFields: Object.keys(profileData),
      },
    });

    return updatedProfile;
  }

  @Get("preferences")
  @ApiOperation({ summary: "Get current user preferences" })
  @ApiResponse({
    status: 200,
    description: "Preferences retrieved successfully",
  })
  async getCurrentUserPreferences(@Request() req: Express.Request & { user: { id: string } }) {
    const userId = req.user.id;
    const { preferences } = await this.profileService.getUserProfile(userId);

    return preferences;
  }

  @Put("preferences")
  @ApiOperation({ summary: "Update current user preferences" })
  @ApiResponse({ status: 200, description: "Preferences updated successfully" })
  async updateCurrentUserPreferences(
    @Request() req: Express.Request & { user: { id: string } },
    @Body() preferencesData: UpdatePreferencesDto,
  ) {
    const userId = req.user.id;
    const updatedPreferences =
      await this.profileService.createOrUpdatePreferences(
        userId,
        preferencesData,
      );

    // Log activity
    await this.userManagementService.logActivity({
      userId,
      action: "preferences_update",
      resourceType: "preferences",
      resourceId: userId,
      metadata: {
        updatedFields: Object.keys(preferencesData),
      },
    });

    return updatedPreferences;
  }

  @Post("avatar")
  @UseInterceptors(FileInterceptor("avatar"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload user avatar" })
  @ApiResponse({ status: 201, description: "Avatar uploaded successfully" })
  @ApiResponse({ status: 400, description: "Invalid file or file too large" })
  async uploadAvatar(@Request() req: Express.Request & { user: { id: string } }, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    const userId = req.user.id;
    const uploadedFile = await this.profileService.uploadFile(userId, {
      originalName: file.originalname,
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileType: "avatar",
    });

    // Log activity
    await this.userManagementService.logActivity({
      userId,
      action: "avatar_upload",
      resourceType: "file",
      resourceId: uploadedFile.id as string,
      metadata: {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    return {
      success: true,
      file: uploadedFile,
      avatarUrl: `/api/v1/users/files/${uploadedFile.id}`,
    };
  }

  @Delete("avatar")
  @ApiOperation({ summary: "Remove user avatar" })
  @ApiResponse({ status: 200, description: "Avatar removed successfully" })
  async removeAvatar(@Request() req: Express.Request & { user: { id: string } }) {
    const userId = req.user.id;

    // Get current avatar
    const avatarFiles = await this.profileService.getUserFiles(
      userId,
      "avatar",
    );
    const currentAvatar = avatarFiles.find((f) => f.isActive);

    if (currentAvatar) {
      await this.profileService.deleteFile(userId, currentAvatar.id as string);

      // Log activity
      await this.userManagementService.logActivity({
        userId,
        action: "avatar_remove",
        resourceType: "file",
        resourceId: currentAvatar.id as string,
      });
    }

    return { success: true, message: "Avatar removed successfully" };
  }

  @Get("files")
  @ApiOperation({ summary: "Get user files" })
  @ApiResponse({ status: 200, description: "Files retrieved successfully" })
  async getUserFiles(@Request() req: Express.Request & { user: { id: string } }) {
    const userId = req.user.id;
    const files = await this.profileService.getUserFiles(userId);

    return files.map((file) => ({
      ...file,
      url: `/api/v1/users/files/${file.id}`,
    }));
  }

  @Post("files")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload user document" })
  @ApiResponse({ status: 201, description: "File uploaded successfully" })
  @ApiResponse({ status: 400, description: "Invalid file or file too large" })
  async uploadFile(@Request() req: Express.Request & { user: { id: string } }, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    const userId = req.user.id;
    const uploadedFile = await this.profileService.uploadFile(userId, {
      originalName: file.originalname,
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileType: "document",
    });

    // Log activity
    await this.userManagementService.logActivity({
      userId,
      action: "file_upload",
      resourceType: "file",
      resourceId: uploadedFile.id as string,
      metadata: {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    return {
      success: true,
      file: uploadedFile,
      fileUrl: `/api/v1/users/files/${uploadedFile.id}`,
    };
  }

  @Delete("files/:fileId")
  @ApiOperation({ summary: "Delete user file" })
  @ApiResponse({ status: 200, description: "File deleted successfully" })
  @ApiResponse({ status: 404, description: "File not found" })
  async deleteFile(
    @Request() req: Express.Request & { user: { id: string } },
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ) {
    const userId = req.user.id;
    await this.profileService.deleteFile(userId, fileId);

    // Log activity
    await this.userManagementService.logActivity({
      userId,
      action: "file_delete",
      resourceType: "file",
      resourceId: fileId,
    });

    return { success: true, message: "File deleted successfully" };
  }

  @Get("activity")
  @ApiOperation({ summary: "Get current user activity log" })
  @ApiResponse({
    status: 200,
    description: "Activity log retrieved successfully",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 10, max: 100)",
  })
  async getCurrentUserActivity(
    @Request() req: Express.Request & { user: { id: string } },
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const userId = req.user.id;

    // Ensure limit is reasonable
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const offset = (Math.max(1, page) - 1) * safeLimit;

    const { activities, total } =
      await this.userManagementService.getUserActivityPaginated(userId, {
        limit: safeLimit,
        offset,
      });

    return {
      activities,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }
}
