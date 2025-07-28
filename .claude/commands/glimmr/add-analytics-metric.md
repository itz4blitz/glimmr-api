---
name: add-analytics-metric
description: Scaffolds a new analytics metric from database query to frontend display with SQL query, service method, API endpoint, React component, and chart visualization
allowed-tools:
  - bash
  - read
  - write
  - edit
  - grep
---

# Add Analytics Metric Command

Creates a complete analytics metric from database to visualization.

## Usage
```
/add-analytics-metric <metric-name> <metric-type>
```

Metric types: `summary`, `timeseries`, `distribution`, `comparison`

Example: `/add-analytics-metric average-negotiated-rate comparison`

## Steps

1. First, analyze existing analytics structure:

```bash
# Check current analytics schema and services
cat apps/api/src/database/schema/analytics.ts
ls -la apps/api/src/analytics/
grep -r "export class.*Service" apps/api/src/analytics/

# Check frontend analytics components
ls -la apps/web/src/components/analytics/
ls -la apps/web/src/pages/dashboard/
```

2. Create or update the analytics schema if needed:

```typescript
// In apps/api/src/database/schema/analytics.ts, add if needed:
export const ${metricName}Analytics = pgTable('${metricName}_analytics', {
  id: serial('id').primaryKey(),
  hospitalId: text('hospital_id').references(() => hospitals.id),
  payerName: text('payer_name'),
  serviceCode: text('service_code'),
  ${metricType === 'summary' ? `
  averageRate: numeric('average_rate', { precision: 10, scale: 2 }),
  medianRate: numeric('median_rate', { precision: 10, scale: 2 }),
  minRate: numeric('min_rate', { precision: 10, scale: 2 }),
  maxRate: numeric('max_rate', { precision: 10, scale: 2 }),
  sampleSize: integer('sample_size'),
  ` : ''}
  ${metricType === 'timeseries' ? `
  date: date('date').notNull(),
  value: numeric('value', { precision: 10, scale: 2 }).notNull(),
  changePercent: numeric('change_percent', { precision: 5, scale: 2 }),
  ` : ''}
  ${metricType === 'distribution' ? `
  bucketRange: text('bucket_range').notNull(),
  bucketCount: integer('bucket_count').notNull(),
  percentage: numeric('percentage', { precision: 5, scale: 2 }),
  ` : ''}
  ${metricType === 'comparison' ? `
  comparisonGroup: text('comparison_group').notNull(),
  metricValue: numeric('metric_value', { precision: 10, scale: 2 }).notNull(),
  variance: numeric('variance', { precision: 10, scale: 2 }),
  percentile: integer('percentile'),
  ` : ''}
  calculatedAt: timestamp('calculated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Add indexes for performance
export const ${metricName}AnalyticsIndexes = {
  byHospital: index('${metricName}_hospital_idx').on(${metricName}Analytics.hospitalId),
  ${metricType === 'timeseries' ? `byDate: index('${metricName}_date_idx').on(${metricName}Analytics.date),` : ''}
  ${metricType === 'comparison' ? `byGroup: index('${metricName}_group_idx').on(${metricName}Analytics.comparisonGroup),` : ''}
};
```

3. Create the analytics service method in `apps/api/src/analytics/analytics.service.ts`:

