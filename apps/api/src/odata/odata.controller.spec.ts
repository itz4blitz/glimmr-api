import { Test, TestingModule } from '@nestjs/testing';
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
      ],
    }).compile();

    controller = module.get<ODataController>(ODataController);
    odataService = module.get<ODataService>(ODataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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