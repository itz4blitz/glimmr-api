import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../database/schema/users';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
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
    const payload = { 
      sub: user.id, 
      username: user.username, 
      role: user.role 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  async register(username: string, password: string, role: 'admin' | 'api-user' = 'api-user') {
    const existingUser = await this.usersService.findByUsername(username);
    if (existingUser) {
      throw new UnauthorizedException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      username,
      password: hashedPassword,
      role,
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