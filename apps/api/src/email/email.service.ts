import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export interface EmailTestResult {
  success: boolean;
  message: string;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const isProduction = this.configService.get("NODE_ENV") === "production";

    if (isProduction) {
      // Production SMTP configuration
      this.transporter = nodemailer.createTransport({
        host: this.configService.get("SMTP_HOST"),
        port: this.configService.get("SMTP_PORT", 587),
        secure: this.configService.get("SMTP_SECURE", false),
        auth: {
          user: this.configService.get("SMTP_USER"),
          pass: this.configService.get("SMTP_PASS"),
        },
      });
    } else {
      // Development configuration using Inbucket
      this.transporter = nodemailer.createTransport({
        host: "inbucket",
        port: 2500,
        secure: false,
        auth: undefined, // Inbucket doesn't require auth
      });
    }

    this.logger.log(
      `Email transporter initialized for ${isProduction ? "production" : "development"} environment`,
    );
  }

  async testConnection(): Promise<EmailTestResult> {
    try {
      await this.transporter.verify();
      return {
        success: true,
        message: "Email service connection verified successfully",
      };
    } catch (_error) {
      this.logger.error("Email service connection failed", (_error as Error).stack);
      return {
        success: false,
        message: "Email service connection failed",
        error: (_error as Error).message,
      };
    }
  }

  async sendEmail(options: EmailOptions): Promise<EmailTestResult> {
    try {
      const defaultFrom = this.configService.get(
        "SMTP_FROM",
        "noreply@glimmr.dev",
      );

      const mailOptions = {
        from: options.from || defaultFrom,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const _result = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully to ${mailOptions.to}`);

      return {
        success: true,
        message: `Email sent successfully. Message ID: ${_result.messageId}`,
      };
    } catch (_error) {
      this.logger.error(`Failed to send email to ${options.to}`, (_error as Error).stack);
      return {
        success: false,
        message: "Failed to send email",
        error: (_error as Error).message,
      };
    }
  }

  async sendTestEmail(
    to: string = "test@example.com",
  ): Promise<EmailTestResult> {
    const testEmailOptions: EmailOptions = {
      to,
      subject: "Glimmr API - Test Email",
      text: "This is a test email from the Glimmr API email service.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #333;">Glimmr API Test Email</h2>
          <p>This is a test email from the Glimmr API email service.</p>
          <p>If you received this email, the email service is working correctly.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Sent at: ${new Date().toISOString()}<br>
            Environment: ${this.configService.get("NODE_ENV", "development")}
          </p>
        </div>
      `,
    };

    return await this.sendEmail(testEmailOptions);
  }
}
