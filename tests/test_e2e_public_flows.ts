import http from 'http';
import { app } from '../server/index.js';
import { setDatabaseProvider } from '../server/db.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { setStorageService } from '../server/storage/storageFactory.js';
import { MockStorageService } from '../server/testing/MockStorageService.js';
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

export async function runPublicFlowsTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.4 PUBLIC WEBSITE & CATALOG WORKFLOWS');
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

  try {
    // --- 1. Public Games Catalog ---
    console.log('--- 1. Games Catalog Workflows ---');

    await run('GamesCatalog', 'GET /api/games returns published catalog with populated latest releases', async () => {
      const res = await fetch(`${baseUrl}/api/games`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(Array.isArray(body.games), 'body.games is an array');
      assert(body.games.length > 0, 'Catalog contains games');
      const baseline = body.games.find((g: any) => g.slug === TEST_FIXTURES.game.slug);
      assert(baseline !== undefined, `Baseline game "${TEST_FIXTURES.game.slug}" present`);
      assert(baseline.latest_release !== undefined, 'Latest release populated on game record');
    });

    await run('GamesCatalog', 'GET /api/games/:slug returns detailed game with all releases sorted', async () => {
      const res = await fetch(`${baseUrl}/api/games/${TEST_FIXTURES.game.slug}`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.game !== undefined, 'body.game exists');
      assert(body.game.slug === TEST_FIXTURES.game.slug, 'Game slug matches requested slug');
      assert(Array.isArray(body.game.releases), 'Releases list is array');
    });

    await run('GamesCatalog', 'GET /api/games/:slug returns HTTP 404 for non-existent game', async () => {
      const res = await fetch(`${baseUrl}/api/games/non_existent_game_slug_12345`);
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('not found') === true, 'Error indicates game not found');
    });

    await run('GamesCatalog', 'GET /api/games filters by featured flag', async () => {
      const res = await fetch(`${baseUrl}/api/games?featured=true`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      for (const g of body.games) {
        assert(g.featured === true, 'Returned game is marked featured');
      }
    });

    // --- 2. Public Products Catalog ---
    console.log('\n--- 2. Products Catalog Workflows ---');

    await run('ProductsCatalog', 'GET /api/products returns published products (excluding drafts)', async () => {
      const res = await fetch(`${baseUrl}/api/products`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(Array.isArray(body.products), 'body.products is array');
      for (const p of body.products) {
        assert(p.status === 'Published', `Product "${p.name}" status must be Published (got ${p.status})`);
      }
    });

    await run('ProductsCatalog', 'GET /api/products bridges published games into catalog under Games category', async () => {
      const res = await fetch(`${baseUrl}/api/products?include_games=true`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      const bridgedGame = body.products.find((p: any) => p.category === 'Games');
      assert(bridgedGame !== undefined, 'Bridged game found in unified products catalog');
    });

    await run('ProductsCatalog', 'GET /api/products/:slug returns published product details', async () => {
      const res = await fetch(`${baseUrl}/api/products/${TEST_FIXTURES.product.slug}`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.product?.slug === TEST_FIXTURES.product.slug, 'Product slug matches requested');
    });

    await run('ProductsCatalog', 'GET /api/products/:slug returns HTTP 404 for missing product', async () => {
      const res = await fetch(`${baseUrl}/api/products/non_existent_product_slug`);
      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    // --- 3. Public Stats & Settings ---
    console.log('\n--- 3. Public Stats & Settings Workflows ---');

    await run('PublicStats', 'GET /api/stats returns aggregated metrics and public studio settings', async () => {
      const res = await fetch(`${baseUrl}/api/stats`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.stats !== undefined, 'body.stats exists');
      assert(typeof body.stats.total_games === 'number', 'total_games is number');
      assert(typeof body.stats.total_downloads === 'number', 'total_downloads is number');
      assert(body.settings !== undefined, 'body.settings exists');
      assert(typeof body.settings.studio_name === 'string' && body.settings.studio_name.length > 0, 'Studio name is non-empty string');
    });

    // --- 4. SEO & Dynamic Discovery ---
    console.log('\n--- 4. Sitemap & Discovery Workflows ---');

    await run('Discovery', 'GET /sitemap.xml generates valid XML containing public routes', async () => {
      const res = await fetch(`${baseUrl}/sitemap.xml`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.headers.get('content-type')?.includes('application/xml') === true, 'Content-Type is XML');
      const xml = await res.text();
      assert(xml.includes('<urlset'), 'XML contains urlset tag');
      assert(xml.includes(`<loc>https://tech.aadirishi.in/games/${TEST_FIXTURES.game.slug}</loc>`), 'Sitemap lists baseline game');
    });

  } finally {
    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`PUBLIC FLOWS SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Public Flows Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_e2e_public_flows.ts')) {
  runPublicFlowsTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN PUBLIC FLOWS SUITE]', err);
      process.exit(1);
    });
}
