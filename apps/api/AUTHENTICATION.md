# Authentication & Authorization System

This document outlines the authentication and authorization system implemented for the Glimmr API.

## Overview

The API now implements a comprehensive security system with:
- JWT-based authentication for admin users
- API key authentication for programmatic access
- Role-based access control (RBAC)
- Secured admin interfaces
- Protected endpoints

## Authentication Methods

### 1. JWT Authentication
- **Use Case**: Interactive admin access
- **Header**: `Authorization: Bearer <token>`
- **Expiry**: 24 hours
- **Roles**: `admin`, `api-user`

### 2. API Key Authentication
- **Use Case**: Programmatic access to data endpoints
- **Header**: `x-api-key: <api-key>`
- **Expiry**: No expiration (revokable)
- **Roles**: `admin`, `api-user`

## User Roles

### Admin (`admin`)
- Full access to all endpoints
- Can trigger background jobs
- Access to Bull Board queue management
- Can generate API keys
- Can access analytics export

### API User (`api-user`)
- Read access to data endpoints
- Can view job status (but not trigger jobs)
- Can access analytics dashboards
- Can generate API keys
- Cannot access admin-only endpoints

## Protected Endpoints

### High Security (Admin Only)
- `POST /jobs/*` - Job management actions
- `GET /jobs/board` - Bull Board dashboard URL
- `/admin/queues/*` - Bull Board admin interface

### Medium Security (Admin + API User)
- `GET /jobs/*` - Job status and information
- `GET /analytics/*` - Analytics dashboards and data
- `GET /odata/*` - OData endpoints (API key required)

### Public Endpoints
- `GET /health` - Health checks
- `GET /` - API information

## Getting Started

### 1. Create Admin User
```bash
# Set environment variables (optional)
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=secure_password_123

# Run the admin seeding script
pnpm db:seed:admin
```

### 2. Login and Get JWT Token
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "admin",
    "role": "admin"
  }
}
```

### 3. Generate API Key
```bash
curl -X POST http://localhost:3000/auth/api-key \
  -H "Authorization: Bearer <your-jwt-token>"
```

Response:
```json
{
  "apiKey": "gapi_xyz123abc456"
}
```

### 4. Access Protected Endpoints

#### Using JWT Token
```bash
curl -X GET http://localhost:3000/jobs \
  -H "Authorization: Bearer <your-jwt-token>"
```

#### Using API Key
```bash
curl -X GET http://localhost:3000/odata/hospitals \
  -H "x-api-key: gapi_xyz123abc456"
```

## API Documentation

Visit `/docs` (Swagger UI) for comprehensive API documentation including:
- Authentication examples
- Endpoint security requirements
- Request/response schemas
- Try-it-out functionality

## Security Features

### Password Security
- Passwords hashed with bcrypt (10 rounds)
- Minimum password length enforced
- No password storage in logs

### Token Security
- JWT tokens signed with configurable secret
- 24-hour expiration
- Stateless authentication

### API Key Security
- Cryptographically random API keys
- Prefixed with `gapi_` for identification
- Revokable through database

### Request Logging
- All authentication attempts logged
- Authorization headers masked in logs
- Request context tracking

## Environment Variables

```env
JWT_SECRET=your-super-secret-jwt-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password_123
```

## Testing

### Run Security Tests
```bash
# Run authentication e2e tests
pnpm test:e2e src/auth/test/auth.e2e-spec.ts

# Run all tests
pnpm test
```

### Manual Testing Checklist

1. **Authentication**
   - [ ] User registration works
   - [ ] Login with valid credentials
   - [ ] Login rejection with invalid credentials
   - [ ] JWT token generation
   - [ ] API key generation

2. **Authorization**
   - [ ] Admin can access all endpoints
   - [ ] API user cannot access admin endpoints
   - [ ] Unauthenticated requests are rejected
   - [ ] API key authentication works for OData

3. **Security**
   - [ ] Bull Board requires admin authentication
   - [ ] Job triggers require admin role
   - [ ] Analytics requires authentication
   - [ ] OData requires API key

## Migration Guide

### From Unauthenticated API
1. Create admin user: `pnpm db:seed:admin`
2. Login to get JWT token
3. Update client applications to include authentication headers
4. Generate API keys for programmatic access
5. Update OData clients to use API key authentication

### Breaking Changes
- All endpoints now require authentication (except health and root)
- Bull Board admin interface requires admin authentication
- OData endpoints require API key authentication

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check if JWT token is valid and not expired
   - Verify API key is correct
   - Ensure proper authentication header format

2. **403 Forbidden**
   - Check user role permissions
   - Verify endpoint requires user's role level

3. **JWT Verification Failed**
   - Check JWT_SECRET environment variable
   - Ensure token hasn't expired
   - Verify token format (Bearer <token>)

### Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure database migrations have been applied
4. Review this documentation for correct usage patterns