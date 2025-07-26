import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";

@ApiTags("Dashboard")
@Controller("dashboard")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("stats")
  @ApiOperation({ summary: "Get dashboard statistics" })
  @ApiResponse({
    status: 200,
    description: "Dashboard statistics retrieved successfully",
  })
  async getDashboardStats() {
    return this.dashboardService.getDashboardStats();
  }
}
