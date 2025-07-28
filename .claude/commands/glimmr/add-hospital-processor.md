---
name: add-hospital-processor
description: Creates a new hospital data processor with processor class, tests, queue integration, and database schema updates
allowed-tools:
  - bash
  - read
  - write
  - edit
  - grep
---

# Add Hospital Processor Command

Creates a complete hospital data processor for handling transparency files.

## Usage
```
/add-hospital-processor <processor-name> <file-format>
```

Example: `/add-hospital-processor mayo-clinic csv`

## Steps

1. First, check existing processors and database schema:

```bash
ls -la apps/api/src/jobs/processors/
grep -r "export class.*Processor" apps/api/src/jobs/processors/
cat apps/api/src/database/schema/hospitals.ts
```

2. Create the processor class at `apps/api/src/jobs/processors/${processorName}.processor.ts`:

```typescript
import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { PinoLogger } from 'nestjs-pino';
import { Inject } from '@nestjs/common';
import { Database } from '@/database/database.service';
import { StorageService } from '@/storage/storage.service';
import { hospitals, priceTransparencyFiles, prices } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import * as csv from 'csv-parser';

interface ${ProcessorName}JobData {
  hospitalId: string;
  fileId: string;
  filePath: string;
}

@Injectable()
@Processor('${processorName}-processor')
export class ${ProcessorName}Processor {
  constructor(
    @Inject('DB') private readonly db: Database,
    private readonly storageService: StorageService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(${ProcessorName}Processor.name);
  }

  @Process()
  async process(job: Job<${ProcessorName}JobData>) {
    const { hospitalId, fileId, filePath } = job.data;
    
    this.logger.info(
      { hospitalId, fileId, filePath },
      'Starting ${processorName} processing'
    );

    try {
      // Get file metadata
      const [file] = await this.db
        .select()
        .from(priceTransparencyFiles)
        .where(eq(priceTransparencyFiles.id, fileId));

      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      // Process based on format
      ${fileFormat === 'csv' ? `await this.processCSV(job, file);` : ''}
      ${fileFormat === 'json' ? `await this.processJSON(job, file);` : ''}
      ${fileFormat === 'xml' ? `await this.processXML(job, file);` : ''}

      // Update file status
      await this.db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: 'completed',
          processedAt: new Date(),
        })
        .where(eq(priceTransparencyFiles.id, fileId));

      this.logger.info(
        { hospitalId, fileId },
        '${processorName} processing completed'
      );
    } catch (error) {
      this.logger.error(
        { err: error, hospitalId, fileId },
        'Failed to process ${processorName} file'
      );
      
      // Update file status to failed
      await this.db
        .update(priceTransparencyFiles)
        .set({
          processingStatus: 'failed',
          errorMessage: error.message,
        })
        .where(eq(priceTransparencyFiles.id, fileId));
        
      throw error;
    }
  }

  ${fileFormat === 'csv' ? `
  private async processCSV(job: Job<${ProcessorName}JobData>, file: any) {
    const stream = await this.storageService.getFileStream(job.data.filePath);
    let totalRows = 0;
    let processedRows = 0;
    const batchSize = 100;
    let batch: any[] = [];

    const transformStream = new Transform({
      objectMode: true,
      transform: async (row, encoding, callback) => {
        try {
          totalRows++;
          
          // Map CSV columns to our schema
          const price = {
            hospitalId: job.data.hospitalId,
            fileId: job.data.fileId,
            code: row['CPT'] || row['HCPCS'] || row['DRG'],
            codeType: this.detectCodeType(row),
            description: row['Description'] || row['Service Description'],
            grossCharge: this.parsePrice(row['Gross Charge'] || row['Standard Charge']),
            discountedCashPrice: this.parsePrice(row['Cash Price'] || row['Discounted Cash Price']),
            // Add more mappings based on common column names
          };

          batch.push(price);

          if (batch.length >= batchSize) {
            await this.insertBatch(batch);
            processedRows += batch.length;
            batch = [];
            
            // Update progress
            if (processedRows % 1000 === 0) {
              await job.updateProgress((processedRows / totalRows) * 100);
            }
          }

          callback();
        } catch (error) {
          callback(error);
        }
      },
      flush: async (callback) => {
        if (batch.length > 0) {
          await this.insertBatch(batch);
          processedRows += batch.length;
        }
        await job.updateProgress(100);
        callback();
      },
    });

    await pipeline(
      stream,
      csv({
        mapHeaders: ({ header }) => header.trim(),
        skipLinesWithError: true,
      }),
      transformStream
    );

    this.logger.info(
      { totalRows, processedRows },
      'CSV processing completed'
    );
  }

  private detectCodeType(row: any): string {
    if (row['CPT']) return 'CPT';
    if (row['HCPCS']) return 'HCPCS';
    if (row['DRG']) return 'DRG';
    if (row['MS-DRG']) return 'MS-DRG';
    return 'UNKNOWN';
  }

  private parsePrice(value: string | undefined): number | null {
    if (!value) return null;
    
    // Remove common formatting
    const cleaned = value
      .replace(/[$,]/g, '')
      .replace(/\s+/g, '')
      .trim();
    
    const parsed = parseFloat(cleaned);
    
    // Validate reasonable price range
    if (isNaN(parsed) || parsed < 0 || parsed > 10000000) {
      return null;
    }
    
    return parsed;
  }

  private async insertBatch(batch: any[]) {
    if (batch.length === 0) return;
    
    try {
      await this.db.insert(prices).values(batch).onConflictDoNothing();
    } catch (error) {
      this.logger.error(
        { err: error, batchSize: batch.length },
        'Failed to insert price batch'
      );
      // Log sample of failed data for debugging
      this.logger.debug(
        { sample: batch.slice(0, 3) },
        'Failed batch sample'
      );
    }
  }
  ` : ''}

  ${fileFormat === 'json' ? `
  private async processJSON(job: Job<${ProcessorName}JobData>, file: any) {
    const fileContent = await this.storageService.downloadFile(job.data.filePath);
    const data = JSON.parse(fileContent.toString('utf-8'));
    
    // Handle common JSON structures
    const items = data.items || data.prices || data.standard_charges || data;
    
    if (!Array.isArray(items)) {
      throw new Error('Invalid JSON structure: expected array of prices');
    }
    
    const batchSize = 100;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const prices = batch.map(item => ({
        hospitalId: job.data.hospitalId,
        fileId: job.data.fileId,
        code: item.code || item.procedure_code,
        codeType: item.code_type || 'UNKNOWN',
        description: item.description || item.procedure_description,
        grossCharge: this.parsePrice(item.gross_charge || item.standard_charge),
        discountedCashPrice: this.parsePrice(item.cash_price || item.discounted_cash_price),
        // Map payer-specific rates
        payerRates: this.extractPayerRates(item),
      }));
      
      await this.insertBatch(prices);
      await job.updateProgress((i + batch.length) / items.length * 100);
    }
  }
  
  private extractPayerRates(item: any): any {
    const rates = {};
    
    // Common patterns for payer rates in JSON
    if (item.payer_specific_negotiated_charges) {
      return item.payer_specific_negotiated_charges;
    }
    
    // Sometimes rates are flattened with payer name as key
    Object.keys(item).forEach(key => {
      if (key.includes('rate') || key.includes('price')) {
        rates[key] = this.parsePrice(item[key]);
      }
    });
    
    return Object.keys(rates).length > 0 ? rates : null;
  }
  ` : ''}
}
```