```typescript
// Add to AnalyticsService class:

async get${MetricName}(params: {
  hospitalId?: string;
  payerName?: string;
  serviceCode?: string;
  ${metricType === 'timeseries' ? 'startDate?: Date; endDate?: Date;' : ''}
  ${metricType === 'comparison' ? 'groupBy?: "payer" | "service" | "hospital";' : ''}
}) {
  const { hospitalId, payerName, serviceCode } = params;
  
  this.logger.info({ params }, 'Fetching ${metricName} analytics');

  try {
    ${metricType === 'summary' ? `
    // Summary metric: aggregate data
    const result = await this.db
      .select({
        averageRate: sql\`AVG(CAST(p.negotiated_rate AS DECIMAL))\`.as('average_rate'),
        medianRate: sql\`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(p.negotiated_rate AS DECIMAL))\`.as('median_rate'),
        minRate: sql\`MIN(CAST(p.negotiated_rate AS DECIMAL))\`.as('min_rate'),
        maxRate: sql\`MAX(CAST(p.negotiated_rate AS DECIMAL))\`.as('max_rate'),
        sampleSize: sql\`COUNT(*)\`.as('sample_size'),
      })
      .from(prices)
      .where(
        and(
          hospitalId ? eq(prices.hospitalId, hospitalId) : undefined,
          payerName ? eq(prices.payerName, payerName) : undefined,
          serviceCode ? eq(prices.code, serviceCode) : undefined,
          // Filter out invalid prices
          gt(prices.negotiatedRate, 0),
          lt(prices.negotiatedRate, 1000000),
        )
      );

    return {
      type: 'summary',
      data: result[0] || {
        averageRate: 0,
        medianRate: 0,
        minRate: 0,
        maxRate: 0,
        sampleSize: 0,
      },
      metadata: {
        calculatedAt: new Date(),
        filters: { hospitalId, payerName, serviceCode },
      },
    };
    ` : ''}

    ${metricType === 'timeseries' ? `
    // Time series metric: track changes over time
    const { startDate, endDate } = params;
    
    const result = await this.db
      .select({
        date: sql\`DATE(p.created_at)\`.as('date'),
        value: sql\`AVG(CAST(p.negotiated_rate AS DECIMAL))\`.as('value'),
        count: sql\`COUNT(*)\`.as('count'),
      })
      .from(prices)
      .where(
        and(
          hospitalId ? eq(prices.hospitalId, hospitalId) : undefined,
          payerName ? eq(prices.payerName, payerName) : undefined,
          serviceCode ? eq(prices.code, serviceCode) : undefined,
          startDate ? gte(prices.createdAt, startDate) : undefined,
          endDate ? lte(prices.createdAt, endDate) : undefined,
          gt(prices.negotiatedRate, 0),
        )
      )
      .groupBy(sql\`DATE(p.created_at)\`)
      .orderBy(sql\`DATE(p.created_at)\`);

    // Calculate change percentages
    const dataWithChanges = result.map((item, index) => ({
      ...item,
      changePercent: index > 0 
        ? ((item.value - result[index - 1].value) / result[index - 1].value) * 100
        : 0,
    }));

    return {
      type: 'timeseries',
      data: dataWithChanges,
      metadata: {
        startDate,
        endDate,
        dataPoints: result.length,
      },
    };
    ` : ''}

    ${metricType === 'distribution' ? `
    // Distribution metric: show data spread
    const buckets = [
      { min: 0, max: 100, label: '$0-$100' },
      { min: 100, max: 500, label: '$100-$500' },
      { min: 500, max: 1000, label: '$500-$1k' },
      { min: 1000, max: 5000, label: '$1k-$5k' },
      { min: 5000, max: 10000, label: '$5k-$10k' },
      { min: 10000, max: null, label: '$10k+' },
    ];

    const distribution = await Promise.all(
      buckets.map(async (bucket) => {
        const count = await this.db
          .select({ count: sql\`COUNT(*)\` })
          .from(prices)
          .where(
            and(
              hospitalId ? eq(prices.hospitalId, hospitalId) : undefined,
              payerName ? eq(prices.payerName, payerName) : undefined,
              serviceCode ? eq(prices.code, serviceCode) : undefined,
              gte(prices.negotiatedRate, bucket.min),
              bucket.max ? lt(prices.negotiatedRate, bucket.max) : undefined,
            )
          );
        
        return {
          bucketRange: bucket.label,
          bucketCount: count[0]?.count || 0,
          min: bucket.min,
          max: bucket.max,
        };
      })
    );

    const total = distribution.reduce((sum, b) => sum + b.bucketCount, 0);
    const distributionWithPercentages = distribution.map(b => ({
      ...b,
      percentage: total > 0 ? (b.bucketCount / total) * 100 : 0,
    }));

    return {
      type: 'distribution',
      data: distributionWithPercentages,
      metadata: {
        totalCount: total,
        bucketCount: buckets.length,
      },
    };
    ` : ''}

    ${metricType === 'comparison' ? `
    // Comparison metric: compare across groups
    const { groupBy = 'payer' } = params;
    
    const groupColumn = {
      payer: prices.payerName,
      service: prices.code,
      hospital: prices.hospitalId,
    }[groupBy];

    const result = await this.db
      .select({
        comparisonGroup: groupColumn,
        metricValue: sql\`AVG(CAST(p.negotiated_rate AS DECIMAL))\`.as('metric_value'),
        variance: sql\`VARIANCE(CAST(p.negotiated_rate AS DECIMAL))\`.as('variance'),
        count: sql\`COUNT(*)\`.as('count'),
      })
      .from(prices)
      .where(
        and(
          hospitalId && groupBy !== 'hospital' ? eq(prices.hospitalId, hospitalId) : undefined,
          payerName && groupBy !== 'payer' ? eq(prices.payerName, payerName) : undefined,
          serviceCode && groupBy !== 'service' ? eq(prices.code, serviceCode) : undefined,
          gt(prices.negotiatedRate, 0),
        )
      )
      .groupBy(groupColumn)
      .orderBy(desc(sql\`AVG(CAST(p.negotiated_rate AS DECIMAL))\`))
      .limit(20);

    // Calculate percentiles
    const values = result.map(r => r.metricValue);
    const sortedValues = values.sort((a, b) => a - b);
    
    const dataWithPercentiles = result.map(item => ({
      ...item,
      percentile: Math.round(
        (sortedValues.indexOf(item.metricValue) / sortedValues.length) * 100
      ),
    }));

    return {
      type: 'comparison',
      data: dataWithPercentiles,
      metadata: {
        groupBy,
        groupCount: result.length,
      },
    };
    ` : ''}
  } catch (error) {
    this.logger.error(
      { err: error, params },
      'Failed to calculate ${metricName} analytics'
    );
    throw error;
  }
}

