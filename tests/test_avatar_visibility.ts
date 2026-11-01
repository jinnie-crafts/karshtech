import http from 'http';
import fs from 'fs';
import path from 'path';
import { app } from '../server/index.js';
import { ensureStorageDirectories, IMAGES_DIR, DEFAULT_REPO_UPLOADS_DIR, getFileSha256, syncFileWithHash, BUNDLED_SYSTEM_ASSETS } from '../server/paths.js';
import { setDatabaseProvider } from '../server/db.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';
import { setSessionCookie } from '../server/auth.js';

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

export async function runAvatarVisibilityTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — AVATAR VISIBILITY & CACHING INTEGRITY TEST SUITE');
  console.log('================================================================\n');

  const testDbUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard rejected test URL: ${guard.reason}`);

  const postgresProvider = new SupabasePostgresProvider(testDbUrl);
  await postgresProvider.init();
  setDatabaseProvider(postgresProvider);

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
    // --- 1. Disk & Repository Avatar Invariants ---
    console.log('--- 1. Disk & Repository Avatar Invariants ---');

    const AVATARS = [
      { name: 'avatar_harsh.png', minBytes: 500000 },  // Updated high-res ~1.2 MB
      { name: 'avatar_aditya.png', minBytes: 500000 }, // Updated high-res ~1.0 MB
      { name: 'avatar_komal.png', minBytes: 150000 },  // High-res ~195 KB
    ];

    await run('FILESYSTEM', 'Bundled repository avatars exist in server/uploads/images with expected high-res sizes', async () => {
      const repoImages = path.join(DEFAULT_REPO_UPLOADS_DIR, 'images');
      for (const av of AVATARS) {
        const fullPath = path.join(repoImages, av.name);
        assert(fs.existsSync(fullPath), `Avatar "${av.name}" missing from ${repoImages}`);
        const size = fs.statSync(fullPath).size;
        assert(size >= av.minBytes, `Avatar "${av.name}" is too small (${size} bytes, expected >= ${av.minBytes})`);
      }
    });

    // --- 2. Storage Directory Synchronization ---
    console.log('\n--- 2. Storage Directory Synchronization ---');

    await run('SYNC', 'ensureStorageDirectories synchronizes newer/modified repository assets to target images dir', async () => {
      // Simulate persistent storage by calling ensureStorageDirectories
      ensureStorageDirectories();
      for (const av of AVATARS) {
        const dest = path.join(IMAGES_DIR, av.name);
        assert(fs.existsSync(dest), `Synced avatar "${av.name}" missing in IMAGES_DIR`);
        const size = fs.statSync(dest).size;
        assert(size >= av.minBytes, `Synced avatar "${av.name}" has wrong size (${size} bytes)`);
      }
    });

    // --- 3. HTTP Cache-Control & Serving Headers ---
    console.log('\n--- 3. HTTP Cache-Control & Serving Headers ---');

    await run('HTTP_CACHE', 'Static serving of avatar_harsh.png sets max-age=300 and must-revalidate', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/avatar_harsh.png`);
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const cc = res.headers.get('cache-control') || '';
      assert(cc.includes('max-age=300'), `Expected max-age=300, got "${cc}"`);
      assert(cc.includes('must-revalidate'), `Expected must-revalidate, got "${cc}"`);
      const length = Number(res.headers.get('content-length'));
      assert(length >= 500000, `Expected high-res Harsh avatar (>500KB), got ${length} bytes`);
    });

    await run('HTTP_CACHE', 'Static serving of avatar_aditya.png sets max-age=300 and serves high-res file', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/avatar_aditya.png`);
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const cc = res.headers.get('cache-control') || '';
      assert(cc.includes('max-age=300'), `Expected max-age=300, got "${cc}"`);
      assert(cc.includes('must-revalidate'), `Expected must-revalidate, got "${cc}"`);
      const length = Number(res.headers.get('content-length'));
      assert(length >= 500000, `Expected high-res Aditya avatar (>500KB), got ${length} bytes`);
    });

    await run('HTTP_CACHE', 'Static serving of avatar_komal.png sets max-age=300 and serves high-res file', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/avatar_komal.png`);
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const cc = res.headers.get('cache-control') || '';
      assert(cc.includes('max-age=300'), `Expected max-age=300, got "${cc}"`);
      assert(cc.includes('must-revalidate'), `Expected must-revalidate, got "${cc}"`);
      const length = Number(res.headers.get('content-length'));
      assert(length >= 150000, `Expected Komal avatar (>150KB), got ${length} bytes`);
    });

    // --- 4. Frontend StudioPage URL Cache-Busting ---
    console.log('\n--- 4. Frontend StudioPage URL Cache-Busting ---');

    await run('FRONTEND', 'StudioPage source contains cache-busting version parameter (?v=...) on all team avatars', async () => {
      const studioSource = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/StudioPage.tsx'), 'utf8');
      assert(studioSource.includes("avatar: '/uploads/images/avatar_harsh.png?v="), 'Harsh avatar has ?v= param');
      assert(studioSource.includes("avatar: '/uploads/images/avatar_komal.png?v="), 'Komal avatar has ?v= param');
      assert(studioSource.includes("avatar: '/uploads/images/avatar_aditya.png?v="), 'Aditya avatar has ?v= param');
    });

    // --- 5. Path Traversal & Security on Avatar Endpoint ---
    console.log('\n--- 5. Security & Path Traversal Guards ---');

    await run('SECURITY', '/uploads/images/:filename rejects directory traversal sequences', async () => {
      const res1 = await fetch(`${baseUrl}/uploads/images/..%2f..%2fpackage.json`);
      assert(res1.status === 400 || res1.status === 404, `Expected 400 or 404, got ${res1.status}`);

      const res2 = await fetch(`${baseUrl}/uploads/images/%00avatar.png`);
      assert(res2.status === 400 || res2.status === 404, `Expected 400 or 404, got ${res2.status}`);
    });

    // --- 6. SHA-256 Cryptographic Synchronization Invariants ---
    console.log('\n--- 6. SHA-256 Cryptographic Synchronization Invariants ---');

    await run('SHA256_SYNC', 'getFileSha256 calculates authoritative hex digest and returns null for non-existent files', async () => {
      const tempFile = path.resolve(process.cwd(), 'temp_sha256_probe.txt');
      try {
        fs.writeFileSync(tempFile, 'KarshTechAvatarIntegrityVerification2026', 'utf8');
        const hash = getFileSha256(tempFile);
        assert(hash !== null && typeof hash === 'string', 'Expected valid hash string');
        assert(hash.length === 64, `Expected 64-character SHA-256 hex string, got ${hash.length}`);
        // Authoritative SHA-256 of 'KarshTechAvatarIntegrityVerification2026'
        const expected = '9ac3519a8dc62c7bf641f2563beb86d24b874c261a94b7ad1985f2134b15d875';
        assert(hash.toLowerCase() === expected.toLowerCase(), `Hash mismatch: expected ${expected}, got ${hash}`);

        const nonExistent = getFileSha256(path.resolve(process.cwd(), 'non_existent_file_xyz_123.tmp'));
        assert(nonExistent === null, 'Expected null for non-existent file');
      } finally {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      }
    });

    await run('SHA256_SYNC', 'syncFileWithHash copies when dest missing, updates when content differs, and skips identical content', async () => {
      const srcFile = path.resolve(process.cwd(), 'temp_src_avatar.txt');
      const destFile = path.resolve(process.cwd(), 'temp_dest_avatar.txt');

      try {
        // Step 1: Destination does not exist -> copy should occur and return true
        fs.writeFileSync(srcFile, 'Version 1 Content: Alpha Avatar', 'utf8');
        if (fs.existsSync(destFile)) fs.unlinkSync(destFile);

        const res1 = syncFileWithHash(srcFile, destFile);
        assert(res1 === true, 'Expected true when copying to non-existent destination');
        assert(fs.existsSync(destFile), 'Destination file should now exist');
        assert(fs.readFileSync(destFile, 'utf8') === 'Version 1 Content: Alpha Avatar', 'Content should match source');

        // Step 2: Content is identical -> sync should be skipped, returning false, dest mtime untouched
        const mtimeBefore = fs.statSync(destFile).mtimeMs;
        // Wait 10ms to ensure a timestamp change would register if overwritten
        await new Promise((r) => setTimeout(r, 15));
        const res2 = syncFileWithHash(srcFile, destFile);
        assert(res2 === false, 'Expected false when source and destination hashes match');
        const mtimeAfter = fs.statSync(destFile).mtimeMs;
        assert(mtimeBefore === mtimeAfter, 'Destination file mtime should remain unchanged when skipped');

        // Step 3: Source content changes -> sync should detect difference and overwrite dest
        fs.writeFileSync(srcFile, 'Version 2 Content: Beta Avatar Updated', 'utf8');
        const res3 = syncFileWithHash(srcFile, destFile);
        assert(res3 === true, 'Expected true when hashes differ');
        assert(fs.readFileSync(destFile, 'utf8') === 'Version 2 Content: Beta Avatar Updated', 'Destination should have new content');

        // Step 4: Source does not exist -> destination preserved untouched, returns false
        fs.unlinkSync(srcFile);
        const res4 = syncFileWithHash(srcFile, destFile);
        assert(res4 === false, 'Expected false when source file does not exist');
        assert(fs.existsSync(destFile), 'Destination file should be preserved untouched');
        assert(fs.readFileSync(destFile, 'utf8') === 'Version 2 Content: Beta Avatar Updated', 'Content preserved');
      } finally {
        if (fs.existsSync(srcFile)) fs.unlinkSync(srcFile);
        if (fs.existsSync(destFile)) fs.unlinkSync(destFile);
      }
    });

    await run('SHA256_SYNC', 'BUNDLED_SYSTEM_ASSETS contains canonical avatars and protects user assets from overwrites', async () => {
      assert(BUNDLED_SYSTEM_ASSETS.has('avatar_harsh.png'), 'avatar_harsh.png is in BUNDLED_SYSTEM_ASSETS');
      assert(BUNDLED_SYSTEM_ASSETS.has('avatar_aditya.png'), 'avatar_aditya.png is in BUNDLED_SYSTEM_ASSETS');
      assert(BUNDLED_SYSTEM_ASSETS.has('avatar_komal.png'), 'avatar_komal.png is in BUNDLED_SYSTEM_ASSETS');
      assert(BUNDLED_SYSTEM_ASSETS.has('default_cover.jpg'), 'default_cover.jpg is in BUNDLED_SYSTEM_ASSETS');
      assert(!BUNDLED_SYSTEM_ASSETS.has('user_uploaded_image.png'), 'User uploads not in bundled system assets');
    });

  } finally {
    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.filter((r) => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`AVATAR VISIBILITY SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Avatar Visibility Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_avatar_visibility.ts')) {
  runAvatarVisibilityTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN AVATAR VISIBILITY SUITE]', err);
      process.exit(1);
    });
}