3. Create test file at `apps/api/src/jobs/processors/${processorName}.processor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ${ProcessorName}Processor } from './${processorName}.processor';
import { Job } from 'bull';
import { StorageService } from '@/storage/storage.service';
import { Database } from '@/database/database.service';
import { PinoLogger } from 'nestjs-pino';
import { Readable } from 'stream';

describe('${ProcessorName}Processor', () => {
  let processor: ${ProcessorName}Processor;
  let mockDb: jest.Mocked<Database>;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockLogger: jest.Mocked<PinoLogger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ${ProcessorName}Processor,
        {
          provide: 'DB',
          useValue: {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            values: jest.fn().mockReturnThis(),
            onConflictDoNothing: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getFileStream: jest.fn(),
            downloadFile: jest.fn(),
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<${ProcessorName}Processor>(${ProcessorName}Processor);
    mockDb = module.get('DB');
    mockStorageService = module.get(StorageService);
    mockLogger = module.get(PinoLogger);
  });

  describe('process', () => {
    let mockJob: jest.Mocked<Job>;

    beforeEach(() => {
      mockJob = {
        data: {
          hospitalId: 'hospital-123',
          fileId: 'file-456',
          filePath: 'hospitals/test.${fileFormat}',
        },
        updateProgress: jest.fn(),
      } as any;
    });

    it('should process ${fileFormat} file successfully', async () => {
      // Mock file data
      mockDb.select.mockResolvedValueOnce([{
        id: 'file-456',
        hospitalId: 'hospital-123',
        fileType: '${fileFormat}',
      }]);

      ${fileFormat === 'csv' ? `
      // Mock CSV stream
      const mockStream = new Readable();
      mockStorageService.getFileStream.mockReturnValue(mockStream);

      // Process job
      const processPromise = processor.process(mockJob);

      // Simulate CSV data
      mockStream.push('CPT,Description,Gross Charge,Cash Price\\n');
      mockStream.push('99213,Office Visit,250.00,150.00\\n');
      mockStream.push('99214,Extended Office Visit,350.00,200.00\\n');
      mockStream.push(null); // End stream

      await processPromise;
      ` : ''}

      ${fileFormat === 'json' ? `
      // Mock JSON data
      const mockJsonData = {
        items: [
          {
            code: '99213',
            description: 'Office Visit',
            gross_charge: 250.00,
            cash_price: 150.00,
          },
          {
            code: '99214',
            description: 'Extended Office Visit',
            gross_charge: 350.00,
            cash_price: 200.00,
          },
        ],
      };
      
      mockStorageService.downloadFile.mockResolvedValue(
        Buffer.from(JSON.stringify(mockJsonData))
      );

      await processor.process(mockJob);
      ` : ''}

      // Verify progress updates
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);

      // Verify file status updated
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({
        processingStatus: 'completed',
        processedAt: expect.any(Date),
      });
    });

    it('should handle processing errors', async () => {
      mockDb.select.mockRejectedValue(new Error('Database error'));

      await expect(processor.process(mockJob)).rejects.toThrow('Database error');

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          hospitalId: 'hospital-123',
          fileId: 'file-456',
        }),
        'Failed to process ${processorName} file'
      );
    });
  });
});
```

