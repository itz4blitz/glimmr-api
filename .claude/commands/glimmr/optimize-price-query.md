---
name: optimize-price-query
description: Analyzes slow price queries, suggests indexes, query rewrites, or schema changes, and implements the optimization with proper migration
allowed-tools:
  - bash
  - read
  - write
  - edit
  - grep
---

# Optimize Price Query Command

Analyzes and optimizes slow price-related database queries.

## Usage
```
/optimize-price-query <query-type>
```

Query types: `search`, `aggregate`, `join`, `custom`

Example: `/optimize-price-query search`

## Steps

1. First, analyze current database performance:

```bash
# Check current table sizes
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND tablename LIKE '%price%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Check existing indexes
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('prices', 'price_transparency_files')
ORDER BY tablename, indexname;"
```

2. Identify slow queries:

```bash
# Enable query logging if needed
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries over 1 second
SELECT pg_reload_conf();"

# Check recent slow queries
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT 
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%price%' AND mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;"

# If pg_stat_statements not enabled
docker logs glimmr-postgres --tail 1000 | grep -E "duration: [0-9]{4,}" | tail -20
```

3. Analyze specific query patterns:

### Search Queries
```bash
# Analyze search query performance
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM prices 
WHERE 
  hospital_id = 'test-hospital' AND
  code ILIKE '%99213%' AND
  payer_name ILIKE '%BCBS%'
LIMIT 100;"

# Check for missing indexes
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  null_frac,
  avg_width
FROM pg_stats
WHERE tablename = 'prices' 
  AND attname IN ('hospital_id', 'code', 'payer_name', 'service_code');"
```

### Aggregate Queries
```bash
# Analyze aggregation performance
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  hospital_id,
  payer_name,
  AVG(CAST(negotiated_rate AS DECIMAL)) as avg_rate,
  COUNT(*) as count
FROM prices
WHERE negotiated_rate > 0
GROUP BY hospital_id, payer_name
HAVING COUNT(*) > 10;"

# Check work_mem for sorting/grouping
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "SHOW work_mem;"
```

### Join Queries
```bash
# Analyze join performance
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  p.*,
  h.name as hospital_name,
  ptf.file_url
FROM prices p
JOIN hospitals h ON p.hospital_id = h.id
JOIN price_transparency_files ptf ON p.file_id = ptf.id
WHERE p.created_at > CURRENT_DATE - INTERVAL '7 days'
LIMIT 1000;"
```

4. Based on query type, create optimizations:

### For Search Queries

```typescript
// Create new migration file
cat > apps/api/src/database/migrations/optimize-price-search.sql << 'EOF'
-- Optimize price search queries

-- 1. Create composite index for common search patterns
CREATE INDEX IF NOT EXISTS idx_prices_hospital_code_payer 
ON prices(hospital_id, code, payer_name)
WHERE negotiated_rate > 0; -- Partial index to exclude invalid prices

-- 2. Create GIN index for full-text search on codes
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_prices_code_trgm 
ON prices USING gin(code gin_trgm_ops);

-- 3. Create index for payer name search
CREATE INDEX IF NOT EXISTS idx_prices_payer_trgm 
ON prices USING gin(payer_name gin_trgm_ops);

-- 4. Create covering index for common queries
CREATE INDEX IF NOT EXISTS idx_prices_search_covering
ON prices(hospital_id, code, payer_name)
INCLUDE (negotiated_rate, description, created_at)
WHERE negotiated_rate > 0;

-- 5. Update table statistics
ANALYZE prices;
EOF
```

### For Aggregate Queries

```typescript
// Create materialized view for common aggregations
cat > apps/api/src/database/migrations/create-price-aggregates-mv.sql << 'EOF'
-- Create materialized view for price aggregations

CREATE MATERIALIZED VIEW IF NOT EXISTS price_aggregates_mv AS
SELECT 
  hospital_id,
  payer_name,
  code,
  code_type,
  COUNT(*) as price_count,
  AVG(CAST(negotiated_rate AS DECIMAL)) as avg_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(negotiated_rate AS DECIMAL)) as median_rate,
  MIN(CAST(negotiated_rate AS DECIMAL)) as min_rate,
  MAX(CAST(negotiated_rate AS DECIMAL)) as max_rate,
  STDDEV(CAST(negotiated_rate AS DECIMAL)) as stddev_rate,
  MAX(updated_at) as last_updated
FROM prices
WHERE negotiated_rate > 0 AND negotiated_rate < 1000000
GROUP BY hospital_id, payer_name, code, code_type
HAVING COUNT(*) >= 3; -- Only include groups with sufficient data

-- Create indexes on materialized view
CREATE INDEX idx_price_aggregates_hospital ON price_aggregates_mv(hospital_id);
CREATE INDEX idx_price_aggregates_payer ON price_aggregates_mv(payer_name);
CREATE INDEX idx_price_aggregates_code ON price_aggregates_mv(code);
CREATE INDEX idx_price_aggregates_composite ON price_aggregates_mv(hospital_id, payer_name, code);

-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_price_aggregates_mv()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY price_aggregates_mv;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh (requires pg_cron or similar)
-- SELECT cron.schedule('refresh-price-aggregates', '0 */6 * * *', 'SELECT refresh_price_aggregates_mv()');
EOF
```

