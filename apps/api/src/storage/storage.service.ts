import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import {
  createWriteStream,
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
} from "fs";
import { unlink, stat } from "fs/promises";
import { join, dirname } from "path";
import { pipeline } from "stream/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

export interface StorageConfig {
  type: "local" | "s3" | "spaces";
  basePath?: string; // For local storage
  bucket?: string; // For S3/Spaces
  region?: string;
  endpoint?: string; // For DigitalOcean Spaces
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface StorageFile {
  key: string;
  size: number;
  lastModified: Date;
  url?: string;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

@Injectable()
export class StorageService {
  private readonly config: StorageConfig;
  private s3Client?: S3Client;

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(StorageService.name)
    private readonly logger: PinoLogger,
  ) {
    this.config = this.loadStorageConfig();
    this.initializeStorage();
  }

  private loadStorageConfig(): StorageConfig {
    const storageType = this.configService.get<string>(
      "STORAGE_TYPE",
      "local",
    ) as StorageConfig["type"];

    switch (storageType) {
      case "local":
        return {
          type: "local",
          basePath: this.configService.get<string>(
            "STORAGE_LOCAL_PATH",
            "./storage",
          ),
        };

      case "s3":
        return {
          type: "s3",
          bucket: this.configService.get<string>("STORAGE_S3_BUCKET"),
          region: this.configService.get<string>(
            "STORAGE_S3_REGION",
            "us-east-1",
          ),
          accessKeyId: this.configService.get<string>(
            "STORAGE_S3_ACCESS_KEY_ID",
          ),
          secretAccessKey: this.configService.get<string>(
            "STORAGE_S3_SECRET_ACCESS_KEY",
          ),
        };

      case "spaces":
        return {
          type: "spaces",
          bucket: this.configService.get<string>("STORAGE_SPACES_BUCKET"),
          region: this.configService.get<string>(
            "STORAGE_SPACES_REGION",
            "nyc3",
          ),
          endpoint: this.configService.get<string>("STORAGE_SPACES_ENDPOINT"),
          accessKeyId: this.configService.get<string>(
            "STORAGE_SPACES_ACCESS_KEY_ID",
          ),
          secretAccessKey: this.configService.get<string>(
            "STORAGE_SPACES_SECRET_ACCESS_KEY",
          ),
        };

      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }

  private initializeStorage(): void {
    if (this.config.type === "local" && this.config.basePath) {
      // Ensure local storage directory exists
      if (!existsSync(this.config.basePath)) {
        mkdirSync(this.config.basePath, { recursive: true });
        this.logger.info(
          {
            path: this.config.basePath,
          },
          "Created local storage directory",
        );
      }
    } else if (this.config.type === "s3" || this.config.type === "spaces") {
      // Initialize S3 client for S3 or DigitalOcean Spaces
      this.s3Client = new S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint, // For DigitalOcean Spaces
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        forcePathStyle: this.config.type === "spaces", // Required for DigitalOcean Spaces
      });

      this.logger.info(
        {
          type: this.config.type,
          region: this.config.region,
          endpoint: this.config.endpoint,
          bucket: this.config.bucket,
        },
        "S3 client initialized",
      );
    }

    this.logger.info(
      {
        type: this.config.type,
        config: this.sanitizeConfig(this.config),
      },
      "Storage service initialized",
    );
  }

  private sanitizeConfig(config: StorageConfig): Partial<StorageConfig> {
    const sanitized = { ...config };
    if (sanitized.accessKeyId) sanitized.accessKeyId = "***";
    if (sanitized.secretAccessKey) sanitized.secretAccessKey = "***";
    return sanitized;
  }

  /**
   * Upload a file from a stream
   */
  async uploadFromStream(
    key: string,
    stream: NodeJS.ReadableStream,
    options: UploadOptions = {},
  ): Promise<StorageFile> {
    this.logger.info(
      {
        key,
        storageType: this.config.type,
        contentType: options.contentType,
      },
      "Starting file upload",
    );

    try {
      switch (this.config.type) {
        case "local":
          return await this.uploadToLocal(key, stream, options);
        case "s3":
        case "spaces":
          return await this.uploadToS3Compatible(key, stream, options);
        default:
          throw new Error(
            `Upload not implemented for storage type: ${this.config.type}`,
          );
      }
    } catch (error) {
      this.logger.error(
        {
          key,
          error: error.message,
          storageType: this.config.type,
        },
        "File upload failed",
      );
      throw error;
    }
  }

