const XLSX = require('xlsx');
const AWS = require('@aws-sdk/client-s3');
const fs = require('fs');

async function debugPriceFile() {
  // Setup S3 client for MinIO
  const s3Client = new AWS.S3Client({
    region: 'us-east-1',
    endpoint: 'http://localhost:9000',
    credentials: {
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin123'
    },
    forcePathStyle: true
  });

  const storageKey = 'hospitals/b7180055-54d6-451c-a2cf-fe71b0b79d32/transparency-files/2025-07-23/CDM02212023-3_83c11f.xlsx';
  
  try {
    // Download file from MinIO
    const command = new AWS.GetObjectCommand({
      Bucket: 'glimmr-files',
      Key: storageKey
    });
    
    const response = await s3Client.send(command);
    const chunks = [];
    
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    
    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    console.log('=== FILE ANALYSIS ===');
    console.log('Sheet Names:', workbook.SheetNames);
    
    // Check first sheet
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    console.log('\n=== FIRST SHEET ANALYSIS ===');
    console.log('Total Rows:', data.length);
    
    if (data.length > 0) {
      console.log('\nFirst Row (Headers):', data[0]);
      console.log('\nFirst 5 data rows:');
      for (let i = 1; i < Math.min(6, data.length); i++) {
        console.log(`Row ${i}:`, data[i].slice(0, 5), '...');
      }
    }
    
    // Also check as JSON with headers
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
    if (jsonData.length > 0) {
      console.log('\n=== COLUMN NAMES ===');
      console.log(Object.keys(jsonData[0]));
      
      console.log('\n=== SAMPLE RECORD ===');
      console.log(JSON.stringify(jsonData[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugPriceFile();