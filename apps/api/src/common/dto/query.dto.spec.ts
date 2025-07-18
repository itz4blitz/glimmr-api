import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  PaginationQueryDto,
  HospitalFilterQueryDto,
  PriceFilterQueryDto,
  JobFilterQueryDto,
  PriceComparisonQueryDto,
  AnalyticsQueryDto,
  ExportQueryDto,
  ODataQueryDto,
} from './query.dto';

describe('Query DTOs', () => {
  describe('PaginationQueryDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToInstance(PaginationQueryDto, {
        limit: 10,
        offset: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(PaginationQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with string numbers that get transformed', async () => {
      const dto = plainToInstance(PaginationQueryDto, {
        limit: '25',
        offset: '5',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.limit).toBe(25);
      expect(dto.offset).toBe(5);
    });

    it('should fail validation with limit exceeding maximum', async () => {
      const dto = plainToInstance(PaginationQueryDto, {
        limit: 101,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('should fail validation with limit below minimum', async () => {
      const dto = plainToInstance(PaginationQueryDto, {
        limit: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail validation with negative offset', async () => {
      const dto = plainToInstance(PaginationQueryDto, {
        offset: -1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail validation with non-numeric values', async () => {
      const dto = plainToInstance(PaginationQueryDto, {
        limit: 'invalid',
        offset: 'invalid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('HospitalFilterQueryDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(HospitalFilterQueryDto, {
        state: 'CA',
        city: 'Los Angeles',
        limit: 20,
        offset: 10,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(HospitalFilterQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only filter fields', async () => {
      const dto = plainToInstance(HospitalFilterQueryDto, {
        state: 'TX',
        city: 'Houston',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with non-string state', async () => {
      const dto = plainToInstance(HospitalFilterQueryDto, {
        state: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string city', async () => {
      const dto = plainToInstance(HospitalFilterQueryDto, {
        city: 456,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should inherit pagination validation rules', async () => {
      const dto = plainToInstance(HospitalFilterQueryDto, {
        limit: 200,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
    });
  });

  describe('PriceFilterQueryDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(PriceFilterQueryDto, {
        hospital: '123e4567-e89b-12d3-a456-426614174000',
        service: 'MRI',
        state: 'CA',
        minPrice: 100,
        maxPrice: 1000,
        limit: 50,
        offset: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(PriceFilterQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with price filters only', async () => {
      const dto = plainToInstance(PriceFilterQueryDto, {
        minPrice: 50,
        maxPrice: 500,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should transform string prices to numbers', async () => {
      const dto = plainToInstance(PriceFilterQueryDto, {
        minPrice: '100',
        maxPrice: '500',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.minPrice).toBe(100);
      expect(dto.maxPrice).toBe(500);
    });

    it('should fail validation with negative minPrice', async () => {
      const dto = plainToInstance(PriceFilterQueryDto, {
        minPrice: -10,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail validation with negative maxPrice', async () => {
      const dto = plainToInstance(PriceFilterQueryDto, {
        maxPrice: -50,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail validation with non-string hospital', async () => {
      const dto = plainToInstance(PriceFilterQueryDto, {
        hospital: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string service', async () => {
      const dto = plainToInstance(PriceFilterQueryDto, {
        service: 789,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string state', async () => {
      const dto = plainToInstance(PriceFilterQueryDto, {
        state: 456,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('JobFilterQueryDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(JobFilterQueryDto, {
        status: 'completed',
        type: 'hospital-import',
        limit: 25,
        offset: 5,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(JobFilterQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only job filters', async () => {
      const dto = plainToInstance(JobFilterQueryDto, {
        status: 'running',
        type: 'price-update',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with non-string status', async () => {
      const dto = plainToInstance(JobFilterQueryDto, {
        status: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string type', async () => {
      const dto = plainToInstance(JobFilterQueryDto, {
        type: 456,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should inherit pagination validation rules', async () => {
      const dto = plainToInstance(JobFilterQueryDto, {
        limit: 150,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
    });
  });

  describe('PriceComparisonQueryDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(PriceComparisonQueryDto, {
        service: 'MRI',
        state: 'CA',
        limit: 20,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with required field only', async () => {
      const dto = plainToInstance(PriceComparisonQueryDto, {
        service: 'CT Scan',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should transform string limit to number', async () => {
      const dto = plainToInstance(PriceComparisonQueryDto, {
        service: 'X-Ray',
        limit: '15',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.limit).toBe(15);
    });

    it('should fail validation without required service field', async () => {
      const dto = plainToInstance(PriceComparisonQueryDto, {
        state: 'TX',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string service', async () => {
      const dto = plainToInstance(PriceComparisonQueryDto, {
        service: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string state', async () => {
      const dto = plainToInstance(PriceComparisonQueryDto, {
        service: 'MRI',
        state: 789,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with limit exceeding maximum', async () => {
      const dto = plainToInstance(PriceComparisonQueryDto, {
        service: 'MRI',
        limit: 100,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('should fail validation with limit below minimum', async () => {
      const dto = plainToInstance(PriceComparisonQueryDto, {
        service: 'MRI',
        limit: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });
  });

  describe('AnalyticsQueryDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(AnalyticsQueryDto, {
        service: 'MRI',
        state: 'CA',
        period: '30d',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(AnalyticsQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with valid period values', async () => {
      const validPeriods = ['30d', '90d', '1y'];
      
      for (const period of validPeriods) {
        const dto = plainToInstance(AnalyticsQueryDto, { period });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should fail validation with invalid period', async () => {
      const dto = plainToInstance(AnalyticsQueryDto, {
        period: '7d',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should fail validation with non-string service', async () => {
      const dto = plainToInstance(AnalyticsQueryDto, {
        service: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string state', async () => {
      const dto = plainToInstance(AnalyticsQueryDto, {
        state: 456,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string period', async () => {
      const dto = plainToInstance(AnalyticsQueryDto, {
        period: 30,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('ExportQueryDto', () => {
    it('should validate with all valid data including limit', async () => {
      const dto = plainToInstance(ExportQueryDto, {
        format: 'json',
        dataset: 'hospitals',
        limit: 1000,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(ExportQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with all supported format values', async () => {
      const validFormats = ['csv', 'json', 'excel', 'parquet'];
      
      for (const format of validFormats) {
        const dto = plainToInstance(ExportQueryDto, { format });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should validate with all supported dataset values', async () => {
      const validDatasets = ['hospitals', 'prices', 'analytics', 'all'];
      
      for (const dataset of validDatasets) {
        const dto = plainToInstance(ExportQueryDto, { dataset });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should validate boundary limit values', async () => {
      const boundaryLimits = [1, 100000];
      
      for (const limit of boundaryLimits) {
        const dto = plainToInstance(ExportQueryDto, {
          format: 'json',
          dataset: 'hospitals',
          limit,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should transform string limit to number', async () => {
      const dto = plainToInstance(ExportQueryDto, {
        format: 'json',
        dataset: 'hospitals',
        limit: '5000',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.limit).toBe(5000);
    });

    it('should validate complex parameter combinations', async () => {
      const dto = plainToInstance(ExportQueryDto, {
        format: 'parquet',
        dataset: 'all',
        limit: 50000,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with invalid format', async () => {
      const dto = plainToInstance(ExportQueryDto, {
        format: 'pdf',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should fail validation with invalid dataset', async () => {
      const dto = plainToInstance(ExportQueryDto, {
        dataset: 'users',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should fail validation with limit below minimum', async () => {
      const dto = plainToInstance(ExportQueryDto, {
        format: 'json',
        dataset: 'hospitals',
        limit: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail validation with limit above maximum', async () => {
      const dto = plainToInstance(ExportQueryDto, {
        format: 'json',
        dataset: 'hospitals',
        limit: 100001,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('should fail validation with non-string format', async () => {
      const dto = plainToInstance(ExportQueryDto, {
        format: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string dataset', async () => {
      const dto = plainToInstance(ExportQueryDto, {
        dataset: 456,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-numeric limit', async () => {
      const dto = plainToInstance(ExportQueryDto, {
        format: 'json',
        dataset: 'hospitals',
        limit: 'not-a-number',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNumber');
    });

    it('should validate with all format and dataset combinations', async () => {
      const formats = ['csv', 'json', 'excel', 'parquet'];
      const datasets = ['hospitals', 'prices', 'analytics', 'all'];
      
      for (const format of formats) {
        for (const dataset of datasets) {
          const dto = plainToInstance(ExportQueryDto, { format, dataset });
          const errors = await validate(dto);
          expect(errors.length).toBe(0);
        }
      }
    });

    it('should validate with typical streaming parameters', async () => {
      const dto = plainToInstance(ExportQueryDto, {
        format: 'json',
        dataset: 'all',
        limit: 10000,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('ODataQueryDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(ODataQueryDto, {
        $select: 'name,address,state',
        $filter: "state eq 'CA'",
        $orderby: 'name asc',
        $top: '10',
        $skip: '0',
        $count: 'true',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(ODataQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with individual OData parameters', async () => {
      const dto = plainToInstance(ODataQueryDto, {
        $select: 'id,name',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with $count as "false"', async () => {
      const dto = plainToInstance(ODataQueryDto, {
        $count: 'false',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with non-string $select', async () => {
      const dto = plainToInstance(ODataQueryDto, {
        $select: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string $filter', async () => {
      const dto = plainToInstance(ODataQueryDto, {
        $filter: 456,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string $orderby', async () => {
      const dto = plainToInstance(ODataQueryDto, {
        $orderby: 789,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string $top', async () => {
      const dto = plainToInstance(ODataQueryDto, {
        $top: 10,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string $skip', async () => {
      const dto = plainToInstance(ODataQueryDto, {
        $skip: 5,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string $count', async () => {
      const dto = plainToInstance(ODataQueryDto, {
        $count: true,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });
});