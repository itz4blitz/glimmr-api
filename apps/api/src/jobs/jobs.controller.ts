import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JobsService } from './jobs.service';
import { HospitalMonitorService } from './services/hospital-monitor.service';
import { PRAPipelineService } from './services/pra-pipeline.service';
import { JobCleanupService } from './services/job-cleanup.service';
import { TriggerHospitalImportDto, TriggerPriceFileDownloadDto, StartHospitalImportDto, StartPriceUpdateDto, TriggerPRAScanDto, TriggerAnalyticsRefreshDto } from './dto/hospital-import.dto';
import { JobFilterQueryDto } from '../common/dto/query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Jobs')
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

  @Get('queues/configs')
  @ApiOperation({ summary: 'Get all queue configurations' })
  @ApiResponse({ status: 200, description: 'Queue configurations retrieved successfully' })
  @Roles('admin', 'api-user')
  async getQueueConfigs() {
    return this.jobsService.getQueueConfigs();
  }

  @Get('queues/:queueName/config')
  @ApiOperation({ summary: 'Get configuration for a specific queue' })
  @ApiResponse({ status: 200, description: 'Queue configuration retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @Roles('admin', 'api-user')
  async getQueueConfig(@Param('queueName') queueName: string) {
    return this.jobsService.getQueueConfig(queueName);
  }

  @Put('queues/:queueName/config')
  @ApiOperation({ summary: 'Update configuration for a specific queue' })
  @ApiResponse({ status: 200, description: 'Queue configuration updated successfully' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @Roles('admin')
  async updateQueueConfig(
    @Param('queueName') queueName: string,
    @Body() config: any
  ) {
    return this.jobsService.updateQueueConfig(queueName, config);
  }

  // Removed duplicate getJobLogs - see queue/:queueName/logs endpoint below

  @Get('status')
  @ApiOperation({ summary: 'Get overall job system status' })
  @ApiResponse({ status: 200, description: 'Job system status retrieved successfully' })
  @Roles('admin', 'api-user')
  async getJobSystemStatus() {
    return this.jobsService.getJobSystemStatus();
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
  async cleanupAllQueues(@Body() _body: { dryRun?: boolean } = {}) {
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

  // Queue Control Endpoints
  @Post('queue/:queueName/pause')
  @ApiOperation({ summary: 'Pause a queue' })
  @ApiResponse({ status: 200, description: 'Queue paused successfully' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @Roles('admin')
  async pauseQueue(@Param('queueName') queueName: string) {
    const queue = this.jobsService.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }
    await queue.pause();
    return {
      message: `Queue '${queueName}' paused successfully`,
      queueName,
      status: 'paused',
    };
  }

  @Post('queue/:queueName/resume')
  @ApiOperation({ summary: 'Resume a paused queue' })
  @ApiResponse({ status: 200, description: 'Queue resumed successfully' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @Roles('admin')
  async resumeQueue(@Param('queueName') queueName: string) {
    const queue = this.jobsService.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }
    await queue.resume();
    return {
      message: `Queue '${queueName}' resumed successfully`,
      queueName,
      status: 'active',
    };
  }

  @Post('queue/:queueName/retry-failed')
  @ApiOperation({ summary: 'Retry all failed jobs in a queue' })
  @ApiResponse({ status: 200, description: 'Failed jobs retry initiated' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @Roles('admin')
  async retryFailedJobs(@Param('queueName') queueName: string) {
    const queue = this.jobsService.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }
    
    const failedJobs = await queue.getFailed();
    let retriedCount = 0;
    
    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
      } catch (error) {
        // Log error silently - job retry failed
      }
    }
    
    return {
      message: `Retry initiated for failed jobs in queue '${queueName}'`,
      queueName,
      totalFailed: failedJobs.length,
      retriedCount,
    };
  }

  @Post('queue/:queueName/add')
  @ApiOperation({ summary: 'Manually add a job to a queue' })
  @ApiResponse({ status: 201, description: 'Job added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid queue name or job data' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @Roles('admin')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { 
          type: 'string', 
          description: 'Job name (optional)',
          example: 'manual-price-download-123'
        },
        data: { 
          type: 'object', 
          description: 'Job data',
          example: { hospitalId: 'test-001', fileUrl: 'https://example.com/file.csv' }
        },
        opts: { 
          type: 'object',
          description: 'Job options (optional)',
          properties: {
            priority: { type: 'number', example: 5 },
            delay: { type: 'number', example: 0 },
            attempts: { type: 'number', example: 3 },
            backoff: { 
              type: 'object',
              properties: {
                type: { type: 'string', example: 'exponential' },
                delay: { type: 'number', example: 5000 }
              }
            }
          }
        },
      },
      required: ['data'],
    },
  })
  async addJobToQueue(
    @Param('queueName') queueName: string,
    @Body() body: { name?: string; data: any; opts?: any }
  ) {
    const queue = this.jobsService.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const jobName = body.name || `manual-${queueName}-${Date.now()}`;
    const jobOpts = body.opts || {
      priority: 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 20,
      removeOnFail: 30,
    };

    const job = await queue.add(jobName, body.data, jobOpts);

    return {
      message: `Job added to queue '${queueName}' successfully`,
      jobId: job.id,
      jobName: job.name,
      queueName,
    };
  }

  @Post('queue/:queueName/drain')
  @ApiOperation({ summary: 'Drain queue (alternative POST endpoint for UI compatibility)' })
  @ApiResponse({ status: 200, description: 'Queue drained successfully' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue to drain' })
  @Roles('admin')
  async drainQueuePost(@Param('queueName') queueName: string) {
    await this.jobCleanupService.drainQueue(queueName);
    return {
      message: `Queue '${queueName}' drained successfully`,
      queueName,
      warning: 'All waiting and delayed jobs have been removed',
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

  // Analytics Refresh Endpoints
  @Post('analytics/refresh')
  @Throttle({ expensive: { limit: 2, ttl: 1800000 } }) // 30 minutes
  @ApiOperation({ summary: 'Trigger analytics refresh job' })
  @ApiResponse({ status: 201, description: 'Analytics refresh job queued successfully' })
  @Roles('admin')
  @ApiBody({ type: TriggerAnalyticsRefreshDto })
  async triggerAnalyticsRefresh(@Body() dto: TriggerAnalyticsRefreshDto = {}) {
    const { metricTypes, forceRefresh = false, batchSize = 100 } = dto;
    
    const result = await this.jobsService.startAnalyticsRefresh({
      metricTypes,
      forceRefresh,
      batchSize,
    });
    
    return { 
      message: 'Analytics refresh job queued successfully',
      ...result 
    };
  }

  // Data Export Endpoints
  @Post('export')
  @Throttle({ expensive: { limit: 3, ttl: 1800000 } }) // 30 minutes
  @ApiOperation({ summary: 'Trigger data export job' })
  @ApiResponse({ status: 201, description: 'Data export job queued successfully' })
  @Roles('admin')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        format: { 
          type: 'string', 
          enum: ['json', 'csv', 'excel'],
          description: 'Export format',
          default: 'json'
        },
        dataset: {
          type: 'string',
          enum: ['hospitals', 'prices', 'analytics', 'all'],
          description: 'Dataset to export',
          default: 'hospitals'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to export',
          default: 1000
        },
        filters: {
          type: 'object',
          description: 'Additional filters for the export'
        }
      }
    }
  })
  async triggerDataExport(@Body() body: any = {}) {
    const { format = 'json', dataset = 'hospitals', limit = 1000, filters = {} } = body;
    
    const result = await this.jobsService.startDataExport({
      format,
      dataset,
      limit,
      filters,
    });
    
    return { 
      message: 'Data export job queued successfully',
      ...result 
    };
  }

  // Enhanced Queue Monitoring Endpoints
  @Get('monitoring/detailed-stats')
  @ApiOperation({ summary: 'Get detailed queue monitoring statistics' })
  @ApiResponse({ status: 200, description: 'Detailed monitoring statistics' })
  @Roles('admin', 'api-user')
  async getDetailedMonitoringStats() {
    return this.jobsService.getDetailedQueueStats();
  }

  @Get('monitoring/queue/:queueName/performance')
  @ApiOperation({ summary: 'Get performance metrics for specific queue' })
  @ApiResponse({ status: 200, description: 'Queue performance metrics' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @Roles('admin', 'api-user')
  async getQueuePerformance(@Param('queueName') queueName: string) {
    return this.jobsService.getQueuePerformanceMetrics(queueName);
  }

  @Get('monitoring/health')
  @ApiOperation({ summary: 'Get queue health status' })
  @ApiResponse({ status: 200, description: 'Queue health status' })
  @Roles('admin', 'api-user')
  async getQueueHealth() {
    return this.jobsService.getQueueHealth();
  }

  @Get('monitoring/trends')
  @ApiOperation({ summary: 'Get queue processing trends' })
  @ApiResponse({ status: 200, description: 'Queue processing trends' })
  @ApiQuery({ name: 'hours', required: false, description: 'Hours of history to include (default: 24)' })
  @Roles('admin', 'api-user')
  async getQueueTrends(@Query('hours') hours?: string) {
    const hoursNumber = hours ? parseInt(hours, 10) : 24;
    return this.jobsService.getQueueTrends(hoursNumber);
  }

  @Get('queue/:queueName/history')
  @ApiOperation({ summary: 'Get job history for a specific queue' })
  @ApiResponse({ status: 200, description: 'Job history retrieved successfully' })
  @ApiParam({ name: 'queueName', description: 'Queue name' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of jobs to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of jobs to skip (default: 0)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by job status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in job names and descriptions' })
  @Roles('admin', 'api-user')
  async getQueueHistory(
    @Param('queueName') queueName: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.jobsService.getQueueHistory(queueName, {
      limit: limit ? parseInt(limit.toString()) : 50,
      offset: offset ? parseInt(offset.toString()) : 0,
      status,
      search,
    });
  }

  @Get('queue/:queueName/current')
  @ApiOperation({ summary: 'Get currently running jobs for a specific queue' })
  @ApiResponse({ status: 200, description: 'Current jobs retrieved successfully' })
  @ApiParam({ name: 'queueName', description: 'Queue name' })
  @Roles('admin', 'api-user')
  async getCurrentJobs(@Param('queueName') queueName: string) {
    return this.jobsService.getCurrentJobs(queueName);
  }

  @Get('job/:jobId/details')
  @ApiOperation({ summary: 'Get detailed information about a specific job' })
  @ApiResponse({ status: 200, description: 'Job details retrieved successfully' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @Roles('admin', 'api-user')
  async getJobDetails(@Param('jobId') jobId: string) {
    return this.jobsService.getJobDetails(jobId);
  }

  @Get('job/:jobId/logs')
  @ApiOperation({ summary: 'Get logs for a specific job' })
  @ApiResponse({ status: 200, description: 'Job logs retrieved successfully' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiQuery({ name: 'level', required: false, description: 'Filter by log level' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in log messages' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of logs to return (default: 100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of logs to skip (default: 0)' })
  @Roles('admin', 'api-user')
  async getJobLogsById(
    @Param('jobId') jobId: string,
    @Query('level') level?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    // Call the new getJobLogsById method in service
    return this.jobsService.getJobLogsById(jobId, {
      level,
      search,
      limit: limit ? parseInt(limit.toString()) : 100,
      offset: offset ? parseInt(offset.toString()) : 0,
    });
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get logs from all queues' })
  @ApiResponse({ status: 200, description: 'All logs retrieved successfully' })
  @ApiQuery({ name: 'level', required: false, description: 'Filter by log level' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in log messages' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of logs to return (default: 100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of logs to skip (default: 0)' })
  @Roles('admin', 'api-user')
  async getAllLogs(
    @Query('level') level?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.jobsService.getAllLogs({
      level,
      search,
      limit: limit ? parseInt(limit.toString()) : 100,
      offset: offset ? parseInt(offset.toString()) : 0,
    });
  }

  @Delete('logs/reset')
  @Throttle({ expensive: { limit: 1, ttl: 3600000 } })
  @ApiOperation({ 
    summary: 'Reset all job logs',
    description: 'WARNING: This permanently deletes all job logs from the database. This operation cannot be undone!'
  })
  @ApiResponse({ status: 200, description: 'Logs reset successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @Roles('admin')
  async resetAllLogs() {
    return this.jobsService.resetAllLogs();
  }

  @Get('queue/:queueName/logs')
  @ApiOperation({ summary: 'Get logs for a specific queue' })
  @ApiResponse({ status: 200, description: 'Queue logs retrieved successfully' })
  @ApiParam({ name: 'queueName', description: 'Queue name' })
  @ApiQuery({ name: 'level', required: false, description: 'Filter by log level' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in log messages' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of logs to return (default: 100)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of logs to skip (default: 0)' })
  @Roles('admin', 'api-user')
  async getQueueLogs(
    @Param('queueName') queueName: string,
    @Query('level') level?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.jobsService.getQueueLogs(queueName, {
      level,
      search,
      limit: limit ? parseInt(limit.toString()) : 100,
      offset: offset ? parseInt(offset.toString()) : 0,
    });
  }

  @Delete('queue/:queueName/logs/reset')
  @Throttle({ expensive: { limit: 1, ttl: 3600000 } })
  @ApiOperation({ 
    summary: 'Reset logs for a specific queue',
    description: 'WARNING: This permanently deletes all job logs for the specified queue. This operation cannot be undone!'
  })
  @ApiResponse({ status: 200, description: 'Queue logs reset successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @Roles('admin')
  async resetQueueLogs(@Param('queueName') queueName: string) {
    return this.jobsService.resetQueueLogs(queueName);
  }

  // Configuration endpoints
  @Get('configurations')
  @ApiOperation({ summary: 'Get all job queue configurations' })
  @ApiResponse({ status: 200, description: 'Configurations retrieved successfully' })
  @Roles('admin')
  async getJobConfigurations() {
    return this.jobsService.getQueueConfigs();
  }

  @Get('configurations/with-schedules')
  @ApiOperation({ summary: 'Get all job queue configurations with schedule information' })
  @ApiResponse({ status: 200, description: 'Configurations with schedules retrieved successfully' })
  @Roles('admin')
  async getJobConfigurationsWithSchedules() {
    return this.jobsService.getQueueConfigsWithSchedules();
  }

  @Get('configuration/:queueName')
  @ApiOperation({ summary: 'Get configuration for a specific queue' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved successfully' })
  @ApiParam({ name: 'queueName', description: 'Queue name' })
  @Roles('admin')
  async getJobQueueConfig(@Param('queueName') queueName: string) {
    return this.jobsService.getQueueConfig(queueName);
  }

  @Put('configuration/:queueName')
  @ApiOperation({ summary: 'Update configuration for a specific queue' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  @ApiParam({ name: 'queueName', description: 'Queue name' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        displayName: { type: 'string' },
        description: { type: 'string' },
        isEnabled: { type: 'boolean' },
        maxConcurrency: { type: 'number' },
        defaultJobOptions: { type: 'object' },
        removeOnComplete: { type: 'number' },
        removeOnFail: { type: 'number' },
        rateLimitMax: { type: 'number' },
        rateLimitDuration: { type: 'number' },
        alertOnFailureCount: { type: 'number' },
        alertOnQueueSize: { type: 'number' },
      },
    },
  })
  @Roles('admin')
  async updateJobQueueConfig(
    @Param('queueName') queueName: string,
    @Body() config: any,
  ) {
    return this.jobsService.updateQueueConfig(queueName, config);
  }

  // Schedule endpoints (TODO: Implement in service)
  // @Get('schedules')
  // @ApiOperation({ summary: 'Get all job schedules' })
  // @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
  // @Roles('admin')
  // async getJobSchedules() {
  //   return this.jobsService.getJobSchedules();
  // }

  // @Post('schedules')
  // @ApiOperation({ summary: 'Create a new job schedule' })
  // @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     required: ['name', 'templateId', 'cronExpression'],
  //     properties: {
  //       name: { type: 'string' },
  //       description: { type: 'string' },
  //       templateId: { type: 'string' },
  //       cronExpression: { type: 'string' },
  //       timezone: { type: 'string', default: 'UTC' },
  //       priority: { type: 'number' },
  //       timeout: { type: 'number' },
  //       retryAttempts: { type: 'number' },
  //       retryDelay: { type: 'number' },
  //       jobConfig: { type: 'object' },
  //       isEnabled: { type: 'boolean', default: true },
  //     },
  //   },
  // })
  // @Roles('admin')
  // async createJobSchedule(@Body() schedule: any) {
  //   return this.jobsService.createJobSchedule(schedule);
  // }

  // @Put('schedules/:scheduleId')
  // @ApiOperation({ summary: 'Update a job schedule' })
  // @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  // @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       name: { type: 'string' },
  //       description: { type: 'string' },
  //       cronExpression: { type: 'string' },
  //       timezone: { type: 'string' },
  //       priority: { type: 'number' },
  //       timeout: { type: 'number' },
  //       retryAttempts: { type: 'number' },
  //       retryDelay: { type: 'number' },
  //       jobConfig: { type: 'object' },
  //       isEnabled: { type: 'boolean' },
  //     },
  //   },
  // })
  // @Roles('admin')
  // async updateJobSchedule(
  //   @Param('scheduleId') scheduleId: string,
  //   @Body() updates: any,
  // ) {
  //   return this.jobsService.updateJobSchedule(scheduleId, updates);
  // }

  // @Delete('schedules/:scheduleId')
  // @ApiOperation({ summary: 'Delete a job schedule' })
  // @ApiResponse({ status: 200, description: 'Schedule deleted successfully' })
  // @ApiParam({ name: 'scheduleId', description: 'Schedule ID' })
  // @Roles('admin')
  // async deleteJobSchedule(@Param('scheduleId') scheduleId: string) {
  //   await this.jobsService.deleteJobSchedule(scheduleId);
  //   return { message: 'Schedule deleted successfully' };
  // }

  // Job creation endpoint
  @Post('create')
  @ApiOperation({ summary: 'Create a new job' })
  @ApiResponse({ status: 201, description: 'Job created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid job data' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['queue', 'name', 'data'],
      properties: {
        queue: { 
          type: 'string', 
          enum: ['price-file-parser', 'price-update', 'analytics-refresh', 'export-data', 'pra-unified-scan', 'pra-file-download'],
          description: 'Queue name' 
        },
        name: { type: 'string', description: 'Job name' },
        data: { type: 'object', description: 'Job data payload' },
        options: {
          type: 'object',
          properties: {
            priority: { type: 'number', minimum: 0, maximum: 100 },
            delay: { type: 'number', minimum: 0 },
            attempts: { type: 'number', minimum: 1, maximum: 10 },
            backoff: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['fixed', 'exponential'] },
                delay: { type: 'number' }
              }
            }
          }
        }
      }
    }
  })
  @Roles('admin')
  async createJob(@Body() body: any) {
    return this.jobsService.createJob(body);
  }

  // Job operations
  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiResponse({ status: 200, description: 'Job retry initiated' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @Roles('admin')
  async retryJob(@Param('id') id: string) {
    return this.jobsService.retryJob(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel/remove a job' })
  @ApiResponse({ status: 200, description: 'Job cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @Roles('admin')
  async cancelJob(@Param('id') id: string) {
    return this.jobsService.cancelJob(id);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple jobs' })
  @ApiResponse({ status: 201, description: 'Jobs created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid job data' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['jobs'],
      properties: {
        jobs: {
          type: 'array',
          items: {
            type: 'object',
            required: ['queue', 'name', 'data'],
            properties: {
              queue: { type: 'string' },
              name: { type: 'string' },
              data: { type: 'object' },
              options: { type: 'object' }
            }
          }
        }
      }
    }
  })
  @Roles('admin')
  async createBulkJobs(@Body() body: any) {
    return this.jobsService.createBulkJobs(body.jobs);
  }

  // This route must be at the end to avoid catching other routes
  @Get(':id')
  @ApiOperation({ summary: 'Get job by ID' })
  @ApiResponse({ status: 200, description: 'Job retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @Roles('admin', 'api-user')
  async getJobById(@Param('id') id: string) {
    return this.jobsService.getJobById(id);
  }

}
