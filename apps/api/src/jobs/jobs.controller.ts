import { Controller, Get, Post, Body, Param, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JobsService } from './jobs.service.js';
import { HospitalMonitorService } from './services/hospital-monitor.service.js';
import { PRAPipelineService } from './services/pra-pipeline.service.js';
import { JobCleanupService } from './services/job-cleanup.service.js';
import { TriggerHospitalImportDto, TriggerPriceFileDownloadDto, StartHospitalImportDto, StartPriceUpdateDto, TriggerPRAScanDto } from './dto/hospital-import.dto.js';
import { JobFilterQueryDto } from '../common/dto/query.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiTags('jobs')
@Controller('jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly hospitalMonitorService: HospitalMonitorService,
    private readonly praPipelineService: PRAPipelineService,
    private readonly jobCleanupService: JobCleanupService,
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

  // Job Cleanup Endpoints
  @Get('cleanup/stats')
  @ApiOperation({ summary: 'Get job cleanup statistics and queue health' })
  @ApiResponse({ status: 200, description: 'Cleanup statistics retrieved successfully' })
  @Roles('admin', 'api-user')
  async getCleanupStats() {
    return this.jobCleanupService.getCleanupStats();
  }

  // Analytics Refresh Endpoints
  @Post('analytics/refresh')
  @Throttle({ expensive: { limit: 3, ttl: 900000 } })
  @ApiOperation({ summary: 'Trigger analytics refresh job' })
  @ApiResponse({ status: 201, description: 'Analytics refresh job queued' })
  @Roles('admin')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        metricTypes: {
          type: 'array',
          items: { type: 'string', enum: ['all', 'summary', 'variance', 'geographic', 'service', 'trend'] },
          description: 'Types of metrics to calculate',
          default: ['all']
        },
        forceRefresh: {
          type: 'boolean',
          description: 'Force refresh of existing metrics',
          default: false
        },
        reportingPeriod: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'quarterly'],
          description: 'Reporting period for metrics',
          default: 'monthly'
        }
      }
    },
    required: false
  })
  async triggerAnalyticsRefresh(@Body() body: { 
    metricTypes?: string[]; 
    forceRefresh?: boolean; 
    reportingPeriod?: string 
  } = {}) {
    const result = await this.jobsService.triggerAnalyticsRefresh(body);
    return { 
      message: 'Analytics refresh job queued',
      jobId: result.id,
      ...body
    };
  }

  @Post('cleanup/all')
  @Throttle({ expensive: { limit: 2, ttl: 3600000 } })
  @ApiOperation({ summary: 'Trigger comprehensive cleanup of all job queues' })
  @ApiResponse({ status: 200, description: 'Cleanup completed successfully' })
  @ApiResponse({ status: 400, description: 'Cleanup failed' })
  @Roles('admin')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        dryRun: { 
          type: 'boolean', 
          description: 'Preview cleanup without actually deleting jobs',
          default: false 
        },
      },
    },
    required: false,
  })
  async cleanupAllQueues(@Body() body: { dryRun?: boolean } = {}) {
    const results = await this.jobCleanupService.cleanupAllQueues();
    return {
      message: 'Job cleanup completed',
      results,
      summary: results.reduce((acc, r) => {
        acc.totalDeleted += r.deletedCount;
        if (r.error) acc.errors++;
        return acc;
      }, { totalDeleted: 0, errors: 0 }),
    };
  }

  @Post('cleanup/queue/:queueName')
  @Throttle({ expensive: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Cleanup specific job queue' })
  @ApiResponse({ status: 200, description: 'Queue cleanup completed successfully' })
  @ApiResponse({ status: 400, description: 'Queue not found or cleanup failed' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue to cleanup' })
  @Roles('admin')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        completed: {
          type: 'object',
          properties: {
            maxAge: { type: 'number', description: 'Max age in milliseconds' },
            limit: { type: 'number', description: 'Max number of jobs to clean' },
          },
        },
        failed: {
          type: 'object',
          properties: {
            maxAge: { type: 'number', description: 'Max age in milliseconds' },
            limit: { type: 'number', description: 'Max number of jobs to clean' },
          },
        },
        stalled: {
          type: 'object',
          properties: {
            maxAge: { type: 'number', description: 'Max age in milliseconds' },
            limit: { type: 'number', description: 'Max number of jobs to clean' },
          },
        },
      },
    },
    required: false,
  })
  async cleanupSpecificQueue(
    @Param('queueName') queueName: string,
    @Body() policy?: any,
  ) {
    const results = await this.jobCleanupService.cleanupSpecificQueue(queueName, policy);
    return {
      message: `Queue '${queueName}' cleanup completed`,
      queueName,
      results,
      summary: {
        totalDeleted: results.reduce((sum, r) => sum + r.deletedCount, 0),
        errors: results.filter(r => r.error).length,
      },
    };
  }

  @Delete('drain/:queueName')
  @Throttle({ expensive: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ 
    summary: 'Drain queue (remove all waiting/delayed jobs)',
    description: 'WARNING: This removes all waiting and delayed jobs from the queue. Active, completed, and failed jobs are preserved.'
  })
  @ApiResponse({ status: 200, description: 'Queue drained successfully' })
  @ApiResponse({ status: 400, description: 'Queue not found' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue to drain' })
  @Roles('admin')
  async drainQueue(@Param('queueName') queueName: string) {
    await this.jobCleanupService.drainQueue(queueName);
    return {
      message: `Queue '${queueName}' drained successfully`,
      queueName,
      warning: 'All waiting and delayed jobs have been removed',
    };
  }

  @Delete('obliterate/:queueName')
  @Throttle({ expensive: { limit: 1, ttl: 3600000 } })
  @ApiOperation({ 
    summary: 'OBLITERATE queue (PERMANENTLY DELETE ALL DATA)',
    description: 'DANGER: This permanently deletes ALL jobs and queue data. This operation cannot be undone!'
  })
  @ApiResponse({ status: 200, description: 'Queue obliterated successfully' })
  @ApiResponse({ status: 400, description: 'Queue not found' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue to obliterate' })
  @Roles('admin')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        confirm: { 
          type: 'boolean', 
          description: 'Must be true to confirm obliteration',
          example: true 
        },
        queueName: { 
          type: 'string', 
          description: 'Must match the queue name in the URL path for double confirmation' 
        },
      },
      required: ['confirm', 'queueName'],
    },
  })
  async obliterateQueue(
    @Param('queueName') queueName: string,
    @Body() body: { confirm: boolean; queueName: string },
  ) {
    if (!body.confirm) {
      throw new Error('Obliteration must be confirmed by setting confirm=true');
    }
    
    if (body.queueName !== queueName) {
      throw new Error('Queue name in body must match URL parameter for double confirmation');
    }

    await this.jobCleanupService.obliterateQueue(queueName);
    return {
      message: `Queue '${queueName}' has been OBLITERATED`,
      queueName,
      warning: 'ALL DATA FOR THIS QUEUE HAS BEEN PERMANENTLY DELETED',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('cleanup/policies')
  @ApiOperation({ summary: 'Get available cleanup policies for all queues' })
  @ApiResponse({ status: 200, description: 'Cleanup policies retrieved successfully' })
  @Roles('admin', 'api-user')
  async getCleanupPolicies() {
    const availableQueues = this.jobCleanupService.getAvailableQueues();
    const policies: Record<string, any> = {};
    
    for (const queueName of availableQueues) {
      policies[queueName] = this.jobCleanupService.getDefaultPolicy(queueName);
    }

    return {
      queues: availableQueues,
      policies,
      description: 'Default cleanup policies for each queue',
    };
  }
}
