import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JobSchedulingService } from "../services/operations/job-scheduling.service";
import {
  CreateJobScheduleDto,
  UpdateJobScheduleDto,
} from "../dto/job-operations.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";

@ApiTags("Job Scheduling")
@Controller("job-schedules")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobSchedulingController {
  constructor(
    private readonly jobSchedulingService: JobSchedulingService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new job schedule" })
  @ApiResponse({ status: 201, description: "Schedule created successfully" })
  @Roles("admin")
  createSchedule(
    @Body() dto: CreateJobScheduleDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.jobSchedulingService.createSchedule(dto, user.id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update an existing job schedule" })
  @ApiResponse({ status: 200, description: "Schedule updated successfully" })
  @ApiParam({ name: "id", description: "Schedule ID" })
  @Roles("admin")
  updateSchedule(
    @Param("id") id: string,
    @Body() dto: UpdateJobScheduleDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.jobSchedulingService.updateSchedule(id, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: "Get all job schedules" })
  @ApiResponse({ status: 200, description: "Schedules retrieved successfully" })
  @Roles("admin", "api-user")
  getSchedules(
    @Query("isEnabled") isEnabled?: boolean,
    @Query("queueName") queueName?: string,
  ) {
    return this.jobSchedulingService.getSchedules({ enabled: isEnabled, templateId: queueName });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific job schedule" })
  @ApiResponse({ status: 200, description: "Schedule retrieved successfully" })
  @ApiParam({ name: "id", description: "Schedule ID" })
  @Roles("admin", "api-user")
  getSchedule(@Param("id") id: string) {
    return this.jobSchedulingService.getSchedule(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a job schedule" })
  @ApiResponse({ status: 200, description: "Schedule deleted successfully" })
  @ApiParam({ name: "id", description: "Schedule ID" })
  @Roles("admin")
  deleteSchedule(@Param("id") id: string) {
    return this.jobSchedulingService.deleteSchedule(id);
  }

  @Post(":id/enable")
  @ApiOperation({ summary: "Enable a job schedule" })
  @ApiResponse({ status: 200, description: "Schedule enabled successfully" })
  @ApiParam({ name: "id", description: "Schedule ID" })
  @Roles("admin")
  enableSchedule(@Param("id") id: string) {
    return this.jobSchedulingService.updateSchedule(id, { isEnabled: true });
  }

  @Post(":id/disable")
  @ApiOperation({ summary: "Disable a job schedule" })
  @ApiResponse({ status: 200, description: "Schedule disabled successfully" })
  @ApiParam({ name: "id", description: "Schedule ID" })
  @Roles("admin")
  disableSchedule(@Param("id") id: string) {
    return this.jobSchedulingService.updateSchedule(id, { isEnabled: false });
  }

  @Post(":id/run")
  @ApiOperation({ summary: "Manually run a scheduled job" })
  @ApiResponse({ status: 200, description: "Job triggered successfully" })
  @ApiParam({ name: "id", description: "Schedule ID" })
  @Roles("admin")
  runScheduledJob(@Param("id") id: string) {
    return this.jobSchedulingService.runScheduleNow(id);
  }

  @Get(":id/history")
  @ApiOperation({ summary: "Get execution history for a schedule" })
  @ApiResponse({ status: 200, description: "History retrieved successfully" })
  @ApiParam({ name: "id", description: "Schedule ID" })
  @Roles("admin", "api-user")
  async getScheduleHistory(
    @Param("id") id: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ) {
    // Since we track lastJobId, we can use the job history from the queue
    const schedule = await this.jobSchedulingService.getSchedule(id);
    
    // Get jobs from the queue that match this schedule's template
    const jobsService = this.jobSchedulingService['jobsService'];
    const jobs = await jobsService.getJobs(schedule.template.queueName, {
      status: ['completed', 'failed'],
      limit: limit || 10,
      offset: offset || 0,
    });
    
    // Filter jobs that were created by this schedule
    const scheduleJobs = jobs.filter(job => 
      job.data?.scheduleId === id || job.opts?.repeat?.key === `schedule:${id}`
    );
    
    return {
      scheduleId: id,
      scheduleName: schedule.name,
      jobs: scheduleJobs.map(job => ({
        id: job.id,
        status: job.finishedOn ? 'completed' : 'failed',
        startedAt: job.processedOn ? new Date(job.processedOn) : null,
        completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        failedReason: job.failedReason,
        duration: job.finishedOn && job.processedOn 
          ? job.finishedOn - job.processedOn 
          : null,
      })),
      total: scheduleJobs.length,
    };
  }
}