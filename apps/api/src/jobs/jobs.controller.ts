import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JobsService } from './jobs.service';
import { HospitalMonitorService } from './services/hospital-monitor.service';
import { PRAPipelineService } from './services/pra-pipeline.service';
import { TriggerHospitalImportDto, TriggerPriceFileDownloadDto } from './dto/hospital-import.dto';

@ApiTags('jobs')
@Controller('jobs')
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
  async getJobs(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: number,
  ) {
    return this.jobsService.getJobs({ status, type, limit });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get job queue statistics' })
  @ApiResponse({ status: 200, description: 'Job statistics retrieved successfully' })
  async getJobStats() {
    return this.jobsService.getJobStats();
  }

  @Get('board')
  @ApiOperation({ summary: 'Get Bull Board dashboard URL' })
  @ApiResponse({ status: 200, description: 'Bull Board dashboard information' })
  async getBullBoard() {
    return this.jobsService.getBullBoardInfo();
  }

  @Post('hospital-import')
  @Throttle({ expensive: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Start hospital data import job' })
  @ApiResponse({ status: 201, description: 'Hospital import job started successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Data source (url, file, manual)' },
        url: { type: 'string', description: 'URL for data import' },
        priority: { type: 'number', description: 'Job priority (1-10)' },
      },
    },
  })
  async startHospitalImport(@Body() importData: any) {
    return this.jobsService.startHospitalImport(importData);
  }

  @Post('price-update')
  @Throttle({ expensive: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Start price data update job' })
  @ApiResponse({ status: 201, description: 'Price update job started successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hospitalId: { type: 'string', description: 'Specific hospital ID (optional)' },
        priority: { type: 'number', description: 'Job priority (1-10)' },
      },
    },
  })
  async startPriceUpdate(@Body() updateData: any) {
    return this.jobsService.startPriceUpdate(updateData);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job by ID' })
  @ApiResponse({ status: 200, description: 'Job retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async getJobById(@Param('id') id: string) {
    return this.jobsService.getJobById(id);
  }

  @Post('hospitals/import')
  @Throttle({ expensive: { limit: 3, ttl: 900000 } })
  @ApiOperation({ summary: 'Trigger hospital import from Patient Rights Advocate' })
  @ApiBody({ type: TriggerHospitalImportDto, required: false })
  @ApiResponse({ status: 201, description: 'Hospital import job queued' })
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
  async getMonitoringStats() {
    return this.hospitalMonitorService.getMonitoringStats();
  }

  // PRA Pipeline Endpoints
  @Post('pra/scan')
  @Throttle({ expensive: { limit: 2, ttl: 900000 } })
  @ApiOperation({ summary: 'Trigger PRA unified scan' })
  @ApiResponse({ status: 201, description: 'PRA scan job queued' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        testMode: { type: 'boolean', description: 'Test mode (only scan a few states)' },
        forceRefresh: { type: 'boolean', description: 'Force refresh even if recently updated' },
      },
    },
  })
  async triggerPRAScan(@Body() body: { testMode?: boolean; forceRefresh?: boolean }) {
    const { testMode = false, forceRefresh = false } = body;
    const result = await this.praPipelineService.triggerManualPRAScan(testMode, forceRefresh);
    return { message: 'PRA unified scan triggered', ...result };
  }

  @Get('pra/status')
  @ApiOperation({ summary: 'Get PRA pipeline status' })
  @ApiResponse({ status: 200, description: 'Pipeline status retrieved successfully' })
  async getPRAPipelineStatus() {
    return this.praPipelineService.getPipelineStatus();
  }

  @Post('pra/full-refresh')
  @Throttle({ expensive: { limit: 1, ttl: 900000 } })
  @ApiOperation({ summary: 'Trigger full PRA refresh' })
  @ApiResponse({ status: 201, description: 'Full PRA refresh triggered' })
  async triggerFullPRARefresh() {
    const result = await this.praPipelineService.triggerFullPipelineRefresh();
    return { message: 'Full PRA refresh triggered', ...result };
  }
}
