# Airbyte ETL Pipeline for Healthcare Price Transparency

## 🎯 **Overview**

Airbyte serves as the central data processing engine for Glimmr Health's price transparency platform, handling the complex ETL (Extract, Transform, Load) pipeline for healthcare pricing data from multiple sources and formats.

## 🏗️ **Data Pipeline Architecture**

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌─────────────┐
│   Data Sources  │───▶│   Airbyte    │───▶│   Transform     │───▶│ Destination │
│                 │    │   Connectors │    │   & Normalize   │    │  Database   │
└─────────────────┘    └──────────────┘    └─────────────────┘    └─────────────┘
```

## 📊 **Data Sources & Connectors**

### **1. Hospital PRA Files (Price Transparency)**
- **Source**: Playwright scraping results
- **Connector**: Custom File Connector
- **Formats**: CSV, JSON, XML, Excel
- **Frequency**: Daily
- **Data Volume**: 50MB-2GB per hospital
- **Key Fields**: 
  - Procedure codes (CPT, DRG, HCPCS)
  - Gross charges
  - Cash prices
  - Hospital identifiers

### **2. Hospital Machine Readable Files (MRF)**
- **Source**: Hospital websites (CMS mandated)
- **Connector**: Custom File Connector + HTTP Connector
- **Formats**: JSON, CSV (large files 100MB-10GB)
- **Frequency**: Monthly/Quarterly
- **Data Volume**: 100MB-10GB per hospital
- **Key Fields**:
  - Negotiated rates by payer
  - In-network vs out-of-network rates
  - Billing codes and modifiers
  - Effective dates

### **3. Reference Data**
- **Source**: CMS, AMA, external APIs
- **Connector**: HTTP API Connector
- **Formats**: JSON, CSV
- **Frequency**: Weekly/Monthly
- **Data**:
  - CPT code descriptions
  - Hospital NPI database
  - Geographic regions
  - Payer identifiers

## 🔄 **ETL Process Flow**

### **Extract Phase**

#### **File-Based Extraction**
```yaml
# Airbyte Source Configuration
source:
  name: "hospital-pra-files"
  connector: "file"
  config:
    dataset_name: "hospital_pricing"
    format: "csv"
    provider:
      storage: "local"
      file_path: "/data/scraped/hospital_files/"
    schema_inference: true
    encoding: "utf-8"
```

#### **API-Based Extraction**
```yaml
# Reference data from APIs
source:
  name: "cms-provider-data"
  connector: "http-api"
  config:
    base_url: "https://data.cms.gov/api/"
    endpoints:
      - path: "provider/data"
        method: "GET"
        pagination:
          type: "offset"
          limit: 1000
```

### **Transform Phase**

#### **Data Normalization Rules**
```sql
-- Standardize procedure codes
CASE 
  WHEN LENGTH(procedure_code) = 5 AND procedure_code ~ '^[0-9]+$' 
  THEN 'CPT-' || procedure_code
  WHEN procedure_code ~ '^DRG'
  THEN UPPER(procedure_code)
  ELSE 'UNKNOWN-' || procedure_code
END as standardized_code

-- Clean pricing data
CASE 
  WHEN gross_charge::numeric < 0 THEN NULL
  WHEN gross_charge::numeric > 1000000 THEN NULL
  ELSE gross_charge::numeric
END as cleaned_gross_charge

-- Standardize hospital identifiers
REGEXP_REPLACE(hospital_name, '[^a-zA-Z0-9\s]', '', 'g') as clean_hospital_name
```

#### **Data Quality Checks**
```yaml
# Airbyte Data Quality Rules
transformations:
  - name: "validate_pricing_data"
    type: "custom_sql"
    sql: |
      SELECT *,
        CASE 
          WHEN gross_charge IS NULL THEN 'MISSING_PRICE'
          WHEN gross_charge < 0 THEN 'NEGATIVE_PRICE'
          WHEN gross_charge > 1000000 THEN 'UNREALISTIC_PRICE'
          ELSE 'VALID'
        END as data_quality_flag
      FROM {{ source('hospital_pricing') }}
      WHERE procedure_code IS NOT NULL
```

### **Load Phase**

#### **Destination Schema**
```sql
-- Raw data tables
CREATE TABLE raw_hospital_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id VARCHAR(50),
  hospital_name VARCHAR(255),
  procedure_code VARCHAR(20),
  procedure_description TEXT,
  gross_charge DECIMAL(12,2),
  cash_price DECIMAL(12,2),
  min_negotiated_rate DECIMAL(12,2),
  max_negotiated_rate DECIMAL(12,2),
  file_source VARCHAR(255),
  extracted_at TIMESTAMP DEFAULT NOW(),
  data_quality_flag VARCHAR(50)
);

-- Processed analytics tables
CREATE TABLE hospital_price_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_npi VARCHAR(10),
  standardized_procedure_code VARCHAR(30),
  avg_gross_charge DECIMAL(12,2),
  median_negotiated_rate DECIMAL(12,2),
  price_variance DECIMAL(8,4),
  geographic_region VARCHAR(50),
  last_updated TIMESTAMP DEFAULT NOW()
);
```

## 🔧 **Custom Connectors**

### **Hospital File Processor Connector**
```python
# Custom Airbyte Source Connector
class HospitalFileSource(Source):
    def check_connection(self, config):
        # Validate file access and format
        return True, None
    
    def discover(self, config):
        # Auto-detect schema from hospital files
        schema = self._infer_schema(config['file_path'])
        return AirbyteCatalog(streams=[schema])
    
    def read(self, config, catalog, state):
        # Process hospital pricing files
        for file_path in self._get_files(config):
            yield from self._process_hospital_file(file_path)
    
    def _process_hospital_file(self, file_path):
        # Handle different file formats
        if file_path.endswith('.csv'):
            yield from self._process_csv(file_path)
        elif file_path.endswith('.json'):
            yield from self._process_json(file_path)
        elif file_path.endswith('.xlsx'):
            yield from self._process_excel(file_path)