// Add cache wrapper for performance
@Cacheable({
  ttl: 300, // 5 minutes
  key: (params) => \`${metricName}:\${JSON.stringify(params)}\`,
})
async getCached${MetricName}(params: Parameters<typeof this.get${MetricName}>[0]) {
  return this.get${MetricName}(params);
}
```

4. Add the API endpoint in `apps/api/src/analytics/analytics.controller.ts`:

```typescript
// Add to AnalyticsController class:

@Get('${metricName}')
@ApiOperation({ summary: 'Get ${metricName} analytics' })
@ApiQuery({ name: 'hospitalId', required: false, type: String })
@ApiQuery({ name: 'payerName', required: false, type: String })
@ApiQuery({ name: 'serviceCode', required: false, type: String })
${metricType === 'timeseries' ? `
@ApiQuery({ name: 'startDate', required: false, type: Date })
@ApiQuery({ name: 'endDate', required: false, type: Date })
` : ''}
${metricType === 'comparison' ? `
@ApiQuery({ name: 'groupBy', required: false, enum: ['payer', 'service', 'hospital'] })
` : ''}
@ApiResponse({
  status: 200,
  description: '${MetricName} analytics data',
  schema: {
    type: 'object',
    properties: {
      type: { type: 'string', example: '${metricType}' },
      data: {
        ${metricType === 'summary' ? `
        type: 'object',
        properties: {
          averageRate: { type: 'number', example: 1250.50 },
          medianRate: { type: 'number', example: 1100.00 },
          minRate: { type: 'number', example: 500.00 },
          maxRate: { type: 'number', example: 3000.00 },
          sampleSize: { type: 'number', example: 1543 },
        },
        ` : ''}
        ${metricType === 'timeseries' ? `
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            value: { type: 'number' },
            changePercent: { type: 'number' },
            count: { type: 'number' },
          },
        },
        ` : ''}
        ${metricType === 'distribution' ? `
        type: 'array',
        items: {
          type: 'object',
          properties: {
            bucketRange: { type: 'string', example: '$1k-$5k' },
            bucketCount: { type: 'number' },
            percentage: { type: 'number' },
          },
        },
        ` : ''}
        ${metricType === 'comparison' ? `
        type: 'array',
        items: {
          type: 'object',
          properties: {
            comparisonGroup: { type: 'string' },
            metricValue: { type: 'number' },
            variance: { type: 'number' },
            percentile: { type: 'number' },
            count: { type: 'number' },
          },
        },
        ` : ''}
      },
      metadata: { type: 'object' },
    },
  },
})
async get${MetricName}(
  @Query('hospitalId') hospitalId?: string,
  @Query('payerName') payerName?: string,
  @Query('serviceCode') serviceCode?: string,
  ${metricType === 'timeseries' ? `
  @Query('startDate') startDate?: string,
  @Query('endDate') endDate?: string,
  ` : ''}
  ${metricType === 'comparison' ? `
  @Query('groupBy') groupBy?: 'payer' | 'service' | 'hospital',
  ` : ''}
) {
  return this.analyticsService.getCached${MetricName}({
    hospitalId,
    payerName,
    serviceCode,
    ${metricType === 'timeseries' ? `
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    ` : ''}
    ${metricType === 'comparison' ? `groupBy,` : ''}
  });
}
```

