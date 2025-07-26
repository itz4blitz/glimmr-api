import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
} from "class-validator";

export class RegisterDto {
  @ApiProperty({ description: "Email address" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: "Password", minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: "Username",
    required: false,
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username?: string;

  @ApiProperty({ description: "First name", required: false, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiProperty({ description: "Last name", required: false, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  // Note: Role is no longer selectable by users - defaults to 'api-user'
  // Admins can change roles after registration using the admin endpoints
}
