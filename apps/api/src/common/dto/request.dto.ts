import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RequestDto {
  @ApiProperty({
    description: "Request object",
    required: false,
  })
  @IsOptional()
  url?: string;

  @ApiProperty({
    description: "Request headers",
    required: false,
  })
  @IsOptional()
  headers?: Record<string, string>;

  @ApiProperty({
    description: "Request method",
    required: false,
  })
  @IsOptional()
  @IsString()
  method?: string;
}

export class ResponseDto {
  @ApiProperty({
    description: "Response object",
    required: false,
  })
  @IsOptional()
  status?: number;

  @ApiProperty({
    description: "Response headers",
    required: false,
  })
  @IsOptional()
  headers?: Record<string, string>;

  json?: (data: unknown) => unknown;
  send?: (data: unknown) => unknown;
  setHeader?: (key: string, value: string) => void;
}