5. Create the React component at `apps/web/src/components/analytics/${MetricName}Chart.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
${metricType === 'summary' ? `
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon } from 'lucide-react';
` : ''}
${metricType === 'timeseries' ? `
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
` : ''}
${metricType === 'distribution' ? `
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
` : ''}
${metricType === 'comparison' ? `
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
` : ''}

interface ${MetricName}ChartProps {
  hospitalId?: string;
  payerName?: string;
  serviceCode?: string;
  ${metricType === 'timeseries' ? `
  startDate?: Date;
  endDate?: Date;
  ` : ''}
  ${metricType === 'comparison' ? `
  groupBy?: 'payer' | 'service' | 'hospital';
  ` : ''}
  className?: string;
}

export function ${MetricName}Chart({
  hospitalId,
  payerName,
  serviceCode,
  ${metricType === 'timeseries' ? 'startDate, endDate,' : ''}
  ${metricType === 'comparison' ? "groupBy = 'payer'," : ''}
  className,
}: ${MetricName}ChartProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [hospitalId, payerName, serviceCode${metricType === 'timeseries' ? ', startDate, endDate' : ''}${metricType === 'comparison' ? ', groupBy' : ''}]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (hospitalId) params.append('hospitalId', hospitalId);
      if (payerName) params.append('payerName', payerName);
      if (serviceCode) params.append('serviceCode', serviceCode);
      ${metricType === 'timeseries' ? `
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      ` : ''}
      ${metricType === 'comparison' ? `
      if (groupBy) params.append('groupBy', groupBy);
      ` : ''}

      const response = await fetch(\`/api/v1/analytics/${metricName}?\${params}\`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-3 w-[150px]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  ${metricType === 'summary' ? `
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const getChangeIcon = (current: number, previous: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    if (change > 0) return <ArrowUpIcon className="h-4 w-4 text-green-500" />;
    if (change < 0) return <ArrowDownIcon className="h-4 w-4 text-red-500" />;
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>${MetricName}</CardTitle>
        <CardDescription>
          Based on {data.data.sampleSize.toLocaleString()} price points
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Average Rate</p>
            <p className="text-2xl font-bold">{formatCurrency(data.data.averageRate)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Median Rate</p>
            <p className="text-2xl font-bold">{formatCurrency(data.data.medianRate)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Min Rate</p>
            <p className="text-2xl font-bold">{formatCurrency(data.data.minRate)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Max Rate</p>
            <p className="text-2xl font-bold">{formatCurrency(data.data.maxRate)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  ` : ''}

  ${metricType === 'timeseries' ? `
  const formatDate = (dateStr: string) => format(parseISO(dateStr), 'MMM d, yyyy');
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>${MetricName} Over Time</CardTitle>
        <CardDescription>
          Showing {data.metadata.dataPoints} data points
          {data.metadata.startDate && data.metadata.endDate && 
            \` from \${format(parseISO(data.metadata.startDate), 'MMM d, yyyy')} to \${format(parseISO(data.metadata.endDate), 'MMM d, yyyy')}\`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              className="text-xs"
            />
            <YAxis 
              tickFormatter={formatCurrency}
              className="text-xs"
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={formatDate}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Average Rate"
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
  ` : ''}

  ${metricType === 'distribution' ? `
  const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--primary))',
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>${MetricName} Distribution</CardTitle>
        <CardDescription>
          Total of {data.metadata.totalCount.toLocaleString()} prices analyzed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="bucketRange" 
              className="text-xs"
            />
            <YAxis 
              tickFormatter={(value) => \`\${value}%\`}
              className="text-xs"
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'percentage') return [\`\${value.toFixed(1)}%\`, 'Percentage'];
                return [value.toLocaleString(), 'Count'];
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Bar dataKey="percentage" name="percentage">
              {data.data.map((entry: any, index: number) => (
                <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
  ` : ''}

  ${metricType === 'comparison' ? `
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  const getBarColor = (percentile: number) => {
    if (percentile >= 75) return 'hsl(var(--destructive))';
    if (percentile >= 50) return 'hsl(var(--warning))';
    if (percentile >= 25) return 'hsl(var(--primary))';
    return 'hsl(var(--success))';
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>${MetricName} Comparison</CardTitle>
            <CardDescription>
              Comparing top {data.metadata.groupCount} groups by {groupBy}
            </CardDescription>
          </div>
          <Select value={groupBy} onValueChange={(value: any) => /* handle change */}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="payer">By Payer</SelectItem>
              <SelectItem value="service">By Service</SelectItem>
              <SelectItem value="hospital">By Hospital</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart 
            data={data.data} 
            layout="horizontal"
            margin={{ left: 100 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              type="number"
              tickFormatter={formatCurrency}
              className="text-xs"
            />
            <YAxis 
              dataKey="comparisonGroup"
              type="category"
              className="text-xs"
              width={90}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'metricValue') return [formatCurrency(value), 'Average Rate'];
                if (name === 'count') return [value.toLocaleString(), 'Sample Size'];
                if (name === 'percentile') return [\`\${value}th\`, 'Percentile'];
                return [value, name];
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Bar dataKey="metricValue" name="metricValue">
              {data.data.map((entry: any, index: number) => (
                <Cell key={\`cell-\${index}\`} fill={getBarColor(entry.percentile)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--success))]" />
            <span>Bottom 25%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--primary))]" />
            <span>25-50%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--warning))]" />
            <span>50-75%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--destructive))]" />
            <span>Top 25%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  ` : ''}
}
```

6. Add the component to the dashboard page in `apps/web/src/pages/dashboard/DashboardPage.tsx`:

```typescript
import { ${MetricName}Chart } from '@/components/analytics/${MetricName}Chart';

// In the dashboard content, add:
<${MetricName}Chart 
  hospitalId={selectedHospitalId}
  payerName={selectedPayerName}
  serviceCode={selectedServiceCode}
  ${metricType === 'timeseries' ? `
  startDate={dateRange.from}
  endDate={dateRange.to}
  ` : ''}
  ${metricType === 'comparison' ? `
  groupBy={groupBySelection}
  ` : ''}
  className="col-span-full lg:col-span-2"
/>
```

7. Create tests for the service method:

```bash
# Create test file
cat > apps/api/src/analytics/analytics.service.spec.ts << 'EOF'
// Add test for the new method:
describe('get${MetricName}', () => {
  it('should return ${metricType} data', async () => {
    // Mock database response
    const mockData = ${metricType === 'summary' ? `[{
      average_rate: 1250.50,
      median_rate: 1100.00,
      min_rate: 500.00,
      max_rate: 3000.00,
      sample_size: 1543,
    }]` : metricType === 'timeseries' ? `[
      { date: '2024-01-01', value: 1200, count: 50 },
      { date: '2024-01-02', value: 1250, count: 60 },
    ]` : metricType === 'distribution' ? `[
      { count: 100 },
      { count: 250 },
      { count: 150 },
    ]` : `[
      { comparison_group: 'BCBS', metric_value: 1500, variance: 100, count: 200 },
      { comparison_group: 'Aetna', metric_value: 1400, variance: 90, count: 180 },
    ]`};

    mockDb.select.mockResolvedValue(mockData);

    const result = await service.get${MetricName}({
      hospitalId: 'test-hospital',
      payerName: 'test-payer',
    });

    expect(result).toMatchObject({
      type: '${metricType}',
      data: expect.any(${metricType === 'summary' ? 'Object' : 'Array'}),
      metadata: expect.objectContaining({
        ${metricType === 'summary' ? 'calculatedAt: expect.any(Date)' : ''}
        ${metricType === 'timeseries' ? 'dataPoints: expect.any(Number)' : ''}
        ${metricType === 'distribution' ? 'totalCount: expect.any(Number)' : ''}
        ${metricType === 'comparison' ? 'groupCount: expect.any(Number)' : ''}
      }),
    });
  });

  it('should handle empty results', async () => {
    mockDb.select.mockResolvedValue([]);

    const result = await service.get${MetricName}({});

    expect(result.data).toBeDefined();
    ${metricType === 'summary' ? 'expect(result.data.sampleSize).toBe(0);' : 'expect(result.data).toHaveLength(0);'}
  });
});
EOF
```

8. Run migrations if schema was updated:

```bash
cd apps/api
pnpm db:generate
pnpm db:migrate
```

9. Verify the implementation:

```bash
# Check TypeScript compilation
cd apps/api && pnpm check-types
cd apps/web && npm run check-types

# Run tests
cd apps/api && pnpm test analytics.service.spec.ts

# Test the endpoint
curl "http://localhost:3000/api/v1/analytics/${metricName}?hospitalId=test-hospital"

# Check Swagger documentation
open http://localhost:3000/api/docs#/analytics/get${MetricName}
```

## Analytics Best Practices

1. **Performance Optimization**:
   - Use database indexes on commonly filtered columns
   - Implement caching for expensive queries
   - Consider materialized views for complex aggregations
   - Use pagination for large result sets

2. **Data Quality**:
   - Filter out invalid prices ($0, $999999, etc.)
   - Handle null values appropriately
   - Validate date ranges
   - Normalize payer names before aggregation

3. **Visualization**:
   - Choose appropriate chart types for data
   - Provide context with metadata
   - Use consistent color schemes
   - Make charts responsive for mobile

4. **Error Handling**:
   - Gracefully handle missing data
   - Provide meaningful error messages
   - Log errors with context
   - Show loading states