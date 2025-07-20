import { Controller, Get, Post, Query, Body, Req, Res, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiSecurity } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ODataService } from './odata.service';
import { ApiKeyAuthGuard } from '../auth/guards/api-key-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ODataQueryDto } from '../common/dto/query.dto';
import { RequestDto, ResponseDto } from '../common/dto/request.dto';
import { ODataErrorDto } from './dto/odata-error.dto';

@ApiTags('OData')
@Controller('odata')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyAuthGuard, RolesGuard)
export class ODataController {
  constructor(private readonly odataService: ODataService) {}

  @Get()
  @ApiOperation({ summary: 'OData service document' })
  @ApiResponse({ status: 200, description: 'OData service document retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ODataErrorDto })
  @Roles('admin', 'api-user')
  async getServiceDocument(@Req() req: RequestDto, @Res() res: ResponseDto) {
    try {
      const serviceDoc = await this.odataService.getServiceDocument(req);
      res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
      res.setHeader('OData-Version', '4.0');
      return res.json(serviceDoc);
    } catch (error) {
      throw new HttpException(
        this.odataService.formatODataError('Service document error', error.message),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('$metadata')
  @ApiOperation({ summary: 'OData metadata document' })
  @ApiResponse({ status: 200, description: 'OData metadata document retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ODataErrorDto })
  @Roles('admin', 'api-user')
  async getMetadata(@Res() res: ResponseDto) {
    try {
      const metadata = await this.odataService.getMetadata();
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('OData-Version', '4.0');
      return res.send(metadata);
    } catch (error) {
      throw new HttpException(
        this.odataService.formatODataError('Metadata error', error.message),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('hospitals')
  @Throttle({ expensive: { limit: 20, ttl: 900000 } })
  @ApiOperation({ summary: 'OData hospitals entity set' })
  @ApiResponse({ status: 200, description: 'Hospitals data retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid query parameters', type: ODataErrorDto })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ODataErrorDto })
  @Roles('admin', 'api-user')
  @ApiQuery({ name: '$select', required: false, description: 'Select specific fields' })
  @ApiQuery({ name: '$filter', required: false, description: 'Filter criteria' })
  @ApiQuery({ name: '$orderby', required: false, description: 'Sort order' })
  @ApiQuery({ name: '$top', required: false, description: 'Number of records to return' })
  @ApiQuery({ name: '$skip', required: false, description: 'Number of records to skip' })
  @ApiQuery({ name: '$count', required: false, description: 'Include count' })
  async getHospitals(@Res() res: ResponseDto, @Query() query: ODataQueryDto) {
    try {
      const data = await this.odataService.getHospitals(query);
      res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
      res.setHeader('OData-Version', '4.0');
      return res.json(data);
    } catch (error) {
      const statusCode = error.name === 'ValidationError' ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(
        this.odataService.formatODataError('Hospitals query error', error.message),
        statusCode
      );
    }
  }

  @Get('prices')
  @Throttle({ expensive: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'OData prices entity set' })
  @ApiResponse({ status: 200, description: 'Prices data retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid query parameters', type: ODataErrorDto })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ODataErrorDto })
  @Roles('admin', 'api-user')
  @ApiQuery({ name: '$select', required: false, description: 'Select specific fields' })
  @ApiQuery({ name: '$filter', required: false, description: 'Filter criteria' })
  @ApiQuery({ name: '$orderby', required: false, description: 'Sort order' })
  @ApiQuery({ name: '$top', required: false, description: 'Number of records to return' })
  @ApiQuery({ name: '$skip', required: false, description: 'Number of records to skip' })
  @ApiQuery({ name: '$count', required: false, description: 'Include count' })
  async getPrices(@Res() res: ResponseDto, @Query() query: ODataQueryDto) {
    try {
      const data = await this.odataService.getPrices(query);
      res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
      res.setHeader('OData-Version', '4.0');
      return res.json(data);
    } catch (error) {
      const statusCode = error.name === 'ValidationError' ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(
        this.odataService.formatODataError('Prices query error', error.message),
        statusCode
      );
    }
  }

  @Get('analytics')
  @Throttle({ expensive: { limit: 15, ttl: 900000 } })
  @ApiOperation({ summary: 'OData analytics entity set' })
  @ApiResponse({ status: 200, description: 'Analytics data retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid query parameters', type: ODataErrorDto })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ODataErrorDto })
  @Roles('admin', 'api-user')
  @ApiQuery({ name: '$select', required: false, description: 'Select specific fields' })
  @ApiQuery({ name: '$filter', required: false, description: 'Filter criteria' })
  @ApiQuery({ name: '$orderby', required: false, description: 'Sort order' })
  @ApiQuery({ name: '$top', required: false, description: 'Number of records to return' })
  @ApiQuery({ name: '$skip', required: false, description: 'Number of records to skip' })
  @ApiQuery({ name: '$count', required: false, description: 'Include count' })
  async getAnalytics(@Res() res: ResponseDto, @Query() query: ODataQueryDto) {
    try {
      const data = await this.odataService.getAnalytics(query);
      res.setHeader('Content-Type', 'application/json;odata.metadata=minimal');
      res.setHeader('OData-Version', '4.0');
      return res.json(data);
    } catch (error) {
      const statusCode = error.name === 'ValidationError' ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(
        this.odataService.formatODataError('Analytics query error', error.message),
        statusCode
      );
    }
  }

  @Post('$batch')
  @ApiOperation({ summary: 'OData batch operations' })
  @ApiResponse({ status: 200, description: 'Batch operations completed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid batch format', type: ODataErrorDto })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ODataErrorDto })
  @Roles('admin', 'api-user')
  async processBatch(@Req() req: RequestDto, @Res() res: ResponseDto, @Body() body: string) {
    try {
      const batchResult = await this.odataService.processBatch(body, req);
      res.setHeader('Content-Type', 'multipart/mixed; boundary=batchresponse');
      res.setHeader('OData-Version', '4.0');
      return res.send(batchResult);
    } catch (error) {
      const statusCode = error.name === 'ValidationError' ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(
        this.odataService.formatODataError('Batch processing error', error.message),
        statusCode
      );
    }
  }
}
