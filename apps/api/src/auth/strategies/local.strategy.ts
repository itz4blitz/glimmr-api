import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../auth.service";
import { Request } from "express";
import { User } from "../../database/schema/users";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: "email",
      passReqToCallback: true,
    });
  }

  async validate(
    request: Request,
    email: string,
    password: string,
  ): Promise<Pick<User, "id" | "email" | "role">> {
    const user = await this.authService.validateUser(email, password, request);
    if (!user || !user.id || !user.email || !user.role) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
