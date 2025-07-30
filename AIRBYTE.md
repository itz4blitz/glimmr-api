# Airbyte ETL Pipeline for Healthcare Price Transparency

## 🎯 **The Real Challenge**

Healthcare pricing data is scattered across thousands of hospital websites in inconsistent formats. Each hospital publishes their price transparency files differently - some use CSV, others JSON, many use Excel. Airbyte transforms this scattered mess into clean, comparable pricing data.

## 🏗️ **Why Airbyte Makes This Simple**

**Format Flexibility**: Every hospital publishes pricing data differently. Airbyte handles CSV files, JSON feeds, Excel spreadsheets, and XML without us writing custom parsers for each hospital.

**Focused Data Extraction**: We don't need every procedure code hospitals publish. We're targeting a specific subset of HCPCS codes that matter for price transparency. Airbyte filters and extracts only what we need.

**Data Standardization**: Hospital A calls a procedure "MRI Brain" while Hospital B calls it "Magnetic Resonance Imaging - Head". Airbyte's transformation engine standardizes these variations.

**Automated Processing**: Once configured, Airbyte processes new hospital files automatically. No manual intervention needed.

## 📊 **What We're Actually Processing**

### **Hospital Price Transparency Files**
**Reality Check**: Most hospital files are 10-200MB, not massive datasets. These contain thousands of procedure codes, but we only extract the specific HCPCS codes we care about.

**What's Inside**: Basic pricing information including what hospitals charge for procedures, cash prices for uninsured patients, and sometimes negotiated rates with insurance companies.

**File Formats**: Hospitals use whatever format they want - CSV files, Excel spreadsheets, JSON feeds, or XML. Airbyte handles all of these without us building custom parsers.

### **Machine Readable Files (MRF)**
**The Important Data**: These contain actual negotiated rates between hospitals and insurance companies. Most files are 50-500MB, with large health systems occasionally reaching 1GB.

**What We Extract**: Only the HCPCS codes and payer rates we need for price comparisons. We're not storing every single procedure code and modifier combination.

**Update Frequency**: Hospitals update these monthly or quarterly, so we don't need real-time processing.

### **Reference Data**
**Supporting Information**: Small datasets that help us understand the pricing data - procedure code descriptions, hospital information, and geographic regions. These are typically small CSV or JSON files from CMS and other official sources.
## 🔄 **How Airbyte Processes Our Data**

### **Extract: Getting the Data**
**File Processing**: Airbyte monitors folders where our Playwright scrapers drop hospital files. When new files appear, Airbyte automatically detects the format (CSV, JSON, Excel) and begins processing.

**API Connections**: For reference data like procedure code descriptions, Airbyte connects directly to CMS and other official APIs to pull the latest information.

**Smart Detection**: Airbyte automatically figures out the structure of each hospital's data files, even when they use different column names or formats.

### **Transform: Cleaning the Mess**
**Standardization**: Every hospital names procedures differently. Airbyte transforms "MRI Brain w/o contrast" and "Magnetic Resonance Imaging Head" into standardized HCPCS codes we can compare.

**Data Validation**: Hospital data often contains obvious errors - negative prices, missing procedure codes, unrealistic charges over $1 million. Airbyte flags these issues and either fixes them or marks them for review.

**Filtering**: We only care about specific HCPCS codes, not every single procedure a hospital offers. Airbyte extracts just the data we need and ignores the rest.

### **Load: Storing for Analysis**
**Database Storage**: Clean, standardized data gets loaded into our PostgreSQL database where our analytics engine can access it quickly.

**Data Organization**: Airbyte organizes the data by hospital, procedure code, and date so we can easily compare prices across different providers and track changes over time.

## 🔧 **Custom Processing for Healthcare Data**

### **Hospital File Processor**
**Format Detection**: Airbyte automatically recognizes whether a hospital file is CSV, JSON, Excel, or XML and processes it accordingly. No manual configuration needed for each hospital.

**Schema Discovery**: Each hospital structures their data differently. Airbyte examines the file structure and automatically maps columns like "Procedure Code", "CPT Code", or "Service Code" to our standardized format.