  /**
   * Upload a file from local path
   */
  async uploadFromFile(
    key: string,
    filePath: string,
    options: UploadOptions = {},
  ): Promise<StorageFile> {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stream = createReadStream(filePath);
    return this.uploadFromStream(key, stream, options);
  }

  /**
   * Download a file to a stream
   */
  async downloadToStream(key: string): Promise<NodeJS.ReadableStream> {
    this.logger.info(
      {
        key,
        storageType: this.config.type,
      },
      "Starting file download",
    );

    try {
      switch (this.config.type) {
        case "local":
          return this.downloadFromLocal(key);
        case "s3":
        case "spaces":
          return await this.downloadFromS3Compatible(key);
        default:
          throw new Error(
            `Download not implemented for storage type: ${this.config.type}`,
          );
      }
    } catch (error) {
      this.logger.error(
        {
          key,
          error: error.message,
          storageType: this.config.type,
        },
        "File download failed",
      );
      throw error;
    }
  }

  /**
   * Download a file to local path
   */
  async downloadToFile(key: string, filePath: string): Promise<void> {
    const stream = await this.downloadToStream(key);
    const writeStream = createWriteStream(filePath);

    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    await pipeline(stream, writeStream);
  }

  /**
   * Get file information
   */
  async getFileInfo(key: string): Promise<StorageFile | null> {
    try {
      switch (this.config.type) {
        case "local":
          return this.getLocalFileInfo(key);
        case "s3":
        case "spaces":
          return this.getS3FileInfo(key);
        default:
          throw new Error(
            `Get file info not implemented for storage type: ${this.config.type}`,
          );
      }
    } catch (error) {
      this.logger.error(
        {
          key,
          error: error.message,
          storageType: this.config.type,
        },
        "Failed to get file info",
      );
      return null;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<boolean> {
    this.logger.info(
      {
        key,
        storageType: this.config.type,
      },
      "Deleting file",
    );

    try {
      switch (this.config.type) {
        case "local":
          return this.deleteLocalFile(key);
        case "s3":
        case "spaces":
          return this.deleteS3File(key);
        default:
          throw new Error(
            `Delete not implemented for storage type: ${this.config.type}`,
          );
      }
    } catch (error) {
      this.logger.error(
        {
          key,
          error: error.message,
          storageType: this.config.type,
        },
        "File deletion failed",
      );
      return false;
    }
  }

  /**
   * List files with prefix
   */
  async listFiles(
    prefix: string = "",
    limit: number = 1000,
  ): Promise<StorageFile[]> {
    try {
      switch (this.config.type) {
        case "local":
          return this.listLocalFiles(prefix, limit);
        case "s3":
        case "spaces":
          return this.listS3Files(prefix, limit);
        default:
          throw new Error(
            `List files not implemented for storage type: ${this.config.type}`,
          );
      }
    } catch (error) {
      this.logger.error(
        {
          prefix,
          error: error.message,
          storageType: this.config.type,
        },
        "Failed to list files",
      );
      return [];
    }
  }

  /**
   * Check if a file exists in storage
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const fileInfo = await this.getFileInfo(key);
      return fileInfo !== null;
    } catch (error) {
      this.logger.debug(
        {
          key,
          error: error.message,
        },
        "File existence check failed",
      );
      return false;
    }
  }

  // Local storage implementations
  private async uploadToLocal(
    key: string,
    stream: NodeJS.ReadableStream,
    options: UploadOptions,
  ): Promise<StorageFile> {
    const filePath = join(this.config.basePath, key);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const writeStream = createWriteStream(filePath);
    await pipeline(stream, writeStream);

    const stats = statSync(filePath);

    return {
      key,
      size: stats.size,
      lastModified: stats.mtime,
    };
  }

  private downloadFromLocal(key: string): NodeJS.ReadableStream {
    const filePath = join(this.config.basePath, key);

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }

    return createReadStream(filePath);
  }

  private async getLocalFileInfo(key: string): Promise<StorageFile | null> {
    const filePath = join(this.config.basePath, key);

    if (!existsSync(filePath)) {
      return null;
    }

    const stats = await stat(filePath);

    return {
      key,
      size: stats.size,
      lastModified: stats.mtime,
    };
  }

  private async deleteLocalFile(key: string): Promise<boolean> {
    const filePath = join(this.config.basePath, key);

    if (!existsSync(filePath)) {
      return true; // Already deleted
    }

    try {
      await unlink(filePath);
      return true;
    } catch (error) {
      this.logger.error(
        {
          key,
          filePath,
          error: error.message,
        },
        "Failed to delete local file",
      );
      return false;
    }
  }

  private async listLocalFiles(
    prefix: string,
    limit: number,
  ): Promise<StorageFile[]> {
    // Local file listing is not implemented for this use case
    // In production, we use S3/MinIO which has proper listing capabilities
    this.logger.warn(
      {
        prefix,
        limit,
      },
      "Local file listing not implemented - use S3/MinIO for production",
    );

    // This method intentionally returns an empty array as local file listing
    // is not implemented for this storage service. Use S3/MinIO for production.
    return [];
  }

  // S3/Spaces implementations
  private async uploadToS3Compatible(
    key: string,
    stream: NodeJS.ReadableStream,
    options: UploadOptions,
  ): Promise<StorageFile> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    try {
      // Convert stream to buffer for upload
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        Metadata: options.metadata,
      });

      await this.s3Client.send(command);

      return {
        key,
        size: body.length,
        lastModified: new Date(),
        url: this.getS3Url(key),
      };
    } catch (error) {
      this.logger.error(
        {
          key,
          error: error.message,
          bucket: this.config.bucket,
        },
        "S3 upload failed",
      );
      throw error;
    }
  }

  private async downloadFromS3Compatible(
    key: string,
  ): Promise<NodeJS.ReadableStream> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error(`No body returned for key: ${key}`);
      }

      // The response.Body is already a Node.js Readable stream
      const stream = response.Body as Readable;

      this.logger.info(
        {
          key,
          bucket: this.config.bucket,
          contentLength: response.ContentLength,
          contentType: response.ContentType,
        },
        "S3 download stream ready",
      );

      return stream;
    } catch (error) {
      this.logger.error(
        {
          key,
          bucket: this.config.bucket,
          error: error.message,
          code: error.Code,
        },
        "S3 download failed",
      );
      throw error;
    }
  }

  private async getS3FileInfo(key: string): Promise<StorageFile | null> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        url: this.getS3Url(key),
      };
    } catch (error) {
      if (error.name === "NotFound") {
        return null;
      }
      this.logger.error(
        {
          key,
          error: error.message,
        },
        "S3 head object failed",
      );
      throw error;
    }
  }

  private async deleteS3File(key: string): Promise<boolean> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      this.logger.error(
        {
          key,
          error: error.message,
        },
        "S3 delete failed",
      );
      return false;
    }
  }

  private async listS3Files(
    prefix: string,
    limit: number,
  ): Promise<StorageFile[]> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        MaxKeys: limit,
      });

      const response = await this.s3Client.send(command);
      const files: StorageFile[] = [];

      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key) {
            files.push({
              key: object.Key,
              size: object.Size || 0,
              lastModified: object.LastModified || new Date(),
              url: this.getS3Url(object.Key),
            });
          }
        }
      }

      return files;
    } catch (error) {
      this.logger.error(
        {
          prefix,
          limit,
          error: error.message,
        },
        "S3 list objects failed",
      );
      throw error;
    }
  }

  private getS3Url(key: string): string {
    if (this.config.endpoint) {
      // For DigitalOcean Spaces or custom S3 endpoint
      return `${this.config.endpoint}/${this.config.bucket}/${key}`;
    } else {
      // For AWS S3
      return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
    }
  }
}
