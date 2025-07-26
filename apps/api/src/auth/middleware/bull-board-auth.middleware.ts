import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth.service";

@Injectable()
export class BullBoardAuthMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers["x-api-key"];

    try {
      let user = null;

      // Try JWT authentication first
      if (
        authHeader &&
        typeof authHeader === "string" &&
        authHeader.startsWith("Bearer ")
      ) {
        const token = authHeader.substring(7);
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>("JWT_SECRET"),
        });

        user = {
          id: payload.sub,
          username: payload.username,
          role: payload.role,
        };
      }
      // Try API key authentication
      else if (apiKey && typeof apiKey === "string") {
        const validatedUser = await this.authService.validateApiKey(apiKey);
        if (validatedUser) {
          user = {
            id: validatedUser.id,
            email: validatedUser.email,
            role: validatedUser.role,
          };
        }
      }

      // Check if user has admin role
      if (!user || user.role !== "admin") {
        res.status(401).json({
          statusCode: 401,
          message: "Admin access required for queue management",
          error: "Unauthorized",
        });
        return;
      }

      next();
    } catch (error) {
      res.status(401).json({
        statusCode: 401,
        message: "Invalid credentials",
        error: "Unauthorized",
      });
      return;
    }
  }
}
