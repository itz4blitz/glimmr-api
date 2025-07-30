import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  // Get,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { Roles } from "./decorators/roles.decorator";
import { RolesGuard } from "./guards/roles.guard";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: "Login user" })
  @ApiResponse({ status: 200, description: "User logged in successfully" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @UseGuards(LocalAuthGuard)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Request() req, @Body() _loginDto: LoginDto) {
    return this.authService.login(req.user, req);
  }

  @ApiOperation({
    summary: "Register new user",
    description:
      "Register a new user. Note: Users start with no roles - an admin must assign roles for access to protected endpoints.",
  })
  @ApiResponse({ status: 201, description: "User registered successfully" })
  @ApiResponse({ status: 400, description: "Username or email already exists" })
  @Post("register")
  register(@Body() registerDto: RegisterDto, @Request() req) {
    return this.authService.register(registerDto, req);
  }

  @ApiOperation({ summary: "Generate API key" })
  @ApiResponse({ status: 200, description: "API key generated successfully" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "api-user")
  @Post("api-key")
  async generateApiKey(@Request() req) {
    const apiKey = await this.authService.generateApiKey(req.user.id);
    return { apiKey };
  }

  @ApiOperation({ summary: "Logout user" })
  @ApiResponse({ status: 200, description: "User logged out successfully" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    await this.authService.logout(req.user.id, req);
    return { message: "Logged out successfully" };
  }
}
