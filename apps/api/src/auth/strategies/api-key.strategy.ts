import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import Strategy from "passport-headerapikey";
import { AuthService } from "../auth.service";

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, "api-key") {
  constructor(private authService: AuthService) {
    super(
      { header: "x-api-key", prefix: "" },
      true,
      async (apiKey: string, done) => {
        return this.validate(apiKey, done);
      },
    );
  }

  async validate(apiKey: string, done: (error: Error, data) => {}) {
    const user = await this.authService.validateApiKey(apiKey);
    if (!user) {
      done(new UnauthorizedException("Invalid API key"), null);
      return;
    }
    done(null, {
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
