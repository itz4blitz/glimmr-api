import { Injectable, UnauthorizedException, ForbiddenException, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RbacService } from './rbac.service';
import { User } from '../database/schema/users';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    @Optional() private rbacService: RbacService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      return user;
    }
    return null;
  }

  async validateApiKey(apiKey: string): Promise<User | null> {
    const user = await this.usersService.findByApiKey(apiKey);
    if (user && user.apiKey === apiKey) {
      return user;
    }
    return null;
  }

  async login(user: User) {
    // Get user roles and permissions from RBAC system (if available)
    let userWithRoles;
    try {
      if (this.rbacService) {
        userWithRoles = await this.rbacService.getUserWithRoles(user.id as string);
      }
    } catch (error) {
      // RBAC system not available yet, fall back to legacy role
      userWithRoles = null;
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role, // Keep legacy role for backward compatibility
      roles: userWithRoles?.roles.map(r => r.name) || [user.role],
      permissions: userWithRoles?.permissions.map(p => `${p.resource}:${p.action}`) || []
    };

    // Update last login time if method exists
    try {
      await this.usersService.updateLastLogin(user.id as string);
    } catch (error) {
      // Method might not exist yet
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role, // Keep legacy role
        firstName: user.firstName,
        lastName: user.lastName,
        roles: userWithRoles?.roles || [],
        permissions: userWithRoles?.permissions || [],
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Check if email is already in use
    const existingEmail = await this.usersService.findByEmail(registerDto.email);
    if (existingEmail) {
      throw new UnauthorizedException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      password: hashedPassword,
      role: 'user', // Default role for new users
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
    });

    return this.login(user);
  }

  async generateApiKey(userId: string): Promise<string> {
    const apiKey = this.generateRandomApiKey();
    await this.usersService.updateApiKey(userId, apiKey);
    return apiKey;
  }

  private generateRandomApiKey(): string {
    return `gapi_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  }
}