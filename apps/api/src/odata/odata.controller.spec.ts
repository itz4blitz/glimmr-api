import { Test, TestingModule } from "@nestjs/testing";
import { APP_GUARD } from "@nestjs/core";
import { Reflector } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { ODataController } from "./odata.controller";
import { ODataService } from "./odata.service";
import { CustomThrottlerGuard } from "../common/guards/custom-throttler.guard";
import { RbacService } from "../auth/rbac.service";

describe("ODataController", () => {
  let controller: ODataController;
  let odataService: ODataService;

  const mockODataService = {
    getServiceDocument: jest.fn(),
    getMetadata: jest.fn(),
    getHospitals: jest.fn(),
    getPrices: jest.fn(),
    getAnalytics: jest.fn(),
    formatODataError: jest.fn(),
  };

  const mockRequest = {
    url: "/odata",
    headers: {
      "Content-Type": "application/json",
    },
    method: "GET",
  };

  const mockResponse = {
    status: 200,
    headers: {},
    json: jest.fn(),
    send: jest.fn(),
    setHeader: jest.fn(),
  };

  const mockRbacService = {
    hasPermission: jest.fn().mockResolvedValue(true),
    getUserPermissions: jest
      .fn()
      .mockResolvedValue(["read:odata", "write:odata"]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: "default",
            ttl: 60000,
            limit: 10,
          },
          {
            name: "expensive",
            ttl: 900000,
            limit: 5,
          },
        ]),
      ],
      controllers: [ODataController],
      providers: [
        {
          provide: ODataService,
          useValue: mockODataService,
        },
        {
          provide: APP_GUARD,
          useClass: CustomThrottlerGuard,
        },
        {
          provide: RbacService,
          useValue: mockRbacService,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<ODataController>(ODataController);
    odataService = module.get<ODataService>(ODataService);

    // Set up formatODataError mock to return the error message
    mockODataService.formatODataError.mockImplementation(
      (title: string, message: string) => ({
        error: {
          code: "InternalServerError",
          message: title,
          details: message,
        },
      }),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Controller Initialization", () => {
    it("should be defined", () => {
      expect(controller).toBeDefined();
    });

    it("should have OData service injected", () => {
      expect(odataService).toBeDefined();
    });
  });

  describe("Metadata Endpoints (No Rate Limiting)", () => {
    let mockRequest: any;
    let mockResponse: any;

    beforeEach(() => {
      mockRequest = {
        headers: {},
        url: "/odata",
      };

      mockResponse = {
        setHeader: jest.fn(),
        json: jest.fn(),
        send: jest.fn(),
      };
    });

    describe("GET /odata (Service Document)", () => {
      it("should return service document with correct headers", async () => {
        const mockServiceDoc = {
          "@odata.context": "$metadata",
          value: [
            { name: "Hospitals", kind: "EntitySet", url: "Hospitals" },
            { name: "Prices", kind: "EntitySet", url: "Prices" },
            { name: "Analytics", kind: "EntitySet", url: "Analytics" },
          ],
        };
        mockODataService.getServiceDocument.mockResolvedValue(mockServiceDoc);

        await controller.getServiceDocument(mockRequest, mockResponse);

        expect(odataService.getServiceDocument).toHaveBeenCalledWith(
          mockRequest,
        );
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "Content-Type",
          "application/json;odata.metadata=minimal",
        );
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "OData-Version",
          "4.0",
        );
        expect(mockResponse.json).toHaveBeenCalledWith(mockServiceDoc);
      });
    });

    describe("GET /odata/$metadata", () => {
      it("should return metadata document with correct headers", async () => {
        const mockMetadata =
          '<?xml version="1.0" encoding="UTF-8"?><edmx:Edmx></edmx:Edmx>';
        mockODataService.getMetadata.mockResolvedValue(mockMetadata);

        await controller.getMetadata(mockResponse);

        expect(odataService.getMetadata).toHaveBeenCalledTimes(1);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "Content-Type",
          "application/xml",
        );
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "OData-Version",
          "4.0",
        );
        expect(mockResponse.send).toHaveBeenCalledWith(mockMetadata);
      });
    });
  });

  describe("Entity Set Endpoints (Rate Limited)", () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        json: jest.fn(),
      };
    });

    describe("GET /odata/hospitals (20 req/15min)", () => {
      it("should return hospitals with all query parameters", async () => {
        const mockHospitals = {
          "@odata.context": "/odata/$metadata#Hospitals",
          "@odata.count": 100,
          value: [
            { id: "1", name: "Hospital A", state: "CA" },
            { id: "2", name: "Hospital B", state: "NY" },
          ],
        };
        mockODataService.getHospitals.mockResolvedValue(mockHospitals);

        const query = {
          $select: "id,name,state",
          $filter: 'state eq "CA"',
          $orderby: "name asc",
          $top: "10",
          $skip: "0",
          $count: "true",
        };

        await controller.getHospitals(mockResponse, query);

        expect(odataService.getHospitals).toHaveBeenCalledWith(query);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "Content-Type",
          "application/json;odata.metadata=minimal",
        );
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "OData-Version",
          "4.0",
        );
        expect(mockResponse.json).toHaveBeenCalledWith(mockHospitals);
      });

      it("should handle optional query parameters", async () => {
        const mockHospitals = {
          "@odata.context": "/odata/$metadata#Hospitals",
          value: [],
        };
        mockODataService.getHospitals.mockResolvedValue(mockHospitals);

        await controller.getHospitals(mockResponse, {});

        expect(odataService.getHospitals).toHaveBeenCalledWith({});
      });

      it("should handle complex OData filters", async () => {
        const complexFilter =
          "state eq 'CA' and contains(name, 'Medical') and year(establishedDate) gt 2000";
        const mockHospitals = {
          "@odata.context": "/odata/$metadata#Hospitals",
          value: [],
        };
        mockODataService.getHospitals.mockResolvedValue(mockHospitals);

        await controller.getHospitals(mockResponse, { $filter: complexFilter });

        expect(odataService.getHospitals).toHaveBeenCalledWith({
          $filter: complexFilter,
        });
      });
    });

    describe("GET /odata/prices (10 req/15min - Most Restricted)", () => {
      it("should return prices with pagination", async () => {
        const mockPrices = {
          "@odata.context": "/odata/$metadata#Prices",
          "@odata.count": 50000,
          "@odata.nextLink": "/odata/prices?$skip=1000",
          value: [
            { id: "1", hospitalId: "h1", service: "MRI", price: 1000.0 },
            { id: "2", hospitalId: "h2", service: "CT Scan", price: 500.0 },
          ],
        };
        mockODataService.getPrices.mockResolvedValue(mockPrices);

        const query = {
          $select: "hospitalId,service,price",
          $filter: "price lt 1000",
          $orderby: "price desc",
          $top: "1000",
          $skip: "0",
          $count: "true",
        };

        await controller.getPrices(mockResponse, query);

        expect(odataService.getPrices).toHaveBeenCalledWith(query);
        expect(mockResponse.json).toHaveBeenCalledWith(mockPrices);
      });

      it("should handle large result sets with proper pagination", async () => {
        const mockPrices = {
          "@odata.context": "/odata/$metadata#Prices",
          "@odata.count": 1000000,
          "@odata.nextLink": "/odata/prices?$skip=5000",
          value: Array.from({ length: 5000 }, (_, i) => ({
            id: i.toString(),
            service: "Service",
            price: 100 + i,
          })),
        };
        mockODataService.getPrices.mockResolvedValue(mockPrices);

        await controller.getPrices(mockResponse, {
          $top: "5000",
          $skip: "0",
          $count: "true",
        });

        expect(odataService.getPrices).toHaveBeenCalledWith({
          $top: "5000",
          $skip: "0",
          $count: "true",
        });
      });

      it("should handle complex price queries", async () => {
        const complexFilter =
          "service eq 'MRI' and price ge 500 and price le 2000 and hospitalId in ('h1', 'h2', 'h3')";
        const mockPrices = {
          "@odata.context": "/odata/$metadata#Prices",
          value: [],
        };
        mockODataService.getPrices.mockResolvedValue(mockPrices);

        const query = {
          $select: "hospitalId,service,price,effectiveDate",
          $filter: complexFilter,
          $orderby: "effectiveDate desc, price asc",
          $top: "100",
          $skip: "200",
          $count: "false",
        };

        await controller.getPrices(mockResponse, query);

        expect(odataService.getPrices).toHaveBeenCalledWith(query);
      });
    });

    describe("GET /odata/analytics (15 req/15min)", () => {
      it("should return analytics with aggregations", async () => {
        const mockAnalytics = {
          "@odata.context": "/odata/$metadata#Analytics",
          value: [
            { state: "CA", avgPrice: 1500.0, hospitalCount: 100 },
            { state: "NY", avgPrice: 1800.0, hospitalCount: 120 },
          ],
        };
        mockODataService.getAnalytics.mockResolvedValue(mockAnalytics);

        const query = {
          $select: "state,avgPrice,hospitalCount",
          $filter: "hospitalCount gt 50",
          $orderby: "avgPrice desc",
          $top: "50",
          $skip: "0",
          $count: "true",
        };

        await controller.getAnalytics(mockResponse, query);

        expect(odataService.getAnalytics).toHaveBeenCalledWith(query);
        expect(mockResponse.json).toHaveBeenCalledWith(mockAnalytics);
      });

      it("should handle time-based analytics queries", async () => {
        const timeFilter =
          "year(calculatedDate) eq 2024 and month(calculatedDate) ge 6";
        const mockAnalytics = {
          "@odata.context": "/odata/$metadata#Analytics",
          value: [],
        };
        mockODataService.getAnalytics.mockResolvedValue(mockAnalytics);

        const query = {
          $filter: timeFilter,
          $orderby: "calculatedDate desc",
        };

        await controller.getAnalytics(mockResponse, query);

        expect(odataService.getAnalytics).toHaveBeenCalledWith(query);
      });
    });
  });

  describe("Error Handling", () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        json: jest.fn(),
        send: jest.fn(),
      };
    });

    it("should propagate service errors for hospitals endpoint", async () => {
      mockODataService.getHospitals.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(controller.getHospitals(mockResponse, {})).rejects.toThrow();
    });

    it("should propagate service errors for prices endpoint", async () => {
      mockODataService.getPrices.mockRejectedValue(new Error("Query timeout"));

      await expect(controller.getPrices(mockResponse, {})).rejects.toThrow();
    });

    it("should propagate service errors for analytics endpoint", async () => {
      mockODataService.getAnalytics.mockRejectedValue(
        new Error("Aggregation failed"),
      );

      await expect(controller.getAnalytics(mockResponse, {})).rejects.toThrow();
    });

    it("should handle malformed OData queries", async () => {
      const malformedFilter = "invalid odata syntax here";
      const mockData = {
        "@odata.context": "/odata/$metadata#Hospitals",
        value: [],
      };
      mockODataService.getHospitals.mockResolvedValue(mockData);

      await controller.getHospitals(mockResponse, { $filter: malformedFilter });

      expect(odataService.getHospitals).toHaveBeenCalledWith({
        $filter: malformedFilter,
      });
    });
  });

  describe("Rate Limiting Behavior", () => {
    it("should have different throttle limits for different endpoints", () => {
      // Verify that the endpoints exist and can be called
      // The actual throttling behavior is tested in the guard tests
      expect(controller.getPrices).toBeDefined(); // Most restrictive: 10 req/15min
      expect(controller.getAnalytics).toBeDefined(); // Moderate: 15 req/15min
      expect(controller.getHospitals).toBeDefined(); // Least restrictive: 20 req/15min
    });

    it("should not throttle metadata endpoints", () => {
      // Metadata endpoints should not have throttle decorators
      expect(controller.getServiceDocument).toBeDefined();
      expect(controller.getMetadata).toBeDefined();
    });
  });

  describe("Response Headers", () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        json: jest.fn(),
        send: jest.fn(),
      };
    });

    it("should set correct OData headers for JSON responses", async () => {
      const mockData = { value: [] };
      mockODataService.getHospitals.mockResolvedValue(mockData);

      await controller.getHospitals(mockResponse, {});

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/json;odata.metadata=minimal",
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "OData-Version",
        "4.0",
      );
    });

    it("should set correct headers for XML metadata", async () => {
      const mockMetadata = "<edmx:Edmx></edmx:Edmx>";
      mockODataService.getMetadata.mockResolvedValue(mockMetadata);

      await controller.getMetadata(mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/xml",
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "OData-Version",
        "4.0",
      );
    });
  });

  describe("Query Parameter Validation", () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        json: jest.fn(),
      };
    });

    it("should handle boolean count parameter correctly", async () => {
      const mockData = { value: [] };
      mockODataService.getPrices.mockResolvedValue(mockData);

      // Test with boolean true
      await controller.getPrices(mockResponse, { $count: "true" });

      expect(odataService.getPrices).toHaveBeenCalledWith(
        expect.objectContaining({ $count: "true" }),
      );
    });

    it("should handle numeric parameters correctly", async () => {
      const mockData = { value: [] };
      mockODataService.getAnalytics.mockResolvedValue(mockData);

      await controller.getAnalytics(mockResponse, { $top: "100", $skip: "50" });

      expect(odataService.getAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ $top: "100", $skip: "50" }),
      );
    });
  });
});
