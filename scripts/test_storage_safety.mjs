#!/usr/bin/env node

/**
 * ==============================================================================
 * KARSH TECH — STORAGE MIGRATION SAFETY TEST SUITE
 * File: scripts/test_storage_safety.mjs
 * 
 * Verifies non-overwriting Supabase Storage migration semantics:
 *   1. New object upload (HTTP 201 with x-upsert: false)
 *   2. HTTP 409 Conflict with identical remote object (skipped safely)
 *   3. HTTP 409 Conflict with different remote object (flagged for review)
 *   4. HTTP 409 Conflict with unverifiable metadata (flagged for review)
 *   5. Failed upload handling (HTTP 500 error handled gracefully)
 *   6. Idempotent retry after partial failure
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { uploadStorageFile, computeChecksums } from './migrate_json_to_supabase.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Use an actual local file for realistic testing
const sampleImagePath = path.resolve(PROJECT_ROOT, 'server/uploads/images/avatar_harsh.png');
const fileBuffer = fs.readFileSync(sampleImagePath);
const localSize = fileBuffer.length;
const { md5: localMd5 } = computeChecksums(fileBuffer);

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}${detail ? ' - ' + detail : ''}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ' - ' + detail : ''}`);
    failed++;
  }
}

console.log('='.repeat(70));
console.log('  RUNNING SUPABASE STORAGE SAFETY & NON-OVERWRITING TEST SUITE');
console.log('='.repeat(70));
console.log(`Sample test file: ${path.basename(sampleImagePath)} (${localSize} bytes, MD5: ${localMd5})\n`);

async function runTests() {
  // ----------------------------------------------------------------------------
  // TEST 1: NEW OBJECT UPLOAD
  // ----------------------------------------------------------------------------
  console.log('[TEST 1] New Object Upload (Fresh Asset)');
  let capturedHeaders = null;
  const mockFetchNew = async (url, options) => {
    capturedHeaders = options.headers;
    return {
      ok: true,
      status: 201,
      statusText: 'Created',
      json: async () => ({ Key: 'game-assets/avatar_harsh.png' })
    };
  };

  const res1 = await uploadStorageFile('game-assets', 'avatar_harsh.png', sampleImagePath, 'image/png', {
    supabaseUrl: 'https://mock.supabase.co',
    supabaseKey: 'mock-key',
    fetchFn: mockFetchNew
  });

  assert(res1.status === 'uploaded', 'Status is uploaded');
  assert(res1.success === true, 'Success flag is true');
  assert(capturedHeaders['x-upsert'] === 'false', 'x-upsert header is strictly false');

  // ----------------------------------------------------------------------------
  // TEST 2: HTTP 409 CONFLICT - IDENTICAL REMOTE OBJECT
  // ----------------------------------------------------------------------------
  console.log('\n[TEST 2] HTTP 409 Conflict with Identical Remote Object (Safe Skip)');
  const mockFetchIdentical = async (url, options) => {
    if (options.method === 'POST' && url.includes('/storage/v1/object/list/')) {
      // Remote list inquiry returns matching size and MD5 etag
      return {
        ok: true,
        status: 200,
        json: async () => ([
          {
            name: 'avatar_harsh.png',
            metadata: {
              size: localSize,
              eTag: `"${localMd5}"`,
              mimetype: 'image/png'
            }
          }
        ])
      };
    }
    // Upload POST returns 409 Conflict
    return {
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () => JSON.stringify({ message: 'The resource already exists' })
    };
  };

  const res2 = await uploadStorageFile('game-assets', 'avatar_harsh.png', sampleImagePath, 'image/png', {
    supabaseUrl: 'https://mock.supabase.co',
    supabaseKey: 'mock-key',
    fetchFn: mockFetchIdentical
  });

  assert(res2.status === 'skipped_identical', 'Status is skipped_identical');
  assert(res2.success === true, 'Treated as successfully resolved');
  assert(res2.verified === true, 'Verified flag is true');
  assert(res2.checksumVerified === true, 'Checksum match confirmed');

  // ----------------------------------------------------------------------------
  // TEST 3: HTTP 409 CONFLICT - DIFFERENT REMOTE OBJECT (SIZE MISMATCH)
  // ----------------------------------------------------------------------------
  console.log('\n[TEST 3] HTTP 409 Conflict with Different Remote Object (Size Mismatch)');
  const mockFetchDifferent = async (url, options) => {
    if (options.method === 'POST' && url.includes('/storage/v1/object/list/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ([
          {
            name: 'avatar_harsh.png',
            metadata: {
              size: localSize + 9999, // Remote is different!
              eTag: '"diff1234567890"',
              mimetype: 'image/png'
            }
          }
        ])
      };
    }
    return {
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () => JSON.stringify({ message: 'The resource already exists' })
    };
  };

  const res3 = await uploadStorageFile('game-assets', 'avatar_harsh.png', sampleImagePath, 'image/png', {
    supabaseUrl: 'https://mock.supabase.co',
    supabaseKey: 'mock-key',
    fetchFn: mockFetchDifferent
  });

  assert(res3.status === 'warning_mismatch', 'Status is warning_mismatch');
  assert(res3.success === false, 'Never counted as success');
  assert(res3.verified === false, 'Verified flag is false');
  assert(res3.reason.includes('Size mismatch'), 'Reason documents size mismatch');

  // ----------------------------------------------------------------------------
  // TEST 4: HTTP 409 CONFLICT - UNVERIFIABLE METADATA
  // ----------------------------------------------------------------------------
  console.log('\n[TEST 4] HTTP 409 Conflict with Inaccessible Metadata');
  const mockFetchUnverifiable = async (url, options) => {
    if (options.method === 'POST' && url.includes('/storage/v1/object/list/')) {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      };
    }
    if (options.method === 'HEAD') {
      return {
        ok: false,
        status: 500
      };
    }
    return {
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () => JSON.stringify({ message: 'The resource already exists' })
    };
  };

  const res4 = await uploadStorageFile('game-assets', 'avatar_harsh.png', sampleImagePath, 'image/png', {
    supabaseUrl: 'https://mock.supabase.co',
    supabaseKey: 'mock-key',
    fetchFn: mockFetchUnverifiable
  });

  assert(res4.status === 'warning_unverifiable', 'Status is warning_unverifiable');
  assert(res4.success === false, 'Never counted as success');
  assert(res4.verified === false, 'Verified is false');

  // ----------------------------------------------------------------------------
  // TEST 5: FAILED UPLOAD (SERVER ERROR / QUOTA ERROR)
  // ----------------------------------------------------------------------------
  console.log('\n[TEST 5] Failed Upload Handling (HTTP 500 / Payload Too Large)');
  const mockFetchError = async (url, options) => {
    return {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Database connection timeout in Storage engine'
    };
  };

  const res5 = await uploadStorageFile('game-assets', 'avatar_harsh.png', sampleImagePath, 'image/png', {
    supabaseUrl: 'https://mock.supabase.co',
    supabaseKey: 'mock-key',
    fetchFn: mockFetchError
  });

  assert(res5.status === 'failed', 'Status is failed');
  assert(res5.success === false, 'Success is false');
  assert(res5.error.includes('HTTP 500'), 'Error message contains HTTP 500 details');

  // ----------------------------------------------------------------------------
  // TEST 6: RETRY AFTER PARTIAL FAILURE (BATCH SIMULATION)
  // ----------------------------------------------------------------------------
  console.log('\n[TEST 6] Batch Retry Simulation After Partial Failure');
  const remoteState = new Map();
  // Simulate File 1 already existed remotely and is identical
  remoteState.set('file1.png', { size: localSize, etag: localMd5 });
  // File 2 previously failed, now attempts fresh upload
  // File 3 already existed remotely and is identical
  remoteState.set('file3.png', { size: localSize, etag: localMd5 });

  const mockBatchFetch = async (url, options) => {
    const filename = decodeURIComponent(url.split('/').pop());

    if (options.method === 'POST' && url.includes('/storage/v1/object/list/')) {
      const body = JSON.parse(options.body);
      const searchName = body.search;
      const found = remoteState.get(searchName);
      if (found) {
        return {
          ok: true,
          status: 200,
          json: async () => ([
            { name: searchName, metadata: { size: found.size, eTag: `"${found.etag}"` } }
          ])
        };
      }
      return { ok: true, status: 200, json: async () => ([]) };
    }

    if (options.method === 'POST') {
      if (remoteState.has(filename)) {
        return {
          ok: false,
          status: 409,
          statusText: 'Conflict',
          text: async () => 'Resource already exists'
        };
      }
      // Fresh upload succeeds and is saved
      remoteState.set(filename, { size: localSize, etag: localMd5 });
      return {
        ok: true,
        status: 201,
        statusText: 'Created'
      };
    }
  };

  const batchFiles = ['file1.png', 'file2.png', 'file3.png'];
  const batchResults = [];

  for (const f of batchFiles) {
    const result = await uploadStorageFile('game-assets', f, sampleImagePath, 'image/png', {
      supabaseUrl: 'https://mock.supabase.co',
      supabaseKey: 'mock-key',
      fetchFn: mockBatchFetch
    });
    batchResults.push(result);
  }

  assert(batchResults[0].status === 'skipped_identical', 'File 1 safely skipped (identical)');
  assert(batchResults[1].status === 'uploaded', 'File 2 successfully uploaded on retry');
  assert(batchResults[2].status === 'skipped_identical', 'File 3 safely skipped (identical)');

  // ----------------------------------------------------------------------------
  // TEST SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
