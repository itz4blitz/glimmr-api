# Generate API Documentation Command

This command extracts documentation from API services, generates OpenAPI specs, and creates comprehensive API documentation.

## Usage

```bash
/docs/generate-api-docs
```

## What it does

1. **Extract JSDoc Comments**
   - Scans all `*.service.ts` files for JSDoc documentation
   - Extracts method signatures, parameters, and return types
   - Collects example usage from comments

2. **Generate OpenAPI Documentation**
   - Analyzes controller decorators for endpoint definitions
   - Extracts DTO schemas from class-validator decorators
   - Generates OpenAPI 3.0 specification
   - Updates Swagger documentation

3. **Create Example Requests/Responses**
   - Extracts real examples from e2e test files
   - Captures actual HTTP requests and responses
   - Formats examples for documentation

4. **Update Documentation Files**
   - Updates `/docs/api/` with generated content
   - Creates endpoint reference pages
   - Generates API changelog

## Process

### Step 1: Service Documentation Extraction
```typescript
// Looks for JSDoc comments like:
/**
 * Fetches hospital data by state
 * @param state - Two-letter state code
 * @returns Array of hospitals in the specified state
 * @example
 * const hospitals = await hospitalService.findByState('CA');
 */
```

### Step 2: OpenAPI Generation
```typescript
// Extracts from controllers:
@ApiTags('hospitals')
@Controller('hospitals')
export class HospitalController {
  @Get(':id')
  @ApiOperation({ summary: 'Get hospital by ID' })
  @ApiResponse({ status: 200, description: 'Hospital found', type: HospitalDto })
  @ApiResponse({ status: 404, description: 'Hospital not found' })
  async findOne(@Param('id') id: string): Promise<HospitalDto> {
    // ...
  }
}
```

### Step 3: E2E Test Example Extraction
```typescript
// Captures from tests:
it('should return hospital data', async () => {
  const response = await request(app.getHttpServer())
    .get('/hospitals/123')
    .expect(200);
    
  // This response is captured as an example
  expect(response.body).toMatchObject({
    id: '123',
    name: 'Sample Hospital',
    state: 'CA'
  });
});
```

### Step 4: Documentation Generation
Creates structured documentation:
- `docs/api/README.md` - API overview
- `docs/api/endpoints/` - Individual endpoint docs
- `docs/api/schemas/` - Data model documentation
- `docs/api/examples/` - Request/response examples
- `docs/api/authentication.md` - Auth guide
- `docs/api/errors.md` - Error reference

## Implementation Script

