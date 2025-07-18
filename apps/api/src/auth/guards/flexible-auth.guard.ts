import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class FlexibleAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const apiKey = request.headers['x-api-key'];

    // Try JWT authentication first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        
        // Add user to request
        request.user = {
          id: payload.sub,
          username: payload.username,
          role: payload.role,
        };
        return true;
      } catch (error) {
        // JWT verification failed, continue to API key
      }
    }

    // Try API key authentication
    if (apiKey) {
      try {
        const user = await this.authService.validateApiKey(apiKey);
        if (user) {
          request.user = {
            id: user.id,
            username: user.username,
            role: user.role,
          };
          return true;
        }
      } catch (error) {
        // API key validation failed
      }
    }

    throw new UnauthorizedException('Invalid credentials');
  }
}