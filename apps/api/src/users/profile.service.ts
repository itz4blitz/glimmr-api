import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { eq, and, desc } from "drizzle-orm";
import { DatabaseService } from "../database/database.service";
import {
  users,
  userProfiles,
  userPreferences,
  userFiles,
  UserProfile,
  UserPreferences,
  UserFile,
} from "../database/schema";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import * as path from "path";
import * as fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

export interface ProfileUpdateData {
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
  avatarUrl?: string | null;
}

export interface PreferencesUpdateData {
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

export interface FileUploadData {
  originalName: string;
  buffer: Buffer;
  mimeType: string;
  fileType: "avatar" | "document";
}

@Injectable()
export class ProfileService {
  private readonly uploadDir = process.env.UPLOAD_DIR || "./uploads";
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  constructor(
    private readonly databaseService: DatabaseService,
    @InjectPinoLogger(ProfileService.name)
    private readonly logger: PinoLogger,
  ) {
    this.ensureUploadDir();
  }

  private get db() {
    return this.databaseService.db;
  }

  private async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, "avatars"), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, "documents"), {
        recursive: true,
      });
    } catch (_error) {
      this.logger.error({
        msg: "Failed to create upload directories",
        error: _error instanceof Error ? (_error as Error).message : String(_error),
      });
    }
  }

  // Profile Management
  async getUserProfile(userId: string): Promise<{
    profile: UserProfile | null;
    preferences: UserPreferences | null;
  }> {
    const [profileResult] = await this.db
      .select()
      .from(userProfiles)
      .leftJoin(
        userPreferences,
        eq(userProfiles.userId, userPreferences.userId),
      )
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (!profileResult) {
      // Check if user exists
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new NotFoundException("User not found");
      }

      return {
        profile: null,
        preferences: null,
      };
    }

    return {
      profile: profileResult.user_profiles as UserProfile,
      preferences: (profileResult.user_preferences ||
        null) as UserPreferences | null,
    };
  }

  async createOrUpdateProfile(
    userId: string,
    profileData: ProfileUpdateData,
  ): Promise<UserProfile> {
    // Check if user exists
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Check if profile exists
    const [existingProfile] = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (existingProfile) {
      // Update existing profile
      const [updatedProfile] = await this.db
        .update(userProfiles)
        .set({
          ...profileData,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId))
        .returning();

      this.logger.info({
        msg: "User profile updated",
        userId,
        updatedFields: Object.keys(profileData),
      });

      return updatedProfile;
    } else {
      // Create new profile
      const [newProfile] = await this.db
        .insert(userProfiles)
        .values({
          userId,
          ...profileData,
        })
        .returning();

      this.logger.info({
        msg: "User profile created",
        userId,
      });

      return newProfile;
    }
  }

  async createOrUpdatePreferences(
    userId: string,
    preferencesData: PreferencesUpdateData,
  ): Promise<UserPreferences> {
    // Check if user exists
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Check if preferences exist
    const [existingPreferences] = await this.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existingPreferences) {
      // Update existing preferences
      const [updatedPreferences] = await this.db
        .update(userPreferences)
        .set({
          ...preferencesData,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId))
        .returning();

      this.logger.info({
        msg: "User preferences updated",
        userId,
        updatedFields: Object.keys(preferencesData),
      });

      return updatedPreferences as UserPreferences;
    } else {
      // Create new preferences
      const [newPreferences] = await this.db
        .insert(userPreferences)
        .values({
          userId,
          ...preferencesData,
        })
        .returning();

      this.logger.info({
        msg: "User preferences created",
        userId,
      });

      return newPreferences as UserPreferences;
    }
  }

  // File Management
  async uploadFile(
    userId: string,
    fileData: FileUploadData,
  ): Promise<UserFile> {
    // Validate file
    this.validateFile(fileData);

    // Generate unique filename
    const fileExtension = path.extname(fileData.originalName);
    const fileName = `${uuidv4()}${fileExtension}`;
    const subDir = fileData.fileType === "avatar" ? "avatars" : "documents";
    const filePath = path.join(this.uploadDir, subDir, fileName);
    const relativePath = path.join(subDir, fileName);

    try {
      // Save file to disk
      await fs.writeFile(filePath, fileData.buffer);

      // If this is an avatar, deactivate previous avatars
      if (fileData.fileType === "avatar") {
        await this.db
          .update(userFiles)
          .set({ isActive: false })
          .where(
            and(
              eq(userFiles.userId, userId),
              eq(userFiles.fileType, "avatar"),
              eq(userFiles.isActive, true),
            ),
          );
      }

      // Save file record to database
      const [savedFile] = await this.db
        .insert(userFiles)
        .values({
          userId,
          fileType: fileData.fileType,
          originalName: fileData.originalName,
          fileName,
          filePath: relativePath,
          fileSize: fileData.buffer.length,
          mimeType: fileData.mimeType,
        })
        .returning();

      // If this is an avatar, update the profile
      if (fileData.fileType === "avatar") {
        const avatarUrl = `/api/v1/files/${savedFile.id}`;
        await this.createOrUpdateProfile(userId, { avatarUrl });
      }

      this.logger.info({
        msg: "File uploaded successfully",
        userId,
        fileId: savedFile.id,
        fileType: fileData.fileType,
        fileName: fileData.originalName,
        fileSize: fileData.buffer.length,
      });

      return savedFile as UserFile;
    } catch (_error) {
      // Clean up file if database save failed
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        this.logger.error({
          msg: "Failed to clean up file after database error",
          filePath,
          error: unlinkError instanceof Error ? unlinkError.message : String(unlinkError),
        });
      }

      this.logger.error({
        msg: "File upload failed",
        userId,
        error: _error instanceof Error ? (_error as Error).message : String(_error),
      });

      throw new BadRequestException("File upload failed");
    }
  }

  async deleteFile(userId: string, fileId: string): Promise<void> {
    const [file] = await this.db
      .select()
      .from(userFiles)
      .where(
        and(
          eq(userFiles.id, fileId),
          eq(userFiles.userId, userId),
          eq(userFiles.isActive, true),
        ),
      )
      .limit(1);

    if (!file) {
      throw new NotFoundException("File not found");
    }

    // Mark file as inactive
    await this.db
      .update(userFiles)
      .set({ isActive: false })
      .where(eq(userFiles.id, fileId));

    // If this was an avatar, remove from profile
    if (file.fileType === "avatar") {
      await this.createOrUpdateProfile(userId, { avatarUrl: null });
    }

    // Delete physical file
    const fullPath = path.join(this.uploadDir, file.filePath);
    try {
      await fs.unlink(fullPath);
    } catch (_error) {
      this.logger.error({
        msg: "Failed to delete physical file",
        filePath: fullPath,
        error: _error instanceof Error ? (_error as Error).message : String(_error),
      });
    }

    this.logger.info({
      msg: "File deleted successfully",
      userId,
      fileId,
      fileType: file.fileType,
    });
  }

  async getUserFiles(userId: string, fileType?: string): Promise<UserFile[]> {
    const whereConditions = [
      eq(userFiles.userId, userId),
      eq(userFiles.isActive, true),
    ];

    if (fileType) {
      whereConditions.push(eq(userFiles.fileType, fileType));
    }

    const files = await this.db
      .select()
      .from(userFiles)
      .where(and(...whereConditions))
      .orderBy(desc(userFiles.uploadedAt));

    return files as UserFile[];
  }

  async getFileById(fileId: string): Promise<UserFile | null> {
    const [file] = await this.db
      .select()
      .from(userFiles)
      .where(and(eq(userFiles.id, fileId), eq(userFiles.isActive, true)))
      .limit(1);

    return (file as UserFile) || null;
  }

  async getFileBuffer(file: UserFile): Promise<Buffer> {
    const fullPath = path.join(this.uploadDir, file.filePath);
    try {
      return await fs.readFile(fullPath);
    } catch (_error) {
      this.logger.error({
        msg: "Failed to read file",
        fileId: file.id,
        filePath: fullPath,
        error: _error instanceof Error ? (_error as Error).message : String(_error),
      });
      throw new NotFoundException("File not found on disk");
    }
  }

  private validateFile(fileData: FileUploadData): void {
    // Check file size
    if (fileData.buffer.length > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    // Check file type for avatars
    if (
      fileData.fileType === "avatar" &&
      !this.allowedImageTypes.includes(fileData.mimeType)
    ) {
      throw new BadRequestException(
        "Invalid file type for avatar. Allowed types: JPEG, PNG, GIF, WebP",
      );
    }

    // Check filename
    if (!fileData.originalName || fileData.originalName.length > 255) {
      throw new BadRequestException("Invalid filename");
    }
  }
}
