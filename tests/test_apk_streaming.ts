import http from 'http';
import { app } from '../server/index.js';
import { db, setDatabaseProvider } from '../server/db.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { setStorageService } from '../server/storage/storageFactory.js';
import { MockStorageService } from '../server/testing/MockStorageService.js';
import { validateTestDatabaseUrl, assertTestDatabaseIsolation } from '../server/testing/testDatabaseGuard.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
  } catch {}
}

export interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

export async function runApkStreamingTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.3 PRIVATE APK STREAMING & COUNTER TESTS');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  // 1. Validate guard
  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard rejected test URL: ${guard.reason}`);

  // 2. Initialize PostgreSQL provider for Docker test DB
  const postgresProvider = new SupabasePostgresProvider(testDbUrl);
  await postgresProvider.init();
  setDatabaseProvider(postgresProvider);

  // 3. Initialize Mock Storage Service and wire into app
  const mockStorage = new MockStorageService();
  await mockStorage.init();
  setStorageService(mockStorage);

  // 4. Spin up ephemeral Express HTTP server
  let server: http.Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  // Synthetic APK buffer
  const sampleApkBuffer = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x08, 0x00]),
    Buffer.from('AndroidManifest.xml'),
    Buffer.from('KARSH_TECH_TEST_APK_PAYLOAD_V1'),
    Buffer.alloc(1024),
  ]);

  try {
    // Setup test records in Docker DB
    const testGame = await postgresProvider.createGame({
      title: 'APK Streaming Test Game',
      slug: `apk-streaming-test-game-${Date.now()}`,
      tagline: 'Test Tagline',
      description: 'Test Description',
      genre: ['Action'],
      platforms: ['Android'],
      status: 'Available',
      featured: false,
    } as any);

    // Create published release with uploaded APK
    const testApkFilename = 'test_release_streaming.apk';
    const originalFilename = 'My Great Game (v1.0.0) [Final].apk';

    await mockStorage.upload({
      bucket: 'release-apks',
      path: testApkFilename,
      buffer: sampleApkBuffer,
      contentType: 'application/vnd.android.package-archive',
      preventOverwrite: false,
    });

    const publishedRel = await postgresProvider.createRelease({
      game_id: testGame.id,
      version_name: 'v1.0.0-stream',
      version_code: 100,
      release_date: '2026-11-01',
      release_notes: 'Initial test release',
      apk_filename: testApkFilename,
      original_filename: originalFilename,
      apk_file_size: sampleApkBuffer.length,
      is_published: true,
    } as any);

    // Create UNPUBLISHED release with uploaded APK
    const unpublishedRel = await postgresProvider.createRelease({
      game_id: testGame.id,
      version_name: 'v1.1.0-draft',
      version_code: 110,
      release_date: '2026-11-01',
      release_notes: 'Draft release',
      apk_filename: testApkFilename,
      original_filename: originalFilename,
      apk_file_size: sampleApkBuffer.length,
      is_published: false,
    } as any);

    // Create published release with MISSING APK on storage
    const missingApkRel = await postgresProvider.createRelease({
      game_id: testGame.id,
      version_name: 'v1.2.0-missing',
      version_code: 120,
      release_date: '2026-11-01',
      release_notes: 'Release with missing file',
      apk_filename: 'ghost_file_not_in_storage.apk',
      original_filename: 'ghost.apk',
      apk_file_size: 1000,
      is_published: true,
    } as any);

    // --- TEST 1: Missing Release (HTTP 404) ---
    await run('Lookup', 'Non-existent release ID returns HTTP 404', async () => {
      const res = await fetch(`${baseUrl}/api/releases/non_existent_release_id/download`);
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('not found') === true, 'Error indicates not found');
    });

    // --- TEST 2: Unpublished Release (HTTP 403) & Counter Unchanged ---
    await run('AccessControl', 'Unpublished release returns HTTP 403 without incrementing counter', async () => {
      const res = await fetch(`${baseUrl}/api/releases/${unpublishedRel.id}/download`);
      assert(res.status === 403, `Expected 403, got ${res.status}`);
      const relCheck = await postgresProvider.getReleaseById(unpublishedRel.id);
      assert(parseInt(String(relCheck?.download_count || '0'), 10) === 0, 'Download counter remained 0');
    });

    // --- TEST 3: Published Release with Missing Storage File (HTTP 404) & Counter Unchanged ---
    await run('MissingAsset', 'Missing storage APK returns HTTP 404 without incrementing counter', async () => {
      const res = await fetch(`${baseUrl}/api/releases/${missingApkRel.id}/download`);
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      const relCheck = await postgresProvider.getReleaseById(missingApkRel.id);
      assert(parseInt(String(relCheck?.download_count || '0'), 10) === 0, 'Download counter remained 0');
    });

    // --- TEST 4: Successful Private APK Streaming (HTTP 200) ---
    await run('Streaming', 'Streams APK byte-for-byte through Express without public redirect', async () => {
      const res = await fetch(`${baseUrl}/api/releases/${publishedRel.id}/download`, {
        redirect: 'manual', // Do not follow redirects: ensure it is 200 direct stream
      });
      assert(res.status === 200, `Expected HTTP 200, got ${res.status}`);
      assert(res.headers.get('content-type') === 'application/vnd.android.package-archive', 'Correct APK content-type');
      assert(Number(res.headers.get('content-length')) === sampleApkBuffer.length, 'Content-Length matches buffer');
      assert(res.headers.get('cache-control')?.includes('no-store') === true, 'Cache-Control is private/no-store');

      const arrayBuf = await res.arrayBuffer();
      const downloadedBuf = Buffer.from(arrayBuf);
      assert(downloadedBuf.equals(sampleApkBuffer), 'Downloaded byte buffer is byte-for-byte identical to source APK');
    });

    // --- TEST 5: RFC 6266 / RFC 5987 Content-Disposition Headers ---
    await run('Headers', 'Content-Disposition includes ASCII fallback and UTF-8 encoded filename', async () => {
      const res = await fetch(`${baseUrl}/api/releases/${publishedRel.id}/download`);
      const cd = res.headers.get('content-disposition') || '';
      assert(cd.startsWith('attachment;'), 'Attachment disposition specified');
      assert(cd.includes('filename="'), 'ASCII fallback filename present');
      assert(cd.includes("filename*=UTF-8''"), 'RFC 5987 UTF-8 encoded filename present');
    });

    // --- TEST 6: Download Counter Incremented on Stream Init ---
    await run('Counter', 'Download counter advances to 2 after successful stream initialization', async () => {
      const rel = await postgresProvider.getReleaseById(publishedRel.id);
      const count = parseInt(String(rel?.download_count || '0'), 10);
      assert(count === 2, `Expected count 2 (from tests 4 and 5), got ${count}`);
    });

    // --- TEST 7: Storage Failure Before Stream Begins Does NOT Increment Counter ---
    await run('Counter', 'Storage retrieval failure returns HTTP 500 without incrementing counter', async () => {
      const countBefore = parseInt(String((await postgresProvider.getReleaseById(publishedRel.id))?.download_count || '0'), 10);
      mockStorage.simulateFailure('downloadPrivate', new Error('Simulated S3 Storage Timeout'));

      const res = await fetch(`${baseUrl}/api/releases/${publishedRel.id}/download`);
      assert(res.status === 500, `Expected HTTP 500 on storage failure, got ${res.status}`);

      mockStorage.clearSimulatedFailure('downloadPrivate');
      const countAfter = parseInt(String((await postgresProvider.getReleaseById(publishedRel.id))?.download_count || '0'), 10);
      assert(countAfter === countBefore, `Download counter must not increment on storage failure (before: ${countBefore}, after: ${countAfter})`);
    });

    // --- TEST 8: High Concurrency Download Counter Correctness ---
    await run('Concurrency', '10 concurrent parallel download requests increment counter by exactly 10', async () => {
      const countBefore = parseInt(String((await postgresProvider.getReleaseById(publishedRel.id))?.download_count || '0'), 10);
      const CONCURRENCY = 10;

      const workers = Array.from({ length: CONCURRENCY }, () =>
        fetch(`${baseUrl}/api/releases/${publishedRel.id}/download`).then(r => r.arrayBuffer())
      );

      const results = await Promise.all(workers);
      assert(results.length === CONCURRENCY, `All ${CONCURRENCY} parallel requests completed`);

      const countAfter = parseInt(String((await postgresProvider.getReleaseById(publishedRel.id))?.download_count || '0'), 10);
      assert(countAfter === countBefore + CONCURRENCY, `Counter advanced by exactly ${CONCURRENCY} (expected: ${countBefore + CONCURRENCY}, actual: ${countAfter})`);
    });

    // Clean up test records in Docker test DB
    await postgresProvider.deleteGame(testGame.id).catch(() => {});

  } finally {
    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`APK STREAMING SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in APK Streaming Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_apk_streaming.ts')) {
  runApkStreamingTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN APK STREAMING SUITE]', err);
      process.exit(1);
    });
}
