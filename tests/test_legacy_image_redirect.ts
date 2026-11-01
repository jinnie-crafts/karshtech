import http from 'http';
import { app } from '../server/index.js';
import { setStorageService } from '../server/storage/storageFactory.js';
import { MockStorageService } from '../server/testing/MockStorageService.js';

export interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

export async function runLegacyImageRedirectTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.3 LEGACY IMAGE REDIRECT SECURITY TESTS');
  console.log('================================================================\n');

  // Configure mock storage
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

  try {
    // --- 1. Legitimate Basename Requests ---
    await run('LegitimateRedirect', 'Cloud-only image not on disk redirects with HTTP 302 to CDN public URL', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/cloud_only_screenshot_99.jpg`, {
        redirect: 'manual',
      });
      assert(res.status === 302, `Expected 302 redirect, got ${res.status}`);
      const location = res.headers.get('location') || '';
      assert(location.includes('game-assets/cloud_only_screenshot_99.jpg'), `Expected CDN location, got "${location}"`);
    });

    await run('LegitimateRedirect', 'Local file present on disk is served directly (HTTP 200)', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/arrow_puzzle_screenshot_1.jpg`, {
        redirect: 'manual',
      });
      assert(res.status === 200, `Expected 200 for local file, got ${res.status}`);
    });

    await run('LegitimateRedirect', 'Filename with spaces redirects safely with URI encoding', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/cloud cover photo.png`, {
        redirect: 'manual',
      });
      assert(res.status === 302, `Expected 302 redirect, got ${res.status}`);
      const location = res.headers.get('location') || '';
      assert(location.includes('cloud%20cover%20photo.png') || location.includes('cloud cover photo.png'), `Redirect location preserved: "${location}"`);
    });

    // --- 2. Path Traversal Attacks ---
    await run('TraversalDefense', 'Rejects raw path traversal attempts (../) with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/..%2f..%2fetc%2fpasswd`, {
        redirect: 'manual',
      });
      assert(res.status === 400, `Expected HTTP 400 for traversal, got ${res.status}`);
      const body = await res.json().catch(() => ({}));
      assert(body.error?.includes('Invalid') || body.error?.includes('unsafe'), 'Safe error message returned');
    });

    await run('TraversalDefense', 'Rejects percent-encoded dot-dot traversal (%2e%2e%2f) with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/%2e%2e%2f%2e%2e%2fsecret.json`, {
        redirect: 'manual',
      });
      assert(res.status === 400, `Expected HTTP 400 for encoded traversal, got ${res.status}`);
    });

    await run('TraversalDefense', 'Rejects backslash traversal (..\\..\\windows) with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/..%5c..%5cwindows%5cwin.ini`, {
        redirect: 'manual',
      });
      assert(res.status === 400, `Expected HTTP 400 for backslash traversal, got ${res.status}`);
    });

    // --- 3. Null-Byte & Special Character Attacks ---
    await run('Sanitization', 'Rejects null-byte injection attempts with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/image.png%00.exe`, {
        redirect: 'manual',
      });
      assert(res.status === 400, `Expected HTTP 400 for null-byte injection, got ${res.status}`);
    });

    await run('Sanitization', 'Never exposes internal filesystem paths or stack traces in errors', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/%2e%2e%2fpackage.json`, {
        redirect: 'manual',
      });
      const text = await res.text();
      assert(!text.includes('C:\\'), 'Does not leak Windows file path');
      assert(!text.includes('/home/'), 'Does not leak Linux home path');
      assert(!text.includes('karsh Techs'), 'Does not leak project directory path');
    });

  } finally {
    server.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`LEGACY REDIRECT SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Legacy Redirect Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_legacy_image_redirect.ts')) {
  runLegacyImageRedirectTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN LEGACY REDIRECT SUITE]', err);
      process.exit(1);
    });
}
