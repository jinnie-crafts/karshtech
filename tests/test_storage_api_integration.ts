import http from 'http';
import { app } from '../server/index.js';
import { setDatabaseProvider } from '../server/db.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { setStorageService } from '../server/storage/storageFactory.js';
import { MockStorageService } from '../server/testing/MockStorageService.js';
import { generateToken } from '../server/auth.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';
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

export async function runStorageApiIntegrationTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.3 EXPRESS STORAGE API INTEGRATION TESTS');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  // Validate test DB
  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard rejected test URL: ${guard.reason}`);

  const postgresProvider = new SupabasePostgresProvider(testDbUrl);
  await postgresProvider.init();
  setDatabaseProvider(postgresProvider);

  const mockStorage = new MockStorageService();
  await mockStorage.init();
  setStorageService(mockStorage);

  let server: http.Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  // Setup Admin & Non-Admin Tokens
  const adminToken = generateToken({
    userId: TEST_FIXTURES.user.id,
    username: TEST_FIXTURES.user.username,
    role: 'admin',
  });

  const editorToken = generateToken({
    userId: 'test_user_editor',
    username: 'test_api_editor',
    role: 'editor',
  });

  // Synthetic valid buffers
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
  const validApkBuffer = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x08, 0x00]),
    Buffer.from('AndroidManifest.xml'),
    Buffer.from('SYNTHETIC_API_APK_PAYLOAD'),
    Buffer.alloc(256),
  ]);

  try {
    // ==========================================
    // 1. POST /api/admin/upload/image Tests
    // ==========================================
    console.log('--- 1. POST /api/admin/upload/image ---');

    await run('ImageAPI', 'Unauthorized request without token returns HTTP 401', async () => {
      const form = new FormData();
      form.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'test.png');
      const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
        method: 'POST',
        body: form,
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await run('ImageAPI', 'Non-admin request returns HTTP 403 Forbidden', async () => {
      const form = new FormData();
      form.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'test.png');
      const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: form,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await run('ImageAPI', 'Admin upload with valid PNG returns HTTP 200 with metadata', async () => {
      const form = new FormData();
      form.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'screenshot.png');
      form.append('bucket', 'game-assets');

      const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Response contains success: true');
      assert(typeof body.filename === 'string' && body.filename.endsWith('.png'), 'Filename returned with .png');
      assert(typeof body.url === 'string' && body.url.includes('game-assets/'), 'CDN URL returned');
      assert(body.size === validPngBuffer.length, 'Size matches upload');
    });

    await run('ImageAPI', 'Upload routes to product-assets bucket when specified in body', async () => {
      const form = new FormData();
      form.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'product_preview.png');
      form.append('bucket', 'product-assets');

      const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.url.includes('product-assets/'), 'URL routes to product-assets');
    });

    await run('ImageAPI', 'Missing image multipart field returns HTTP 400', async () => {
      const form = new FormData();
      form.append('wrong_field', 'some text');

      const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });

      assert(res.status === 400, `Expected 400 for missing file field, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('No image file') === true, 'Error indicates missing file');
    });

    await run('ImageAPI', 'Invalid file disguised as image (text file) returns HTTP 400', async () => {
      const fakeImage = Buffer.from('Just plain text content');
      const form = new FormData();
      form.append('image', new Blob([fakeImage], { type: 'image/png' }), 'fake.png');

      const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });

      assert(res.status === 400, `Expected 400 for fake image, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('magic bytes') === true, 'Identifies magic bytes check failure');
    });

    await run('ImageAPI', 'Disallowed file extension (.sh) rejected with HTTP 400 by Multer', async () => {
      const form = new FormData();
      form.append('image', new Blob([validPngBuffer], { type: 'text/plain' }), 'malicious.sh');

      const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });

      assert(res.status === 400, `Expected 400 for disallowed extension, got ${res.status}`);
    });

    await run('ImageAPI', 'Storage failure returns HTTP 500 without leaking stack trace', async () => {
      mockStorage.simulateFailure('upload', new Error('Supabase Storage 500 Internal Error'));

      const form = new FormData();
      form.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'error_test.png');

      const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });

      assert(res.status === 500, `Expected HTTP 500 on storage error, got ${res.status}`);
      const body = await res.json();
      assert(!body.stack, 'Does not return stack trace');
      assert(!JSON.stringify(body).includes('C:\\'), 'Does not leak local paths');

      mockStorage.clearSimulatedFailure('upload');
    });

    // ==========================================
    // 2. POST /api/admin/upload/apk Tests
    // ==========================================
    console.log('\n--- 2. POST /api/admin/upload/apk ---');

    await run('ApkAPI', 'Unauthorized request without token returns HTTP 401', async () => {
      const form = new FormData();
      form.append('apk', new Blob([validApkBuffer], { type: 'application/vnd.android.package-archive' }), 'game.apk');
      const res = await fetch(`${baseUrl}/api/admin/upload/apk`, {
        method: 'POST',
        body: form,
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await run('ApkAPI', 'Non-admin request returns HTTP 403 Forbidden', async () => {
      const form = new FormData();
      form.append('apk', new Blob([validApkBuffer], { type: 'application/vnd.android.package-archive' }), 'game.apk');
      const res = await fetch(`${baseUrl}/api/admin/upload/apk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${editorToken}` },
        body: form,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await run('ApkAPI', 'Admin upload with valid synthetic APK returns HTTP 200 with stored metadata', async () => {
      const form = new FormData();
      form.append(
        'apk',
        new Blob([validApkBuffer], { type: 'application/vnd.android.package-archive' }),
        'Arrow Puzzle (v1.2.0) [Final].apk'
      );

      const res = await fetch(`${baseUrl}/api/admin/upload/apk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Response contains success: true');
      assert(typeof body.filename === 'string' && body.filename.endsWith('.apk'), 'Stored filename ends with .apk');
      assert(body.original_filename === 'Arrow Puzzle (v1.2.0) [Final].apk', 'Original filename sanitized and preserved');
      assert(body.size === validApkBuffer.length, 'Size matches buffer length');
    });

    await run('ApkAPI', 'Missing apk multipart field returns HTTP 400', async () => {
      const form = new FormData();
      form.append('wrong_field', 'data');

      const res = await fetch(`${baseUrl}/api/admin/upload/apk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });

      assert(res.status === 400, `Expected 400 for missing APK field, got ${res.status}`);
    });

    await run('ApkAPI', 'Non-ZIP file claiming .apk rejected with HTTP 400', async () => {
      const fakeApk = Buffer.from('Plain text fake apk file');
      const form = new FormData();
      form.append('apk', new Blob([fakeApk], { type: 'application/vnd.android.package-archive' }), 'corrupt.apk');

      const res = await fetch(`${baseUrl}/api/admin/upload/apk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });

      assert(res.status === 400, `Expected 400 for non-ZIP APK, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('PK\\x03\\x04') === true, 'Identifies missing ZIP header');
    });

    await run('ApkAPI', 'ZIP lacking AndroidManifest.xml rejected with HTTP 400', async () => {
      const zipNoManifest = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
        Buffer.from('readme.txt'),
        Buffer.alloc(64),
      ]);
      const form = new FormData();
      form.append('apk', new Blob([zipNoManifest], { type: 'application/vnd.android.package-archive' }), 'not_android.apk');

      const res = await fetch(`${baseUrl}/api/admin/upload/apk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });

      assert(res.status === 400, `Expected 400 for missing AndroidManifest, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('AndroidManifest.xml') === true, 'Cites missing manifest entry');
    });

    await run('ApkAPI', 'Storage failure returns HTTP 500 without leaking internal secrets', async () => {
      mockStorage.simulateFailure('upload', new Error('Supabase Storage 502 Bad Gateway'));

      const form = new FormData();
      form.append('apk', new Blob([validApkBuffer], { type: 'application/vnd.android.package-archive' }), 'sample.apk');

      const res = await fetch(`${baseUrl}/api/admin/upload/apk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });

      assert(res.status === 500, `Expected 500 on storage error, got ${res.status}`);
      const body = await res.json();
      assert(!body.stack, 'Does not leak stack trace');
      mockStorage.clearSimulatedFailure('upload');
    });

  } finally {
    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`STORAGE API INTEGRATION SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Storage API Integration Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_storage_api_integration.ts')) {
  runStorageApiIntegrationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN STORAGE API SUITE]', err);
      process.exit(1);
    });
}
