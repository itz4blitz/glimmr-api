import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiSecurity } from '@nestjs/swagger';
import { ODataService } from './odata.service';
import { ApiKeyAuthGuard } from '../auth/guards/api-key-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ODataQueryDto } from '../common/dto/query.dto';
import { RequestDto, ResponseDto } from '../common/dto/request.dto';

@ApiTags('odata')
@Controller('odata')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyAuthGuard, RolesGuard)
export class ODataController {
  constructor(private readonly odataService: ODataService) {}

  @Get()
  @ApiOperation({ summary: 'OData service document' })
  @ApiResponse({ status: 200, description: 'OData service document retrieved successfully' })
  @Roles('admin', 'api-user')
  async getServiceDocument(@Req() req: any, @Res() res: any) {
  async getServiceDocument(@Req() req: RequestDto, @Res() res: ResponseDto) {
    const serviceDoc = await this.odataService.getServiceDocument(req);
    res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
    res.setHeader('OData-Version', '4.0');
    return res.json(serviceDoc);
  }

  @Get('$metadata')
  @ApiOperation({ summary: 'OData metadata document' })
  @ApiResponse({ status: 200, description: 'OData metadata document retrieved successfully' })
  @Roles('admin', 'api-user')
  async getMetadata(@Res() res: any) {
  async getMetadata(@Res() res: ResponseDto) {
    const metadata = await this.odataService.getMetadata();
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('OData-Version', '4.0');
    return res.send(metadata);
  }

  @Get('hospitals')
  @ApiOperation({ summary: 'OData hospitals entity set' })
  @ApiResponse({ status: 200, description: 'Hospitals data retrieved successfully' })
  @Roles('admin', 'api-user')
  @ApiQuery({ name: '$select', required: false, description: 'Select specific fields' })
  @ApiQuery({ name: '$filter', required: false, description: 'Filter criteria' })
  @ApiQuery({ name: '$orderby', required: false, description: 'Sort order' })
  @ApiQuery({ name: '$top', required: false, description: 'Number of records to return' })
  @ApiQuery({ name: '$skip', required: false, description: 'Number of records to skip' })
  @ApiQuery({ name: '$count', required: false, description: 'Include count' })
  async getHospitals(
    @Res() res: any,
    @Query('$select') select?: string,
    @Query('$filter') filter?: string,
    @Query('$orderby') orderby?: string,
    @Query('$top') top?: number,
    @Query('$skip') skip?: number,
    @Query('$count') count?: boolean,
  ) {
    const data = await this.odataService.getHospitals({
      select,
      filter,
      orderby,
      top,
      skip,
      count,
    });
  async getHospitals(@Res() res: ResponseDto, @Query() query: ODataQueryDto) {
    const data = await this.odataService.getHospitals(query);
    res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
    res.setHeader('OData-Version', '4.0');
    return res.json(data);
  }

  @Get('prices')
  @ApiOperation({ summary: 'OData prices entity set' })
  @ApiResponse({ status: 200, description: 'Prices data retrieved successfully' })
  @Roles('admin', 'api-user')
  @ApiQuery({ name: '$select', required: false, description: 'Select specific fields' })
  @ApiQuery({ name: '$filter', required: false, description: 'Filter criteria' })
  @ApiQuery({ name: '$orderby', required: false, description: 'Sort order' })
  @ApiQuery({ name: '$top', required: false, description: 'Number of records to return' })
  @ApiQuery({ name: '$skip', required: false, description: 'Number of records to skip' })
  @ApiQuery({ name: '$count', required: false, description: 'Include count' })
  async getPrices(
    @Res() res: any,
    @Query('$select') select?: string,
    @Query('$filter') filter?: string,
    @Query('$orderby') orderby?: string,
    @Query('$top') top?: number,
    @Query('$skip') skip?: number,
    @Query('$count') count?: boolean,
  ) {
    const data = await this.odataService.getPrices({
      select,
      filter,
      orderby,
      top,
      skip,
      count,
    });
  async getPrices(@Res() res: ResponseDto, @Query() query: ODataQueryDto) {
    const data = await this.odataService.getPrices(query);
    res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
    res.setHeader('OData-Version', '4.0');
    return res.json(data);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'OData analytics entity set' })
  @ApiResponse({ status: 200, description: 'Analytics data retrieved successfully' })
  @Roles('admin', 'api-user')
  @ApiQuery({ name: '$select', required: false, description: 'Select specific fields' })
  @ApiQuery({ name: '$filter', required: false, description: 'Filter criteria' })
  @ApiQuery({ name: '$orderby', required: false, description: 'Sort order' })
  @ApiQuery({ name: '$top', required: false, description: 'Number of records to return' })
  @ApiQuery({ name: '$skip', required: false, description: 'Number of records to skip' })
  @ApiQuery({ name: '$count', required: false, description: 'Include count' })
  async getAnalytics(
    @Res() res: any,
    @Query('$select') select?: string,
    @Query('$filter') filter?: string,
    @Query('$orderby') orderby?: string,
    @Query('$top') top?: number,
    @Query('$skip') skip?: number,
    @Query('$count') count?: boolean,
  ) {
    const data = await this.odataService.getAnalytics({
      select,
      filter,
      orderby,
      top,
      skip,
      count,
    });
  async getAnalytics(@Res() res: ResponseDto, @Query() query: ODataQueryDto) {
    const data = await this.odataService.getAnalytics(query);
    res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
    res.setHeader('OData-Version', '4.0');
    return res.json(data);
  }
}
