import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  TriggerHospitalImportDto,
  TriggerPriceFileDownloadDto,
  StartHospitalImportDto,
  StartPriceUpdateDto,
  TriggerPRAScanDto,
} from './hospital-import.dto';

describe('Jobs DTOs', () => {
  describe('TriggerHospitalImportDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(TriggerHospitalImportDto, {
        state: 'CA',
        forceRefresh: true,
        batchSize: 50,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(TriggerHospitalImportDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only state', async () => {
      const dto = plainToInstance(TriggerHospitalImportDto, {
        state: 'TX',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only forceRefresh', async () => {
      const dto = plainToInstance(TriggerHospitalImportDto, {
        forceRefresh: false,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only batchSize', async () => {
      const dto = plainToInstance(TriggerHospitalImportDto, {
        batchSize: 25,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should transform string numbers to numbers', async () => {
      const dto = plainToInstance(TriggerHospitalImportDto, {
        batchSize: '75',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.batchSize).toBe(75);
    });

    it('should fail validation with non-string state', async () => {
      const dto = plainToInstance(TriggerHospitalImportDto, {
        state: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-boolean forceRefresh', async () => {
      const dto = plainToInstance(TriggerHospitalImportDto, {
        forceRefresh: 'true',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail validation with batchSize below minimum', async () => {
      const dto = plainToInstance(TriggerHospitalImportDto, {
        batchSize: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail validation with batchSize above maximum', async () => {
      const dto = plainToInstance(TriggerHospitalImportDto, {
        batchSize: 101,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('should fail validation with non-numeric batchSize', async () => {
      const dto = plainToInstance(TriggerHospitalImportDto, {
        batchSize: 'invalid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate with valid state codes', async () => {
      const validStates = ['CA', 'TX', 'NY', 'FL', 'IL'];
      
      for (const state of validStates) {
        const dto = plainToInstance(TriggerHospitalImportDto, { state });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should validate with batchSize at boundaries', async () => {
      // Test minimum boundary
      const minDto = plainToInstance(TriggerHospitalImportDto, {
        batchSize: 1,
      });
      const minErrors = await validate(minDto);
      expect(minErrors.length).toBe(0);

      // Test maximum boundary
      const maxDto = plainToInstance(TriggerHospitalImportDto, {
        batchSize: 100,
      });
      const maxErrors = await validate(maxDto);
      expect(maxErrors.length).toBe(0);
    });
  });

  describe('TriggerPriceFileDownloadDto', () => {
    it('should validate with valid data', async () => {
      const dto = plainToInstance(TriggerPriceFileDownloadDto, {
        forceReprocess: true,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(TriggerPriceFileDownloadDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with forceReprocess as false', async () => {
      const dto = plainToInstance(TriggerPriceFileDownloadDto, {
        forceReprocess: false,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with non-boolean forceReprocess', async () => {
      const dto = plainToInstance(TriggerPriceFileDownloadDto, {
        forceReprocess: 'true',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail validation with numeric forceReprocess', async () => {
      const dto = plainToInstance(TriggerPriceFileDownloadDto, {
        forceReprocess: 1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail validation with string forceReprocess', async () => {
      const dto = plainToInstance(TriggerPriceFileDownloadDto, {
        forceReprocess: 'false',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });
  });

  describe('StartHospitalImportDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(StartHospitalImportDto, {
        source: 'url',
        url: 'https://example.com/data.csv',
        priority: 5,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with required field only', async () => {
      const dto = plainToInstance(StartHospitalImportDto, {
        source: 'manual',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with different source types', async () => {
      const validSources = ['url', 'file', 'manual'];
      
      for (const source of validSources) {
        const dto = plainToInstance(StartHospitalImportDto, { source });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should transform string priority to number', async () => {
      const dto = plainToInstance(StartHospitalImportDto, {
        source: 'url',
        priority: '8',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.priority).toBe(8);
    });

    it('should fail validation without required source field', async () => {
      const dto = plainToInstance(StartHospitalImportDto, {
        url: 'https://example.com/data.csv',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string source', async () => {
      const dto = plainToInstance(StartHospitalImportDto, {
        source: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with non-string url', async () => {
      const dto = plainToInstance(StartHospitalImportDto, {
        source: 'url',
        url: 456,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with priority below minimum', async () => {
      const dto = plainToInstance(StartHospitalImportDto, {
        source: 'url',
        priority: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail validation with priority above maximum', async () => {
      const dto = plainToInstance(StartHospitalImportDto, {
        source: 'url',
        priority: 11,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('should validate with priority at boundaries', async () => {
      // Test minimum boundary
      const minDto = plainToInstance(StartHospitalImportDto, {
        source: 'url',
        priority: 1,
      });
      const minErrors = await validate(minDto);
      expect(minErrors.length).toBe(0);

      // Test maximum boundary
      const maxDto = plainToInstance(StartHospitalImportDto, {
        source: 'url',
        priority: 10,
      });
      const maxErrors = await validate(maxDto);
      expect(maxErrors.length).toBe(0);
    });

    it('should validate with various URL formats', async () => {
      const validUrls = [
        'https://example.com/data.csv',
        'http://localhost:3000/api/data',
        'https://api.example.com/v1/hospitals.json',
        'https://example.com/path/to/file.xlsx',
      ];
      
      for (const url of validUrls) {
        const dto = plainToInstance(StartHospitalImportDto, {
          source: 'url',
          url,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('StartPriceUpdateDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(StartPriceUpdateDto, {
        hospitalId: '123e4567-e89b-12d3-a456-426614174000',
        priority: 7,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(StartPriceUpdateDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only hospitalId', async () => {
      const dto = plainToInstance(StartPriceUpdateDto, {
        hospitalId: 'hospital-123',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only priority', async () => {
      const dto = plainToInstance(StartPriceUpdateDto, {
        priority: 3,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should transform string priority to number', async () => {
      const dto = plainToInstance(StartPriceUpdateDto, {
        priority: '6',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.priority).toBe(6);
    });

    it('should fail validation with non-string hospitalId', async () => {
      const dto = plainToInstance(StartPriceUpdateDto, {
        hospitalId: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation with priority below minimum', async () => {
      const dto = plainToInstance(StartPriceUpdateDto, {
        priority: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail validation with priority above maximum', async () => {
      const dto = plainToInstance(StartPriceUpdateDto, {
        priority: 11,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('should validate with priority at boundaries', async () => {
      // Test minimum boundary
      const minDto = plainToInstance(StartPriceUpdateDto, {
        priority: 1,
      });
      const minErrors = await validate(minDto);
      expect(minErrors.length).toBe(0);

      // Test maximum boundary
      const maxDto = plainToInstance(StartPriceUpdateDto, {
        priority: 10,
      });
      const maxErrors = await validate(maxDto);
      expect(maxErrors.length).toBe(0);
    });

    it('should validate with various hospital ID formats', async () => {
      const validHospitalIds = [
        '123e4567-e89b-12d3-a456-426614174000',
        'hospital-123',
        'abc123def456',
        'H001',
        'hospital_abc_123',
      ];
      
      for (const hospitalId of validHospitalIds) {
        const dto = plainToInstance(StartPriceUpdateDto, { hospitalId });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('TriggerPRAScanDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {
        testMode: true,
        forceRefresh: false,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only testMode', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {
        testMode: true,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only forceRefresh', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {
        forceRefresh: true,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with both fields as false', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {
        testMode: false,
        forceRefresh: false,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with both fields as true', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {
        testMode: true,
        forceRefresh: true,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with non-boolean testMode', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {
        testMode: 'true',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail validation with non-boolean forceRefresh', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {
        forceRefresh: 'false',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail validation with numeric testMode', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {
        testMode: 1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail validation with numeric forceRefresh', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {
        forceRefresh: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail validation with string boolean values', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {
        testMode: 'true',
        forceRefresh: 'false',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(2);
      expect(errors[0].constraints).toHaveProperty('isBoolean');
      expect(errors[1].constraints).toHaveProperty('isBoolean');
    });

    it('should fail validation with object values', async () => {
      const dto = plainToInstance(TriggerPRAScanDto, {
        testMode: {},
        forceRefresh: [],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(2);
      expect(errors[0].constraints).toHaveProperty('isBoolean');
      expect(errors[1].constraints).toHaveProperty('isBoolean');
    });
  });
});