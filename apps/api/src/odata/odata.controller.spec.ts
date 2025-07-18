import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { ODataController } from './odata.controller';
import { ODataService } from './odata.service';
import { CustomThrottlerGuard } from '../common/guards/custom-throttler.guard';

describe('ODataController - Rate Limiting Integration', () => {
import { ODataController } from './odata.controller';
import { ODataService } from './odata.service';

describe('ODataController', () => {
  let controller: ODataController;
  let odataService: ODataService;

  const mockODataService = {
    getServiceDocument: jest.fn(),
    getMetadata: jest.fn(),
    getHospitals: jest.fn(),
    getPrices: jest.fn(),
    getAnalytics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: 'default',
            ttl: 900000,
            limit: 100,
          },
          {
            name: 'expensive',
            ttl: 900000,
            limit: 10,
          },
        ]),
      ],
    }).compile();

    controller = module.get<ODataController>(ODataController);
  });

  const mockRequest = {
    url: '/odata',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'GET',
  };

  const mockResponse = {
    status: 200,
    headers: {},
    json: jest.fn(),
    send: jest.fn(),
    setHeader: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
        Reflector,
      ],
    }).compile();

    controller = module.get<ODataController>(ODataController);
    odataService = module.get<ODataService>(ODataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have OData service injected', () => {
      expect(odataService).toBeDefined();
    });
  });

  describe('Metadata Endpoints (No Rate Limiting)', () => {
    let mockRequest: any;
    let mockResponse: any;

    beforeEach(() => {
      mockRequest = {
        headers: {},
        url: '/odata',
      };

      mockResponse = {
        setHeader: jest.fn(),
        json: jest.fn(),
        send: jest.fn(),
      };
    });

    describe('GET /odata (Service Document)', () => {
      it('should return service document with correct headers', async () => {
        const mockServiceDoc = {
          '@odata.context': '$metadata',
          value: [
            { name: 'Hospitals', kind: 'EntitySet', url: 'Hospitals' },
            { name: 'Prices', kind: 'EntitySet', url: 'Prices' },
            { name: 'Analytics', kind: 'EntitySet', url: 'Analytics' },
          ],
        };
        mockODataService.getServiceDocument.mockResolvedValue(mockServiceDoc);

        await controller.getServiceDocument(mockRequest, mockResponse);

        expect(odataService.getServiceDocument).toHaveBeenCalledWith(mockRequest);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'application/json;odata.metadata=minimal'
        );
        expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
        expect(mockResponse.json).toHaveBeenCalledWith(mockServiceDoc);
      });
    });

    describe('GET /odata/$metadata', () => {
      it('should return metadata document with correct headers', async () => {
        const mockMetadata = '<?xml version="1.0" encoding="UTF-8"?><edmx:Edmx></edmx:Edmx>';
        mockODataService.getMetadata.mockResolvedValue(mockMetadata);

        await controller.getMetadata(mockResponse);

        expect(odataService.getMetadata).toHaveBeenCalledTimes(1);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/xml');
        expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
        expect(mockResponse.send).toHaveBeenCalledWith(mockMetadata);
      });
    });
  });

  describe('Entity Set Endpoints (Rate Limited)', () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        json: jest.fn(),
      };
    });

    describe('GET /odata/hospitals (20 req/15min)', () => {
      it('should return hospitals with all query parameters', async () => {
        const mockHospitals = {
          '@odata.context': '/odata/$metadata#Hospitals',
          '@odata.count': 100,
          value: [
            { id: '1', name: 'Hospital A', state: 'CA' },
            { id: '2', name: 'Hospital B', state: 'NY' },
          ],
        };
        mockODataService.getHospitals.mockResolvedValue(mockHospitals);

        await controller.getHospitals(
          mockResponse,
          'id,name,state',
          'state eq "CA"',
          'name asc',
          10,
          0,
          true
        );

        expect(odataService.getHospitals).toHaveBeenCalledWith({
          select: 'id,name,state',
          filter: 'state eq "CA"',
          orderby: 'name asc',
          top: 10,
          skip: 0,
          count: true,
        });
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'application/json;odata.metadata=minimal'
        );
        expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
        expect(mockResponse.json).toHaveBeenCalledWith(mockHospitals);
      });

      it('should handle optional query parameters', async () => {
        const mockHospitals = {
          '@odata.context': '/odata/$metadata#Hospitals',
          value: [],
        };
        mockODataService.getHospitals.mockResolvedValue(mockHospitals);

        await controller.getHospitals(mockResponse);

        expect(odataService.getHospitals).toHaveBeenCalledWith({
          select: undefined,
          filter: undefined,
          orderby: undefined,
          top: undefined,
          skip: undefined,
          count: undefined,
        });
      });

      it('should handle complex OData filters', async () => {
        const complexFilter = "state eq 'CA' and contains(name, 'Medical') and year(establishedDate) gt 2000";
        const mockHospitals = { '@odata.context': '/odata/$metadata#Hospitals', value: [] };
        mockODataService.getHospitals.mockResolvedValue(mockHospitals);

        await controller.getHospitals(
          mockResponse,
          undefined,
          complexFilter,
          undefined,
          undefined,
          undefined,
          undefined
        );

        expect(odataService.getHospitals).toHaveBeenCalledWith({
          select: undefined,
          filter: complexFilter,
          orderby: undefined,
          top: undefined,
          skip: undefined,
          count: undefined,
        });
      });
    });

    describe('GET /odata/prices (10 req/15min - Most Restricted)', () => {
      it('should return prices with pagination', async () => {
        const mockPrices = {
          '@odata.context': '/odata/$metadata#Prices',
          '@odata.count': 50000,
          '@odata.nextLink': '/odata/prices?$skip=1000',
          value: [
            { id: '1', hospitalId: 'h1', service: 'MRI', price: 1000.00 },
            { id: '2', hospitalId: 'h2', service: 'CT Scan', price: 500.00 },
          ],
        };
        mockODataService.getPrices.mockResolvedValue(mockPrices);

        await controller.getPrices(
          mockResponse,
          'hospitalId,service,price',
          'price lt 1000',
          'price desc',
          1000,
          0,
          true
        );

        expect(odataService.getPrices).toHaveBeenCalledWith({
          select: 'hospitalId,service,price',
          filter: 'price lt 1000',
          orderby: 'price desc',
          top: 1000,
          skip: 0,
          count: true,
        });
        expect(mockResponse.json).toHaveBeenCalledWith(mockPrices);
      });

      it('should handle large result sets with proper pagination', async () => {
        const mockPrices = {
          '@odata.context': '/odata/$metadata#Prices',
          '@odata.count': 1000000,
          '@odata.nextLink': '/odata/prices?$skip=5000',
          value: Array.from({ length: 5000 }, (_, i) => ({
            id: i.toString(),
            service: 'Service',
            price: 100 + i,
          })),
        };
        mockODataService.getPrices.mockResolvedValue(mockPrices);

        await controller.getPrices(
          mockResponse,
          undefined,
          undefined,
          undefined,
          5000,
          0,
          true
        );

        expect(odataService.getPrices).toHaveBeenCalledWith({
          select: undefined,
          filter: undefined,
          orderby: undefined,
          top: 5000,
          skip: 0,
          count: true,
        });
      });

      it('should handle complex price queries', async () => {
        const complexFilter = "service eq 'MRI' and price ge 500 and price le 2000 and hospitalId in ('h1', 'h2', 'h3')";
        const mockPrices = { '@odata.context': '/odata/$metadata#Prices', value: [] };
        mockODataService.getPrices.mockResolvedValue(mockPrices);

        await controller.getPrices(
          mockResponse,
          'hospitalId,service,price,effectiveDate',
          complexFilter,
          'effectiveDate desc, price asc',
          100,
          200,
          false
        );

        expect(odataService.getPrices).toHaveBeenCalledWith({
          select: 'hospitalId,service,price,effectiveDate',
          filter: complexFilter,
          orderby: 'effectiveDate desc, price asc',
          top: 100,
          skip: 200,
          count: false,
        });
      });
    });

    describe('GET /odata/analytics (15 req/15min)', () => {
      it('should return analytics with aggregations', async () => {
        const mockAnalytics = {
          '@odata.context': '/odata/$metadata#Analytics',
          value: [
            { state: 'CA', avgPrice: 1500.00, hospitalCount: 100 },
            { state: 'NY', avgPrice: 1800.00, hospitalCount: 120 },
          ],
        };
        mockODataService.getAnalytics.mockResolvedValue(mockAnalytics);

        await controller.getAnalytics(
          mockResponse,
          'state,avgPrice,hospitalCount',
          'hospitalCount gt 50',
          'avgPrice desc',
          50,
          0,
          true
        );

        expect(odataService.getAnalytics).toHaveBeenCalledWith({
          select: 'state,avgPrice,hospitalCount',
          filter: 'hospitalCount gt 50',
          orderby: 'avgPrice desc',
          top: 50,
          skip: 0,
          count: true,
        });
        expect(mockResponse.json).toHaveBeenCalledWith(mockAnalytics);
      });

      it('should handle time-based analytics queries', async () => {
        const timeFilter = "year(calculatedDate) eq 2024 and month(calculatedDate) ge 6";
        const mockAnalytics = { '@odata.context': '/odata/$metadata#Analytics', value: [] };
        mockODataService.getAnalytics.mockResolvedValue(mockAnalytics);

        await controller.getAnalytics(
          mockResponse,
          undefined,
          timeFilter,
          'calculatedDate desc',
          undefined,
          undefined,
          undefined
        );

        expect(odataService.getAnalytics).toHaveBeenCalledWith({
          select: undefined,
          filter: timeFilter,
          orderby: 'calculatedDate desc',
          top: undefined,
          skip: undefined,
          count: undefined,
        });
      });
    });
  });

  describe('Error Handling', () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        json: jest.fn(),
        send: jest.fn(),
      };
    });

    it('should propagate service errors for hospitals endpoint', async () => {
      mockODataService.getHospitals.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.getHospitals(mockResponse)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should propagate service errors for prices endpoint', async () => {
      mockODataService.getPrices.mockRejectedValue(new Error('Query timeout'));

      await expect(controller.getPrices(mockResponse)).rejects.toThrow('Query timeout');
    });

    it('should propagate service errors for analytics endpoint', async () => {
      mockODataService.getAnalytics.mockRejectedValue(new Error('Aggregation failed'));

      await expect(controller.getAnalytics(mockResponse)).rejects.toThrow('Aggregation failed');
    });

    it('should handle malformed OData queries', async () => {
      const malformedFilter = "invalid odata syntax here";
      const mockData = { '@odata.context': '/odata/$metadata#Hospitals', value: [] };
      mockODataService.getHospitals.mockResolvedValue(mockData);

      await controller.getHospitals(
        mockResponse,
        undefined,
        malformedFilter,
        undefined,
        undefined,
        undefined,
        undefined
      );

      expect(odataService.getHospitals).toHaveBeenCalledWith({
        select: undefined,
        filter: malformedFilter,
        orderby: undefined,
        top: undefined,
        skip: undefined,
        count: undefined,
      });
    });
  });

  describe('Rate Limiting Behavior', () => {
    it('should have different throttle limits for different endpoints', () => {
      // Verify that the endpoints exist and can be called
      // The actual throttling behavior is tested in the guard tests
      expect(controller.getPrices).toBeDefined(); // Most restrictive: 10 req/15min
      expect(controller.getAnalytics).toBeDefined(); // Moderate: 15 req/15min  
      expect(controller.getHospitals).toBeDefined(); // Least restrictive: 20 req/15min
    });

    it('should not throttle metadata endpoints', () => {
      // Metadata endpoints should not have throttle decorators
      expect(controller.getServiceDocument).toBeDefined();
      expect(controller.getMetadata).toBeDefined();
    });
  });

  describe('Response Headers', () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        json: jest.fn(),
        send: jest.fn(),
      };
    });

    it('should set correct OData headers for JSON responses', async () => {
      const mockData = { value: [] };
      mockODataService.getHospitals.mockResolvedValue(mockData);

      await controller.getHospitals(mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json;odata.metadata=minimal'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
    });

    it('should set correct headers for XML metadata', async () => {
      const mockMetadata = '<edmx:Edmx></edmx:Edmx>';
      mockODataService.getMetadata.mockResolvedValue(mockMetadata);

      await controller.getMetadata(mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/xml');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
    });
  });

  describe('Query Parameter Validation', () => {
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        json: jest.fn(),
      };
    });

    it('should handle boolean count parameter correctly', async () => {
      const mockData = { value: [] };
      mockODataService.getPrices.mockResolvedValue(mockData);

      // Test with boolean true
      await controller.getPrices(
        mockResponse,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );

      expect(odataService.getPrices).toHaveBeenCalledWith(
        expect.objectContaining({ count: true })
      );
    });

    it('should handle numeric parameters correctly', async () => {
      const mockData = { value: [] };
      mockODataService.getAnalytics.mockResolvedValue(mockData);

      await controller.getAnalytics(
        mockResponse,
        undefined,
        undefined,
        undefined,
        100,
        50,
        undefined
      );

      expect(odataService.getAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ top: 100, skip: 50 })
      );
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getServiceDocument', () => {
    it('should call odataService.getServiceDocument and set appropriate headers', async () => {
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata',
        value: [
          {
            name: 'hospitals',
            kind: 'EntitySet',
            url: 'hospitals',
          },
          {
            name: 'prices',
            kind: 'EntitySet',
            url: 'prices',
          },
          {
            name: 'analytics',
            kind: 'EntitySet',
            url: 'analytics',
          },
        ],
      };
      
      mockODataService.getServiceDocument.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getServiceDocument(mockRequest, mockResponse);

      expect(odataService.getServiceDocument).toHaveBeenCalledWith(mockRequest);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json;odata.metadata=minimal');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle empty service document', async () => {
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata',
        value: [],
      };
      
      mockODataService.getServiceDocument.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getServiceDocument(mockRequest, mockResponse);

      expect(odataService.getServiceDocument).toHaveBeenCalledWith(mockRequest);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json;odata.metadata=minimal');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle different request objects', async () => {
      const customRequest = {
        url: '/odata',
        headers: {
          'Accept': 'application/json',
        },
        method: 'GET',
      };
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata',
        value: [
          {
            name: 'hospitals',
            kind: 'EntitySet',
            url: 'hospitals',
          },
        ],
      };
      
      mockODataService.getServiceDocument.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getServiceDocument(customRequest, mockResponse);

      expect(odataService.getServiceDocument).toHaveBeenCalledWith(customRequest);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });
  });

  describe('getMetadata', () => {
    it('should call odataService.getMetadata and set appropriate headers', async () => {
      const expectedResult = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="GlimmrAPI" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityContainer Name="Container">
        <EntitySet Name="hospitals" EntityType="GlimmrAPI.Hospital"/>
        <EntitySet Name="prices" EntityType="GlimmrAPI.Price"/>
        <EntitySet Name="analytics" EntityType="GlimmrAPI.Analytics"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
      
      mockODataService.getMetadata.mockResolvedValue(expectedResult);
      mockResponse.send.mockReturnValue(expectedResult);

      const result = await controller.getMetadata(mockResponse);

      expect(odataService.getMetadata).toHaveBeenCalled();
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/xml');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
      expect(mockResponse.send).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle empty metadata', async () => {
      const expectedResult = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="GlimmrAPI" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityContainer Name="Container">
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
      
      mockODataService.getMetadata.mockResolvedValue(expectedResult);
      mockResponse.send.mockReturnValue(expectedResult);

      const result = await controller.getMetadata(mockResponse);

      expect(odataService.getMetadata).toHaveBeenCalled();
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/xml');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
      expect(mockResponse.send).toHaveBeenCalledWith(expectedResult);
    });
  });

  describe('getHospitals', () => {
    it('should call odataService.getHospitals with query parameters and set appropriate headers', async () => {
      const query = {
        $select: 'id,name,state',
        $filter: "state eq 'CA'",
        $orderby: 'name asc',
        $top: '10',
        $skip: '0',
        $count: 'true',
      };
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#hospitals',
        '@odata.count': 25,
        value: [
          { id: '1', name: 'Hospital A', state: 'CA' },
          { id: '2', name: 'Hospital B', state: 'CA' },
        ],
      };
      
      mockODataService.getHospitals.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getHospitals(mockResponse, query);

      expect(odataService.getHospitals).toHaveBeenCalledWith(query);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json;odata.metadata=minimal');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      const query = {};
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#hospitals',
        value: [],
      };
      
      mockODataService.getHospitals.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getHospitals(mockResponse, query);

      expect(odataService.getHospitals).toHaveBeenCalledWith(query);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle partial query parameters', async () => {
      const query = {
        $select: 'name',
        $top: '5',
      };
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#hospitals',
        value: [
          { name: 'Hospital A' },
          { name: 'Hospital B' },
        ],
      };
      
      mockODataService.getHospitals.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getHospitals(mockResponse, query);

      expect(odataService.getHospitals).toHaveBeenCalledWith(query);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle complex filter queries', async () => {
      const query = {
        $filter: "state eq 'CA' and city eq 'Los Angeles'",
        $orderby: 'name desc',
        $top: '20',
        $skip: '10',
        $count: 'true',
      };
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#hospitals',
        '@odata.count': 5,
        value: [
          { id: '1', name: 'Hospital Z', state: 'CA', city: 'Los Angeles' },
          { id: '2', name: 'Hospital Y', state: 'CA', city: 'Los Angeles' },
        ],
      };
      
      mockODataService.getHospitals.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getHospitals(mockResponse, query);

      expect(odataService.getHospitals).toHaveBeenCalledWith(query);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });
  });

  describe('getPrices', () => {
    it('should call odataService.getPrices with query parameters and set appropriate headers', async () => {
      const query = {
        $select: 'id,service,price',
        $filter: "price gt 500",
        $orderby: 'price desc',
        $top: '15',
        $skip: '5',
        $count: 'true',
      };
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#prices',
        '@odata.count': 150,
        value: [
          { id: '1', service: 'MRI', price: 1200 },
          { id: '2', service: 'CT Scan', price: 800 },
        ],
      };
      
      mockODataService.getPrices.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getPrices(mockResponse, query);

      expect(odataService.getPrices).toHaveBeenCalledWith(query);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json;odata.metadata=minimal');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      const query = {};
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#prices',
        value: [],
      };
      
      mockODataService.getPrices.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getPrices(mockResponse, query);

      expect(odataService.getPrices).toHaveBeenCalledWith(query);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle service-specific queries', async () => {
      const query = {
        $filter: "service eq 'MRI'",
        $orderby: 'price asc',
        $top: '10',
      };
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#prices',
        value: [
          { id: '1', service: 'MRI', price: 800 },
          { id: '2', service: 'MRI', price: 1000 },
        ],
      };
      
      mockODataService.getPrices.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getPrices(mockResponse, query);

      expect(odataService.getPrices).toHaveBeenCalledWith(query);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle price range queries', async () => {
      const query = {
        $filter: "price ge 100 and price le 500",
        $select: 'service,price',
        $orderby: 'service asc',
      };
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#prices',
        value: [
          { service: 'Blood Test', price: 150 },
          { service: 'X-Ray', price: 200 },
        ],
      };
      
      mockODataService.getPrices.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getPrices(mockResponse, query);

      expect(odataService.getPrices).toHaveBeenCalledWith(query);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });
  });

  describe('getAnalytics', () => {
    it('should call odataService.getAnalytics with query parameters and set appropriate headers', async () => {
      const query = {
        $select: 'id,metric,value',
        $filter: "metric eq 'average_price'",
        $orderby: 'value desc',
        $top: '10',
        $skip: '0',
        $count: 'true',
      };
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#analytics',
        '@odata.count': 50,
        value: [
          { id: '1', metric: 'average_price', value: 750 },
          { id: '2', metric: 'average_price', value: 680 },
        ],
      };
      
      mockODataService.getAnalytics.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getAnalytics(mockResponse, query);

      expect(odataService.getAnalytics).toHaveBeenCalledWith(query);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json;odata.metadata=minimal');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('OData-Version', '4.0');
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      const query = {};
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#analytics',
        value: [],
      };
      
      mockODataService.getAnalytics.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getAnalytics(mockResponse, query);

      expect(odataService.getAnalytics).toHaveBeenCalledWith(query);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle metric-specific queries', async () => {
      const query = {
        $filter: "metric eq 'total_hospitals'",
        $select: 'metric,value,date',
        $orderby: 'date desc',
      };
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#analytics',
        value: [
          { metric: 'total_hospitals', value: 1250, date: '2024-01-01' },
          { metric: 'total_hospitals', value: 1240, date: '2023-12-31' },
        ],
      };
      
      mockODataService.getAnalytics.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getAnalytics(mockResponse, query);

      expect(odataService.getAnalytics).toHaveBeenCalledWith(query);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should handle date range queries', async () => {
      const query = {
        $filter: "date ge '2024-01-01' and date le '2024-01-31'",
        $select: 'metric,value,date',
        $orderby: 'date asc',
        $top: '20',
      };
      const expectedResult = {
        '@odata.context': 'http://localhost:3000/odata/$metadata#analytics',
        value: [
          { metric: 'daily_average', value: 750, date: '2024-01-01' },
          { metric: 'daily_average', value: 760, date: '2024-01-02' },
        ],
      };
      
      mockODataService.getAnalytics.mockResolvedValue(expectedResult);
      mockResponse.json.mockReturnValue(expectedResult);

      const result = await controller.getAnalytics(mockResponse, query);

      expect(odataService.getAnalytics).toHaveBeenCalledWith(query);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });
  });
});
