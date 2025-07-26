import { ApiProperty } from "@nestjs/swagger";

export class ODataErrorDetail {
  @ApiProperty({
    description: "Error code",
    example: "InvalidQuery",
  })
  code: string;

  @ApiProperty({
    description: "Error message",
    example: "The query is invalid",
  })
  message: string;

  @ApiProperty({
    description: "Target of the error",
    example: "$filter",
    required: false,
  })
  target?: string;
}

export class ODataErrorDto {
  @ApiProperty({
    description: "OData error information",
    type: ODataErrorDetail,
  })
  error: ODataErrorDetail;
}
