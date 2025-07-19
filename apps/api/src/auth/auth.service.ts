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

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByUsername(username);
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
      username: user.username,
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
        username: user.username,
        role: user.role, // Keep legacy role
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: userWithRoles?.roles || [],
        permissions: userWithRoles?.permissions || [],
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByUsername(registerDto.username);
    if (existingUser) {
      throw new UnauthorizedException('Username already exists');
    }

    // Check if email is already in use (if method exists)
    if (registerDto.email) {
      try {
        const existingEmail = await this.usersService.findByEmail(registerDto.email);
        if (existingEmail) {
          throw new UnauthorizedException('Email already exists');
        }
      } catch (error) {
        // findByEmail method might not exist yet
      }
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      username: registerDto.username,
      password: hashedPassword,
      role: 'api-user', // Default role for new users
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