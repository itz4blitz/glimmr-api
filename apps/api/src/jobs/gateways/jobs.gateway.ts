import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { UseGuards } from "@nestjs/common";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  roles?: string[];
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: "/jobs",
})
export class JobsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedClients: Map<string, AuthenticatedSocket> = new Map();

  constructor(
    @InjectPinoLogger(JobsGateway.name)
    private readonly logger: PinoLogger,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.info("WebSocket Gateway initialized");
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract and verify JWT token from the connection
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.verifyToken(token);
      if (!payload) {
        client.disconnect();
        return;
      }

      // Store authenticated user info
      client.userId = payload.sub;
      client.roles = payload.roles || [];

      // Add to connected clients
      this.connectedClients.set(client.id, client);

      this.logger.info({
        msg: "Client connected",
        clientId: client.id,
        userId: client.userId,
      });

      // Send initial connection success
      client.emit("connected", {
        message: "Connected to job monitoring",
        clientId: client.id,
      });
    } catch (error) {
      this.logger.error({
        msg: "Connection error",
        error: error.message,
        clientId: client.id,
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    
    this.logger.info({
      msg: "Client disconnected",
      clientId: client.id,
      userId: client.userId,
    });
  }

  // Subscribe to specific queue updates
  @SubscribeMessage("subscribeQueue")
  handleSubscribeQueue(
    @MessageBody() data: { queue: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!this.hasPermission(client, ["admin", "api-user"])) {
      throw new WsException("Unauthorized");
    }

    const room = `queue:${data.queue}`;
    client.join(room);

    this.logger.info({
      msg: "Client subscribed to queue",
      clientId: client.id,
      queue: data.queue,
    });

    return { event: "subscribed", data: { queue: data.queue } };
  }

  // Unsubscribe from queue updates
  @SubscribeMessage("unsubscribeQueue")
  handleUnsubscribeQueue(
    @MessageBody() data: { queue: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const room = `queue:${data.queue}`;
    client.leave(room);

    this.logger.info({
      msg: "Client unsubscribed from queue",
      clientId: client.id,
      queue: data.queue,
    });

    return { event: "unsubscribed", data: { queue: data.queue } };
  }

  // Subscribe to all job updates
  @SubscribeMessage("subscribeAll")
  handleSubscribeAll(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.hasPermission(client, ["admin"])) {
      throw new WsException("Unauthorized");
    }

    client.join("all-jobs");

    this.logger.info({
      msg: "Client subscribed to all jobs",
      clientId: client.id,
    });

    return { event: "subscribed", data: { type: "all" } };
  }

  // Subscribe to job-specific updates
  @SubscribeMessage("subscribeJob")
  handleSubscribeJob(
    @MessageBody() data: { jobId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!this.hasPermission(client, ["admin", "api-user"])) {
      throw new WsException("Unauthorized");
    }

    const room = `job:${data.jobId}`;
    client.join(room);

    this.logger.info({
      msg: "Client subscribed to job",
      clientId: client.id,
      jobId: data.jobId,
    });

    return { event: "subscribed", data: { jobId: data.jobId } };
  }

  // Emit job status update
  emitJobUpdate(queue: string, jobId: string, update: any) {
    // Emit to queue-specific room
    this.server.to(`queue:${queue}`).emit("jobUpdate", {
      queue,
      jobId,
      ...update,
    });

    // Emit to job-specific room
    this.server.to(`job:${jobId}`).emit("jobUpdate", {
      queue,
      jobId,
      ...update,
    });

    // Emit to all-jobs room for admins
    this.server.to("all-jobs").emit("jobUpdate", {
      queue,
      jobId,
      ...update,
    });
  }

  // Emit queue statistics update
  emitQueueStats(queue: string, stats: any) {
    this.server.to(`queue:${queue}`).emit("queueStats", {
      queue,
      ...stats,
    });

    // Also emit to all-jobs room
    this.server.to("all-jobs").emit("queueStats", {
      queue,
      ...stats,
    });
  }

  // Emit system-wide statistics
  emitSystemStats(stats: any) {
    this.server.to("all-jobs").emit("systemStats", stats);
  }

  // Emit job progress update
  emitJobProgress(queue: string, jobId: string, progress: number) {
    const update = {
      type: "progress",
      progress,
      timestamp: new Date().toISOString(),
    };

    this.emitJobUpdate(queue, jobId, update);
  }

  // Emit job completed
  emitJobCompleted(queue: string, jobId: string, result: any) {
    const update = {
      type: "completed",
      status: "completed",
      result,
      timestamp: new Date().toISOString(),
    };

    this.emitJobUpdate(queue, jobId, update);
  }

  // Emit job failed
  emitJobFailed(queue: string, jobId: string, error: any) {
    const update = {
      type: "failed",
      status: "failed",
      error: error.message || error,
      timestamp: new Date().toISOString(),
    };

    this.emitJobUpdate(queue, jobId, update);
  }

  // Emit job started
  emitJobStarted(queue: string, jobId: string) {
    const update = {
      type: "started",
      status: "active",
      timestamp: new Date().toISOString(),
    };

    this.emitJobUpdate(queue, jobId, update);
  }

  // Emit new job added
  emitJobAdded(queue: string, job: any) {
    const update = {
      type: "added",
      status: "waiting",
      job,
      timestamp: new Date().toISOString(),
    };

    this.server.to(`queue:${queue}`).emit("jobAdded", {
      queue,
      ...update,
    });

    this.server.to("all-jobs").emit("jobAdded", {
      queue,
      ...update,
    });
  }

  // Emit job removed
  emitJobRemoved(queue: string, jobId: string) {
    const update = {
      type: "removed",
      jobId,
      timestamp: new Date().toISOString(),
    };

    this.server.to(`queue:${queue}`).emit("jobRemoved", {
      queue,
      ...update,
    });

    this.server.to("all-jobs").emit("jobRemoved", {
      queue,
      ...update,
    });
  }

  // Emit queue paused/resumed
  emitQueueStateChange(queue: string, isPaused: boolean) {
    const update = {
      type: isPaused ? "paused" : "resumed",
      isPaused,
      timestamp: new Date().toISOString(),
    };

    this.server.to(`queue:${queue}`).emit("queueStateChange", {
      queue,
      ...update,
    });

    this.server.to("all-jobs").emit("queueStateChange", {
      queue,
      ...update,
    });
  }

  // Emit alert
  emitAlert(alert: {
    type: "warning" | "error" | "info";
    queue?: string;
    message: string;
    details?: any;
  }) {
    const alertData = {
      ...alert,
      timestamp: new Date().toISOString(),
    };

    if (alert.queue) {
      this.server.to(`queue:${alert.queue}`).emit("alert", alertData);
    }

    this.server.to("all-jobs").emit("alert", alertData);
  }

  // Helper methods
  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth?.token || client.handshake.headers?.authorization;
    if (!auth) return null;

    if (auth.startsWith("Bearer ")) {
      return auth.substring(7);
    }

    return auth;
  }

  private async verifyToken(token: string): Promise<any | null> {
    try {
      const secret = this.configService.get<string>("JWT_SECRET");
      return await this.jwtService.verifyAsync(token, { secret });
    } catch (error) {
      this.logger.error({
        msg: "Token verification failed",
        error: error.message,
      });
      return null;
    }
  }

  private hasPermission(client: AuthenticatedSocket, requiredRoles: string[]): boolean {
    if (!client.roles || client.roles.length === 0) return false;
    return requiredRoles.some(role => client.roles.includes(role));
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // Get connected clients info (for monitoring)
  getConnectedClientsInfo(): Array<{ clientId: string; userId: string; roles: string[] }> {
    return Array.from(this.connectedClients.values()).map(client => ({
      clientId: client.id,
      userId: client.userId || "unknown",
      roles: client.roles || [],
    }));
  }
}