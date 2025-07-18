#!/usr/bin/env node

/**
 * Quick test script for the new streaming analytics export functionality
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function testEndpoints() {
  console.log('Testing Analytics Export Endpoints...\n');
  
  try {
    // Test 1: Regular export endpoint (should return job metadata)
    console.log('1. Testing regular export endpoint...');
    const exportResult = await makeRequest('/api/v1/analytics/export?format=json&dataset=hospitals&limit=10');
    console.log('Response:', exportResult.data.substring(0, 200) + '...\n');
    
    // Test 2: Streaming export endpoint
    console.log('2. Testing streaming export endpoint...');
    const streamResult = await makeRequest('/api/v1/analytics/export/stream?format=json&dataset=hospitals&limit=5');
    console.log('Response:', streamResult.data.substring(0, 300) + '...\n');
    
    // Test 3: Test format validation
    console.log('3. Testing format validation...');
    const validationResult = await makeRequest('/api/v1/analytics/export/stream?format=csv&dataset=hospitals');
    console.log('Response:', validationResult.data + '\n');
    
    console.log('All tests completed!');
    
  } catch (error) {
    console.error('Error testing endpoints:', error.message);
    console.log('Note: Make sure the development server is running with `pnpm start:dev`');
  }
}

if (require.main === module) {
  testEndpoints();
}

module.exports = { testEndpoints };