### For Join Queries

```typescript
// Optimize join performance
cat > apps/api/src/database/migrations/optimize-price-joins.sql << 'EOF'
-- Optimize price join queries

-- 1. Ensure foreign key indexes exist
CREATE INDEX IF NOT EXISTS idx_prices_hospital_id ON prices(hospital_id);
CREATE INDEX IF NOT EXISTS idx_prices_file_id ON prices(file_id);

-- 2. Create composite index for time-based queries
CREATE INDEX IF NOT EXISTS idx_prices_created_hospital 
ON prices(created_at DESC, hospital_id);

-- 3. Create partial indexes for common filters
CREATE INDEX IF NOT EXISTS idx_prices_recent 
ON prices(created_at DESC)
WHERE created_at > CURRENT_DATE - INTERVAL '30 days';

-- 4. Optimize hospital lookups
CREATE INDEX IF NOT EXISTS idx_hospitals_id_name 
ON hospitals(id) INCLUDE (name, state, city);

-- 5. Optimize file lookups
CREATE INDEX IF NOT EXISTS idx_ptf_id_url 
ON price_transparency_files(id) INCLUDE (file_url, file_type);

-- 6. Consider table partitioning for very large tables
-- This is a more complex operation that requires careful planning
/*
-- Example: Partition by created_at
CREATE TABLE prices_partitioned (LIKE prices INCLUDING ALL) PARTITION BY RANGE (created_at);
CREATE TABLE prices_y2024m01 PARTITION OF prices_partitioned FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- ... create more partitions as needed
*/
EOF
```

5. Update Drizzle schema to reflect optimizations:

```typescript
// In apps/api/src/database/schema/prices.ts, add indexes:

export const pricesIndexes = {
  // Existing indexes...
  
  // Search optimization indexes
  hospitalCodePayer: index('idx_prices_hospital_code_payer')
    .on(prices.hospitalId, prices.code, prices.payerName)
    .where(sql`negotiated_rate > 0`),
    
  codeTrgm: index('idx_prices_code_trgm')
    .using('gin', prices.code),
    
  payerTrgm: index('idx_prices_payer_trgm')
    .using('gin', prices.payerName),
    
  searchCovering: index('idx_prices_search_covering')
    .on(prices.hospitalId, prices.code, prices.payerName)
    .include([prices.negotiatedRate, prices.description, prices.createdAt])
    .where(sql`negotiated_rate > 0`),
    
  // Join optimization indexes
  hospitalId: index('idx_prices_hospital_id').on(prices.hospitalId),
  fileId: index('idx_prices_file_id').on(prices.fileId),
  createdHospital: index('idx_prices_created_hospital')
    .on(prices.createdAt.desc(), prices.hospitalId),
  recent: index('idx_prices_recent')
    .on(prices.createdAt.desc())
    .where(sql`created_at > CURRENT_DATE - INTERVAL '30 days'`),
};
```

6. Update service to use optimized queries:

```typescript
// In apps/api/src/prices/prices.service.ts:

// Use materialized view for aggregations
async getAggregatedPrices(filters: PriceFilters) {
  const query = this.db
    .select()
    .from(priceAggregatesMv) // Use materialized view
    .where(
      and(
        filters.hospitalId ? eq(priceAggregatesMv.hospitalId, filters.hospitalId) : undefined,
        filters.payerName ? eq(priceAggregatesMv.payerName, filters.payerName) : undefined,
        filters.code ? eq(priceAggregatesMv.code, filters.code) : undefined,
      )
    );
    
  return query;
}

// Optimize search queries with proper indexes
async searchPrices(searchTerm: string, filters: PriceFilters) {
  // Use GIN index for text search
  const query = this.db
    .select()
    .from(prices)
    .where(
      and(
        or(
          sql`${prices.code} ILIKE ${`%${searchTerm}%`}`, // Uses GIN index
          sql`${prices.payerName} ILIKE ${`%${searchTerm}%`}`, // Uses GIN index
          sql`${prices.description} ILIKE ${`%${searchTerm}%`}`,
        ),
        filters.hospitalId ? eq(prices.hospitalId, filters.hospitalId) : undefined,
        gt(prices.negotiatedRate, 0), // Matches partial index condition
      )
    )
    .limit(100);
    
  return query;
}

// Use covering index for common queries
async getPricesWithDetails(hospitalId: string, limit = 1000) {
  // This query can be satisfied entirely from the covering index
  const query = this.db
    .select({
      code: prices.code,
      payerName: prices.payerName,
      negotiatedRate: prices.negotiatedRate,
      description: prices.description,
      createdAt: prices.createdAt,
    })
    .from(prices)
    .where(
      and(
        eq(prices.hospitalId, hospitalId),
        gt(prices.negotiatedRate, 0),
      )
    )
    .orderBy(desc(prices.createdAt))
    .limit(limit);
    
  return query;
}
```

