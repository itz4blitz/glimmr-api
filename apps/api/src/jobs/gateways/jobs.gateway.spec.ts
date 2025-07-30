import { Test, TestingModule } from "@nestjs/testing";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { WsException } from "@nestjs/websockets";
import { JobsGateway } from "./jobs.gateway";

describe("JobsGateway", () => {
  let gateway: JobsGateway;
  let jwtService: JwtService;
  let configService: ConfigService;
  let logger: PinoLogger;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    // Create mock server
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    // Create mock socket
    mockSocket = {
      id: "test-socket-id",
      handshake: {
        auth: { token: "Bearer valid-token" },
        headers: {},
      } as unknown as Socket["handshake"],
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsGateway,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("test-secret"),
          },
        },
        {
          provide: `PinoLogger:${JobsGateway.name}`,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            setContext: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<JobsGateway>(JobsGateway);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<PinoLogger>(`PinoLogger:${JobsGateway.name}`);

    // Set the server on the gateway
    gateway.server = mockServer as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("afterInit", () => {
    it("should log initialization", () => {
      gateway.afterInit(mockServer as Server);
      expect(logger.info).toHaveBeenCalledWith("WebSocket Gateway initialized");
    });
  });

  describe("handleConnection", () => {
    it("should accept valid connection with JWT token", async () => {
      const mockPayload = { sub: "user-123", roles: ["admin"] };
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const authenticatedSocket = mockSocket as Socket & {
        userId?: string;
        roles?: string[];
      };
      await gateway.handleConnection(authenticatedSocket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid-token", {
        secret: "test-secret",
      });
      expect(authenticatedSocket.userId).toBe("user-123");
      expect(authenticatedSocket.roles).toEqual(["admin"]);
      expect(authenticatedSocket.emit).toHaveBeenCalledWith("connected", {
        message: "Connected to job monitoring",
        clientId: "test-socket-id",
      });
      expect(logger.info).toHaveBeenCalledWith({
        msg: "Client connected",
        clientId: "test-socket-id",
        userId: "user-123",
      });
    });

    it("should reject connection without token", async () => {
      const socketWithoutAuth = {
        ...mockSocket,
        handshake: { auth: {}, headers: {} } as Socket["handshake"],
      } as Socket;

      await gateway.handleConnection(socketWithoutAuth);

      expect(socketWithoutAuth.disconnect).toHaveBeenCalled();
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it("should reject connection with invalid token", async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new Error("Invalid token"),
      );

      const authenticatedSocket = mockSocket as Socket & {
        userId?: string;
        roles?: string[];
      };
      await gateway.handleConnection(authenticatedSocket);

      expect(authenticatedSocket.disconnect).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith({
        msg: "Connection error",
        error: "Invalid token",
        clientId: "test-socket-id",
      });
    });

    it("should handle token in authorization header", async () => {
      const socketWithHeaderAuth = {
        ...mockSocket,
        handshake: {
          auth: {},
          headers: { authorization: "Bearer header-token" },
        } as unknown as Socket["handshake"],
      } as Socket & { userId?: string; roles?: string[] };

      const mockPayload = { sub: "user-456", roles: ["api-user"] };
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      await gateway.handleConnection(socketWithHeaderAuth);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith("header-token", {
        secret: "test-secret",
      });
      expect(socketWithHeaderAuth.userId).toBe("user-456");
    });

    it("should handle empty roles in JWT payload", async () => {
      const mockPayload = { sub: "user-789" }; // No roles
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const authenticatedSocket = mockSocket as Socket & {
        userId?: string;
        roles?: string[];
      };
      await gateway.handleConnection(authenticatedSocket);

      expect(authenticatedSocket.userId).toBe("user-789");
      expect(authenticatedSocket.roles).toEqual([]);
    });

    it("should store connected clients", async () => {
      const mockPayload = { sub: "user-123", roles: ["admin"] };
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const authenticatedSocket = mockSocket as Socket & {
        userId?: string;
        roles?: string[];
      };
      await gateway.handleConnection(authenticatedSocket);

      expect(gateway.getConnectedClientsCount()).toBe(1);
      expect(gateway.getConnectedClientsInfo()).toEqual([
        {
          clientId: "test-socket-id",
          userId: "user-123",
          roles: ["admin"],
        },
      ]);
    });
  });

  describe("handleDisconnect", () => {
    it("should remove client from connected list", async () => {
      // First connect a client
      const mockPayload = { sub: "user-123", roles: ["admin"] };
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const authenticatedSocket = mockSocket as Socket & {
        userId?: string;
        roles?: string[];
      };
      await gateway.handleConnection(authenticatedSocket);
      expect(gateway.getConnectedClientsCount()).toBe(1);

      // Then disconnect
      gateway.handleDisconnect(authenticatedSocket);

      expect(gateway.getConnectedClientsCount()).toBe(0);
      expect(logger.info).toHaveBeenCalledWith({
        msg: "Client disconnected",
        clientId: "test-socket-id",
        userId: "user-123",
      });
    });

    it("should handle disconnect of unknown client", () => {
      const unknownSocket = { ...mockSocket, id: "unknown-id" } as Socket & {
        userId?: string;
        roles?: string[];
      };

      // Should not throw
      expect(() => gateway.handleDisconnect(unknownSocket)).not.toThrow();
      expect(logger.info).toHaveBeenCalledWith({
        msg: "Client disconnected",
        clientId: "unknown-id",
        userId: undefined,
      });
    });
  });

  describe("handleSubscribeQueue", () => {
    let authenticatedSocket: Socket & { userId?: string; roles?: string[] };

    beforeEach(() => {
      authenticatedSocket = {
        ...mockSocket,
        userId: "user-123",
        roles: ["admin"],
      } as Socket & { userId?: string; roles?: string[] };
    });

    it("should allow admin to subscribe to queue", () => {
      const result = gateway.handleSubscribeQueue(
        { queue: "price-file-parser" },
        authenticatedSocket,
      );

      expect(authenticatedSocket.join).toHaveBeenCalledWith(
        "queue:price-file-parser",
      );
      expect(logger.info).toHaveBeenCalledWith({
        msg: "Client subscribed to queue",
        clientId: "test-socket-id",
        queue: "price-file-parser",
      });
      expect(result).toEqual({
        event: "subscribed",
        data: { queue: "price-file-parser" },
      });
    });

    it("should allow api-user to subscribe to queue", () => {
      authenticatedSocket.roles = ["api-user"];

      const result = gateway.handleSubscribeQueue(
        { queue: "analytics-refresh" },
        authenticatedSocket,
      );

      expect(authenticatedSocket.join).toHaveBeenCalledWith(
        "queue:analytics-refresh",
      );
      expect(result).toEqual({
        event: "subscribed",
        data: { queue: "analytics-refresh" },
      });
    });

    it("should reject unauthorized user", () => {
      authenticatedSocket.roles = ["regular-user"];

      expect(() =>
        gateway.handleSubscribeQueue(
          { queue: "price-file-parser" },
          authenticatedSocket,
        ),
      ).toThrow(WsException);
    });

    it("should reject user with no roles", () => {
      authenticatedSocket.roles = [];

      expect(() =>
        gateway.handleSubscribeQueue(
          { queue: "price-file-parser" },
          authenticatedSocket,
        ),
      ).toThrow(WsException);
    });
  });

  describe("handleUnsubscribeQueue", () => {
    let authenticatedSocket: Socket & { userId?: string; roles?: string[] };

    beforeEach(() => {
      authenticatedSocket = {
        ...mockSocket,
        userId: "user-123",
        roles: ["admin"],
      } as Socket & { userId?: string; roles?: string[] };
    });

    it("should unsubscribe from queue", () => {
      const result = gateway.handleUnsubscribeQueue(
        { queue: "price-file-parser" },
        authenticatedSocket,
      );

      expect(authenticatedSocket.leave).toHaveBeenCalledWith(
        "queue:price-file-parser",
      );
      expect(logger.info).toHaveBeenCalledWith({
        msg: "Client unsubscribed from queue",
        clientId: "test-socket-id",
        queue: "price-file-parser",
      });
      expect(result).toEqual({
        event: "unsubscribed",
        data: { queue: "price-file-parser" },
      });
    });
  });

  describe("handleSubscribeAll", () => {
    it("should allow admin to subscribe to all jobs", () => {
      const authenticatedSocket = {
        ...mockSocket,
        userId: "user-123",
        roles: ["admin"],
      } as Socket & { userId?: string; roles?: string[] };

      const result = gateway.handleSubscribeAll(authenticatedSocket);

      expect(authenticatedSocket.join).toHaveBeenCalledWith("all-jobs");
      expect(logger.info).toHaveBeenCalledWith({
        msg: "Client subscribed to all jobs",
        clientId: "test-socket-id",
      });
      expect(result).toEqual({
        event: "subscribed",
        data: { type: "all" },
      });
    });

    it("should reject non-admin user", () => {
      const authenticatedSocket = {
        ...mockSocket,
        userId: "user-123",
        roles: ["api-user"],
      } as Socket & { userId?: string; roles?: string[] };

      expect(() => gateway.handleSubscribeAll(authenticatedSocket)).toThrow(
        WsException,
      );
    });
  });

  describe("handleSubscribeJob", () => {
    it("should allow authorized user to subscribe to specific job", () => {
      const authenticatedSocket = {
        ...mockSocket,
        userId: "user-123",
        roles: ["admin"],
      } as Socket & { userId?: string; roles?: string[] };

      const result = gateway.handleSubscribeJob(
        { jobId: "job-123" },
        authenticatedSocket,
      );

      expect(authenticatedSocket.join).toHaveBeenCalledWith("job:job-123");
      expect(logger.info).toHaveBeenCalledWith({
        msg: "Client subscribed to job",
        clientId: "test-socket-id",
        jobId: "job-123",
      });
      expect(result).toEqual({
        event: "subscribed",
        data: { jobId: "job-123" },
      });
    });

    it("should reject unauthorized user", () => {
      const authenticatedSocket = {
        ...mockSocket,
        userId: "user-123",
        roles: ["guest"],
      } as Socket & { userId?: string; roles?: string[] };

      expect(() =>
        gateway.handleSubscribeJob({ jobId: "job-123" }, authenticatedSocket),
      ).toThrow(WsException);
    });
  });

  describe("Event emission methods", () => {
    describe("emitJobUpdate", () => {
      it("should emit to all relevant rooms", () => {
        const update = {
          status: "completed",
          progress: 100,
        };

        gateway.emitJobUpdate("price-file-parser", "job-123", update);

        expect(mockServer.to).toHaveBeenCalledWith("queue:price-file-parser");
        expect(mockServer.to).toHaveBeenCalledWith("job:job-123");
        expect(mockServer.to).toHaveBeenCalledWith("all-jobs");
        expect(mockServer.emit).toHaveBeenCalledTimes(3);
        expect(mockServer.emit).toHaveBeenCalledWith("jobUpdate", {
          queue: "price-file-parser",
          jobId: "job-123",
          ...update,
        });
      });
    });

    describe("emitQueueStats", () => {
      it("should emit queue statistics", () => {
        const stats = {
          active: 5,
          waiting: 10,
          completed: 100,
          failed: 2,
        };

        gateway.emitQueueStats("analytics-refresh", stats);

        expect(mockServer.to).toHaveBeenCalledWith("queue:analytics-refresh");
        expect(mockServer.to).toHaveBeenCalledWith("all-jobs");
        expect(mockServer.emit).toHaveBeenCalledTimes(2);
        expect(mockServer.emit).toHaveBeenCalledWith("queueStats", {
          queue: "analytics-refresh",
          ...stats,
        });
      });
    });

    describe("emitSystemStats", () => {
      it("should emit system-wide statistics", () => {
        const stats = {
          totalJobs: 1000,
          activeQueues: 3,
          memoryUsage: {
            rss: "512MB",
            heapTotal: "256MB",
            heapUsed: "128MB",
          },
        };

        gateway.emitSystemStats(stats);

        expect(mockServer.to).toHaveBeenCalledWith("all-jobs");
        expect(mockServer.emit).toHaveBeenCalledWith("systemStats", stats);
      });
    });

    describe("emitJobProgress", () => {
      it("should emit job progress update", () => {
        gateway.emitJobProgress("export-data", "job-456", 75);

        expect(mockServer.to).toHaveBeenCalledWith("queue:export-data");
        expect(mockServer.to).toHaveBeenCalledWith("job:job-456");
        expect(mockServer.to).toHaveBeenCalledWith("all-jobs");
        expect(mockServer.emit).toHaveBeenCalledWith("jobUpdate", {
          queue: "export-data",
          jobId: "job-456",
          type: "progress",
          progress: 75,
          timestamp: expect.any(String),
        });
      });
    });

    describe("emitJobCompleted", () => {
      it("should emit job completion", () => {
        const result = { recordsProcessed: 1000, duration: 5000 };

        gateway.emitJobCompleted("price-update", "job-789", result);

        expect(mockServer.emit).toHaveBeenCalledWith("jobUpdate", {
          queue: "price-update",
          jobId: "job-789",
          type: "completed",
          status: "completed",
          result,
          timestamp: expect.any(String),
        });
      });
    });

    describe("emitJobFailed", () => {
      it("should emit job failure with error message", () => {
        const error = new Error("Database connection failed");

        gateway.emitJobFailed("pra-file-download", "job-999", error);

        expect(mockServer.emit).toHaveBeenCalledWith("jobUpdate", {
          queue: "pra-file-download",
          jobId: "job-999",
          type: "failed",
          status: "failed",
          error: "Database connection failed",
          timestamp: expect.any(String),
        });
      });

      it("should handle non-Error objects", () => {
        gateway.emitJobFailed("pra-file-download", "job-999", "String error");

        expect(mockServer.emit).toHaveBeenCalledWith("jobUpdate", {
          queue: "pra-file-download",
          jobId: "job-999",
          type: "failed",
          status: "failed",
          error: "String error",
          timestamp: expect.any(String),
        });
      });
    });

    describe("emitJobStarted", () => {
      it("should emit job started event", () => {
        gateway.emitJobStarted("analytics-refresh", "job-111");

        expect(mockServer.emit).toHaveBeenCalledWith("jobUpdate", {
          queue: "analytics-refresh",
          jobId: "job-111",
          type: "started",
          status: "active",
          timestamp: expect.any(String),
        });
      });
    });

    describe("emitJobAdded", () => {
      it("should emit new job added event", () => {
        const job = {
          id: "job-222",
          name: "process-hospital-data",
          data: { hospitalId: 123 },
          opts: {},
        };

        gateway.emitJobAdded("price-file-parser", job);

        expect(mockServer.to).toHaveBeenCalledWith("queue:price-file-parser");
        expect(mockServer.to).toHaveBeenCalledWith("all-jobs");
        expect(mockServer.emit).toHaveBeenCalledWith("jobAdded", {
          queue: "price-file-parser",
          type: "added",
          status: "waiting",
          job,
          timestamp: expect.any(String),
        });
      });
    });

    describe("emitJobRemoved", () => {
      it("should emit job removed event", () => {
        gateway.emitJobRemoved("export-data", "job-333");

        expect(mockServer.to).toHaveBeenCalledWith("queue:export-data");
        expect(mockServer.to).toHaveBeenCalledWith("all-jobs");
        expect(mockServer.emit).toHaveBeenCalledWith("jobRemoved", {
          queue: "export-data",
          type: "removed",
          jobId: "job-333",
          timestamp: expect.any(String),
        });
      });
    });

    describe("emitQueueStateChange", () => {
      it("should emit queue paused event", () => {
        gateway.emitQueueStateChange("price-update", true);

        expect(mockServer.emit).toHaveBeenCalledWith("queueStateChange", {
          queue: "price-update",
          type: "paused",
          isPaused: true,
          timestamp: expect.any(String),
        });
      });

      it("should emit queue resumed event", () => {
        gateway.emitQueueStateChange("price-update", false);

        expect(mockServer.emit).toHaveBeenCalledWith("queueStateChange", {
          queue: "price-update",
          type: "resumed",
          isPaused: false,
          timestamp: expect.any(String),
        });
      });
    });

    describe("emitAlert", () => {
      it("should emit alert to specific queue", () => {
        const alert = {
          type: "warning" as const,
          queue: "pra-unified-scan",
          message: "High failure rate detected",
          details: { failureRate: 0.25 },
        };

        gateway.emitAlert(alert);

        expect(mockServer.to).toHaveBeenCalledWith("queue:pra-unified-scan");
        expect(mockServer.to).toHaveBeenCalledWith("all-jobs");
        expect(mockServer.emit).toHaveBeenCalledWith("alert", {
          ...alert,
          timestamp: expect.any(String),
        });
      });

      it("should emit system-wide alert", () => {
        const alert = {
          type: "error" as const,
          message: "Redis connection lost",
        };

        gateway.emitAlert(alert);

        expect(mockServer.to).toHaveBeenCalledWith("all-jobs");
        expect(mockServer.to).not.toHaveBeenCalledWith(
          expect.stringContaining("queue:"),
        );
        expect(mockServer.emit).toHaveBeenCalledWith("alert", {
          ...alert,
          timestamp: expect.any(String),
        });
      });
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle multiple simultaneous connections", async () => {
      const mockPayload1 = { sub: "user-1", roles: ["admin"] };
      const mockPayload2 = { sub: "user-2", roles: ["api-user"] };

      (jwtService.verifyAsync as jest.Mock)
        .mockResolvedValueOnce(mockPayload1)
        .mockResolvedValueOnce(mockPayload2);

      const socket1 = { ...mockSocket, id: "socket-1" } as Socket;
      const socket2 = { ...mockSocket, id: "socket-2" } as Socket;

      await gateway.handleConnection(socket1);
      await gateway.handleConnection(socket2);

      expect(gateway.getConnectedClientsCount()).toBe(2);
      expect(gateway.getConnectedClientsInfo()).toHaveLength(2);
    });

    it("should handle token without Bearer prefix", async () => {
      const socketWithPlainToken = {
        ...mockSocket,
        handshake: {
          auth: { token: "plain-token" }, // No Bearer prefix
          headers: {},
        } as unknown as Socket["handshake"],
      } as Socket;

      const mockPayload = { sub: "user-123", roles: ["admin"] };
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      await gateway.handleConnection(socketWithPlainToken);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith("plain-token", {
        secret: "test-secret",
      });
    });

    it("should handle JWT verification timeout", async () => {
      (jwtService.verifyAsync as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 100),
          ),
      );

      const authenticatedSocket = mockSocket as Socket & {
        userId?: string;
        roles?: string[];
      };
      await gateway.handleConnection(authenticatedSocket);

      expect(authenticatedSocket.disconnect).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith({
        msg: "Token verification failed",
        error: "Timeout",
      });
    });

    it("should handle malformed JWT payload", async () => {
      const malformedPayload = null; // Invalid payload
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(malformedPayload);

      const authenticatedSocket = mockSocket as Socket & {
        userId?: string;
        roles?: string[];
      };
      await gateway.handleConnection(authenticatedSocket);

      expect(authenticatedSocket.disconnect).toHaveBeenCalled();
    });

    it("should prevent duplicate subscriptions", () => {
      const authenticatedSocket = {
        ...mockSocket,
        userId: "user-123",
        roles: ["admin"],
      } as Socket & { userId?: string; roles?: string[] };

      // Subscribe twice to the same queue
      gateway.handleSubscribeQueue(
        { queue: "price-file-parser" },
        authenticatedSocket,
      );
      gateway.handleSubscribeQueue(
        { queue: "price-file-parser" },
        authenticatedSocket,
      );

      // join should still be called twice (Socket.io handles duplicates)
      expect(authenticatedSocket.join).toHaveBeenCalledTimes(2);
    });

    it("should handle emit failures gracefully", () => {
      mockServer.emit = jest.fn().mockImplementation(() => {
        throw new Error("Emit failed");
      });

      // Should not throw
      expect(() =>
        gateway.emitJobUpdate("test-queue", "job-123", { status: "active" }),
      ).not.toThrow();
    });

    it("should clean up resources on multiple disconnects", async () => {
      const mockPayload = { sub: "user-123", roles: ["admin"] };
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const authenticatedSocket = mockSocket as Socket & {
        userId?: string;
        roles?: string[];
      };
      await gateway.handleConnection(authenticatedSocket);

      // Disconnect multiple times
      gateway.handleDisconnect(authenticatedSocket);
      gateway.handleDisconnect(authenticatedSocket);
      gateway.handleDisconnect(authenticatedSocket);

      expect(gateway.getConnectedClientsCount()).toBe(0);
    });
  });
});