**Error Handling**: When hospitals publish corrupted files or change their format, Airbyte logs the issue and continues processing other hospitals rather than stopping the entire pipeline.

### **MRF File Processing**
**Efficient Processing**: Machine Readable Files can be large (up to 1GB), but we only need specific HCPCS codes. Airbyte streams through these files and extracts just the data we need without loading the entire file into memory.

**Payer Data Extraction**: MRF files contain negotiated rates for dozens of insurance companies. Airbyte extracts each payer's rates separately so we can compare what different insurance companies pay for the same procedure.

**Data Validation**: Insurance rate data often contains inconsistencies. Airbyte validates that rates are reasonable and flags outliers for review.

## 📈 **Automated Processing Schedule**

### **Daily Hospital Data Processing**
**When It Runs**: Every night at 2 AM, Airbyte processes any new hospital files our Playwright scrapers collected during the day.

**What Happens**: New pricing data gets standardized, validated, and loaded into our database. The process typically takes 30-60 minutes for 50-100 hospitals.

**Incremental Updates**: Airbyte only processes new or changed files, not everything from scratch. This keeps processing time manageable as we scale.

### **Weekly MRF Processing**
**When It Runs**: Sunday nights, when server load is lowest and we have time for longer processing jobs.

**What Happens**: Large Machine Readable Files get processed to extract payer-specific negotiated rates. This creates the comparison data that makes our platform valuable.

**Full Refresh**: Since MRF files contain complete rate information, we replace old data with new data rather than trying to merge changes.

## 🔍 **Data Quality & Monitoring**

### **Automated Quality Checks**
**Missing Data Detection**: Airbyte tracks when hospitals publish files with missing prices or procedure codes and alerts us when data quality drops below acceptable levels.

**Price Validation**: Unrealistic prices (negative amounts, charges over $1 million) get flagged automatically. We can review these manually or set rules to exclude them.

**Processing Monitoring**: If a hospital changes their file format or stops publishing data, Airbyte detects this and sends alerts so we can investigate.

### **Real-time Alerts**
**Slack Notifications**: When data quality issues are detected (like high missing price rates), the team gets notified immediately via Slack.

**Email Alerts**: Critical processing failures trigger email alerts to ensure someone addresses the issue quickly.

**Dashboard Monitoring**: Airbyte provides a web dashboard showing processing status, data volumes, and quality metrics for all our data sources.

## 📊 **Performance & Efficiency**

### **Smart Processing**
**Incremental Updates**: Airbyte remembers what files it has already processed and only handles new or changed data. This keeps processing time manageable as we add more hospitals.

**Parallel Processing**: Multiple hospital files can be processed simultaneously, dramatically reducing the time needed to update our entire database.

**Efficient Storage**: Data gets organized by hospital and date, making queries fast and keeping storage costs reasonable.

## 🚀 **Scaling as We Grow**

### **Current Capacity (Starting Out)**
**Hospitals**: 50-100 hospitals providing pricing data
**Processing Time**: 30-60 minutes each night
**Data Volume**: A few GB of pricing data daily
**Infrastructure**: Single Airbyte instance on our existing server

### **Medium Scale (Growth Phase)**
**Hospitals**: 500-1000 hospitals across multiple states
**Processing Time**: 2-4 hours for complete daily updates
**Data Volume**: 10-20GB daily as we add more hospitals and procedure codes
**Infrastructure**: Airbyte cluster with multiple workers for parallel processing

### **Enterprise Scale (National Coverage)**
**Hospitals**: 5000+ hospitals providing comprehensive coverage
**Processing Time**: Near real-time updates as data becomes available
**Data Volume**: 50-100GB daily with full national coverage
**Infrastructure**: Auto-scaling cloud infrastructure that adjusts based on demand

## 💰 **Cost Reality Check**

**Current Setup**: Essentially free since Airbyte runs on our existing $100/month infrastructure
**Growth Phase**: Additional $200-500/month for storage and compute as data volume increases
**Enterprise Scale**: $2000-4000/month for full infrastructure, but generating millions in revenue

**The Bottom Line**: Data processing costs remain under 1% of revenue at every scale. The infrastructure investment pays for itself many times over through the value of clean, comparable healthcare pricing data.
