import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AdminController } from "./admin.controller";
import { RbacService } from "./rbac.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";
import { ApiKeyStrategy } from "./strategies/api-key.strategy";
import { PermissionsGuard } from "./guards/permissions.guard";
import { UsersModule } from "../users/users.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [
    UsersModule,
    EmailModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "24h" },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, AdminController],
  providers: [
    AuthService,
    RbacService,
    JwtStrategy,
    LocalStrategy,
    ApiKeyStrategy,
    PermissionsGuard,
  ],
  exports: [AuthService, RbacService, JwtModule, PermissionsGuard],
})
export class AuthModule {}
