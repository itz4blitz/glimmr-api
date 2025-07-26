import { ApiProperty } from "@nestjs/swagger";

export class ErrorResponseDto {
  @ApiProperty({
    description: "The HTTP status code",
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: "A human-readable error message",
    example: "Invalid request parameters",
  })
  message: string;

  @ApiProperty({
    description: "Machine-readable error code for client handling",
    example: "INVALID_REQUEST",
  })
  error: string;

  @ApiProperty({
    description: "ISO 8601 timestamp of when the error occurred",
    example: "2025-07-18T20:41:36.480Z",
  })
  timestamp: string;

  @ApiProperty({
    description: "The request path that caused the error",
    example: "/api/v1/hospitals/123",
  })
  path: string;

  @ApiProperty({
    description: "Additional context or details about the error",
    example: { field: "hospitalId", value: "123" },
    required: false,
  })
  details?: Record<string, unknown>;

  @ApiProperty({
    description: "Unique identifier for tracing this error",
    example: "req-123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  traceId?: string;
}
