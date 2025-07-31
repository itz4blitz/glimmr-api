# dbt Integration for Glimmr Healthcare Pricing Intelligence

This directory contains the dbt (data build tool) setup for transforming raw healthcare pricing data into clean, analytics-ready models.

## 🎯 Purpose

dbt serves as the **Transform** layer in your ELT pipeline:
- **Extract**: Airbyte pulls data from hospital pricing files
- **Load**: Raw data lands in PostgreSQL
- **Transform**: dbt cleans, models, and tests the data

## 🏗 Architecture

```
Raw Data (Airbyte) → PostgreSQL → dbt → Clean Data Models → NestJS API
```

### Data Flow
1. **Staging Models**: Clean and standardize raw data
2. **Intermediate Models**: Business logic and calculations
3. **Mart Models**: Final analytics-ready tables

## 🚀 Quick Start

### 1. Build and Run dbt
```bash
# From the infrastructure/dbt directory
docker compose build
docker compose run --rm dbt dbt deps
docker compose run --rm dbt dbt run
```

### 2. Test Data Quality
```bash
docker compose run --rm dbt dbt test
```

### 3. Generate Documentation
```bash
docker compose run --rm dbt dbt docs generate
docker compose run --rm dbt dbt docs serve --port 8080
```

## 📊 Data Models

### Staging Models (`models/staging/`)
- `stg_hospital_pricing_files`: Cleaned file metadata
- `stg_hospital_prices`: Standardized pricing records
- `stg_hospitals`: Hospital master data

### Core Models (`models/marts/core/`)
- `dim_hospitals`: Hospital dimension with metrics
- `fact_hospital_prices`: Pricing fact table
- `dim_procedures`: Procedure dimension

### Analytics Models (`models/marts/analytics/`)
- `hospital_pricing_summary`: Aggregated pricing by hospital
- `procedure_price_analysis`: Price variations by procedure
- `market_pricing_trends`: Geographic pricing analysis

## 🔧 Configuration

### Environment Variables
```bash
# Database connection
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=glimmr
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# dbt environment
DBT_ENV=development
```

### dbt Variables
Configured in `dbt_project.yml`:
- `start_date`: Date range for incremental models
- `min_price_threshold`: Minimum valid price (default: $0.01)
- `max_price_threshold`: Maximum valid price (default: $1,000,000)

## 🧪 Data Quality Tests

dbt includes comprehensive data quality tests:

### Generic Tests
- `unique`: Ensures primary keys are unique
- `not_null`: Validates required fields
- `accepted_values`: Validates enum fields
- `relationships`: Validates foreign keys

### Custom Tests
- Price range validation
- Date consistency checks
- File processing status validation

## 🔄 Airflow Integration

dbt runs are orchestrated by Airflow in the complete pipeline:

1. **Airbyte Sync**: Extract and load raw data
2. **dbt deps**: Install dbt packages
3. **dbt run staging**: Transform staging models
4. **dbt test staging**: Test staging data quality
5. **dbt run marts**: Build final data marts
6. **dbt test marts**: Test final data quality

## 📈 Usage Examples

### Run Specific Models
```bash
# Run only staging models
docker compose run --rm dbt dbt run --models staging

# Run specific model and downstream dependencies
docker compose run --rm dbt dbt run --models stg_hospital_prices+

# Run models for specific hospital
docker compose run --rm dbt dbt run --vars '{"hospital_id": "12345"}'
```

### Incremental Runs
```bash
# Run only changed models
docker compose run --rm dbt dbt run --select state:modified

# Full refresh of incremental models
docker compose run --rm dbt dbt run --full-refresh
```

### Testing
```bash
# Test specific models
docker compose run --rm dbt dbt test --models staging

# Test with custom variables
docker compose run --rm dbt dbt test --vars '{"min_price_threshold": 1.00}'
```

## 🛠 Development Workflow

### 1. Add New Model
1. Create SQL file in appropriate directory
2. Add model configuration in `schema.yml`
3. Add tests and documentation
4. Run and test the model

### 2. Modify Existing Model
1. Update SQL logic
2. Update tests if needed
3. Run model and downstream dependencies
4. Validate results

### 3. Deploy Changes
1. Commit changes to git
2. Airflow will automatically run dbt in the pipeline
3. Monitor logs for any issues

## 📋 Common Commands

```bash
# Development commands
docker compose run --rm dbt dbt debug          # Test connection
docker compose run --rm dbt dbt compile        # Compile models
docker compose run --rm dbt dbt run            # Run all models
docker compose run --rm dbt dbt test           # Run all tests

# Documentation
docker compose run --rm dbt dbt docs generate  # Generate docs
docker compose run --rm dbt dbt docs serve     # Serve docs locally

# Utility commands
docker compose run --rm dbt dbt clean          # Clean target directory
docker compose run --rm dbt dbt deps           # Install packages
docker compose run --rm dbt dbt seed           # Load seed data
```

## 🚨 Troubleshooting

### Connection Issues
```bash
# Test database connection
docker compose run --rm dbt dbt debug

# Check environment variables
docker compose run --rm dbt env
```

### Model Failures
```bash
# Run with verbose logging
docker compose run --rm dbt dbt run --log-level debug

# Run specific failing model
docker compose run --rm dbt dbt run --models model_name
```

### Performance Issues
```bash
# Profile model performance
docker compose run --rm dbt dbt run --profiles-dir profiles --profile glimmr_healthcare

# Use incremental models for large datasets
# Configure in model SQL with {{ config(materialized='incremental') }}
```

## 📚 Resources

- [dbt Documentation](https://docs.getdbt.com/)
- [dbt Best Practices](https://docs.getdbt.com/guides/best-practices)
- [dbt Style Guide](https://github.com/dbt-labs/corp/blob/main/dbt_style_guide.md)
