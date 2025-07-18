import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ODataService } from './odata.service';
import { ODataQueryDto } from '../common/dto/query.dto';
import { RequestDto, ResponseDto } from '../common/dto/request.dto';

@ApiTags('odata')
@Controller('odata')
export class ODataController {
  constructor(private readonly odataService: ODataService) {}

  @Get()
  @ApiOperation({ summary: 'OData service document' })
  @ApiResponse({ status: 200, description: 'OData service document retrieved successfully' })
  async getServiceDocument(@Req() req: RequestDto, @Res() res: ResponseDto) {
    const serviceDoc = await this.odataService.getServiceDocument(req);
    res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
    res.setHeader('OData-Version', '4.0');
    return res.json(serviceDoc);
  }

  @Get('$metadata')
  @ApiOperation({ summary: 'OData metadata document' })
  @ApiResponse({ status: 200, description: 'OData metadata document retrieved successfully' })
  async getMetadata(@Res() res: ResponseDto) {
    const metadata = await this.odataService.getMetadata();
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('OData-Version', '4.0');
    return res.send(metadata);
  }

  @Get('hospitals')
  @ApiOperation({ summary: 'OData hospitals entity set' })
  @ApiResponse({ status: 200, description: 'Hospitals data retrieved successfully' })
  async getHospitals(@Res() res: ResponseDto, @Query() query: ODataQueryDto) {
    const data = await this.odataService.getHospitals(query);
    res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
    res.setHeader('OData-Version', '4.0');
    return res.json(data);
  }

  @Get('prices')
  @ApiOperation({ summary: 'OData prices entity set' })
  @ApiResponse({ status: 200, description: 'Prices data retrieved successfully' })
  async getPrices(@Res() res: ResponseDto, @Query() query: ODataQueryDto) {
    const data = await this.odataService.getPrices(query);
    res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
    res.setHeader('OData-Version', '4.0');
    return res.json(data);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'OData analytics entity set' })
  @ApiResponse({ status: 200, description: 'Analytics data retrieved successfully' })
  async getAnalytics(@Res() res: ResponseDto, @Query() query: ODataQueryDto) {
    const data = await this.odataService.getAnalytics(query);
    res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
    res.setHeader('OData-Version', '4.0');
    return res.json(data);
  }
}
