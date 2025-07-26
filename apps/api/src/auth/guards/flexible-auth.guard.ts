import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth.service";

@Injectable()
export class FlexibleAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try JWT authentication first
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      if (token) {
        try {
          const payload = this.jwtService.verify(token, {
            secret: this.configService.get<string>("JWT_SECRET"),
          });

          request.user = {
            id: payload.sub,
            username: payload.username,
            role: payload.role,
          };
          return true;
        } catch (_error) {
          // JWT verification failed, try API key fallback
        }
      }
    }

    // Try API key authentication
    const apiKey = request.headers["x-api-key"];
    if (apiKey) {
      try {
        const user = await this.authService.validateApiKey(apiKey);
        if (user) {
          request.user = user;
          return true;
        }
      } catch (error) {
        // API key validation failed
      }
    }

    // No valid authentication found
    throw new UnauthorizedException("Authentication required");
  }
}