```

### **MRF File Processor**
```python
class MRFProcessor:
    def process_mrf_file(self, file_path):
        """Process large Machine Readable Files efficiently"""
        # Stream processing for large files
        with open(file_path, 'r') as f:
            for chunk in self._read_chunks(f, chunk_size=10000):
                processed_chunk = self._normalize_mrf_data(chunk)
                yield processed_chunk
    
    def _normalize_mrf_data(self, data):
        """Normalize MRF data structure"""
        normalized = []
        for record in data:
            # Extract negotiated rates by payer
            for payer in record.get('negotiated_rates', []):
                normalized.append({
                    'hospital_id': record['hospital_id'],
                    'procedure_code': record['billing_code'],
                    'payer_name': payer['payer_name'],
                    'negotiated_rate': payer['negotiated_rate'],
                    'service_type': record.get('service_type'),
                    'effective_date': payer.get('effective_date')
                })
        return normalized
```

## 📈 **Data Processing Workflows**

### **Daily Processing Pipeline**
```yaml
# Airbyte Connection Configuration
connections:
  - name: "daily-pra-processing"
    source: "hospital-pra-files"
    destination: "postgresql-warehouse"
    schedule:
      type: "cron"
      cron_expression: "0 2 * * *"  # 2 AM daily
    sync_mode: "incremental"
    transformations:
      - "standardize_procedure_codes"
      - "validate_pricing_data"
      - "calculate_price_metrics"
```

### **Weekly MRF Processing**
```yaml
  - name: "weekly-mrf-processing"
    source: "hospital-mrf-files"
    destination: "postgresql-warehouse"
    schedule:
      type: "cron"
      cron_expression: "0 1 * * 0"  # 1 AM Sundays
    sync_mode: "full_refresh"
    transformations:
      - "process_negotiated_rates"
      - "link_to_procedure_codes"
      - "calculate_payer_analytics"
```

## 🔍 **Data Quality & Monitoring**

### **Automated Data Quality Checks**
```sql
-- Data quality monitoring queries
WITH quality_metrics AS (
  SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN gross_charge IS NULL THEN 1 END) as missing_prices,
    COUNT(CASE WHEN gross_charge < 0 THEN 1 END) as negative_prices,
    COUNT(CASE WHEN procedure_code IS NULL THEN 1 END) as missing_codes,
    AVG(gross_charge) as avg_price,
    STDDEV(gross_charge) as price_stddev
  FROM raw_hospital_pricing
  WHERE extracted_at >= CURRENT_DATE - INTERVAL '1 day'
)
SELECT 
  *,
  (missing_prices::float / total_records) * 100 as missing_price_pct,
  (negative_prices::float / total_records) * 100 as negative_price_pct
FROM quality_metrics;
```

### **Alerting & Notifications**
```yaml
# Data quality alerts
alerts:
  - name: "high_error_rate"
    condition: "missing_price_pct > 10"
    action: "slack_notification"
    message: "High missing price rate detected: {missing_price_pct}%"
  
  - name: "processing_failure"
    condition: "total_records = 0"
    action: "email_notification"
    recipients: ["data-team@glimmr.health"]
```

## 📊 **Performance Optimization**

### **Incremental Processing**
- **State Management**: Track last processed file timestamps
- **Change Detection**: Only process new/modified files
- **Deduplication**: Prevent duplicate data ingestion

### **Parallel Processing**
- **Multi-threading**: Process multiple hospitals simultaneously
- **Batch Processing**: Group small files for efficiency
- **Resource Scaling**: Auto-scale based on data volume

### **Storage Optimization**
- **Partitioning**: Partition by hospital and date
- **Compression**: Use columnar storage for analytics
- **Archival**: Move old data to cold storage

## 🚀 **Scaling Strategy**

### **Current Capacity (Phase 1)**
- **Hospitals**: 50-100 hospitals
- **Data Volume**: 1-5GB daily
- **Processing Time**: 30-60 minutes
- **Infrastructure**: Single Airbyte instance

### **Scale Target (Phase 2)**
- **Hospitals**: 500-1000 hospitals
- **Data Volume**: 10-50GB daily
- **Processing Time**: 2-4 hours
- **Infrastructure**: Airbyte cluster with workers

### **Enterprise Scale (Phase 3)**
- **Hospitals**: 5000+ hospitals
- **Data Volume**: 100GB+ daily
- **Processing Time**: Real-time streaming
- **Infrastructure**: Kubernetes-based auto-scaling

## 💰 **Cost Analysis**

| Component | Current | Scale | Enterprise |
|-----------|---------|-------|------------|
| **Airbyte Hosting** | $0 (self-hosted) | $200/month | $1000/month |
| **Storage** | $50/month | $200/month | $1000/month |
| **Compute** | Included | $300/month | $2000/month |
| **Total** | **$50/month** | **$700/month** | **$4000/month** |

**ROI**: Processing costs represent <1% of potential revenue at each scale.

This ETL pipeline transforms raw healthcare pricing chaos into structured, actionable business intelligence! 🏥📊
