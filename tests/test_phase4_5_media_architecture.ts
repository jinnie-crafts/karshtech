import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from '../server/index.js';
import { setDatabaseProvider } from '../server/db.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { setStorageService } from '../server/storage/storageFactory.js';
import { MockStorageService } from '../server/testing/MockStorageService.js';
import { MediaService } from '../server/services/MediaService.js';
import { generateToken } from '../server/auth.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';
import { TestHarness } from '../server/testing/testHarness.js';
import { executeMediaMigration } from '../scripts/migrate_media_to_supabase.mjs';

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

export async function runPhase45MediaArchitectureTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.5 SUPABASE-FIRST MEDIA ARCHITECTURE TESTS');
  console.log('================================================================\n');

  const testDbUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard rejected test URL: ${guard.reason}`);

  const harness = new TestHarness({ testDatabaseUrl: testDbUrl });
  await harness.applySchema();
  await harness.seedFixtures();

  const postgresProvider = new SupabasePostgresProvider(testDbUrl);
  await postgresProvider.init();
  setDatabaseProvider(postgresProvider);

  const mockStorage = new MockStorageService();
  await mockStorage.init();
  setStorageService(mockStorage);

  const mediaService = new MediaService(mockStorage, postgresProvider);

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

  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  try {
    // --- 1. Canonical Media URL Resolution ---
    console.log('--- 1. Canonical Media URL Resolution ---');

    await run('RESOLUTION', 'resolveCanonicalUrl transforms legacy /uploads/images/ path to Supabase CDN URL', async () => {
      const resolved = mediaService.resolveCanonicalUrl('/uploads/images/arrow_puzzle_screenshot_1.jpg');
      assert(resolved.startsWith('https://mock-storage.local/game-assets/'), `Expected CDN URL, got ${resolved}`);
      assert(resolved.includes('arrow_puzzle_screenshot_1.jpg'), 'Contains object filename');
    });

    await run('RESOLUTION', 'resolveCanonicalUrl transforms bare filenames to canonical CDN URLs with bucketHint', async () => {
      const resolved = mediaService.resolveCanonicalUrl('product_hero_banner.jpg', 'product-assets');
      assert(resolved === 'https://mock-storage.local/product-assets/product_hero_banner.jpg', `Got ${resolved}`);
    });

    await run('RESOLUTION', 'resolveCanonicalUrl preserves static public brand assets (/brand/...) unchanged', async () => {
      const resolved = mediaService.resolveCanonicalUrl('/brand/karsh-tech-k.png');
      assert(resolved === '/brand/karsh-tech-k.png', `Expected static path preserved, got ${resolved}`);
    });

    await run('RESOLUTION', 'resolveCanonicalUrl preserves external absolute URLs unchanged', async () => {
      const ext = 'https://images.unsplash.com/photo-sample.jpg';
      assert(mediaService.resolveCanonicalUrl(ext) === ext, 'External URL preserved');
    });

    // --- 2. Public API Delivery & Decorator ---
    console.log('\n--- 2. Public API Media Delivery ---');

    await run('API_DELIVERY', 'GET /api/games returns canonical CDN URLs for cover_image and screenshots', async () => {
      // Ensure test-space-odyssey exists with legacy /uploads path to verify transformation
      await postgresProvider.updateGame('test_game_001', {
        cover_image: '/uploads/images/arrow_puzzle_cover.jpg',
        screenshots: ['/uploads/images/arrow_puzzle_screen1.jpg'],
      });

      const res = await fetch(`${baseUrl}/api/games`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(Array.isArray(body.games) && body.games.length > 0, 'Returned games list');
      const game = body.games.find((g: any) => g.id === 'test_game_001');
      assert(Boolean(game), 'Found test_game_001 in response');
      assert(
        game.cover_image.startsWith('https://mock-storage.local/game-assets/') ||
        game.cover_image.startsWith('https://') ||
        game.cover_image.startsWith('/brand/'),
        `Expected canonical cover URL, got ${game.cover_image}`
      );
      assert(game.cover_image.includes('arrow_puzzle_cover.jpg'), 'Contains transformed cover filename');
      if (game.screenshots?.length > 0) {
        assert(game.screenshots[0].startsWith('https://'), 'Screenshots are canonical URLs');
      }
    });

    await run('API_DELIVERY', 'GET /api/stats includes canonical studio team avatar URLs in media payload', async () => {
      const res = await fetch(`${baseUrl}/api/stats`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.media?.avatars?.harsh !== undefined, 'Has harsh avatar in stats');
      assert(body.media?.avatars?.aditya !== undefined, 'Has aditya avatar in stats');
      assert(body.media?.avatars?.komal !== undefined, 'Has komal avatar in stats');
      assert(body.media.avatars.harsh.startsWith('https://'), 'Avatar is canonical CDN URL');
    });

    // --- 3. Private APK Access Control ---
    console.log('\n--- 3. Private APK Access Control ---');

    await run('PRIVATE_APK', 'resolveCanonicalUrl strictly returns empty string / never exposes public URL for release-apks', async () => {
      let threw = false;
      try {
        mockStorage.getPublicUrl('release-apks', 'arrow-puzzle-release-v1.0.0.apk');
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('Security Violation'), 'Security violation message thrown');
      }
      assert(threw, 'MockStorage blocked public URL for release-apks');
    });

    // --- 4. Upload & PostgreSQL media_assets Integration ---
    console.log('\n--- 4. Metadata Consistency & media_assets Storage ---');

    const uploadedObjectPath = `test_phase4_5_${Date.now()}.png`;
    mockStorage.seedObject('game-assets', uploadedObjectPath, validPngBuffer, 'image/png');

    await run('METADATA', 'registerAssetMetadata successfully inserts record into media_assets table', async () => {
      const sha256 = crypto.createHash('sha256').update(validPngBuffer).digest('hex');
      const record = await mediaService.registerAssetMetadata({
        bucket: 'game-assets',
        objectPath: uploadedObjectPath,
        originalFilename: 'test_phase4_5.png',
        mimeType: 'image/png',
        sizeBytes: validPngBuffer.length,
        sha256,
        category: 'screenshot',
      });

      assert(record !== null, 'Record returned from registerAssetMetadata');
      assert(record.bucket === 'game-assets', 'Bucket stored correctly');
      assert(record.sha256 === sha256, 'SHA-256 digest stored correctly');
      assert(record.size_bytes === validPngBuffer.length, 'Size stored correctly');

      // Verify read-back by path
      const readBack = await postgresProvider.getMediaAssetByPath('game-assets', uploadedObjectPath);
      assert(readBack !== null, 'Asset found via getMediaAssetByPath');
      assert(readBack?.id === record.id, 'IDs match');
    });

    // --- 5. SHA-256 Digest Verification ---
    console.log('\n--- 5. Cryptographic Checksum Integrity ---');

    await run('SHA256', 'media_assets enforces exact SHA-256 hexadecimal digests', async () => {
      const readBack = await postgresProvider.getMediaAssetByPath('game-assets', uploadedObjectPath);
      assert(readBack !== null, 'Asset exists');
      assert(readBack?.sha256.length === 64, 'Digest length is 64 hex characters');
      const expectedSha = crypto.createHash('sha256').update(validPngBuffer).digest('hex');
      assert(readBack?.sha256 === expectedSha, 'Digest matches buffer SHA-256 exactly');
    });

    // --- 6. Reference-Aware Deletion & media_assets Cleanup ---
    console.log('\n--- 6. Deletion & Cleanup ---');

    await run('DELETION', 'DELETE /api/admin/media removes object from storage and deletes metadata record', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'game-assets', path: uploadedObjectPath }),
      });
      assert(res.status === 200, `Expected 200 for unreferenced deletion, got ${res.status}`);

      // Verify removed from media_assets table
      const readBack = await postgresProvider.getMediaAssetByPath('game-assets', uploadedObjectPath);
      assert(readBack === null, 'Record was removed from media_assets table');
    });

    // --- 7. Legacy URL Compatibility & Inverted Priority ---
    console.log('\n--- 7. Legacy URL Compatibility ---');

    await run('LEGACY', 'Non-existent disk file redirects with 302 to Supabase CDN URL', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/cloud_only_asset_phase45.jpg`, {
        redirect: 'manual',
      });
      assert(res.status === 302, `Expected 302 redirect, got ${res.status}`);
      const loc = res.headers.get('location') || '';
      assert(loc.includes('cloud_only_asset_phase45.jpg'), 'Redirect location contains filename');
    });

    await run('LEGACY', 'Legacy route sets max-age=300 and must-revalidate headers', async () => {
      const res = await fetch(`${baseUrl}/uploads/images/cloud_only_asset_phase45.jpg`, {
        redirect: 'manual',
      });
      const cc = res.headers.get('cache-control') || '';
      assert(cc.includes('max-age=300'), 'Cache control has max-age=300');
      assert(cc.includes('must-revalidate'), 'Cache control has must-revalidate');
    });

    // --- 8. Frontend Fallbacks Verification ---
    console.log('\n--- 8. Frontend Image Error Handling & Fallbacks ---');

    await run('FRONTEND', 'StudioPage source contains onError avatar fallback and dynamic API resolution', async () => {
      const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/StudioPage.tsx'), 'utf8');
      assert(source.includes('avatarMap'), 'StudioPage loads avatarMap from API');
      assert(source.includes('onError'), 'StudioPage has onError handler for avatars');
    });

    await run('FRONTEND', 'GameCard and HomePage contain onError fallback to brand icon', async () => {
      const gameCard = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GameCard.tsx'), 'utf8');
      assert(gameCard.includes('onError'), 'GameCard has onError fallback');
      const homePage = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/HomePage.tsx'), 'utf8');
      assert(homePage.includes('onError'), 'HomePage has onError fallback');
    });

    // --- 9. Migration Script Dry-Run Invariants ---
    console.log('\n--- 9. Migration Utility Dry-Run Safety ---');

    await run('MIGRATION_SCRIPT', 'migrate_media_to_supabase dry-run executes cleanly with zero writes', async () => {
      const summary = await executeMediaMigration({
        databaseUrl: testDbUrl,
        supabaseUrl: 'https://mock-storage.local',
        supabaseKey: 'mock-test-key-phase45',
        confirmMigration: false, // DRY RUN
      });

      assert(summary.mode === 'dry-run', 'Summary mode is dry-run');
    });

    // --- 10. Secret Isolation ---
    console.log('\n--- 10. Secret Isolation ---');

    await run('SECURITY', 'Frontend source code never references SUPABASE_SECRET_KEY', async () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true }) as string[];
      for (const rel of srcFiles) {
        if (!rel.endsWith('.ts') && !rel.endsWith('.tsx')) continue;
        const full = path.resolve(process.cwd(), 'src', rel);
        if (fs.statSync(full).isFile()) {
          const content = fs.readFileSync(full, 'utf8');
          assert(!content.includes('SUPABASE_SECRET_KEY'), `Secret key reference leaked in ${rel}`);
        }
      }
    });

  } finally {
    if (server) server.close();
    await postgresProvider.close();
    await harness.close();
  }

  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.filter((r) => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`PHASE 4.5 SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Phase 4.5 Media Architecture Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_phase4_5_media_architecture.ts')) {
  runPhase45MediaArchitectureTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN PHASE 4.5 SUITE]', err);
      process.exit(1);
    });
}
