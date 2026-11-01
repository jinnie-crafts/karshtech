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

export async function runAdminFlowsTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.4 ADMIN WORKFLOW & CRUD VERIFICATION');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

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

  const adminToken = generateToken({
    userId: TEST_FIXTURES.user.id,
    username: TEST_FIXTURES.user.username,
    role: 'admin',
  });

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  try {
    // --- 1. Admin Game Management ---
    console.log('--- 1. Game Management Workflows ---');

    let createdGameId = '';
    const uniqueGameSlug = `test-admin-game-${Date.now()}`;

    await run('AdminGame', 'POST /api/admin/games creates a new game', async () => {
      const res = await fetch(`${baseUrl}/api/admin/games`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title: 'Admin Created Test Game',
          slug: uniqueGameSlug,
          tagline: 'Built via Admin API Flow',
          description: 'Comprehensive test description for game creation.',
          genre: ['Action', 'Strategy'],
          platforms: ['Android'],
          status: 'Available',
          featured: true,
          cover_image: '/uploads/images/cover.png',
          screenshots: ['/uploads/images/s1.png'],
        }),
      });

      assert(res.status === 201 || res.status === 200, `Expected 200/201, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Response contains success: true');
      assert(body.game?.slug === uniqueGameSlug, 'Game created with matching slug');
      createdGameId = body.game.id;
    });

    await run('AdminGame', 'GET /api/admin/games lists administrative games', async () => {
      const res = await fetch(`${baseUrl}/api/admin/games`, {
        headers: authHeaders,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(Array.isArray(body.games), 'body.games is array');
      const found = body.games.find((g: any) => g.id === createdGameId);
      assert(found !== undefined, 'Created game is listed');
    });

    await run('AdminGame', 'PUT /api/admin/games/:id updates game metadata', async () => {
      const res = await fetch(`${baseUrl}/api/admin/games/${createdGameId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          tagline: 'Updated Tagline via Admin Flow',
          featured: false,
        }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.game.tagline === 'Updated Tagline via Admin Flow', 'Tagline updated');
      assert(body.game.featured === false, 'Featured updated to false');
    });

    // --- 2. Admin Release Management ---
    console.log('\n--- 2. Release Management Workflows ---');

    let createdReleaseId = '';

    await run('AdminRelease', 'POST /api/admin/releases creates release associated with game', async () => {
      const res = await fetch(`${baseUrl}/api/admin/releases`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          game_id: createdGameId,
          version_name: 'v1.5.0-admin',
          version_code: 150,
          release_date: '2026-11-01',
          release_notes: 'Automated release test notes',
          apk_filename: 'admin_test_release.apk',
          original_filename: 'My Game (v1.5.0).apk',
          apk_file_size: 5000000,
          is_published: false, // Initially draft
        }),
      });

      assert(res.status === 201 || res.status === 200, `Expected 200/201, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Response contains success: true');
      createdReleaseId = body.release.id;
    });

    await run('AdminRelease', 'GET /api/admin/releases lists releases enriched with game_title', async () => {
      const res = await fetch(`${baseUrl}/api/admin/releases`, {
        headers: authHeaders,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      const found = body.releases.find((r: any) => r.id === createdReleaseId);
      assert(found !== undefined, 'Created release found in admin listing');
      assert(found.game_title === 'Admin Created Test Game', 'Enriched with game_title');
    });

    await run('AdminRelease', 'PUT /api/admin/releases/:id publishes the release', async () => {
      const res = await fetch(`${baseUrl}/api/admin/releases/${createdReleaseId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          is_published: true,
          release_notes: 'Published release notes',
        }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.release.is_published === true, 'Release published');
    });

    // --- 3. Admin Product Management ---
    console.log('\n--- 3. Product Management Workflows ---');

    let createdProductId = '';
    const uniqueProdSlug = `admin-prod-${Date.now()}`;

    await run('AdminProduct', 'POST /api/admin/products creates product in Draft status', async () => {
      const res = await fetch(`${baseUrl}/api/admin/products`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Admin Test Product',
          slug: uniqueProdSlug,
          short_description: 'Test short description',
          description: 'Long description of test product',
          category: 'Web Applications',
          cover_image: '/uploads/images/prod.png',
          technologies: ['React', 'Node.js', 'PostgreSQL'],
          status: 'Draft',
        }),
      });

      assert(res.status === 201 || res.status === 200, `Expected 200/201, got ${res.status}`);
      const body = await res.json();
      assert(body.product.status === 'Draft', 'Product created as Draft');
      createdProductId = body.product.id;
    });

    await run('AdminProduct', 'Draft product is hidden from public /api/products', async () => {
      const res = await fetch(`${baseUrl}/api/products`);
      const body = await res.json();
      const found = body.products.find((p: any) => p.id === createdProductId);
      assert(found === undefined, 'Draft product must NOT appear in public catalog');
    });

    await run('AdminProduct', 'PATCH /api/admin/products/:id/status publishes product', async () => {
      const res = await fetch(`${baseUrl}/api/admin/products/${createdProductId}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: 'Published' }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.product.status === 'Published', 'Product status updated to Published');
    });

    await run('AdminProduct', 'Published product now appears in public /api/products', async () => {
      const res = await fetch(`${baseUrl}/api/products`);
      const body = await res.json();
      const found = body.products.find((p: any) => p.id === createdProductId);
      assert(found !== undefined, 'Published product appears in public catalog');
    });

    await run('AdminProduct', 'DELETE /api/admin/products/:id deletes product', async () => {
      const res = await fetch(`${baseUrl}/api/admin/products/${createdProductId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    // --- 4. Admin Settings Management ---
    console.log('\n--- 4. Studio Settings Workflows ---');

    await run('AdminSettings', 'GET and PUT /api/admin/settings updates studio settings', async () => {
      const getRes = await fetch(`${baseUrl}/api/admin/settings`, {
        headers: authHeaders,
      });
      assert(getRes.status === 200, `Expected 200, got ${getRes.status}`);

      const putRes = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          studio_name: 'Karsh Tech Studio Verified',
          tagline: 'Empowering Digital Innovation',
        }),
      });
      assert(putRes.status === 200, `Expected 200, got ${putRes.status}`);
      const body = await putRes.json();
      assert(body.settings.studio_name === 'Karsh Tech Studio Verified', 'Studio name updated');
      assert(body.settings.tagline === 'Empowering Digital Innovation', 'Tagline updated');

      // Restore baseline studio settings so subsequent test suites remain completely hermetic
      await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          studio_name: TEST_FIXTURES.settings.studio_name,
          tagline: TEST_FIXTURES.settings.tagline,
          contact_email: TEST_FIXTURES.settings.contact_email,
        }),
      });
    });

    // --- 5. Clean up Game & Cascade Release ---
    console.log('\n--- 5. Cleanup & Foreign Key Cascade Verification ---');

    await run('AdminCleanup', 'DELETE /api/admin/games/:id removes game and cascades child release', async () => {
      const delRes = await fetch(`${baseUrl}/api/admin/games/${createdGameId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      assert(delRes.status === 200, `Expected 200, got ${delRes.status}`);

      // Verify release was cascaded
      const relCheck = await postgresProvider.getReleaseById(createdReleaseId);
      assert(relCheck === undefined, 'Child release removed automatically by foreign key cascade');
    });

  } finally {
    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`ADMIN FLOWS SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Admin Flows Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_e2e_admin_flows.ts')) {
  runAdminFlowsTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN ADMIN FLOWS SUITE]', err);
      process.exit(1);
    });
}