```bash
#!/bin/bash
# This script is executed when the command runs

set -euo pipefail

echo "🚀 Generating API Documentation..."

# Create documentation directories
mkdir -p docs/api/{endpoints,schemas,examples}

# Step 1: Extract service documentation
echo "📝 Extracting service documentation..."
npx typedoc \
  --plugin typedoc-plugin-markdown \
  --out docs/api/services \
  --exclude "**/*.spec.ts" \
  --exclude "**/node_modules/**" \
  apps/api/src/**/*.service.ts

# Step 2: Generate OpenAPI specification
echo "📋 Generating OpenAPI specification..."
cd apps/api
npm run build
node -e "
const { NestFactory } = require('@nestjs/core');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const { AppModule } = require('./dist/app.module');
const fs = require('fs');

async function generateOpenAPI() {
  const app = await NestFactory.create(AppModule.default || AppModule, { logger: false });
  
  const config = new DocumentBuilder()
    .setTitle('Glimmr API')
    .setDescription('Healthcare Price Transparency Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  
  fs.writeFileSync('../../docs/api/openapi.json', JSON.stringify(document, null, 2));
  await app.close();
  
  console.log('✅ OpenAPI specification generated');
}

generateOpenAPI().catch(console.error);
"
cd ../..

# Step 3: Extract examples from e2e tests
echo "🧪 Extracting examples from e2e tests..."
node -e "
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const examples = {};

// Parse e2e test files
glob.sync('apps/api/test/**/*.e2e-spec.ts').forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Extract request/response examples
  const matches = content.matchAll(/request\(.*?\)[\s\S]*?\.expect\(\d+\)[\s\S]*?expect\(.*?\.body\)[\s\S]*?\}\);/g);
  
  for (const match of matches) {
    // Parse endpoint and example
    const endpoint = match[0].match(/\.(get|post|put|delete|patch)\(['\"](.*?)['\"].*?\)/);
    if (endpoint) {
      const method = endpoint[1].toUpperCase();
      const path = endpoint[2];
      const key = \`\${method} \${path}\`;
      
      if (!examples[key]) {
        examples[key] = {
          method,
          path,
          examples: []
        };
      }
      
      // Extract request body if present
      const bodyMatch = match[0].match(/\.send\(([\s\S]*?)\)/);
      const responseMatch = match[0].match(/expect\(.*?\.body\)[\s\S]*?toMatchObject\(([\s\S]*?)\)/);
      
      examples[key].examples.push({
        request: bodyMatch ? bodyMatch[1] : null,
        response: responseMatch ? responseMatch[1] : null,
        test: path.basename(file)
      });
    }
  }
});

// Save examples
fs.writeFileSync('docs/api/examples/extracted.json', JSON.stringify(examples, null, 2));
console.log('✅ Extracted', Object.keys(examples).length, 'endpoint examples');
"

# Step 4: Generate endpoint documentation
echo "📚 Generating endpoint documentation..."
node -e "
const fs = require('fs');
const openapi = JSON.parse(fs.readFileSync('docs/api/openapi.json'));
const examples = JSON.parse(fs.readFileSync('docs/api/examples/extracted.json'));

// Generate endpoint documentation
Object.entries(openapi.paths).forEach(([path, methods]) => {
  const filename = path.replace(/[{}]/g, '').replace(/\//g, '-').substring(1) + '.md';
  const filepath = \`docs/api/endpoints/\${filename}\`;
  
  let content = \`# \${path}\n\n\`;
  
  Object.entries(methods).forEach(([method, spec]) => {
    content += \`## \${method.toUpperCase()}\n\n\`;
    content += \`\${spec.summary || 'No summary available'}\n\n\`;
    
    if (spec.description) {
      content += \`### Description\n\${spec.description}\n\n\`;
    }
    
    // Parameters
    if (spec.parameters && spec.parameters.length > 0) {
      content += \`### Parameters\n\n\`;
      content += \`| Name | Type | Required | Description |\n\`;
      content += \`|------|------|----------|-------------|\n\`;
      spec.parameters.forEach(param => {
        content += \`| \${param.name} | \${param.schema?.type || 'any'} | \${param.required ? 'Yes' : 'No'} | \${param.description || '-'} |\n\`;
      });
      content += \`\n\`;
    }
    
    // Request body
    if (spec.requestBody) {
      content += \`### Request Body\n\n\`;
      content += \`\\\`\\\`\\\`json\n\`;
      const schema = spec.requestBody.content?.['application/json']?.schema;
      if (schema) {
        content += JSON.stringify(schema, null, 2);
      }
      content += \`\n\\\`\\\`\\\`\n\n\`;
    }
    
    // Responses
    content += \`### Responses\n\n\`;
    Object.entries(spec.responses).forEach(([status, response]) => {
      content += \`#### \${status} - \${response.description}\n\n\`;
      if (response.content?.['application/json']?.schema) {
        content += \`\\\`\\\`\\\`json\n\`;
        content += JSON.stringify(response.content['application/json'].schema, null, 2);
        content += \`\n\\\`\\\`\\\`\n\n\`;
      }
    });
    
    // Examples from tests
    const exampleKey = \`\${method.toUpperCase()} \${path}\`;
    if (examples[exampleKey]) {
      content += \`### Examples\n\n\`;
      examples[exampleKey].examples.forEach((ex, i) => {
        content += \`#### Example \${i + 1} (from \${ex.test})\n\n\`;
        if (ex.request) {
          content += \`**Request:**\n\\\`\\\`\\\`json\n\${ex.request}\n\\\`\\\`\\\`\n\n\`;
        }
        if (ex.response) {
          content += \`**Response:**\n\\\`\\\`\\\`json\n\${ex.response}\n\\\`\\\`\\\`\n\n\`;
        }
      });
    }
  });
  
  fs.writeFileSync(filepath, content);
});

console.log('✅ Generated endpoint documentation');
"

# Step 5: Generate API overview
echo "📄 Generating API overview..."
cat > docs/api/README.md << 'EOF'
# Glimmr API Documentation

## Overview

The Glimmr API provides programmatic access to healthcare price transparency data. This RESTful API allows you to:

- Search and retrieve hospital information
- Access pricing data for medical procedures
- Monitor price transparency file updates
- Generate analytics and reports
- Manage job processing workflows

## Base URL

```
https://api.glimmr.com/v1
```

For local development:
```
http://localhost:3000/api/v1
```

## Authentication

Most endpoints require authentication using JWT tokens. See [Authentication Guide](./authentication.md) for details.

```bash
curl -X POST https://api.glimmr.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

## Quick Start

1. **Get Authentication Token**
   ```bash
   POST /auth/login
   ```

2. **List Hospitals**
   ```bash
   GET /hospitals?state=CA&limit=10
   ```

3. **Get Price Data**
   ```bash
   GET /prices?hospitalId=123&cptCode=99213
   ```

## Available Endpoints

EOF

# Generate endpoint list
node -e "
const openapi = JSON.parse(fs.readFileSync('docs/api/openapi.json'));
const endpoints = [];

