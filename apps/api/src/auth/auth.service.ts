import { Injectable, UnauthorizedException, ForbiddenException, Optional, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RbacService } from './rbac.service';
import { User } from '../database/schema/users';
import { RegisterDto } from './dto/register.dto';
import { ActivityLoggingService } from '../activity/activity-logging.service';
import { Request } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    @Optional() private rbacService: RbacService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(forwardRef(() => ActivityLoggingService))
    private activityLoggingService: ActivityLoggingService,
  ) {}

  async validateUser(email: string, password: string, request?: Request): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      return user;
    }
    
    // Log failed login attempt
    if (user) {
      await this.activityLoggingService.logAuth('login_failed', user.id as string, {
        reason: 'invalid_password',
        email,
      }, request);
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

  async login(user: User, request?: Request) {
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

    // Log successful login
    await this.activityLoggingService.logAuth('login', user.id as string, {
      email: user.email,
      roles: userWithRoles?.roles.map(r => r.name) || [user.role],
    }, request);

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

  async register(registerDto: RegisterDto, request?: Request) {
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

    // Log user registration
    await this.activityLoggingService.logActivity({
      userId: user.id as string,
      action: 'user_registered',
      resourceType: 'user',
      resourceId: user.id as string,
      metadata: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      request,
    });

    return this.login(user, request);
  }

  async generateApiKey(userId: string): Promise<string> {
    const apiKey = this.generateRandomApiKey();
    await this.usersService.updateApiKey(userId, apiKey);
    return apiKey;
  }

  private generateRandomApiKey(): string {
    return `gapi_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  }

  async logout(userId: string, request?: Request): Promise<void> {
    // Log logout event
    await this.activityLoggingService.logAuth('logout', userId, {
      timestamp: new Date().toISOString(),
    }, request);
  }
}