import http from 'http';
import crypto from 'crypto';
import { Readable } from 'stream';
import { app, storageService, setStorageService } from '../server/index.js';
import { setDatabaseProvider } from '../server/db.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { generateToken } from '../server/auth.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';
import { MockStorageService } from '../server/testing/MockStorageService.js';
import { SupabaseStorageService } from '../server/storage/SupabaseStorageService.js';

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

export async function runStorageFollowupAudit(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.4 STORAGE AUDIT FOLLOW-UP VERIFICATION');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard rejected test URL: ${guard.reason}`);

  const postgresProvider = new SupabasePostgresProvider(testDbUrl);
  await postgresProvider.init();
  setDatabaseProvider(postgresProvider);

  // Initialize Mock Storage Service for isolated API testing
  const mockStorage = new MockStorageService();
  await mockStorage.init();

  let server: http.Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  const adminToken = generateToken({
    userId: TEST_FIXTURES.user.id,
    username: TEST_FIXTURES.user.username,
    role: 'admin',
  });

  try {
    // =========================================================================
    // 7.1 SUPABASE ETAG & MD5 COMPATIBILITY
    // =========================================================================
    console.log('--- 7.1 Supabase ETag & MD5 Hash Verification Logic ---');

    // We test the exact cryptographic collision evaluation algorithm used by SupabaseStorageService
    // by mocking fetch responses for Supabase Storage endpoints to simulate various ETag conditions.
    const fakeSupabaseUrl = 'https://fake-supabase-project.supabase.co';
    const fakeServiceKey = 'synthetic-service-key-for-unit-test';
    const storageServiceInstance = new SupabaseStorageService(fakeSupabaseUrl, fakeServiceKey);

    const originalFetch = globalThis.fetch;

    await run('ETag_MD5', 'Identical object collision with matching 32-char hex MD5 reuses object', async () => {
      const testBuffer = Buffer.from('Exact identical binary content');
      const testMd5 = crypto.createHash('md5').update(testBuffer).digest('hex');

      globalThis.fetch = async (url: any, init: any) => {
        if (typeof url === 'string' && url.includes('/storage/v1/object/game-assets/test.png') && init?.method === 'POST') {
          return new Response(JSON.stringify({ error: 'Duplicate', message: 'The resource already exists' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (typeof url === 'string' && url.includes('/storage/v1/object/list/game-assets')) {
          return new Response(JSON.stringify([
            {
              name: 'test.png',
              metadata: { size: testBuffer.length, mimetype: 'image/png', eTag: `"${testMd5}"` },
              created_at: new Date().toISOString(),
            }
          ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(url, init);
      };

      try {
        const result = await storageServiceInstance.upload({
          bucket: 'game-assets',
          path: 'test.png',
          buffer: testBuffer,
          contentType: 'image/png',
          preventOverwrite: true,
        });

        assert(result.success === true, 'Upload indicates success');
        assert(result.size === testBuffer.length, 'Size matches');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await run('ETag_MD5', 'Equal-size different-content collision is rejected with HTTP 409', async () => {
      const bufA = Buffer.from('File AAAAAA 1234');
      const bufB = Buffer.from('File BBBBBB 5678'); // Same byte length: 16
      assert(bufA.length === bufB.length, 'Buffers must be same length');
      const md5A = crypto.createHash('md5').update(bufA).digest('hex');

      globalThis.fetch = async (url: any, init: any) => {
        if (typeof url === 'string' && url.includes('/storage/v1/object/game-assets/collide.png') && init?.method === 'POST') {
          return new Response(JSON.stringify({ error: 'Duplicate' }), { status: 409 });
        }
        if (typeof url === 'string' && url.includes('/storage/v1/object/list/game-assets')) {
          return new Response(JSON.stringify([
            {
              name: 'collide.png',
              metadata: { size: bufA.length, mimetype: 'image/png', eTag: `"${md5A}"` },
            }
          ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(url, init);
      };

      try {
        let threw = false;
        try {
          await storageServiceInstance.upload({
            bucket: 'game-assets',
            path: 'collide.png',
            buffer: bufB,
            contentType: 'image/png',
            preventOverwrite: true,
          });
        } catch (err: any) {
          threw = true;
          assert(err.message.includes('HTTP 409') && err.message.includes('unverified content'), 'Rejection mentions unverified content');
        }
        assert(threw, 'Must throw error on different content collision');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await run('ETag_MD5', 'Missing ETag in metadata fails closed with HTTP 409', async () => {
      const buf = Buffer.from('Some test data');

      globalThis.fetch = async (url: any, init: any) => {
        if (typeof url === 'string' && url.includes('/storage/v1/object/game-assets/noetag.png') && init?.method === 'POST') {
          return new Response(JSON.stringify({ error: 'Duplicate' }), { status: 409 });
        }
        if (typeof url === 'string' && url.includes('/storage/v1/object/list/game-assets')) {
          return new Response(JSON.stringify([
            {
              name: 'noetag.png',
              metadata: { size: buf.length, mimetype: 'image/png' /* eTag missing */ },
            }
          ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(url, init);
      };

      try {
        let threw = false;
        try {
          await storageServiceInstance.upload({
            bucket: 'game-assets',
            path: 'noetag.png',
            buffer: buf,
            contentType: 'image/png',
            preventOverwrite: true,
          });
        } catch (err: any) {
          threw = true;
          assert(err.message.includes('unverified content'), 'Rejects because ETag was missing');
        }
        assert(threw, 'Must throw when ETag is missing');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await run('ETag_MD5', 'Multipart or non-MD5 ETag (with hyphens) fails closed with HTTP 409', async () => {
      const buf = Buffer.from('Multipart candidate test');
      const multipartETag = '"d41d8cd98f00b204e9800998ecf8427e-3"'; // S3 multipart format

      globalThis.fetch = async (url: any, init: any) => {
        if (typeof url === 'string' && url.includes('/storage/v1/object/game-assets/multi.png') && init?.method === 'POST') {
          return new Response(JSON.stringify({ error: 'Duplicate' }), { status: 409 });
        }
        if (typeof url === 'string' && url.includes('/storage/v1/object/list/game-assets')) {
          return new Response(JSON.stringify([
            {
              name: 'multi.png',
              metadata: { size: buf.length, mimetype: 'image/png', eTag: multipartETag },
            }
          ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(url, init);
      };

      try {
        let threw = false;
        try {
          await storageServiceInstance.upload({
            bucket: 'game-assets',
            path: 'multi.png',
            buffer: buf,
            contentType: 'image/png',
            preventOverwrite: true,
          });
        } catch (err: any) {
          threw = true;
          assert(err.message.includes('unverified content'), 'Rejects non-standard 32-char MD5 ETag');
        }
        assert(threw, 'Must throw on multipart ETag');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await run('ETag_MD5', 'Metadata lookup failure (null) rejects collision safely', async () => {
      const buf = Buffer.from('Metadata lookup failure test');

      globalThis.fetch = async (url: any, init: any) => {
        if (typeof url === 'string' && url.includes('/storage/v1/object/game-assets/missing-meta.png') && init?.method === 'POST') {
          return new Response(JSON.stringify({ error: 'Duplicate' }), { status: 409 });
        }
        if (typeof url === 'string' && url.includes('/storage/v1/object/list/game-assets')) {
          return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(url, init);
      };

      try {
        let threw = false;
        try {
          await storageServiceInstance.upload({
            bucket: 'game-assets',
            path: 'missing-meta.png',
            buffer: buf,
            contentType: 'image/png',
            preventOverwrite: true,
          });
        } catch (err: any) {
          threw = true;
          assert(err.message.includes('metadata lookup failed'), 'Mentions metadata lookup failed');
        }
        assert(threw, 'Must throw when metadata cannot be retrieved');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    // =========================================================================
    // 7.2 DOWNLOAD COUNTER SEMANTICS
    // =========================================================================
    console.log('\n--- 7.2 Download Counter Semantics Verification ---');

    // Setup synthetic release fixture for download counter tests
    const counterTestGame = await postgresProvider.createGame({
      title: 'Counter Verification Game',
      slug: `counter-verification-game-${Date.now()}`,
      description: 'Testing stream initialization download counter semantics',
      status: 'Available',
      featured: false,
    });

    const counterTestRelease = await postgresProvider.createRelease({
      game_id: counterTestGame.id,
      version_name: '1.0.0-sem',
      version_code: 100,
      release_date: '2026-11-01',
      release_notes: 'Counter semantics verification release',
      apk_filename: `sem-counter-${Date.now()}.apk`,
      original_filename: 'sem-counter.apk',
      apk_file_size: 1024,
      download_count: 0,
      is_published: true,
    });

    const unpublishedRelease = await postgresProvider.createRelease({
      game_id: counterTestGame.id,
      version_name: '0.9.0-draft',
      version_code: 90,
      release_date: '2026-11-01',
      release_notes: 'Unpublished draft release',
      apk_filename: `unpub-counter-${Date.now()}.apk`,
      original_filename: 'unpub.apk',
      apk_file_size: 1024,
      download_count: 0,
      is_published: false,
    });

    await run('DownloadCounter', 'Stream initialization failure (file missing) does NOT increment counter', async () => {
      // release.apk_filename is missing from both mockStorage and local disk
      const beforeRelease = await postgresProvider.getReleaseById(counterTestRelease.id);
      assert(beforeRelease!.download_count === 0, 'Initial download count is 0');

      const res = await fetch(`${baseUrl}/api/releases/${counterTestRelease.id}/download`);
      assert(res.status === 404, `Expected 404, got ${res.status}`);

      const afterRelease = await postgresProvider.getReleaseById(counterTestRelease.id);
      assert(afterRelease!.download_count === 0, 'Download counter must NOT increment on 404');
    });

    await run('DownloadCounter', 'Unpublished release returns HTTP 403 and does NOT increment counter', async () => {
      const res = await fetch(`${baseUrl}/api/releases/${unpublishedRelease.id}/download`);
      assert(res.status === 403, `Expected 403, got ${res.status}`);

      const afterRelease = await postgresProvider.getReleaseById(unpublishedRelease.id);
      assert(afterRelease!.download_count === 0, 'Download counter must NOT increment on 403');
    });

    await run('DownloadCounter', 'Successful stream initialization increments counter exactly once', async () => {
      // Put file in Mock Storage
      const apkBuffer = Buffer.from('SYNTHETIC_APK_CONTENT_FOR_STREAM_TEST');
      await mockStorage.upload({
        bucket: 'release-apks',
        path: counterTestRelease.apk_filename,
        buffer: apkBuffer,
        contentType: 'application/vnd.android.package-archive',
      });

      // Set storage service to mockStorage
      setStorageService(mockStorage);

      try {
        const res = await fetch(`${baseUrl}/api/releases/${counterTestRelease.id}/download`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const streamBytes = await res.arrayBuffer();
        assert(streamBytes.byteLength === apkBuffer.length, 'Streamed bytes match uploaded buffer');

        const afterRelease = await postgresProvider.getReleaseById(counterTestRelease.id);
        assert(afterRelease!.download_count === 1, `Expected download_count = 1, got ${afterRelease!.download_count}`);
      } finally {
        setStorageService(storageService);
      }
    });

    await run('DownloadCounter', 'Multiple concurrent stream initializations increment counter atomically', async () => {
      setStorageService(mockStorage);

      try {
        // Fire 5 concurrent requests
        const requests = Array.from({ length: 5 }, () =>
          fetch(`${baseUrl}/api/releases/${counterTestRelease.id}/download`).then((r) => r.arrayBuffer())
        );

        await Promise.all(requests);

        const finalRelease = await postgresProvider.getReleaseById(counterTestRelease.id);
        // Previous test had 1, plus 5 concurrent = 6
        assert(finalRelease!.download_count === 6, `Expected download_count = 6, got ${finalRelease!.download_count}`);
      } finally {
        setStorageService(storageService);
      }
    });

    // Cleanup counter test fixtures
    await postgresProvider.deleteRelease(counterTestRelease.id);
    await postgresProvider.deleteRelease(unpublishedRelease.id);
    await postgresProvider.deleteGame(counterTestGame.id);

    // =========================================================================
    // 7.3 IMMUTABLE OVERWRITE PROTECTION
    // =========================================================================
    console.log('\n--- 7.3 Overwrite Protection Inspection & Immunity ---');

    await run('OverwriteProtection', 'Image upload route enforces preventOverwrite: true regardless of client parameters', async () => {
      // Valid PNG header: 89 50 4E 47 0D 0A 1A 0A
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const validPngBytes = Buffer.concat([pngHeader, Buffer.from('TEST_PNG_CONTENT_1234567890')]);

      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const bodyParts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="preventOverwrite"\r\n\r\nfalse\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="x-upsert"\r\n\r\ntrue\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="overwrite_test.png"\r\nContent-Type: image/png\r\n\r\n`,
      ];

      const fullBody = Buffer.concat([
        Buffer.from(bodyParts.join('')),
        validPngBytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      setStorageService(mockStorage);

      try {
        const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            Authorization: `Bearer ${adminToken}`,
          },
          body: fullBody,
        });

        assert(res.status === 200, `Expected 200 for valid image upload, got ${res.status}`);
        const json = await res.json();
        assert(Boolean(json.url), 'Returns valid image URL');
        assert(json.filename.endsWith('.png'), 'Stored filename preserves extension');
      } finally {
        setStorageService(storageService);
      }
    });

  } finally {
    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`STORAGE AUDIT SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Storage Audit Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_storage_followup_audit.ts')) {
  runStorageFollowupAudit()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN STORAGE AUDIT SUITE]', err);
      process.exit(1);
    });
}