Object.entries(openapi.paths).forEach(([path, methods]) => {
  Object.entries(methods).forEach(([method, spec]) => {
    endpoints.push({
      method: method.toUpperCase(),
      path,
      summary: spec.summary || 'No description'
    });
  });
});

// Group by tag
const grouped = {};
endpoints.forEach(ep => {
  const tag = openapi.paths[ep.path][ep.method.toLowerCase()].tags?.[0] || 'Other';
  if (!grouped[tag]) grouped[tag] = [];
  grouped[tag].push(ep);
});

// Generate markdown
let content = '';
Object.entries(grouped).forEach(([tag, eps]) => {
  content += \`### \${tag}\n\n\`;
  content += \`| Method | Endpoint | Description |\n\`;
  content += \`|--------|----------|-------------|\n\`;
  eps.forEach(ep => {
    const filename = ep.path.replace(/[{}]/g, '').replace(/\//g, '-').substring(1) + '.md';
    content += \`| \${ep.method} | [\${ep.path}](./endpoints/\${filename}) | \${ep.summary} |\n\`;
  });
  content += \`\n\`;
});

// Append to README
const readme = fs.readFileSync('docs/api/README.md', 'utf8');
fs.writeFileSync('docs/api/README.md', readme + content);
"

# Step 6: Generate schema documentation
echo "📋 Generating schema documentation..."
node -e "
const openapi = JSON.parse(fs.readFileSync('docs/api/openapi.json'));

// Extract all schemas
const schemas = openapi.components?.schemas || {};

Object.entries(schemas).forEach(([name, schema]) => {
  let content = \`# \${name}\n\n\`;
  
  if (schema.description) {
    content += \`\${schema.description}\n\n\`;
  }
  
  content += \`## Properties\n\n\`;
  content += \`| Property | Type | Required | Description |\n\`;
  content += \`|----------|------|----------|-------------|\n\`;
  
  const required = schema.required || [];
  Object.entries(schema.properties || {}).forEach(([prop, def]) => {
    content += \`| \${prop} | \${def.type || 'any'} | \${required.includes(prop) ? 'Yes' : 'No'} | \${def.description || '-'} |\n\`;
  });
  
  content += \`\n## Example\n\n\\\`\\\`\\\`json\n\`;
  content += JSON.stringify(def.example || {}, null, 2);
  content += \`\n\\\`\\\`\\\`\n\`;
  
  fs.writeFileSync(\`docs/api/schemas/\${name}.md\`, content);
});

console.log('✅ Generated schema documentation for', Object.keys(schemas).length, 'schemas');
"

# Step 7: Generate authentication guide
cat > docs/api/authentication.md << 'EOF'
# Authentication Guide

## Overview

The Glimmr API uses JWT (JSON Web Tokens) for authentication. Most endpoints require a valid token in the Authorization header.

## Obtaining a Token

### Login Endpoint

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

### Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "roles": ["user"]
  }
}
```

## Using the Token

Include the token in the Authorization header:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  https://api.glimmr.com/v1/hospitals
```

## Token Expiration

- Tokens expire after 24 hours
- Refresh tokens are valid for 7 days
- Use the refresh endpoint to get a new token

## API Key Authentication

For server-to-server communication, API keys are also supported:

```bash
curl -H "X-API-Key: your-api-key" \
  https://api.glimmr.com/v1/hospitals
```
EOF

# Step 8: Generate error reference
cat > docs/api/errors.md << 'EOF'
# Error Reference

## Error Response Format

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": {
    "field": "email",
    "constraint": "isEmail"
  }
}
```

## Common Error Codes

| Status Code | Name | Description |
|-------------|------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## Rate Limiting

- Default: 100 requests per minute
- Authenticated: 1000 requests per minute
- Headers returned: X-RateLimit-Limit, X-RateLimit-Remaining
EOF

# Generate API changelog
echo "📝 Generating API changelog..."
git log --grep="feat\|fix\|breaking" --pretty=format:"- %s (%h)" --since="30 days ago" -- apps/api/src > docs/api/CHANGELOG.md

echo "✅ API documentation generated successfully!"
echo "📁 Documentation available in: docs/api/"
```

## Output Structure

```
docs/api/
├── README.md                 # API overview
├── authentication.md         # Auth guide
├── errors.md                # Error reference
├── CHANGELOG.md             # Recent API changes
├── openapi.json             # OpenAPI spec
├── endpoints/               # Endpoint docs
│   ├── auth-login.md
│   ├── hospitals.md
│   └── ...
├── schemas/                 # Data models
│   ├── HospitalDto.md
│   ├── PriceDto.md
│   └── ...
├── examples/                # Request/response examples
│   └── extracted.json
└── services/                # Service documentation
    └── ...
```