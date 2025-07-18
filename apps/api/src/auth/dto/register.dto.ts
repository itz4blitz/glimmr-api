import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: 'Username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'Password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ 
    description: 'User role', 
    enum: ['admin', 'api-user'], 
    default: 'api-user' 
  })
  @IsOptional()
  @IsIn(['admin', 'api-user'])
  role?: string = 'api-user';
}