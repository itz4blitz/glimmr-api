import { Test, TestingModule } from "@nestjs/testing";
import { HttpException, HttpStatus } from "@nestjs/common";
import { HospitalsController } from "./hospitals.controller";
import { HospitalsService } from "./hospitals.service";
import { HospitalFilterQueryDto } from "../common/dto/query.dto";
import { RbacService } from "../auth/rbac.service";

describe("HospitalsController", () => {
  let controller: HospitalsController;
  let hospitalsService: HospitalsService;

  const mockHospitalsService = {
    getHospitals: jest.fn(),
    getHospitalById: jest.fn(),
    getHospitalPrices: jest.fn(),
  };

  const mockRbacService = {
    hasPermission: jest.fn().mockReturnValue(true),
    getUserPermissions: jest.fn().mockReturnValue(["hospitals:read"]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HospitalsController],
      providers: [
        {
          provide: HospitalsService,
          useValue: mockHospitalsService,
        },
        {
          provide: RbacService,
          useValue: mockRbacService,
        },
      ],
    }).compile();

    controller = module.get<HospitalsController>(HospitalsController);
    hospitalsService = module.get<HospitalsService>(HospitalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Controller Initialization", () => {
    it("should be defined", () => {
      expect(controller).toBeDefined();
    });

    it("should be an instance of HospitalsController", () => {
      expect(controller).toBeInstanceOf(HospitalsController);
    });

    it("should have hospitalsService injected", () => {
      expect(hospitalsService).toBeDefined();
    });
  });

  describe("getHospitals", () => {
    const mockHospitalResponse = {
      data: [
        {
          id: "1",
          name: "Test Hospital",
          state: "CA",
          city: "Los Angeles",
          address: "123 Main St",
          phone: "555-0123",
          website: "https://test.com",
          bedCount: 100,
          ownership: "Private",
          hospitalType: "General",
          lastUpdated: new Date("2024-01-01"),
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    };

    it("should return hospitals successfully with all filters", async () => {
      const query: HospitalFilterQueryDto = {
        state: "CA",
        city: "Los Angeles",
        limit: 10,
        offset: 0,
      };

      mockHospitalsService.getHospitals.mockResolvedValue(mockHospitalResponse);

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockHospitalResponse);
    });

    it("should return hospitals with partial filters", async () => {
      const query: HospitalFilterQueryDto = { state: "CA" };

      mockHospitalsService.getHospitals.mockResolvedValue(mockHospitalResponse);

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockHospitalResponse);
    });

    it("should return hospitals with no filters", async () => {
      const query: HospitalFilterQueryDto = {};

      mockHospitalsService.getHospitals.mockResolvedValue({
        ...mockHospitalResponse,
        data: [],
        total: 0,
      });

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
      expect(result.total).toBe(0);
    });

    it("should return empty results when no hospitals found", async () => {
      const query: HospitalFilterQueryDto = { state: "XX" };
      const emptyResponse = {
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      mockHospitalsService.getHospitals.mockResolvedValue(emptyResponse);

      const result = await controller.getHospitals(query);

      expect(result).toEqual(emptyResponse);
    });

    it("should handle city filter only", async () => {
      const query: HospitalFilterQueryDto = { city: "Miami" };

      mockHospitalsService.getHospitals.mockResolvedValue(mockHospitalResponse);

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockHospitalResponse);
    });

    it("should handle pagination parameters", async () => {
      const query: HospitalFilterQueryDto = { limit: 25, offset: 50 };

      mockHospitalsService.getHospitals.mockResolvedValue({
        ...mockHospitalResponse,
        limit: 25,
        offset: 50,
      });

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(50);
    });

    it("should throw SERVICE_UNAVAILABLE when database connection fails with ECONNREFUSED", async () => {
      const query: HospitalFilterQueryDto = {};
      const connectionError = new Error("ECONNREFUSED");
      mockHospitalsService.getHospitals.mockRejectedValue(connectionError);

      await expect(controller.getHospitals(query)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getHospitals(query);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(error.getResponse()).toEqual({
          message: "Database connection failed. Please try again later.",
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: "Service Unavailable",
        });
      }
    });

    it("should throw SERVICE_UNAVAILABLE when database connection fails with connect error", async () => {
      const query: HospitalFilterQueryDto = {};
      const connectionError = new Error("connect timeout");
      mockHospitalsService.getHospitals.mockRejectedValue(connectionError);

      await expect(controller.getHospitals(query)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getHospitals(query);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });

    it("should throw INTERNAL_SERVER_ERROR for other errors", async () => {
      const query: HospitalFilterQueryDto = {};
      const otherError = new Error("Some other database error");
      mockHospitalsService.getHospitals.mockRejectedValue(otherError);

      await expect(controller.getHospitals(query)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getHospitals(query);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: "Internal server error occurred while fetching hospitals",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        });
      }
    });

    it("should handle special characters in filter parameters", async () => {
      const query: HospitalFilterQueryDto = {
        state: "CA",
        city: "San Francisco & Oakland",
      };

      mockHospitalsService.getHospitals.mockResolvedValue(mockHospitalResponse);

      const result = await controller.getHospitals(query);

      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
    });

    it("should handle edge case numeric limits", async () => {
      const query: HospitalFilterQueryDto = { limit: 1, offset: 999999 };

      mockHospitalsService.getHospitals.mockResolvedValue({
        data: [],
        total: 0,
        limit: 1,
        offset: 999999,
      });

      const result = await controller.getHospitals(query);

      expect(result.limit).toBe(1);
      expect(result.offset).toBe(999999);
    });
  });

  describe("getHospitalById", () => {
    const mockHospital = {
      id: "123",
      name: "Test Hospital",
      state: "CA",
      city: "Los Angeles",
      address: "123 Main St",
      phone: "555-0123",
      website: "https://test.com",
      bedCount: 100,
      ownership: "Private",
      hospitalType: "General",
      lastUpdated: new Date("2024-01-01"),
      services: ["Emergency", "Surgery"],
    };

    it("should return hospital by ID successfully", async () => {
      mockHospitalsService.getHospitalById.mockResolvedValue(mockHospital);

      const result = await controller.getHospitalById("123");

      expect(hospitalsService.getHospitalById).toHaveBeenCalledWith("123");
      expect(result).toEqual(mockHospital);
    });

    it("should handle UUID format hospital ID", async () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      mockHospitalsService.getHospitalById.mockResolvedValue({
        ...mockHospital,
        id: uuid,
      });

      const result = await controller.getHospitalById(uuid);

      expect(hospitalsService.getHospitalById).toHaveBeenCalledWith(uuid);
      expect(result.id).toBe(uuid);
    });

    it("should handle alphanumeric hospital ID", async () => {
      const alphanumericId = "HOSP-ABC-123";
      mockHospitalsService.getHospitalById.mockResolvedValue({
        ...mockHospital,
        id: alphanumericId,
      });

      const result = await controller.getHospitalById(alphanumericId);

      expect(hospitalsService.getHospitalById).toHaveBeenCalledWith(
        alphanumericId,
      );
    });

    it("should throw NOT_FOUND when hospital does not exist", async () => {
      mockHospitalsService.getHospitalById.mockResolvedValue(null);

      await expect(controller.getHospitalById("999")).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getHospitalById("999");
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(error.getResponse()).toEqual({
          message: "Hospital not found",
          statusCode: HttpStatus.NOT_FOUND,
          error: "Not Found",
        });
      }
    });

    it("should throw NOT_FOUND when hospital returns undefined", async () => {
      mockHospitalsService.getHospitalById.mockResolvedValue(undefined);

      await expect(controller.getHospitalById("999")).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getHospitalById("999");
      } catch (error) {
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it("should re-throw existing NOT_FOUND errors from service", async () => {
      const notFoundError = new HttpException(
        {
          message: "Hospital not found",
          statusCode: HttpStatus.NOT_FOUND,
          error: "Not Found",
        },
        HttpStatus.NOT_FOUND,
      );
      // Simulate the status property that HttpException creates
      (notFoundError as any).status = HttpStatus.NOT_FOUND;

      mockHospitalsService.getHospitalById.mockRejectedValue(notFoundError);

      await expect(controller.getHospitalById("999")).rejects.toThrow(
        notFoundError,
      );
    });

    it("should throw SERVICE_UNAVAILABLE when database connection fails", async () => {
      const connectionError = new Error("ECONNREFUSED: connection refused");
      mockHospitalsService.getHospitalById.mockRejectedValue(connectionError);

      await expect(controller.getHospitalById("123")).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getHospitalById("123");
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(error.getResponse()).toEqual({
          message: "Database connection failed. Please try again later.",
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: "Service Unavailable",
        });
      }
    });

    it("should throw SERVICE_UNAVAILABLE for connection timeout", async () => {
      const connectionError = new Error("connection timeout");
      mockHospitalsService.getHospitalById.mockRejectedValue(connectionError);

      await expect(controller.getHospitalById("123")).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getHospitalById("123");
      } catch (error) {
        expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });

    it("should throw INTERNAL_SERVER_ERROR for other errors", async () => {
      const otherError = new Error("Database query failed");
      mockHospitalsService.getHospitalById.mockRejectedValue(otherError);

      await expect(controller.getHospitalById("123")).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getHospitalById("123");
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual({
          message: "Internal server error occurred while fetching hospital",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        });
      }
    });
  });


  describe("Error Handling Edge Cases", () => {
    it("should handle concurrent requests properly", async () => {
      const mockResponses = [
        { id: "1", name: "Hospital 1" },
        { id: "2", name: "Hospital 2" },
        { id: "3", name: "Hospital 3" },
      ];

      mockHospitalsService.getHospitalById
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2]);

      const promises = [
        controller.getHospitalById("1"),
        controller.getHospitalById("2"),
        controller.getHospitalById("3"),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual(mockResponses);
      expect(hospitalsService.getHospitalById).toHaveBeenCalledTimes(3);
    });

    it("should preserve error message details for debugging", async () => {
      const detailedError = new Error(
        "Database constraint violation: foreign key",
      );
      mockHospitalsService.getHospitals.mockRejectedValue(detailedError);

      try {
        await controller.getHospitals({});
      } catch (error) {
        expect(error.getResponse().message).toBe(
          "Internal server error occurred while fetching hospitals",
        );
      }
    });

    it("should handle null vs undefined return values consistently", async () => {
      // Test null
      mockHospitalsService.getHospitalById.mockResolvedValueOnce(null);
      await expect(controller.getHospitalById("null-test")).rejects.toThrow(
        HttpException,
      );

      // Test undefined
      mockHospitalsService.getHospitalById.mockResolvedValueOnce(undefined);
      await expect(
        controller.getHospitalById("undefined-test"),
      ).rejects.toThrow(HttpException);
    });
  });

  describe("Input Validation Edge Cases", () => {
    it("should handle very long hospital ID", async () => {
      const longId = "a".repeat(1000);
      mockHospitalsService.getHospitalById.mockResolvedValue({
        id: longId,
        name: "Test Hospital",
      });

      const result = await controller.getHospitalById(longId);
      expect(hospitalsService.getHospitalById).toHaveBeenCalledWith(longId);
    });

    it("should handle extreme pagination values", async () => {
      const query: HospitalFilterQueryDto = {
        limit: Number.MAX_SAFE_INTEGER,
        offset: Number.MAX_SAFE_INTEGER,
      };

      mockHospitalsService.getHospitals.mockResolvedValue({
        data: [],
        total: 0,
        limit: Number.MAX_SAFE_INTEGER,
        offset: Number.MAX_SAFE_INTEGER,
      });

      await controller.getHospitals(query);
      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
    });

    it("should handle Unicode characters in search parameters", async () => {
      const query: HospitalFilterQueryDto = {
        state: "CA",
        city: "San José", // Unicode accent
      };

      mockHospitalsService.getHospitals.mockResolvedValue({
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      });

      await controller.getHospitals(query);
      expect(hospitalsService.getHospitals).toHaveBeenCalledWith(query);
    });
  });
});
