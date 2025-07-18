import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JobsService } from './jobs.service';
import { HospitalMonitorService } from './services/hospital-monitor.service';
import { PRAPipelineService } from './services/pra-pipeline.service';
import { TriggerHospitalImportDto, TriggerPriceFileDownloadDto, StartHospitalImportDto, StartPriceUpdateDto, TriggerPRAScanDto } from './dto/hospital-import.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JobFilterQueryDto } from '../common/dto/query.dto';

@ApiTags('jobs')
@Controller('jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly hospitalMonitorService: HospitalMonitorService,
    private readonly praPipelineService: PRAPipelineService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all background jobs' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by job status' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by job type' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results to return' })
  @Roles('admin', 'api-user')
  async getJobs(@Query() query: JobFilterQueryDto) {
    return this.jobsService.getJobs(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get job queue statistics' })
  @ApiResponse({ status: 200, description: 'Job statistics retrieved successfully' })
  @Roles('admin', 'api-user')
  async getJobStats() {
    return this.jobsService.getJobStats();
  }

  @Get('board')
  @ApiOperation({ summary: 'Get Bull Board dashboard URL' })
  @ApiResponse({ status: 200, description: 'Bull Board dashboard information' })
  @Roles('admin')
  async getBullBoard() {
    return this.jobsService.getBullBoardInfo();
  }

  @Post('hospital-import')
  @Throttle({ expensive: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Start hospital data import job' })
  @ApiResponse({ status: 201, description: 'Hospital import job started successfully' })
  @Roles('admin')
  @ApiBody({ type: StartHospitalImportDto })
  async startHospitalImport(@Body() importData: StartHospitalImportDto) {
    return this.jobsService.startHospitalImport(importData);
  }

  @Post('price-update')
  @Throttle({ expensive: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Start price data update job' })
  @ApiResponse({ status: 201, description: 'Price update job started successfully' })
  @Roles('admin')
  @ApiBody({ type: StartPriceUpdateDto })
  async startPriceUpdate(@Body() updateData: StartPriceUpdateDto) {
    return this.jobsService.startPriceUpdate(updateData);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job by ID' })
  @ApiResponse({ status: 200, description: 'Job retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @Roles('admin', 'api-user')
  async getJobById(@Param('id') id: string) {
    return this.jobsService.getJobById(id);
  }

  @Post('hospitals/import')
  @Throttle({ expensive: { limit: 3, ttl: 900000 } })
  @ApiOperation({ summary: 'Trigger hospital import from Patient Rights Advocate' })
  @ApiBody({ type: TriggerHospitalImportDto, required: false })
  @ApiResponse({ status: 201, description: 'Hospital import job queued' })
  @Roles('admin')
  async triggerHospitalImport(@Body() dto: TriggerHospitalImportDto = {}) {
    const { state, forceRefresh } = dto;

    if (state) {
      await this.hospitalMonitorService.triggerHospitalImportByState(state, forceRefresh);
      return { message: `Hospital import job queued for state: ${state}` };
    } else {
      await this.hospitalMonitorService.scheduleDailyHospitalRefresh();
      return { message: 'Full hospital import job queued' };
    }
  }

  @Post('hospitals/:hospitalId/files/:fileId/download')
  @Throttle({ expensive: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Trigger price file download for specific hospital file' })
  @ApiParam({ name: 'hospitalId', description: 'Hospital ID' })
  @ApiParam({ name: 'fileId', description: 'File ID' })
  @ApiBody({ type: TriggerPriceFileDownloadDto, required: false })
  @ApiResponse({ status: 201, description: 'Price file download job queued' })
  @Roles('admin')
  async triggerPriceFileDownload(
    @Param('hospitalId') hospitalId: string,
    @Param('fileId') fileId: string,
    @Body() dto: TriggerPriceFileDownloadDto = {},
  ) {
    const { forceReprocess } = dto;
    await this.hospitalMonitorService.triggerPriceFileDownload(hospitalId, fileId, forceReprocess);
    return { message: `Price file download job queued for hospital ${hospitalId}, file ${fileId}` };
  }

  @Get('monitoring/stats')
  @ApiOperation({ summary: 'Get monitoring statistics' })
  @ApiResponse({ status: 200, description: 'Monitoring statistics' })
  @Roles('admin', 'api-user')
  async getMonitoringStats() {
    return this.hospitalMonitorService.getMonitoringStats();
  }

  // PRA Pipeline Endpoints
  @Post('pra/scan')
  @Throttle({ expensive: { limit: 2, ttl: 900000 } })
  @ApiOperation({ summary: 'Trigger PRA unified scan' })
  @ApiResponse({ status: 201, description: 'PRA scan job queued' })
  @Roles('admin')
  @ApiBody({ type: TriggerPRAScanDto })
  async triggerPRAScan(@Body() body: TriggerPRAScanDto) {
    const { testMode = false, forceRefresh = false } = body;
    const result = await this.praPipelineService.triggerManualPRAScan(testMode, forceRefresh);
    return { message: 'PRA unified scan triggered', ...result };
  }

  @Get('pra/status')
  @ApiOperation({ summary: 'Get PRA pipeline status' })
  @ApiResponse({ status: 200, description: 'Pipeline status retrieved successfully' })
  @Roles('admin', 'api-user')
  async getPRAPipelineStatus() {
    return this.praPipelineService.getPipelineStatus();
  }

  @Post('pra/full-refresh')
  @Throttle({ expensive: { limit: 1, ttl: 900000 } })
  @ApiOperation({ summary: 'Trigger full PRA refresh' })
  @ApiResponse({ status: 201, description: 'Full PRA refresh triggered' })
  @Roles('admin')
  async triggerFullPRARefresh() {
    const result = await this.praPipelineService.triggerFullPipelineRefresh();
    return { message: 'Full PRA refresh triggered', ...result };
  }
}
