import pg from 'pg';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { validateTestDatabaseUrl, assertTestDatabaseIsolation } from '../server/testing/testDatabaseGuard.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
  } catch {}
}

const { Pool } = pg;

interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function run(num: number, category: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ [PASS] [${category}] ${name}`);
    reports.push({ num, name, category, passed: true });
  } catch (err: any) {
    console.error(`  ✗ [FAIL] [${category}] ${name}: ${err.message}`);
    reports.push({ num, name, category, passed: false, error: err.message });
  }
}

export async function runPostgresCrudTests(): Promise<TestReport[]> {
  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.2 REAL POSTGRESQL CRUD INTEGRATION TESTS');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  // 1. Guard check
  console.log('--- 1. Guard Verification ---');
  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard rejected test URL: ${guard.reason}`);

  const testPool = new Pool({
    connectionString: testDbUrl,
    ssl: false,
    connectionTimeoutMillis: 5000,
  });

  await assertTestDatabaseIsolation(testPool, {
    candidateUrl: testDbUrl,
    productionUrl: prodUrl,
    strictDockerMode: true,
    requireMarker: true,
  });
  console.log('  [PASS] Guard confirmed isolated Docker test session and marker.\n');

  const provider = new SupabasePostgresProvider(testDbUrl);
  await provider.init();

  try {
    // ------------------------------------------------------------------------
    // GAMES CRUD
    // ------------------------------------------------------------------------
    console.log('--- 2. Games Operations Testing ---');
    const crudGameId = 'test_game_crud_001';
    const crudGameSlug = 'test-game-crud-orbit';

    await run(1, 'Games', 'List Games contains baseline fixture', async () => {
      const games = await provider.getGames();
      assert(games.some(g => g.id === TEST_FIXTURES.game.id), 'Baseline game not found in list');
    });

    await run(2, 'Games', 'Create Game creates record with full metadata', async () => {
      // Clean any leftover from previous runs
      await provider.deleteGame(crudGameId);

      const created = await provider.createGame({
        title: 'Test Orbit Odyssey',
        slug: crudGameSlug,
        tagline: 'Orbit the synthetic cosmos',
        description: 'A test game for CRUD testing',
        genre: ['Action', 'Sci-Fi'],
        platforms: ['Android', 'Web'],
        status: 'Available',
        featured: true,
        cover_image: 'https://mock-storage.local/game-assets/orbit_cover.jpg',
        screenshots: ['https://mock-storage.local/game-assets/orbit_1.jpg'],
        features: ['Gravity Physics'],
        controls: ['Touch swipe'],
        requirements: { ram: '4GB', min_android: 'Android 10' },
        developer: 'Karsh Tech Test Lab',
      });
      assert(created.id === crudGameId || created.id.startsWith('game_'), 'Game created with valid ID');
      assert(created.title === 'Test Orbit Odyssey', 'Title matches');
      assert(Array.isArray(created.genre) && created.genre.includes('Sci-Fi'), 'Genre array preserved');
    });

    await run(3, 'Games', 'Lookup Game by ID and Slug', async () => {
      const bySlug = await provider.getGameBySlug(crudGameSlug);
      assert(bySlug !== undefined, 'Game not found by slug');
      const byId = await provider.getGameById(bySlug!.id);
      assert(byId !== undefined && byId.slug === crudGameSlug, 'Game not found by ID');
    });

    await run(4, 'Games', 'Update Game modifies fields and preserves immutable properties', async () => {
      const game = await provider.getGameBySlug(crudGameSlug);
      assert(game !== undefined, 'Game must exist');
      const originalCreatedAt = game!.created_at;

      const updated = await provider.updateGame(game!.id, {
        title: 'Test Orbit Odyssey (Remastered)',
        description: 'Updated description for CRUD test',
        status: 'Updated',
      });

      assert(updated !== null, 'Update returned null');
      assert(updated!.title === 'Test Orbit Odyssey (Remastered)', 'Title was updated');
      assert(updated!.status === 'Updated', 'Status was updated');
      assert(updated!.created_at === originalCreatedAt, 'created_at remained immutable');
    });

    await run(5, 'Games', 'Delete Game removes record and returns true', async () => {
      const game = await provider.getGameBySlug(crudGameSlug);
      assert(game !== undefined, 'Game must exist before delete');
      const deleted = await provider.deleteGame(game!.id);
      assert(deleted === true, 'deleteGame returned true');
      const check = await provider.getGameById(game!.id);
      assert(check === undefined, 'Game still exists after deletion');
    });

    // ------------------------------------------------------------------------
    // RELEASES CRUD
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Releases Operations Testing ---');
    let testRelId: string = '';

    await run(6, 'Releases', 'Create Release attached to baseline game', async () => {
      const created = await provider.createRelease({
        game_id: TEST_FIXTURES.game.id,
        version_name: '2.0.0-crud-test',
        version_code: 200,
        release_date: '2026-11-01',
        release_notes: 'CRUD release notes',
        apk_filename: 'test-crud-v2.0.0.apk',
        original_filename: 'test-crud.apk',
        apk_file_size: 2048576,
        apk_download_url: '/api/releases/download/crud-test',
        min_sdk: 26,
        target_sdk: 35,
        is_published: true,
      });
      assert(created.id.length > 0, 'Release created with ID');
      assert(created.download_count === 0, 'Initial download_count is 0');
      testRelId = created.id;
    });

    await run(7, 'Releases', 'Lookup Release by ID and Game ID', async () => {
      const rel = await provider.getReleaseById(testRelId);
      assert(rel !== undefined && rel.version_name === '2.0.0-crud-test', 'Release retrieved by ID');
      const gameReleases = await provider.getReleasesByGameId(TEST_FIXTURES.game.id);
      assert(gameReleases.some(r => r.id === testRelId), 'Release listed under game ID');
    });

    await run(8, 'Releases', 'Latest Release queries respects published filter', async () => {
      const latest = await provider.getLatestReleaseByGameId(TEST_FIXTURES.game.id, true);
      assert(latest !== undefined, 'Latest published release found');
      assert(latest!.version_code === 200, 'Latest release has highest version code');
    });

    await run(9, 'Releases', 'Update Release modifies metadata', async () => {
      const updated = await provider.updateRelease(testRelId, {
        release_notes: 'Updated release notes for testing',
        is_published: false,
      });
      assert(updated !== null, 'updateRelease returned null');
      assert(updated!.is_published === false, 'is_published updated to false');

      // Verify that getLatestReleaseByGameId(..., true) now falls back to published release
      const latestPublished = await provider.getLatestReleaseByGameId(TEST_FIXTURES.game.id, true);
      assert(latestPublished !== undefined && latestPublished!.id === TEST_FIXTURES.release.id, 'Fell back to baseline published release');
    });

    await run(10, 'Releases', 'Delete Release removes record', async () => {
      const deleted = await provider.deleteRelease(testRelId);
      assert(deleted === true, 'deleteRelease returned true');
      const check = await provider.getReleaseById(testRelId);
      assert(check === undefined, 'Release still found after deletion');
    });

    // ------------------------------------------------------------------------
    // PRODUCTS CRUD
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Products Operations Testing ---');
    let testProdId: string = '';
    const testProdSlug = 'test-prod-crud-analytics';

    await run(11, 'Products', 'Create Product in Draft status', async () => {
      // Clean leftover if any
      const existing = await provider.getProductBySlug(testProdSlug, true);
      if (existing) await provider.deleteProduct(existing.id);

      const created = await provider.createProduct({
        name: 'Test Analytics Platform',
        slug: testProdSlug,
        short_description: 'Synthetic analytics tool',
        description: 'Comprehensive analytics tool for testing',
        category: 'Web Applications',
        platform: 'Web',
        status: 'Draft',
        featured: false,
        technologies: ['React', 'Node.js'],
        cover_image: 'https://mock-storage.local/product-assets/analytics.jpg',
        gallery: [],
        display_order: 50,
      });

      assert(created.id.length > 0, 'Product created with ID');
      assert(created.status === 'Draft', 'Status is Draft');
      assert(created.published_at === null || created.published_at === undefined, 'Draft product has null published_at');
      testProdId = created.id;
    });

    await run(12, 'Products', 'Draft filtering in getProducts and getProductBySlug', async () => {
      // Should not appear in public query without includeDrafts
      const publicProducts = await provider.getProducts(false);
      assert(!publicProducts.some(p => p.id === testProdId), 'Draft product must NOT appear when includeDrafts=false');

      const adminProducts = await provider.getProducts(true);
      assert(adminProducts.some(p => p.id === testProdId), 'Draft product MUST appear when includeDrafts=true');

      const bySlugPublic = await provider.getProductBySlug(testProdSlug, false);
      assert(bySlugPublic === undefined, 'Draft product must not be retrieved by slug when includeDrafts=false');

      const bySlugAdmin = await provider.getProductBySlug(testProdSlug, true);
      assert(bySlugAdmin !== undefined && bySlugAdmin.id === testProdId, 'Draft product retrieved when includeDrafts=true');
    });

    await run(13, 'Products', 'Update Product status to Published sets published_at timestamp', async () => {
      const updated = await provider.updateProduct(testProdId, {
        status: 'Published',
        featured: true,
      });

      assert(updated !== null, 'updateProduct returned null');
      assert(updated!.status === 'Published', 'Status updated to Published');
      assert(updated!.published_at !== null && updated!.published_at !== undefined, 'published_at timestamp was automatically populated');

      // Now it appears in public list
      const publicProducts = await provider.getProducts(false);
      assert(publicProducts.some(p => p.id === testProdId), 'Published product now appears in public list');
    });

    await run(14, 'Products', 'Delete Product removes record', async () => {
      const deleted = await provider.deleteProduct(testProdId);
      assert(deleted === true, 'deleteProduct returned true');
      const check = await provider.getProductById(testProdId);
      assert(check === undefined, 'Product still exists after deletion');
    });

    // ------------------------------------------------------------------------
    // USERS CRUD
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Users Operations Testing ---');
    const crudUsername = 'test_crud_admin_user';
    let testUserId: string = '';

    await run(15, 'Users', 'Create User creates admin account', async () => {
      const client = await testPool.connect();
      try {
        await client.query('DELETE FROM users WHERE username = $1;', [crudUsername]);
      } finally {
        client.release();
      }

      const created = await provider.createUser({
        username: crudUsername,
        password_hash: '$2b$10$temporaryhashforcrudtestingonly0000000000000000000000000',
        role: 'admin',
      });

      assert(created.id.length > 0, 'User created with ID');
      assert(created.username === crudUsername, 'Username matches');
      assert(created.role === 'admin', 'Role matches admin');
      testUserId = created.id;
    });

    await run(16, 'Users', 'Lookup User by ID and Case-Insensitive Username', async () => {
      const byId = await provider.getUserById(testUserId);
      assert(byId !== undefined, 'User retrieved by ID');

      // Exact match
      const exact = await provider.getUserByUsername(crudUsername);
      assert(exact !== undefined && exact.id === testUserId, 'User retrieved by exact username');

      // UPPERCASE match
      const upper = await provider.getUserByUsername(crudUsername.toUpperCase());
      assert(upper !== undefined && upper.id === testUserId, 'User retrieved by UPPERCASE username');

      // MixedCase match
      const mixed = await provider.getUserByUsername('TeSt_CrUd_AdMiN_uSeR');
      assert(mixed !== undefined && mixed.id === testUserId, 'User retrieved by MixedCase username');
    });

    await run(17, 'Users', 'Update User Password and Username', async () => {
      const newHash = '$2b$10$updatedhashforcrudtestingonly11111111111111111111111111';
      const passUpdated = await provider.updateUserPassword(testUserId, newHash);
      assert(passUpdated === true, 'updateUserPassword returned true');

      const verifyPass = await provider.getUserById(testUserId);
      assert(verifyPass!.password_hash === newHash, 'Password hash was updated');

      const newUsername = 'test_crud_renamed_user';
      const userUpdated = await provider.updateUserUsername(testUserId, newUsername);
      assert(userUpdated === true, 'updateUserUsername returned true');

      const verifyName = await provider.getUserById(testUserId);
      assert(verifyName!.username === newUsername, 'Username was updated');

      // Clean up test user
      const client = await testPool.connect();
      try {
        await client.query('DELETE FROM users WHERE id = $1;', [testUserId]);
      } finally {
        client.release();
      }
    });

    // ------------------------------------------------------------------------
    // STUDIO SETTINGS
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Studio Settings Testing ---');

    await run(18, 'Settings', 'Retrieve and Update Studio Settings', async () => {
      const settings = await provider.getSettings();
      assert(settings.studio_name === 'Karsh Tech Test Studio', 'Initial studio name matches fixture');

      const updated = await provider.updateSettings({
        announcement: 'Phase 4.3.2 Integration Testing Active',
        tagline: 'Precision Engineered for High Assurance',
      });

      assert(updated.announcement === 'Phase 4.3.2 Integration Testing Active', 'Announcement updated');
      assert(updated.tagline === 'Precision Engineered for High Assurance', 'Tagline updated');

      // Restore baseline
      await provider.updateSettings({
        announcement: TEST_FIXTURES.settings.announcement,
        tagline: TEST_FIXTURES.settings.tagline,
      });
    });

    // ------------------------------------------------------------------------
    // CONSTRAINTS & ERROR HANDLING
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Constraints & Error Handling Testing ---');

    await run(19, 'Constraints', 'Duplicate Primary Key is rejected', async () => {
      let threw = false;
      const client = await testPool.connect();
      try {
        await client.query(`
          INSERT INTO games (id, title, slug)
          VALUES ($1, 'Duplicate ID Game', 'duplicate-id-game');
        `, [TEST_FIXTURES.game.id]);
      } catch (err: any) {
        if (err.code === '23505') threw = true;
      } finally {
        client.release();
      }
      assert(threw, 'PostgreSQL rejected duplicate primary key with 23505');
    });

    await run(20, 'Constraints', 'Duplicate Unique Slug is rejected', async () => {
      let threw = false;
      const client = await testPool.connect();
      try {
        await client.query(`
          INSERT INTO games (id, title, slug)
          VALUES ('some-new-id', 'Duplicate Slug Game', $1);
        `, [TEST_FIXTURES.game.slug]);
      } catch (err: any) {
        if (err.code === '23505') threw = true;
      } finally {
        client.release();
      }
      assert(threw, 'PostgreSQL rejected duplicate slug with 23505');
    });

    await run(21, 'Constraints', 'Check Constraint violation is rejected', async () => {
      let threw = false;
      const client = await testPool.connect();
      try {
        await client.query(`
          INSERT INTO products (id, name, slug, category, status)
          VALUES ('invalid-cat-prod', 'Bad Category', 'bad-cat-slug', 'NonExistentCategory', 'Published');
        `);
      } catch (err: any) {
        if (err.code === '23514') threw = true;
      } finally {
        client.release();
      }
      assert(threw, 'PostgreSQL rejected invalid check constraint with 23514');
    });

    await run(22, 'Constraints', 'Foreign Key cascade delete cleans child releases', async () => {
      // 1. Create temporary parent game
      const cascadeGameId = 'test_cascade_parent_game';
      const cascadeRelId = 'test_cascade_child_rel';
      const client = await testPool.connect();
      try {
        await client.query(`
          INSERT INTO games (id, title, slug) VALUES ($1, 'Cascade Parent', 'cascade-parent')
          ON CONFLICT (id) DO NOTHING;
        `, [cascadeGameId]);

        await client.query(`
          INSERT INTO releases (id, game_id, version_name, apk_filename)
          VALUES ($1, $2, '1.0.0', 'cascade.apk')
          ON CONFLICT (id) DO NOTHING;
        `, [cascadeRelId, cascadeGameId]);

        // Verify child exists
        const childBefore = await client.query('SELECT id FROM releases WHERE id = $1;', [cascadeRelId]);
        assert(childBefore.rows.length === 1, 'Child release created');

        // Delete parent game
        await client.query('DELETE FROM games WHERE id = $1;', [cascadeGameId]);

        // Verify child was cascade-deleted
        const childAfter = await client.query('SELECT id FROM releases WHERE id = $1;', [cascadeRelId]);
        assert(childAfter.rows.length === 0, 'Child release was automatically cascade-deleted');
      } finally {
        client.release();
      }
    });

    // ------------------------------------------------------------------------
    // BASELINE FIXTURE INTEGRITY
    // ------------------------------------------------------------------------
    console.log('\n--- 8. Baseline Fixture Preservation ---');
    await run(23, 'Integrity', 'Baseline synthetic fixtures remain intact', async () => {
      const game = await provider.getGameById(TEST_FIXTURES.game.id);
      assert(game !== undefined && game.slug === TEST_FIXTURES.game.slug, 'Baseline game intact');

      const rel = await provider.getReleaseById(TEST_FIXTURES.release.id);
      assert(rel !== undefined && rel.apk_filename === TEST_FIXTURES.release.apk_filename, 'Baseline release intact');

      const prod = await provider.getProductById(TEST_FIXTURES.product.id);
      assert(prod !== undefined && prod.slug === TEST_FIXTURES.product.slug, 'Baseline product intact');

      const user = await provider.getUserById(TEST_FIXTURES.user.id);
      assert(user !== undefined && user.username === TEST_FIXTURES.user.username, 'Baseline user intact');

      const settings = await provider.getSettings();
      assert(settings.studio_name === TEST_FIXTURES.settings.studio_name, 'Baseline settings intact');
    });

  } finally {
    await provider.close();
    await testPool.end();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`POSTGRES CRUD SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in PostgreSQL CRUD Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_postgres_crud.ts')) {
  runPostgresCrudTests().catch(err => {
    console.error('[FATAL ERROR IN CRUD SUITE]', err);
    process.exit(1);
  });
}
