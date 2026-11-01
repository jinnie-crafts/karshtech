import crypto from 'crypto';
import { MockStorageService } from '../server/testing/MockStorageService.js';
import type { UploadOptions } from '../server/storage/storageTypes.js';

export interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

export async function runStorageCollisionTests(): Promise<TestReport[]> {
  const reports: TestReport[] = [];
  let testNum = 0;

  async function run(category: string, name: string, fn: () => Promise<void>) {
    testNum++;
    try {
      await fn();
      reports.push({ num: testNum, name, category, passed: true });
      console.log(`  ✓ [PASS] [${category}] ${name}`);
    } catch (err: any) {
      reports.push({ num: testNum, name, category, passed: false, error: err.message });
      console.error(`  ✗ [FAIL] [${category}] ${name}: ${err.message}`);
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.3 STORAGE COLLISION & INTEGRITY TESTS');
  console.log('================================================================\n');

  const mockStorage = new MockStorageService();
  await mockStorage.init();

  // Test Payload Setup
  const bufferA = Buffer.from('Original content of length 48 bytes 123456789012');
  const bufferSameContent = Buffer.from('Original content of length 48 bytes 123456789012');
  // Different content with EXACT SAME length (48 bytes)
  const bufferDifferentEqualSize = Buffer.from('Different content length 48 bytes 12345678901234');
  assert(bufferA.length === bufferDifferentEqualSize.length, 'Setup assertion: buffers have identical length (48 bytes)');
  assert(!bufferA.equals(bufferDifferentEqualSize), 'Setup assertion: buffers have different byte contents');

  // Different content with different length
  const bufferDifferentSize = Buffer.from('Shorter content');

  const targetPath = 'screenshots/collision_test.png';

  // 1. Initial Upload
  await run('Collision', 'Initial upload succeeds and stores object', async () => {
    const res = await mockStorage.upload({
      bucket: 'game-assets',
      path: targetPath,
      buffer: bufferA,
      contentType: 'image/png',
      preventOverwrite: true,
    });
    assert(res.success === true, 'Initial upload succeeded');
    assert(res.size === bufferA.length, 'Size matches bufferA');
  });

  // 2. Same path and IDENTICAL content
  await run('Collision', 'Same path and identical content is safely reused without error', async () => {
    const res = await mockStorage.upload({
      bucket: 'game-assets',
      path: targetPath,
      buffer: bufferSameContent,
      contentType: 'image/png',
      preventOverwrite: true,
    });
    assert(res.success === true, 'Upload succeeded by reusing identical object');
    assert(res.size === bufferSameContent.length, 'Size preserved');
  });

  // 3. Same path and DIFFERENT content of EQUAL size (Critical weakness fix)
  await run('Collision', 'Same path and different content of EQUAL size is safely rejected (HTTP 409)', async () => {
    let errorCaught = false;
    try {
      await mockStorage.upload({
        bucket: 'game-assets',
        path: targetPath,
        buffer: bufferDifferentEqualSize,
        contentType: 'image/png',
        preventOverwrite: true,
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('Storage Conflict'), 'Throws Storage Conflict error');
      assert(err.message.includes('409'), 'Cites HTTP 409 conflict code');
      assert(err.message.includes('different content'), 'Identifies content mismatch despite identical size');
    }
    assert(errorCaught, 'Collision rejected when content differs despite matching byte count');
  });

  // 4. Same path and DIFFERENT content of DIFFERENT size
  await run('Collision', 'Same path and different content of DIFFERENT size is rejected (HTTP 409)', async () => {
    let errorCaught = false;
    try {
      await mockStorage.upload({
        bucket: 'game-assets',
        path: targetPath,
        buffer: bufferDifferentSize,
        contentType: 'image/png',
        preventOverwrite: true,
      });
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('different size'), 'Identifies different size collision');
    }
    assert(errorCaught, 'Different size collision rejected');
  });

  // 5. Overwrite allowed when preventOverwrite is false
  await run('Collision', 'Upload succeeds and replaces content when preventOverwrite is false', async () => {
    const res = await mockStorage.upload({
      bucket: 'game-assets',
      path: targetPath,
      buffer: bufferDifferentEqualSize,
      contentType: 'image/png',
      preventOverwrite: false,
    });
    assert(res.success === true, 'Overwrite succeeded');
    const meta = await mockStorage.getObjectMetadata('game-assets', targetPath);
    assert(meta !== null, 'Metadata exists');
    assert(meta?.size === bufferDifferentEqualSize.length, 'Metadata reflects overwritten buffer length');
  });

  // 6. Simulated Network/Server Failure during upload
  await run('Resilience', 'Storage network/server failure is cleanly surfaced as an exception', async () => {
    mockStorage.simulateFailure('upload', new Error('Supabase Storage 503 Service Unavailable: Gateway Timeout'));
    let failureCaught = false;
    try {
      await mockStorage.upload({
        bucket: 'game-assets',
        path: 'another/test.png',
        buffer: bufferA,
        contentType: 'image/png',
      });
    } catch (err: any) {
      failureCaught = true;
      assert(err.message.includes('503 Service Unavailable'), 'Surfaces storage network error message');
    }
    assert(failureCaught, 'Simulated network failure thrown cleanly');
    mockStorage.clearSimulatedFailure('upload');
  });

  // 7. Missing Object Metadata Lookup
  await run('Resilience', 'Metadata lookup for non-existent path safely returns null', async () => {
    const meta = await mockStorage.getObjectMetadata('game-assets', 'non_existent_folder/ghost.png');
    assert(meta === null, 'Non-existent object metadata returns null');
  });

  // 8. Missing Object Download
  await run('Resilience', 'Download of non-existent object throws 404 error cleanly', async () => {
    let notFoundCaught = false;
    try {
      await mockStorage.downloadPrivate('release-apks', 'missing_release.apk');
    } catch (err: any) {
      notFoundCaught = true;
      assert(err.message.includes('404'), 'Identifies 404 not found');
    }
    assert(notFoundCaught, 'Missing download throws 404');
  });

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`STORAGE COLLISION SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Storage Collision Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_storage_collision.ts')) {
  runStorageCollisionTests().catch((err) => {
    console.error('[FATAL ERROR IN STORAGE COLLISION SUITE]', err);
    process.exit(1);
  });
}