7. Apply the optimizations:

```bash
# Generate migration from schema changes
cd apps/api
pnpm db:generate

# Review the generated migration
cat src/database/migrations/*.sql | tail -50

# Apply migrations
pnpm db:migrate

# If using raw SQL migrations, apply them directly
docker exec glimmr-postgres psql -U postgres -d glimmr_dev < src/database/migrations/optimize-price-search.sql
```

8. Verify performance improvements:

```bash
# Re-run the same queries with EXPLAIN ANALYZE
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM prices 
WHERE 
  hospital_id = 'test-hospital' AND
  code ILIKE '%99213%' AND
  payer_name ILIKE '%BCBS%'
LIMIT 100;"

# Check index usage
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND tablename = 'prices'
ORDER BY idx_scan DESC;"

# Monitor query performance
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE query LIKE '%price%'
ORDER BY mean_exec_time DESC
LIMIT 10;"
```

9. Create monitoring dashboard:

```bash
# Create monitoring script
cat > apps/api/scripts/monitor-price-queries.sh << 'EOF'
#!/bin/bash

echo "=== Price Query Performance Monitor ==="
echo

echo "Table Statistics:"
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -t -c "
SELECT 
  'Prices table: ' || COUNT(*) || ' rows' FROM prices
UNION ALL
SELECT 
  'Price aggregates MV: ' || COUNT(*) || ' rows' FROM price_aggregates_mv;"

echo -e "\nSlow Queries (>100ms):"
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT 
  substring(query, 1, 80) as query_preview,
  round(mean_exec_time::numeric, 2) as avg_ms,
  calls
FROM pg_stat_statements
WHERE query LIKE '%price%' AND mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 5;"

echo -e "\nIndex Usage:"
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT 
  indexname,
  idx_scan as scans,
  round(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 2) as index_usage_pct
FROM pg_stat_user_indexes i
JOIN pg_stat_user_tables t USING (schemaname, tablename)
WHERE t.tablename = 'prices'
ORDER BY idx_scan DESC
LIMIT 10;"

echo -e "\nCache Hit Ratio:"
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
SELECT 
  round(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) as cache_hit_ratio
FROM pg_statio_user_tables
WHERE tablename = 'prices';"
EOF

chmod +x apps/api/scripts/monitor-price-queries.sh
```

## Query Optimization Patterns

### 1. Use Proper Indexes
- B-tree for equality and range queries
- GIN for text search and arrays
- GiST for geometric and full-text search
- BRIN for large tables with natural ordering

### 2. Query Rewriting
```sql
-- Bad: Multiple OR conditions
SELECT * FROM prices WHERE code = '99213' OR code = '99214' OR code = '99215';

-- Good: Use IN clause
SELECT * FROM prices WHERE code IN ('99213', '99214', '99215');

-- Bad: Negative conditions
SELECT * FROM prices WHERE payer_name NOT LIKE '%Medicare%';

-- Good: Positive conditions with index
SELECT * FROM prices WHERE payer_name LIKE '%BCBS%' OR payer_name LIKE '%Aetna%';
```

### 3. Avoid Common Pitfalls
- Don't use functions on indexed columns
- Avoid SELECT * in production
- Use LIMIT for large result sets
- Consider pagination for UI queries

### 4. Database Configuration
```bash
# Tune PostgreSQL for better performance
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
SELECT pg_reload_conf();"
```

## Maintenance Tasks

After implementing optimizations:

```bash
# 1. Update table statistics
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "ANALYZE prices;"

# 2. Rebuild indexes if needed
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "REINDEX TABLE prices;"

# 3. Vacuum to reclaim space
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "VACUUM ANALYZE prices;"

# 4. Refresh materialized views
docker exec glimmr-postgres psql -U postgres -d glimmr_dev -c "REFRESH MATERIALIZED VIEW CONCURRENTLY price_aggregates_mv;"
```