4. Update the jobs module to include the new processor:

```bash
# Check current jobs module structure
cat apps/api/src/jobs/modules/jobs.module.ts || cat apps/api/src/jobs/jobs.module.ts
```

5. Add the processor to the jobs module:

```typescript
// In jobs.module.ts, add to imports:
BullModule.registerQueue({
  name: '${processorName}-processor',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
}),

// Add to providers:
${ProcessorName}Processor,
```

6. Create database migration if needed:

```bash
cd apps/api
# Check if any schema changes are needed
pnpm db:generate
pnpm db:migrate
```

7. Create queue trigger in the appropriate service to use this processor:

```typescript
// In the service that triggers this processor
await this.${processorName}Queue.add('process', {
  hospitalId: hospital.id,
  fileId: file.id,
  filePath: file.storageKey,
}, {
  priority: 1,
  delay: 0,
});
```

## Common Hospital File Format Templates

### CSV Column Mappings
Common column names to handle:
- CPT/HCPCS/DRG codes: "CPT", "HCPCS", "DRG", "MS-DRG", "Procedure Code", "Service Code"
- Descriptions: "Description", "Service Description", "Procedure Description", "Service Name"
- Prices: "Gross Charge", "Standard Charge", "List Price", "Charge"
- Cash prices: "Cash Price", "Discounted Cash Price", "Self Pay", "Uninsured Discount"
- Payer rates: Often prefixed with payer name like "BCBS_Rate", "Medicare_Negotiated", etc.

### JSON Schema Patterns
Common JSON structures:
```json
// Pattern 1: Array at root
[
  { "code": "99213", "description": "...", "gross_charge": 250 }
]

// Pattern 2: Wrapped in object
{
  "hospital_name": "...",
  "last_updated": "...",
  "standard_charges": [...]
}

// Pattern 3: CMS standard format
{
  "hospital_name": "...",
  "version": "1.0",
  "standard_charge_information": [...]
}
```

### Error Handling Patterns
- File not found: Retry with exponential backoff
- Invalid format: Log sample data, mark as failed, notify admin
- Network errors: Retry up to 3 times
- Large files: Process in chunks, report progress
- Encoding issues: Try UTF-8, then ISO-8859-1, then Windows-1252

## Verification

After creating the processor, verify it works:

```bash
# 1. Check the processor was created
ls -la apps/api/src/jobs/processors/${processorName}*

# 2. Run tests
cd apps/api
pnpm test src/jobs/processors/${processorName}.processor.spec.ts

# 3. Check TypeScript compilation
pnpm check-types

# 4. Monitor in Bull Board
open http://localhost:3000/api/v1/admin/queues
```