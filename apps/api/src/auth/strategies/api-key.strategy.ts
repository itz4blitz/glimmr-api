import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import Strategy from "passport-headerapikey";
import { AuthService } from "../auth.service";
import { PassportDoneCallback, ApiKeyUser } from "../../types/http.types";
import { User } from "../../database/schema/users";

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, "api-key") {
  constructor(private authService: AuthService) {
    super(
      { header: "x-api-key", prefix: "" },
      true,
      (apiKey: string, done) => {
        return this.validate(apiKey, done);
      },
    );
  }

  async validate(apiKey: string, done: PassportDoneCallback<ApiKeyUser>) {
    const user: User | null = await this.authService.validateApiKey(apiKey);
    if (!user || !user.id || !user.email || !user.role) {
      done(new UnauthorizedException("Invalid API key"), false);
      return;
    }
    done(null, {
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
