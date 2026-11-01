if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

process.env.PORT = '3099';
process.env.DB_PROVIDER = 'json';

import { createStorageService } from '../server/storage/index.js';
import { db } from '../server/db.js';

import fs from 'fs';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runStorageApiTests() {
  const dbJsonPath = 'server/data/db.json';
  const dbJsonSnapshot = fs.readFileSync(dbJsonPath, 'utf8');

  try {
    console.log('\n--- 1. Starting Express Server for Storage API Tests ---');
  // Dynamic import starts the server on port 3099
  const { app, storageService } = await import('../server/index.js');
  const baseUrl = 'http://127.0.0.1:3099';

  // Wait until server is listening
  let serverReady = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await fetch(`${baseUrl}/api/stats`);
      serverReady = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  if (!serverReady) {
    throw new Error('Server failed to start and respond within 6 seconds on port 3099');
  }

  console.log('\n--- 2. Unauthenticated Upload Protection Tests ---');
  const imgRes = await fetch(`${baseUrl}/api/admin/upload/image`, {
    method: 'POST',
  });
  assert(imgRes.status === 401, 'POST /api/admin/upload/image rejects unauthenticated request with HTTP 401');

  const apkRes = await fetch(`${baseUrl}/api/admin/upload/apk`, {
    method: 'POST',
  });
  assert(apkRes.status === 401, 'POST /api/admin/upload/apk rejects unauthenticated request with HTTP 401');

  console.log('\n--- 3. Legacy URL Backward-Compatibility Redirect Tests ---');
  const legacyImgRes = await fetch(`${baseUrl}/uploads/images/avatar_harsh.png`, {
    redirect: 'manual',
  });
  // If the file does not exist locally (or when tested in cloud/render mode)
  // it either redirects (302) or serves locally (200)
  const isRedirectOrLocal = legacyImgRes.status === 302 || legacyImgRes.status === 200;
  assert(isRedirectOrLocal, 'GET /uploads/images/:filename returns HTTP 200 (if local) or HTTP 302 redirect');
  if (legacyImgRes.status === 302) {
    const location = legacyImgRes.headers.get('location') || '';
    assert(
      location.includes('/storage/v1/object/public/game-assets/avatar_harsh.png'),
      'HTTP 302 redirect points to canonical Supabase Storage public CDN URL'
    );
  }

  // Non-existent image that definitely does not exist locally
  const nonExistentRes = await fetch(`${baseUrl}/uploads/images/nonexistent_test_image_99999.png`, {
    redirect: 'manual',
  });
  assert(nonExistentRes.status === 302, 'GET /uploads/images/nonexistent.png triggers HTTP 302 redirect to CDN');
  const targetLocation = nonExistentRes.headers.get('location') || '';
  assert(
    targetLocation.includes('/storage/v1/object/public/game-assets/nonexistent_test_image_99999.png'),
    'Redirect URL contains expected bucket and filename'
  );

  console.log('\n--- 4. Release Download Endpoint & Counter Safety Tests ---');
  // Non-existent release ID
  const notFoundRes = await fetch(`${baseUrl}/api/releases/9999999/download`);
  assert(notFoundRes.status === 404, 'GET /api/releases/nonexistent/download returns HTTP 404');
  const notFoundJson = await notFoundRes.json();
  assert(notFoundJson.error === 'Release not found', 'Returns "Release not found" error message');

  // Unpublished release test (create mock in dev json db)
  const devDb = db;
  const dummyRelease = await devDb.createRelease({
    game_id: 1,
    version: '99.0.0',
    version_code: 990,
    release_type: 'patch',
    changelog: 'Test',
    min_android_version: '8.0',
    target_android_version: '14.0',
    is_published: false,
    apk_filename: 'missing-test-file.apk',
    original_filename: 'test.apk',
    file_size_bytes: 1234,
    sha256_hash: 'abcdef',
    status: 'draft',
    download_count: 0,
  });

  const unpublishedRes = await fetch(`${baseUrl}/api/releases/${dummyRelease.id}/download`);
  assert(unpublishedRes.status === 403, 'GET /api/releases/:id/download rejects unpublished release with HTTP 403');

  // Published release with missing file
  await devDb.updateRelease(dummyRelease.id, { is_published: true });
  const missingFileRes = await fetch(`${baseUrl}/api/releases/${dummyRelease.id}/download`);
  assert(missingFileRes.status === 404, 'GET /api/releases/:id/download returns HTTP 404 when file is missing on storage & disk');

  // Verify download counter was NOT incremented for missing file
  const releaseAfterMissing = await devDb.getReleaseById(dummyRelease.id);
  assert(
    releaseAfterMissing?.download_count === 0,
    'Download count is NOT incremented when storage file is missing (atomic count safety)'
  );

  // Clean up mock release
  await devDb.deleteRelease(dummyRelease.id);

  console.log('\n--- 5. Supabase Production Storage Integrity Verification ---');
  const liveStorage = createStorageService();

  const expectedImages = [
    { name: 'arrow_puzzle_screenshot_1.jpg', size: 475994 },
    { name: 'arrow_puzzle_screenshot_2.jpg', size: 890422 },
    { name: 'arrow_puzzle_screenshot_3.jpg', size: 1098095 },
    { name: 'arrow_puzzle_screenshot_4.jpg', size: 223036 },
    { name: 'arrow_puzzle_screenshot_5.jpg', size: 609095 },
    { name: 'arrow_puzzle_screenshot_6.jpg', size: 316570 },
    { name: 'avatar_harsh.png', size: 180483 },
    { name: 'avatar_aditya.png', size: 171639 },
    { name: 'avatar_komal.png', size: 195109 },
  ];

  for (const img of expectedImages) {
    const meta = await liveStorage.getObjectMetadata('game-assets', img.name);
    assert(meta !== null && meta.size === img.size, `Verified production image in game-assets: ${img.name} (${img.size} bytes)`);
  }

  // Verify private APK in release-apks
  const apkMeta = await liveStorage.getObjectMetadata('release-apks', 'arrow-puzzle-release-v1.0.0.apk');
  assert(apkMeta !== null, 'Verified arrow-puzzle-release-v1.0.0.apk exists in release-apks');
  assert(apkMeta?.size === 2885749, 'arrow-puzzle-release-v1.0.0.apk matches exact verified size 2,885,749 bytes');
  assert(apkMeta?.contentType === 'application/vnd.android.package-archive', 'arrow-puzzle-release-v1.0.0.apk has correct APK MIME type');

  // Verify private bucket access control
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const unauthApkRes = await fetch(`${supabaseUrl}/storage/v1/object/public/release-apks/arrow-puzzle-release-v1.0.0.apk`);
  assert(
    !unauthApkRes.ok,
    `Public unauthenticated GET on private bucket release-apks is denied (HTTP ${unauthApkRes.status})`
  );

  console.log('\n--- 6. Supabase PostgreSQL Release Download Counter Invariant ---');
  const { SupabasePostgresProvider } = await import('../server/database/SupabasePostgresProvider.js');
  const pgProvider = new SupabasePostgresProvider();
  await pgProvider.init();
  const releases = await pgProvider.getReleases();
  const arrowRelease = releases.find((r) => r.apk_filename === 'arrow-puzzle-release-v1.0.0.apk');
  assert(arrowRelease !== undefined, 'Live release arrow-puzzle-release-v1.0.0.apk found in Supabase PostgreSQL');
  assert(
    arrowRelease?.download_count === 7,
    `Production release download_count remains exactly 7 (actual: ${arrowRelease?.download_count})`
  );
  await pgProvider.close();

  console.log(`\n========================================`);
  console.log(`Storage API Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
  } finally {
    fs.writeFileSync(dbJsonPath, dbJsonSnapshot, 'utf8');
  }
}

runStorageApiTests().catch((err) => {
  console.error('API Test Error:', err);
  process.exit(1);
});
