import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { EmailService } from "./email.service";
import { SendEmailDto, SendTestEmailDto } from "./dto/email.dto";

@ApiTags("Admin - Email")
@Controller("admin/email")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get("test-connection")
  @ApiOperation({ summary: "Test email service connection" })
  @ApiResponse({
    status: 200,
    description: "Email service connection test completed",
  })
  @Roles("admin")
  async testEmailConnection() {
    return await this.emailService.testConnection();
  }

  @Post("send-test")
  @ApiOperation({ summary: "Send test email" })
  @ApiResponse({ status: 200, description: "Test email sent successfully" })
  @ApiResponse({ status: 400, description: "Failed to send test email" })
  @Roles("admin")
  async sendTestEmail(@Body() testEmailDto: SendTestEmailDto = {}) {
    return await this.emailService.sendTestEmail(testEmailDto.to);
  }

  @Post("send")
  @ApiOperation({ summary: "Send custom email" })
  @ApiResponse({ status: 200, description: "Email sent successfully" })
  @ApiResponse({ status: 400, description: "Failed to send email" })
  @Roles("admin")
  async sendEmail(@Body() emailData: SendEmailDto) {
    return await this.emailService.sendEmail(emailData);
  }
}