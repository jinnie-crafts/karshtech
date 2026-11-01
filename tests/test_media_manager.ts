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

export async function runMediaManagerTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.6 ADMIN MEDIA & ASSET MANAGER TEST SUITE');
  console.log('================================================================\n');

  const testDbUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
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

  // Setup Tokens
  const adminToken = generateToken({
    userId: TEST_FIXTURES.user.id,
    username: TEST_FIXTURES.user.username,
    role: 'admin',
  });

  const editorToken = generateToken({
    userId: 'test_user_editor',
    username: 'test_editor',
    role: 'editor',
  });

  // Valid image & APK payloads
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
  ]);
  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const validApkBuffer = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x08, 0x00]),
    Buffer.from('AndroidManifest.xml'),
    Buffer.from('SYNTHETIC_MEDIA_TEST_APK_PAYLOAD'),
    Buffer.alloc(256),
  ]);

  let game: any = null;
  let product: any = null;
  let release: any = null;

  try {
    // Restore baseline synthetic fixtures if they were touched
    try {
      await postgresProvider.updateRelease(TEST_FIXTURES.release.id, {
        apk_filename: TEST_FIXTURES.release.apk_filename,
      });
      await postgresProvider.updateGame(TEST_FIXTURES.game.id, {
        cover_image: TEST_FIXTURES.game.cover_image,
        screenshots: TEST_FIXTURES.game.screenshots,
      });
    } catch {}

    // Clean up any stale media manager test records first
    const staleProd = await postgresProvider.getProductBySlug('karsh-web-suite', true);
    if (staleProd) await postgresProvider.deleteProduct(staleProd.id);
    const staleGame = await postgresProvider.getGameBySlug('arrow-puzzle-test-mgr');
    if (staleGame) await postgresProvider.deleteGame(staleGame.id);

    // Create isolated test game
    game = await postgresProvider.createGame({
      title: 'Arrow Puzzle Test',
      slug: 'arrow-puzzle-test-mgr',
      tagline: 'Test spatial puzzle',
      description: 'Test media game',
      genre: ['Puzzle'],
      platforms: ['Android'],
      status: 'Available',
      featured: true,
      cover_image: 'arrow_puzzle_cover.jpg',
      screenshots: ['arrow_puzzle_screenshot_1.jpg', 'custom_game_screenshot.jpg'],
      developer: 'Karsh Tech',
    });

    product = await postgresProvider.createProduct({
      name: 'Karsh Web Suite',
      slug: 'karsh-web-suite',
      short_description: 'Modern reactive web dashboard',
      description: 'Comprehensive software platform',
      category: 'Web Applications',
      cover_image: 'product_cover.jpg',
      gallery: ['product_gallery_1.jpg', 'product_gallery_2.jpg'],
      technologies: ['React', 'TypeScript', 'Tailwind'],
      platform: 'Web',
      status: 'Published',
      featured: true,
      display_order: 1,
    });

    release = await postgresProvider.createRelease({
      game_id: game.id,
      version_name: 'v1.0.0',
      version_code: 1,
      release_date: '2026-11-01',
      release_notes: 'Initial test release',
      apk_filename: 'arrow-puzzle-release-v1.0.0.apk',
      original_filename: 'ArrowPuzzle.apk',
      apk_file_size: validApkBuffer.length,
      apk_download_url: `/api/releases/test_rel_media_mgr/download`,
      min_sdk: 26,
      target_sdk: 35,
      is_published: true,
    });

    // Seed Mock Storage Objects
    mockStorage.reset();

    // 1. Game assets
    mockStorage.seedObject('game-assets', 'arrow_puzzle_cover.jpg', validJpegBuffer, 'image/jpeg');
    mockStorage.seedObject('game-assets', 'arrow_puzzle_screenshot_1.jpg', validJpegBuffer, 'image/jpeg');
    mockStorage.seedObject('game-assets', 'custom_game_screenshot.jpg', validJpegBuffer, 'image/jpeg');
    mockStorage.seedObject('game-assets', 'default_cover.jpg', validJpegBuffer, 'image/jpeg'); // protected
    mockStorage.seedObject('game-assets', 'unreferenced_game_banner.jpg', validJpegBuffer, 'image/jpeg'); // unreferenced

    // 2. Product assets
    mockStorage.seedObject('product-assets', 'product_cover.jpg', validPngBuffer, 'image/png');
    mockStorage.seedObject('product-assets', 'product_gallery_1.jpg', validPngBuffer, 'image/png');
    mockStorage.seedObject('product-assets', 'product_gallery_2.jpg', validPngBuffer, 'image/png');
    mockStorage.seedObject('product-assets', 'unreferenced_product_graphic.png', validPngBuffer, 'image/png'); // unreferenced

    // 3. Release APKs
    mockStorage.seedObject('release-apks', 'arrow-puzzle-release-v1.0.0.apk', validApkBuffer, 'application/vnd.android.package-archive');
    mockStorage.seedObject('release-apks', 'unreferenced_beta_release.apk', validApkBuffer, 'application/vnd.android.package-archive'); // unreferenced

    // ==========================================
    // SECTION 1: AUTHORIZATION & SECURITY PERIMETER
    // ==========================================

    await run('AUTH', 'GET /api/admin/media rejects unauthenticated requests with 401', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
      const body = await res.json();
      assert(body.error.toLowerCase().includes('authentication required'), 'Informative auth error');
    });

    await run('AUTH', 'GET /api/admin/media/stats rejects unauthenticated requests with 401', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media/stats`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await run('AUTH', 'DELETE /api/admin/media rejects unauthenticated requests with 401', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'game-assets', path: 'some_file.jpg' }),
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await run('AUTH', 'GET /api/admin/media rejects non-admin role with 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert(res.status === 403, `Expected 403 for non-admin, got ${res.status}`);
    });

    await run('SECURITY', 'State-changing DELETE without Bearer rejects disallowed Origin (CSRF)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://malicious-site.example.com',
          Cookie: `karshtech_session=${adminToken}`,
        },
        body: JSON.stringify({ bucket: 'game-assets', path: 'unreferenced_game_banner.jpg' }),
      });
      assert(res.status === 403, `Expected 403 CSRF rejection, got ${res.status}`);
      const body = await res.json();
      assert(body.error.includes('CSRF protection'), 'Explicit CSRF explanation');
    });

    // ==========================================
    // SECTION 2: MEDIA OVERVIEW STATS
    // ==========================================

    await run('STATS', 'GET /api/admin/media/stats returns accurate metrics across all 3 buckets', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Response success flag is true');
      const stats = body.stats;

      assert(stats.total_assets === 11, `Expected 11 total assets (5 game, 4 product, 2 apk), got ${stats.total_assets}`);
      assert(stats.game_images === 5, `Expected 5 game images, got ${stats.game_images}`);
      assert(stats.product_images === 4, `Expected 4 product images, got ${stats.product_images}`);
      assert(stats.apk_releases === 2, `Expected 2 apk releases, got ${stats.apk_releases}`);
      assert(stats.image_assets === 9, `Expected 9 total images, got ${stats.image_assets}`);
      assert(stats.total_storage_bytes > 0, 'Storage bytes aggregated');

      const buckets = stats.storage_by_bucket;
      assert(buckets['game-assets'].visibility === 'public', 'game-assets visibility is public');
      assert(buckets['product-assets'].visibility === 'public', 'product-assets visibility is public');
      assert(buckets['release-apks'].visibility === 'private', 'release-apks visibility is private');
    });

    // ==========================================
    // SECTION 3: MEDIA LISTING & DECORATION
    // ==========================================

    await run('LISTING', 'GET /api/admin/media lists all assets with accurate reference decoration', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Success flag true');
      assert(body.count === 11, `Expected 11 assets listed, got ${body.count}`);

      // Check game cover image reference
      const coverAsset = body.assets.find((a: any) => a.name === 'arrow_puzzle_cover.jpg');
      assert(coverAsset, 'arrow_puzzle_cover.jpg found');
      assert(coverAsset.is_referenced === true, 'Cover is marked as referenced');
      assert(coverAsset.referenced_by.some((r: any) => r.type === 'game' && r.field === 'cover_image'), 'Referenced by game cover_image');
      assert(coverAsset.url.startsWith('https://mock-storage.local/game-assets/'), 'Public CDN URL present');

      // Check game screenshot reference
      const shotAsset = body.assets.find((a: any) => a.name === 'arrow_puzzle_screenshot_1.jpg');
      assert(shotAsset, 'arrow_puzzle_screenshot_1.jpg found');
      assert(shotAsset.is_referenced === true, 'Screenshot is referenced');
      assert(shotAsset.is_protected === true, 'arrow_puzzle_screenshot_1.jpg is protected');
      assert(shotAsset.referenced_by.some((r: any) => r.type === 'game' && r.field === 'screenshots'), 'Referenced in game screenshots array');

      // Check protected default cover
      const defaultCover = body.assets.find((a: any) => a.name === 'default_cover.jpg');
      assert(defaultCover, 'default_cover.jpg found');
      assert(defaultCover.is_protected === true, 'default_cover.jpg is protected');

      // Check unreferenced asset
      const unreferenced = body.assets.find((a: any) => a.name === 'unreferenced_game_banner.jpg');
      assert(unreferenced, 'unreferenced_game_banner.jpg found');
      assert(unreferenced.is_referenced === false, 'Unreferenced asset has is_referenced = false');
      assert(unreferenced.referenced_by.length === 0, 'No references listed');
    });

    await run('SECURITY', 'Private release-apks assets strictly return url: null (no URL leak)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media?bucket=release-apks`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.assets.length === 2, `Expected 2 APKs, got ${body.assets.length}`);

      for (const apk of body.assets) {
        assert(apk.url === null, `Private APK ${apk.name} must have url: null, got ${apk.url}`);
        assert(apk.visibility === 'private', 'Marked as private');
      }

      const releaseApk = body.assets.find((a: any) => a.name === 'arrow-puzzle-release-v1.0.0.apk');
      assert(releaseApk, 'arrow-puzzle-release-v1.0.0.apk found');
      assert(releaseApk.is_referenced === true, 'Release APK is referenced');
      assert(releaseApk.is_protected === true, 'Arrow puzzle release v1.0.0 is protected');
      assert(releaseApk.referenced_by.some((r: any) => r.type === 'release'), 'Referenced by release record');
    });

    // ==========================================
    // SECTION 4: FILTERING AND SORTING
    // ==========================================

    await run('FILTER', 'Filter by bucket returns isolated bucket contents', async () => {
      const resGame = await fetch(`${baseUrl}/api/admin/media?bucket=game-assets`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const bodyGame = await resGame.json();
      assert(bodyGame.assets.every((a: any) => a.bucket === 'game-assets'), 'All are game-assets');
      assert(bodyGame.assets.length === 5, `Expected 5 game-assets, got ${bodyGame.assets.length}`);

      const resProd = await fetch(`${baseUrl}/api/admin/media?bucket=product-assets`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const bodyProd = await resProd.json();
      assert(bodyProd.assets.every((a: any) => a.bucket === 'product-assets'), 'All are product-assets');
      assert(bodyProd.assets.length === 4, `Expected 4 product-assets, got ${bodyProd.assets.length}`);
    });

    await run('FILTER', 'Filter by association separates referenced from unreferenced assets', async () => {
      const resAssoc = await fetch(`${baseUrl}/api/admin/media?association=associated`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const bodyAssoc = await resAssoc.json();
      assert(bodyAssoc.assets.every((a: any) => a.is_referenced === true), 'All are referenced');

      const resUnassoc = await fetch(`${baseUrl}/api/admin/media?association=unassociated`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const bodyUnassoc = await resUnassoc.json();
      assert(bodyUnassoc.assets.every((a: any) => a.is_referenced === false), 'All are unreferenced');
      assert(bodyUnassoc.assets.some((a: any) => a.name === 'unreferenced_game_banner.jpg'), 'Contains unreferenced game banner');
      assert(bodyUnassoc.assets.some((a: any) => a.name === 'unreferenced_product_graphic.png'), 'Contains unreferenced product graphic');
      assert(bodyUnassoc.assets.some((a: any) => a.name === 'unreferenced_beta_release.apk'), 'Contains unreferenced APK');
    });

    await run('FILTER', 'Search filter performs case-insensitive filename substring matching', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media?search=arrow`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const body = await res.json();
      assert(body.assets.length >= 3, `Expected at least 3 arrow matches, got ${body.assets.length}`);
      assert(body.assets.every((a: any) => a.name.toLowerCase().includes('arrow')), 'All match search query');
    });

    await run('SORT', 'Sorting returns assets in requested alphanumeric or chronological sequence', async () => {
      const resAsc = await fetch(`${baseUrl}/api/admin/media?sort=name_asc`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const bodyAsc = await resAsc.json();
      const names = bodyAsc.assets.map((a: any) => a.name);
      for (let i = 0; i < names.length - 1; i++) {
        assert(names[i].localeCompare(names[i + 1]) <= 0, `Expected name ascending order at index ${i}`);
      }
    });

    // ==========================================
    // SECTION 5: REFERENCE-AWARE DELETION SAFEGUARDS
    // ==========================================

    await run('DELETION', 'DELETE /api/admin/media rejects missing bucket or path with 400', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'game-assets' }), // missing path
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await run('DELETION', 'DELETE /api/admin/media rejects path traversal attempt with 400', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'game-assets', path: '../../etc/passwd' }),
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const body = await res.json();
      assert(body.error.includes('Path traversal'), 'Path traversal defense triggered');
    });

    await run('DELETION', 'DELETE /api/admin/media strictly rejects protected asset with 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'game-assets', path: 'default_cover.jpg' }),
      });
      assert(res.status === 403, `Expected 403 for protected asset, got ${res.status}`);
      const body = await res.json();
      assert(body.error.includes('protected production asset'), 'Explicit protected asset explanation');

      // Verify asset still exists in storage
      const meta = await mockStorage.getObjectMetadata('game-assets', 'default_cover.jpg');
      assert(meta !== null, 'default_cover.jpg retained in storage');
    });

    await run('DELETION', 'DELETE /api/admin/media strictly rejects game cover image with 409', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'game-assets', path: 'arrow_puzzle_cover.jpg' }),
      });
      assert(res.status === 409, `Expected 409 conflict, got ${res.status}`);
      const body = await res.json();
      assert(body.error.includes('actively referenced'), 'Referenced error message');
      assert(body.referenced_by.some((r: any) => r.type === 'game'), 'References list provided');

      // Verify asset still exists in storage
      const meta = await mockStorage.getObjectMetadata('game-assets', 'arrow_puzzle_cover.jpg');
      assert(meta !== null, 'arrow_puzzle_cover.jpg retained in storage');
    });

    await run('DELETION', 'DELETE /api/admin/media strictly rejects game screenshot with 409', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'game-assets', path: 'custom_game_screenshot.jpg' }),
      });
      assert(res.status === 409, `Expected 409 conflict, got ${res.status}`);
      const body = await res.json();
      assert(body.referenced_by.some((r: any) => r.field === 'screenshots'), 'Referenced in screenshots');
    });

    await run('DELETION', 'DELETE /api/admin/media strictly rejects product gallery image with 409', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'product-assets', path: 'product_gallery_1.jpg' }),
      });
      assert(res.status === 409, `Expected 409 conflict, got ${res.status}`);
      const body = await res.json();
      assert(body.referenced_by.some((r: any) => r.type === 'product' && r.field === 'gallery'), 'Referenced by product gallery');
    });

    await run('DELETION', 'DELETE /api/admin/media strictly rejects release APK with 409', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'release-apks', path: 'arrow-puzzle-release-v1.0.0.apk' }),
      });
      // arrow-puzzle-release-v1.0.0.apk is protected so it may return 403 first
      assert(res.status === 403 || res.status === 409, `Expected 403 or 409, got ${res.status}`);
    });

    await run('DELETION', 'DELETE /api/admin/media successfully deletes unreferenced asset with 200', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'game-assets', path: 'unreferenced_game_banner.jpg' }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Success flag true');

      // Verify removed from storage
      const meta = await mockStorage.getObjectMetadata('game-assets', 'unreferenced_game_banner.jpg');
      assert(meta === null, 'unreferenced_game_banner.jpg deleted from storage');
    });

    await run('DELETION', 'DELETE /api/admin/media returns 404 when asset does not exist in storage', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'game-assets', path: 'non_existent_unreferenced_asset.jpg' }),
      });
      assert(res.status === 404, `Expected 404 for missing storage asset, got ${res.status}`);
      const body = await res.json();
      assert(body.error.includes('did not confirm deletion or object was not found'), 'Error specifies storage missing');
    });

    await run('DELETION', 'DELETE /api/admin/media accepts bucket and path via query parameters', async () => {
      const testAsset = 'query_param_delete_test.png';
      mockStorage.seedObject('product-assets', testAsset, validPngBuffer, 'image/png');

      const res = await fetch(`${baseUrl}/api/admin/media?bucket=product-assets&path=${testAsset}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 200, `Expected 200 for query-param deletion, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Deletion confirmed');

      const meta = await mockStorage.getObjectMetadata('product-assets', testAsset);
      assert(meta === null, 'Asset deleted from storage via query params');
    });

    await run('DELETION', 'DELETE /api/admin/media accepts alternative JSON body fields (name, filename)', async () => {
      // Test with "name" field
      const testAsset1 = 'name_field_delete_test.png';
      mockStorage.seedObject('product-assets', testAsset1, validPngBuffer, 'image/png');
      const res1 = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'product-assets', name: testAsset1 }),
      });
      assert(res1.status === 200, `Expected 200 for name-field deletion, got ${res1.status}`);

      // Test with "filename" field
      const testAsset2 = 'filename_field_delete_test.png';
      mockStorage.seedObject('product-assets', testAsset2, validPngBuffer, 'image/png');
      const res2 = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ bucket: 'product-assets', filename: testAsset2 }),
      });
      assert(res2.status === 200, `Expected 200 for filename-field deletion, got ${res2.status}`);

      const meta1 = await mockStorage.getObjectMetadata('product-assets', testAsset1);
      const meta2 = await mockStorage.getObjectMetadata('product-assets', testAsset2);
      assert(meta1 === null && meta2 === null, 'Both assets successfully removed via alternative body keys');
    });

    // ==========================================
    // SECTION 6: GAME SCREENSHOT ORCHESTRATOR
    // ==========================================

    await run('SCREENSHOTS', 'POST /api/admin/games/:id/screenshots attaches new screenshot', async () => {
      mockStorage.seedObject('game-assets', 'new_dynamic_screenshot.jpg', validJpegBuffer, 'image/jpeg');
      const newUrl = 'https://mock-storage.local/game-assets/new_dynamic_screenshot.jpg';
      const res = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: newUrl }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.screenshots.includes(newUrl), 'New screenshot appended');

      const updatedGame = await postgresProvider.getGameById(game.id);
      assert(updatedGame?.screenshots.includes(newUrl), 'Persisted in database');
    });

    await run('SCREENSHOTS', 'PUT /api/admin/games/:id/screenshots reorders screenshots', async () => {
      const reordered = [
        'arrow_puzzle_screenshot_2.jpg',
        'arrow_puzzle_screenshot_1.jpg',
        'https://mock-storage.local/game-assets/new_dynamic_screenshot.jpg',
      ];
      const res = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ screenshots: reordered }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.screenshots[0] === 'arrow_puzzle_screenshot_2.jpg', 'First screenshot swapped');

      const updatedGame = await postgresProvider.getGameById(game.id);
      assert(updatedGame?.screenshots[0] === 'arrow_puzzle_screenshot_2.jpg', 'Reordered in DB');
    });

    await run('SCREENSHOTS', 'DELETE /api/admin/games/:id/screenshots detaches screenshot without deleting storage object', async () => {
      // Seed the storage object first
      mockStorage.seedObject('game-assets', 'new_dynamic_screenshot.jpg', validJpegBuffer, 'image/jpeg');

      const detachUrl = 'https://mock-storage.local/game-assets/new_dynamic_screenshot.jpg';
      const res = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: detachUrl }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(!body.screenshots.includes(detachUrl), 'Screenshot removed from game');

      // CRITICAL: verify storage object still exists!
      const meta = await mockStorage.getObjectMetadata('game-assets', 'new_dynamic_screenshot.jpg');
      assert(meta !== null, 'Storage object PRESERVED in library after detachment');
    });

    // ==========================================
    // SECTION 7: PRODUCT GALLERY ORCHESTRATOR
    // ==========================================

    await run('GALLERY', 'POST /api/admin/products/:id/gallery attaches image to gallery', async () => {
      mockStorage.seedObject('product-assets', 'new_feature_showcase.png', validPngBuffer, 'image/png');
      const newImg = 'https://mock-storage.local/product-assets/new_feature_showcase.png';
      const res = await fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: newImg }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.gallery.includes(newImg), 'New image appended to gallery');

      const updatedProd = await postgresProvider.getProductById(product.id);
      assert(updatedProd?.gallery?.includes(newImg), 'Persisted in database');
    });

    await run('GALLERY', 'PUT /api/admin/products/:id/gallery reorders gallery images', async () => {
      const reordered = [
        'product_gallery_2.jpg',
        'product_gallery_1.jpg',
        'https://mock-storage.local/product-assets/new_feature_showcase.png',
      ];
      const res = await fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ gallery: reordered }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.gallery[0] === 'product_gallery_2.jpg', 'First slide swapped');

      const updatedProd = await postgresProvider.getProductById(product.id);
      assert(updatedProd?.gallery?.[0] === 'product_gallery_2.jpg', 'Reordered in DB');
    });

    await run('GALLERY', 'DELETE /api/admin/products/:id/gallery detaches image without deleting storage object', async () => {
      mockStorage.seedObject('product-assets', 'new_feature_showcase.png', validPngBuffer, 'image/png');

      const detachUrl = 'https://mock-storage.local/product-assets/new_feature_showcase.png';
      const res = await fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: detachUrl }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(!body.gallery.includes(detachUrl), 'Image removed from product gallery');

      // CRITICAL: verify storage object still exists!
      const meta = await mockStorage.getObjectMetadata('product-assets', 'new_feature_showcase.png');
      assert(meta !== null, 'Storage object PRESERVED in library after detachment');
    });

    // ==========================================
    // SECTION 8: UPLOAD MANAGER VERIFICATION
    // ==========================================

    await run('UPLOAD', 'POST /api/admin/upload/image uploads image to game-assets by default', async () => {
      const boundary = '----WebKitFormBoundaryMediaUploadTest1';
      const bodyParts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="fresh_game_cover.png"\r\nContent-Type: image/png\r\n\r\n`,
        validPngBuffer,
        `\r\n--${boundary}--\r\n`,
      ];
      const bodyBuffer = Buffer.concat(bodyParts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));

      const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Authorization: `Bearer ${adminToken}`,
        },
        body: bodyBuffer,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Upload success');
      assert(body.url.includes('/game-assets/'), 'Uploaded to game-assets');
      assert(body.filename.startsWith('fresh_game_cover_'), 'Generated collision-resistant name');
    });

    await run('UPLOAD', 'POST /api/admin/upload/image uploads to product-assets when requested', async () => {
      const boundary = '----WebKitFormBoundaryMediaUploadTest2';
      const bodyParts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="bucket"\r\n\r\nproduct-assets\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="fresh_product_shot.png"\r\nContent-Type: image/png\r\n\r\n`,
        validPngBuffer,
        `\r\n--${boundary}--\r\n`,
      ];
      const bodyBuffer = Buffer.concat(bodyParts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));

      const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Authorization: `Bearer ${adminToken}`,
        },
        body: bodyBuffer,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Upload success');
      assert(body.url.includes('/product-assets/'), 'Uploaded to product-assets');
    });

    await run('UPLOAD', 'POST /api/admin/upload/apk uploads APK to release-apks private bucket', async () => {
      const boundary = '----WebKitFormBoundaryMediaUploadTest3';
      const bodyParts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="apk"; filename="v2.0.0-beta.apk"\r\nContent-Type: application/vnd.android.package-archive\r\n\r\n`,
        validApkBuffer,
        `\r\n--${boundary}--\r\n`,
      ];
      const bodyBuffer = Buffer.concat(bodyParts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));

      const res = await fetch(`${baseUrl}/api/admin/upload/apk`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Authorization: `Bearer ${adminToken}`,
        },
        body: bodyBuffer,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'APK upload success');
      assert(body.stored_filename.endsWith('.apk'), 'Stored filename ends with .apk');

      // Verify stored in private bucket
      const meta = await mockStorage.getObjectMetadata('release-apks', body.stored_filename);
      assert(meta !== null, 'Stored in release-apks bucket');
    });

    await run('VALIDATION', 'Upload rejects corrupted/fake image magic bytes with 400', async () => {
      const fakeImage = Buffer.from('THIS_IS_NOT_A_VALID_IMAGE_FILE_BUFFER');
      const boundary = '----WebKitFormBoundaryFakeImage';
      const bodyParts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="fake.png"\r\nContent-Type: image/png\r\n\r\n`,
        fakeImage,
        `\r\n--${boundary}--\r\n`,
      ];
      const bodyBuffer = Buffer.concat(bodyParts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));

      const res = await fetch(`${baseUrl}/api/admin/upload/image`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          Authorization: `Bearer ${adminToken}`,
        },
        body: bodyBuffer,
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const body = await res.json();
      assert(body.error.includes('magic bytes check failed'), 'Magic bytes check error');
    });

    // =========================================================================
    // PHASE 4.3.6.2 CONCURRENCY BOUNDARY & 8-SCENARIO INTEGRITY AUDIT SUITE
    // =========================================================================

    // SCENARIO 1: Screenshot attachment versus generic asset deletion
    await run('CONCURRENCY', 'Scenario 1: Screenshot attachment versus generic asset deletion', async () => {
      const raceFile = 'race_s1_screenshot.png';
      mockStorage.seedObject('game-assets', raceFile, validPngBuffer, 'image/png');

      const attachReq = fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: raceFile }),
      });
      const deleteReq = fetch(`${baseUrl}/api/admin/media?bucket=game-assets&path=${raceFile}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const [resAttach, resDelete] = await Promise.all([attachReq, deleteReq]);
      const caseA = resAttach.status === 200 && resDelete.status === 409;
      const caseB = resDelete.status === 200 && resAttach.status === 404;

      assert(caseA || caseB, `Expected serialized outcome (A: 200/409, B: 200/404), got Attach:${resAttach.status}, Delete:${resDelete.status}`);

      const freshGame = await postgresProvider.getGameById(game.id);
      const meta = await mockStorage.getObjectMetadata('game-assets', raceFile);

      if (caseA) {
        assert(freshGame.screenshots.some((s: string) => s.includes(raceFile)), 'Game contains screenshot in Case A');
        assert(meta !== null, 'Storage preserves object in Case A');
        await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ url: raceFile }),
        });
        await mockStorage.deleteObject('game-assets', raceFile);
      } else {
        assert(!freshGame.screenshots.some((s: string) => s.includes(raceFile)), 'Game does NOT have screenshot in Case B');
        assert(meta === null, 'Storage does NOT have object in Case B');
      }
    });

    // SCENARIO 2: Product gallery attachment versus generic asset deletion
    await run('CONCURRENCY', 'Scenario 2: Product gallery attachment versus generic asset deletion', async () => {
      const raceFile = 'race_s2_gallery.png';
      mockStorage.seedObject('product-assets', raceFile, validPngBuffer, 'image/png');

      const attachReq = fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: raceFile }),
      });
      const deleteReq = fetch(`${baseUrl}/api/admin/media?bucket=product-assets&path=${raceFile}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const [resAttach, resDelete] = await Promise.all([attachReq, deleteReq]);
      const caseA = resAttach.status === 200 && resDelete.status === 409;
      const caseB = resDelete.status === 200 && resAttach.status === 404;

      assert(caseA || caseB, `Expected serialized outcome (A: 200/409, B: 200/404), got Gallery:${resAttach.status}, Delete:${resDelete.status}`);

      const freshProd = await postgresProvider.getProductById(product.id);
      const meta = await mockStorage.getObjectMetadata('product-assets', raceFile);

      if (caseA) {
        assert(freshProd?.gallery?.some((img: string) => img.includes(raceFile)), 'Product contains gallery image in Case A');
        assert(meta !== null, 'Storage preserves object in Case A');
        await fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ url: raceFile }),
        });
        await mockStorage.deleteObject('product-assets', raceFile);
      } else {
        assert(!freshProd?.gallery?.some((img: string) => img.includes(raceFile)), 'Product does NOT have gallery image in Case B');
        assert(meta === null, 'Storage does NOT have object in Case B');
      }
    });

    // SCENARIO 3: General game update versus generic asset deletion
    await run('CONCURRENCY', 'Scenario 3: General game update versus generic asset deletion', async () => {
      const raceFile = 'race_s3_game_cover.png';
      mockStorage.seedObject('game-assets', raceFile, validPngBuffer, 'image/png');

      const updateReq = fetch(`${baseUrl}/api/admin/games/${game.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ cover_image: raceFile }),
      });
      const deleteReq = fetch(`${baseUrl}/api/admin/media?bucket=game-assets&path=${raceFile}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const [resUpdate, resDelete] = await Promise.all([updateReq, deleteReq]);
      const caseA = resUpdate.status === 200 && resDelete.status === 409;
      const caseB = resDelete.status === 200 && resUpdate.status === 404;

      assert(caseA || caseB, `Expected serialized outcome (A: 200/409, B: 200/404), got GameUpdate:${resUpdate.status}, Delete:${resDelete.status}`);

      const freshGame = await postgresProvider.getGameById(game.id);
      const meta = await mockStorage.getObjectMetadata('game-assets', raceFile);

      if (caseA) {
        assert(freshGame.cover_image === raceFile, 'Game cover set to raceFile in Case A');
        assert(meta !== null, 'Storage preserves object in Case A');
        // Restore original cover
        await postgresProvider.updateGame(game.id, { cover_image: 'arrow_puzzle_cover.jpg' });
        await mockStorage.deleteObject('game-assets', raceFile);
      } else {
        assert(freshGame.cover_image !== raceFile, 'Game cover NOT set to raceFile in Case B');
        assert(meta === null, 'Storage deleted object in Case B');
      }
    });

    // SCENARIO 4: General product update versus generic asset deletion
    await run('CONCURRENCY', 'Scenario 4: General product update versus generic asset deletion', async () => {
      const raceFile = 'race_s4_prod_cover.png';
      mockStorage.seedObject('product-assets', raceFile, validPngBuffer, 'image/png');

      const updateReq = fetch(`${baseUrl}/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ cover_image: raceFile }),
      });
      const deleteReq = fetch(`${baseUrl}/api/admin/media?bucket=product-assets&path=${raceFile}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const [resUpdate, resDelete] = await Promise.all([updateReq, deleteReq]);
      const caseA = resUpdate.status === 200 && resDelete.status === 409;
      const caseB = resDelete.status === 200 && resUpdate.status === 404;

      assert(caseA || caseB, `Expected serialized outcome (A: 200/409, B: 200/404), got ProdUpdate:${resUpdate.status}, Delete:${resDelete.status}`);

      const freshProd = await postgresProvider.getProductById(product.id);
      const meta = await mockStorage.getObjectMetadata('product-assets', raceFile);

      if (caseA) {
        assert(freshProd.cover_image === raceFile, 'Product cover set to raceFile in Case A');
        assert(meta !== null, 'Storage preserves object in Case A');
        await postgresProvider.updateProduct(product.id, { cover_image: 'product_cover.jpg' });
        await mockStorage.deleteObject('product-assets', raceFile);
      } else {
        assert(freshProd.cover_image !== raceFile, 'Product cover NOT set to raceFile in Case B');
        assert(meta === null, 'Storage deleted object in Case B');
      }
    });

    // SCENARIO 5: Screenshot reordering versus generic asset deletion
    await run('CONCURRENCY', 'Scenario 5: Screenshot reordering versus generic asset deletion', async () => {
      const raceFile = 'race_s5_screenshot.png';
      mockStorage.seedObject('game-assets', raceFile, validPngBuffer, 'image/png');

      // Attach first so it's part of screenshots
      await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: raceFile }),
      });

      // Fire concurrent reorder and deletion
      const reorderReq = fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ screenshots: [raceFile, 'arrow_puzzle_screenshot_1.jpg'] }),
      });
      const deleteReq = fetch(`${baseUrl}/api/admin/media?bucket=game-assets&path=${raceFile}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const [resReorder, resDelete] = await Promise.all([reorderReq, deleteReq]);

      assert(resReorder.status === 200, `Expected Reorder 200, got ${resReorder.status}`);
      assert(resDelete.status === 409, `Expected Delete 409 Conflict, got ${resDelete.status}`);

      const meta = await mockStorage.getObjectMetadata('game-assets', raceFile);
      assert(meta !== null, 'Asset preserved in storage');

      // Cleanup
      await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: raceFile }),
      });
      await mockStorage.deleteObject('game-assets', raceFile);
    });

    // SCENARIO 6: Product gallery reordering versus generic asset deletion
    await run('CONCURRENCY', 'Scenario 6: Product gallery reordering versus generic asset deletion', async () => {
      const raceFile = 'race_s6_gallery.png';
      mockStorage.seedObject('product-assets', raceFile, validPngBuffer, 'image/png');

      // Attach first
      await fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: raceFile }),
      });

      // Fire concurrent reorder and deletion
      const reorderReq = fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ gallery: [raceFile, 'product_gallery_1.jpg'] }),
      });
      const deleteReq = fetch(`${baseUrl}/api/admin/media?bucket=product-assets&path=${raceFile}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const [resReorder, resDelete] = await Promise.all([reorderReq, deleteReq]);

      assert(resReorder.status === 200, `Expected Reorder 200, got ${resReorder.status}`);
      assert(resDelete.status === 409, `Expected Delete 409 Conflict, got ${resDelete.status}`);

      const meta = await mockStorage.getObjectMetadata('product-assets', raceFile);
      assert(meta !== null, 'Asset preserved in storage');

      // Cleanup
      await fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: raceFile }),
      });
      await mockStorage.deleteObject('product-assets', raceFile);
    });

    // SCENARIO 7: Concurrent detach and deletion
    await run('CONCURRENCY', 'Scenario 7: Concurrent detach and generic asset deletion', async () => {
      const raceFile = 'race_s7_detach.png';
      mockStorage.seedObject('game-assets', raceFile, validPngBuffer, 'image/png');

      // Attach first
      await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: raceFile }),
      });

      // Concurrently fire detach and deletion
      const detachReq = fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: raceFile }),
      });
      const deleteReq = fetch(`${baseUrl}/api/admin/media?bucket=game-assets&path=${raceFile}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const [resDetach, resDelete] = await Promise.all([detachReq, deleteReq]);

      const caseA = resDetach.status === 200 && resDelete.status === 200;
      const caseB = resDelete.status === 409 && resDetach.status === 200;

      assert(caseA || caseB, `Expected serialized detach outcome (A: 200/200, B: 409/200), got Detach:${resDetach.status}, Delete:${resDelete.status}`);

      const freshGame = await postgresProvider.getGameById(game.id);
      const meta = await mockStorage.getObjectMetadata('game-assets', raceFile);

      assert(!freshGame.screenshots.includes(raceFile), 'Game does NOT have detached screenshot');
      if (caseB) {
        assert(meta !== null, 'Storage preserves object in Case B');
        await mockStorage.deleteObject('game-assets', raceFile);
      } else {
        assert(meta === null, 'Storage object deleted in Case A');
      }
    });

    // SCENARIO 8: Multiple concurrent deletion requests for the same object
    await run('CONCURRENCY', 'Scenario 8: Multiple concurrent deletion requests for the same object', async () => {
      const raceFile = 'race_s8_double_del.png';
      mockStorage.seedObject('game-assets', raceFile, validPngBuffer, 'image/png');

      const delReq1 = fetch(`${baseUrl}/api/admin/media?bucket=game-assets&path=${raceFile}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const delReq2 = fetch(`${baseUrl}/api/admin/media?bucket=game-assets&path=${raceFile}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const [res1, res2] = await Promise.all([delReq1, delReq2]);

      const oneSucceeded = (res1.status === 200 && res2.status === 404) || (res2.status === 200 && res1.status === 404);
      assert(oneSucceeded, `Expected exactly one 200 and one 404, got Del1:${res1.status}, Del2:${res2.status}`);

      const meta = await mockStorage.getObjectMetadata('game-assets', raceFile);
      assert(meta === null, 'Storage object is completely removed');
    });

    // LOCK KEY NORMALIZATION: Same object with query parameters, fragments, URL encoding, leading slashes
    await run('CONCURRENCY', 'Lock key normalization produces canonical key regardless of path formatting', async () => {
      const { assetConcurrency } = await import('../server/index.js');
      const k1 = assetConcurrency.makeKey('game-assets', 'cover.jpg');
      const k2 = assetConcurrency.makeKey('game-assets', '/cover.jpg');
      const k3 = assetConcurrency.makeKey('game-assets', 'https://supabase.co/storage/v1/object/public/game-assets/cover.jpg?v=123');
      const k4 = assetConcurrency.makeKey('GAME-ASSETS', 'cover.jpg#fragment');
      const k5 = assetConcurrency.makeKey('game-assets', 'folder%2Fcover.jpg');

      assert(k1 === 'game-assets::cover.jpg', `Expected game-assets::cover.jpg, got ${k1}`);
      assert(k2 === k1, `k2 (${k2}) matches k1 (${k1})`);
      assert(k3 === k1, `k3 (${k3}) matches k1 (${k1})`);
      assert(k4 === k1, `k4 (${k4}) matches k1 (${k1})`);
      assert(k5 === k1, `k5 (${k5}) matches k1 (${k1})`);
    });

    // =========================================================================
    // PHASE 4.3.6.1 AUDIT SUITE: PRIVATE APK PROTECTION & SEGREGATION
    // =========================================================================

    await run('APK_PROTECTION', 'Generic DELETE /api/admin/media strictly returns 403 Forbidden for canonical release APK', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media?bucket=release-apks&path=arrow-puzzle-release-v1.0.0.apk`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
      const body = await res.json();
      assert(body.error.includes('Cannot delete protected production asset'), 'Explicit protected asset restriction');

      // Canonical APK must still exist in storage
      const meta = await mockStorage.getObjectMetadata('release-apks', 'arrow-puzzle-release-v1.0.0.apk');
      assert(meta !== null, 'Canonical APK is preserved in storage');
    });

    await run('APK_PROTECTION', 'Generic DELETE /api/admin/media strictly returns 409 Conflict for actively referenced release APK', async () => {
      // Create a test release referencing active_release_test.apk
      const activeApkName = 'active_release_test.apk';
      mockStorage.seedObject('release-apks', activeApkName, validApkBuffer, 'application/vnd.android.package-archive');
      const tempRelease = await postgresProvider.createRelease({
        game_id: game.id,
        version_name: '9.9.9',
        version_code: 999,
        release_date: '2026-11-01',
        release_notes: 'Active release reference test',
        apk_filename: activeApkName,
        original_filename: activeApkName,
        apk_file_size: validApkBuffer.length,
        apk_download_url: '',
        min_sdk: 26,
        target_sdk: 35,
        is_published: true,
      });

      try {
        const res = await fetch(`${baseUrl}/api/admin/media?bucket=release-apks&path=${activeApkName}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert(res.status === 409, `Expected 409 Conflict for referenced APK, got ${res.status}`);
        const body = await res.json();
        assert(body.error.includes('actively referenced and cannot be deleted'), 'Referenced release APK rejection error');

        const meta = await mockStorage.getObjectMetadata('release-apks', activeApkName);
        assert(meta !== null, 'Referenced APK preserved in storage');
      } finally {
        await postgresProvider.deleteRelease(tempRelease.id);
        await mockStorage.deleteObject('release-apks', activeApkName);
      }
    });

    await run('APK_PROTECTION', 'Generic DELETE /api/admin/media successfully deletes unreferenced dummy APK from release-apks', async () => {
      const dummyApk = 'unreferenced_dummy_test.apk';
      mockStorage.seedObject('release-apks', dummyApk, validApkBuffer, 'application/vnd.android.package-archive');

      const res = await fetch(`${baseUrl}/api/admin/media`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ bucket: 'release-apks', path: dummyApk }),
      });
      assert(res.status === 200, `Expected 200 OK for unreferenced dummy APK deletion, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Success flag true');

      // Verify removed from storage
      const meta = await mockStorage.getObjectMetadata('release-apks', dummyApk);
      assert(meta === null, 'Dummy APK deleted from storage');
    });

    await run('APK_PROTECTION', 'Media API never exposes public URLs or download tokens for release-apks assets', async () => {
      const res = await fetch(`${baseUrl}/api/admin/media?bucket=release-apks`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(Array.isArray(body.assets), 'Assets array returned');
      assert(body.assets.length > 0, 'Has APK assets');

      for (const asset of body.assets) {
        assert(asset.visibility === 'private', `Expected private visibility, got ${asset.visibility}`);
        assert(asset.url === null, `Expected url to be null for private APK, got ${asset.url}`);
      }
    });

    // =========================================================================
    // PHASE 4.3.6.1 AUDIT SUITE: ATTACHMENT VALIDATION & HARDENING
    // =========================================================================

    await run('ATTACH_VALIDATION', 'Screenshot attachment rejects nonexistent storage object with 404', async () => {
      const res = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: 'nonexistent_phantom_screenshot_404.png' }),
      });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      const body = await res.json();
      assert(body.error.includes('does not exist in storage bucket') || body.error.includes('does not exist in bucket') || body.error.includes('does not exist in storage'), 'Explicit 404 storage existence error');
    });

    await run('ATTACH_VALIDATION', 'Screenshot attachment rejects external arbitrary URLs with 400', async () => {
      const res = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: 'https://evil-attacker-site.com/exploit.jpg' }),
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const body = await res.json();
      assert(body.error.includes('External URLs are not permitted') || body.error.includes('External or unverified image URLs are not permitted'), 'External URL rejection message');
    });

    await run('ATTACH_VALIDATION', 'Screenshot attachment rejects private APK files with 400', async () => {
      const res = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: 'arrow-puzzle-release-v1.0.0.apk' }),
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const body = await res.json();
      assert(body.error.includes('APK') || body.error.includes('private assets') || body.error.includes('Invalid file extension') || body.error.includes('Private bucket'), 'APK rejection message');
    });

    await run('ATTACH_VALIDATION', 'Screenshot attachment rejects path traversal and encoded separators with 400', async () => {
      const traversalPayloads = [
        '../traversal.png',
        '..\\traversal.png',
        '%2e%2e%2ftraversal.png',
        '%2e%2e/traversal.png',
        'sub/../../traversal.png',
      ];
      for (const payload of traversalPayloads) {
        const res = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ url: payload }),
        });
        assert(res.status === 400, `Expected 400 for payload '${payload}', got ${res.status}`);
      }
    });

    await run('ATTACH_VALIDATION', 'Screenshot attachment rejects duplicate screenshot on same game with 409 Conflict', async () => {
      const dupeFile = 'dupe_test_screenshot.png';
      mockStorage.seedObject('game-assets', dupeFile, validPngBuffer, 'image/png');

      const res1 = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: dupeFile }),
      });
      assert(res1.status === 200, 'First attachment succeeds');

      const res2 = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: dupeFile }),
      });
      assert(res2.status === 409, `Expected 409 Conflict for duplicate screenshot, got ${res2.status}`);
      const body2 = await res2.json();
      assert(body2.error.includes('already attached'), 'Duplicate attachment error message');

      // Cleanup
      await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: dupeFile }),
      });
      await mockStorage.deleteObject('game-assets', dupeFile);
    });

    await run('ATTACH_VALIDATION', 'Product gallery attachment rejects duplicate gallery image with 409 Conflict', async () => {
      const dupeGalleryFile = 'dupe_test_gallery.png';
      mockStorage.seedObject('product-assets', dupeGalleryFile, validPngBuffer, 'image/png');

      const res1 = await fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: dupeGalleryFile }),
      });
      assert(res1.status === 200, 'First gallery attachment succeeds');

      const res2 = await fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: dupeGalleryFile }),
      });
      assert(res2.status === 409, `Expected 409 Conflict for duplicate gallery image, got ${res2.status}`);
      const body2 = await res2.json();
      assert(body2.error.includes('already attached'), 'Duplicate gallery error message');

      // Cleanup
      await fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: dupeGalleryFile }),
      });
      await mockStorage.deleteObject('product-assets', dupeGalleryFile);
    });

    await run('ATTACH_VALIDATION', 'Screenshot reordering rejects duplicate entries or altered elements with 400', async () => {
      const res1 = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ screenshots: ['arrow_puzzle_screenshot_1.jpg', 'arrow_puzzle_screenshot_1.jpg'] }),
      });
      assert(res1.status === 400, `Expected 400 for duplicate array items, got ${res1.status}`);

      const res2 = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ screenshots: ['../evil.png'] }),
      });
      assert(res2.status === 400, `Expected 400 for traversal in array, got ${res2.status}`);
    });

    await run('ATTACH_VALIDATION', 'Product gallery reordering rejects duplicate entries with 400', async () => {
      const res = await fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ gallery: ['product_gallery_1.jpg', 'product_gallery_1.jpg'] }),
      });
      assert(res.status === 400, `Expected 400 for duplicate gallery entries, got ${res.status}`);
    });

    // =========================================================================
    // PHASE 4.3.6.1 AUDIT SUITE: STORAGE PAGINATION & AGGREGATE METRICS
    // =========================================================================

    await run('PAGINATION', 'Multi-page storage pagination retrieves all objects across multiple small batches', async () => {
      // Set simulated page size to 3 so 8 items will require 3 pages (3 + 3 + 2)
      mockStorage.setSimulatedPageSize(3);

      const seededItems = [
        'page_test_01.png',
        'page_test_02.png',
        'page_test_03.png',
        'page_test_04.png',
        'page_test_05.png',
        'page_test_06.png',
        'page_test_07.png',
        'page_test_08.png',
      ];
      for (const item of seededItems) {
        mockStorage.seedObject('product-assets', item, validPngBuffer, 'image/png');
      }

      const res = await fetch(`${baseUrl}/api/admin/media?bucket=product-assets`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(Array.isArray(body.assets), 'Returned assets array');

      // Verify every single seeded item exists in returned multi-page result
      const returnedNames = body.assets.map((a: any) => a.name);
      for (const item of seededItems) {
        assert(returnedNames.includes(item), `Item ${item} was not retrieved across paginated pages`);
      }

      // Cleanup
      for (const item of seededItems) {
        await mockStorage.deleteObject('product-assets', item);
      }
      mockStorage.clearPaginationSimulation();
    });

    await run('PAGINATION', 'Media statistics aggregate counts and byte sums across all paginated batches', async () => {
      mockStorage.setSimulatedPageSize(2);

      const items = ['stat_test_1.png', 'stat_test_2.png', 'stat_test_3.png', 'stat_test_4.png', 'stat_test_5.png'];
      for (const item of items) {
        mockStorage.seedObject('product-assets', item, validPngBuffer, 'image/png');
      }

      const res = await fetch(`${baseUrl}/api/admin/media/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();

      const productBucket = body.stats?.storage_by_bucket?.['product-assets'];
      assert(productBucket !== undefined, 'Has product-assets in stats');
      assert(productBucket.count >= items.length, `Expected >= ${items.length} count, got ${productBucket.count}`);
      assert(productBucket.bytes >= items.length * validPngBuffer.length, 'Size properly calculated across pages');
      assert(body.stats.total_assets >= items.length, 'Total objects reflects all paginated items');
      assert(body.stats.total_storage_bytes > 0, 'Total bytes reflects all paginated items');

      // Cleanup
      for (const item of items) {
        await mockStorage.deleteObject('product-assets', item);
      }
      mockStorage.clearPaginationSimulation();
    });

    await run('PAGINATION', 'Storage listing failure during pagination returns 502 Bad Gateway instead of partial array', async () => {
      mockStorage.setSimulatedPageSize(2);
      // Simulate failure at offset 2 (page 2)
      mockStorage.simulatePaginationFailureAtOffset(2);

      const items = ['fail_test_1.png', 'fail_test_2.png', 'fail_test_3.png'];
      for (const item of items) {
        mockStorage.seedObject('product-assets', item, validPngBuffer, 'image/png');
      }

      const res = await fetch(`${baseUrl}/api/admin/media?bucket=product-assets`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 502, `Expected 502 Bad Gateway on pagination failure, got ${res.status}`);
      const body = await res.json();
      assert(body.error.includes('storage') || body.error.includes('Simulated'), 'Error explains storage failure');

      // Clear simulation and cleanup
      mockStorage.clearPaginationSimulation();
      for (const item of items) {
        await mockStorage.deleteObject('product-assets', item);
      }
    });

    // =========================================================================
    // PHASE 4.3.6.1 AUDIT SUITE: AUTHORIZATION & REQUEST SECURITY
    // =========================================================================

    await run('AUTH_SECURITY', 'State-changing media endpoints reject unauthenticated requests with 401', async () => {
      // 1. DELETE media without auth
      const res1 = await fetch(`${baseUrl}/api/admin/media?bucket=game-assets&path=unreferenced_game_banner.jpg`, {
        method: 'DELETE',
      });
      assert(res1.status === 401, `Expected 401 for unauth DELETE media, got ${res1.status}`);

      // 2. POST screenshot without auth
      const res2 = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'arrow_puzzle_screenshot_1.jpg' }),
      });
      assert(res2.status === 401, `Expected 401 for unauth POST screenshot, got ${res2.status}`);

      // 3. DELETE screenshot without auth
      const res3 = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'arrow_puzzle_screenshot_1.jpg' }),
      });
      assert(res3.status === 401, `Expected 401 for unauth DELETE screenshot, got ${res3.status}`);

      // 4. PUT screenshots without auth
      const res4 = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenshots: [] }),
      });
      assert(res4.status === 401, `Expected 401 for unauth PUT screenshot, got ${res4.status}`);
    });

    await run('AUTH_SECURITY', 'State-changing media endpoints reject non-admin roles (editor) with 403', async () => {
      const res1 = await fetch(`${baseUrl}/api/admin/media?bucket=game-assets&path=unreferenced_game_banner.jpg`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert(res1.status === 403, `Expected 403 for editor DELETE media, got ${res1.status}`);

      const res2 = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editorToken}` },
        body: JSON.stringify({ url: 'arrow_puzzle_screenshot_1.jpg' }),
      });
      assert(res2.status === 403, `Expected 403 for editor POST screenshot, got ${res2.status}`);
    });

    await run('AUTH_SECURITY', 'Invalid or unauthorized bucket names are rejected with 400 Bad Request', async () => {
      const res1 = await fetch(`${baseUrl}/api/admin/media?bucket=internal-unauthorized-bucket&path=test.png`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res1.status === 400, `Expected 400 for invalid bucket on DELETE, got ${res1.status}`);

      const res2 = await fetch(`${baseUrl}/api/admin/media?bucket=system_passwords`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res2.status === 400, `Expected 400 for invalid bucket on GET, got ${res2.status}`);
    });

    await run('AUTH_SECURITY', 'Malformed payloads in attachment endpoints fail closed with 400 Bad Request', async () => {
      const res1 = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({}),
      });
      assert(res1.status === 400, `Expected 400 for empty body, got ${res1.status}`);

      const res2 = await fetch(`${baseUrl}/api/admin/games/${game.id}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ url: 12345 }),
      });
      assert(res2.status === 400, `Expected 400 for numeric url, got ${res2.status}`);

      const res3 = await fetch(`${baseUrl}/api/admin/products/${product.id}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({}),
      });
      assert(res3.status === 400, `Expected 400 for empty gallery body, got ${res3.status}`);
    });

  } finally {
    // Clean up media manager test records and restore baseline state in test DB
    try {
      if (release) await postgresProvider.deleteRelease(release.id);
      if (game) await postgresProvider.deleteGame(game.id);
      if (product) await postgresProvider.deleteProduct(product.id);

      await postgresProvider.updateRelease(TEST_FIXTURES.release.id, {
        apk_filename: TEST_FIXTURES.release.apk_filename,
      });
      await postgresProvider.updateGame(TEST_FIXTURES.game.id, {
        cover_image: TEST_FIXTURES.game.cover_image,
        screenshots: TEST_FIXTURES.game.screenshots,
      });
    } catch {}

    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.filter((r) => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`ADMIN MEDIA MANAGER SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Admin Media Manager Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_media_manager.ts')) {
  runMediaManagerTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN MEDIA MANAGER SUITE]', err);
      process.exit(1);
    });
}
