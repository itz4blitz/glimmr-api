import { IsString, IsEmail, IsOptional, IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class SendEmailDto {
  @ApiProperty({
    description: 'Recipient email address(es)',
    example: 'user@example.com',
    oneOf: [
      { type: 'string', format: 'email' },
      { type: 'array', items: { type: 'string', format: 'email' } }
    ],
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  to: string | string[];

  @ApiProperty({
    description: 'Email subject line',
    example: 'Hospital Data Update Notification',
  })
  @IsString()
  subject: string;

  @ApiProperty({
    description: 'Plain text email content',
    example: 'Your hospital data has been updated successfully.',
    required: false,
  })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({
    description: 'HTML email content',
    example: '<p>Your hospital data has been <strong>updated successfully</strong>.</p>',
    required: false,
  })
  @IsOptional()
  @IsString()
  html?: string;

  @ApiProperty({
    description: 'Sender email address (optional, uses default if not provided)',
    example: 'noreply@glimmr.dev',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  from?: string;
}

export class SendTestEmailDto {
  @ApiProperty({
    description: 'Test email recipient',
    example: 'test@example.com',
    required: false,
    default: 'test@example.com',
  })
  @IsOptional()
  @IsEmail()
  to?: string;
}