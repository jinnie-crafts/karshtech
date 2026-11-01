import pg from 'pg';
import bcrypt from 'bcryptjs';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { validateTestDatabaseUrl, assertTestDatabaseIsolation } from '../server/testing/testDatabaseGuard.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
  } catch (err) {
    console.error('[FATAL] Failed to load .env.test:', err.message);
    process.exit(1);
  }
}

const { Client } = pg;

function assert(condition, message) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

async function verifyMigratedTestDatabase() {
  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.1 POST-MIGRATION VERIFICATION SUITE');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL;
  const prodUrl = process.env.DATABASE_URL;

  // 1. Guard Validation
  console.log('--- 1. Guard Pre-Check ---');
  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard allowed candidate URL (${guard.databaseHost}:${guard.databasePort}/${guard.databaseName})`);

  const client = new Client({
    connectionString: testDbUrl,
    ssl: false,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await assertTestDatabaseIsolation(client, {
      candidateUrl: testDbUrl,
      productionUrl: prodUrl,
      strictDockerMode: true,
      requireMarker: true,
    });
    console.log('  [PASS] assertTestDatabaseIsolation confirmed valid isolated session and marker.\n');

    // 2. Expected Tables Verification
    console.log('--- 2. Schema Tables Verification ---');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    const tables = new Set(tablesRes.rows.map(r => r.table_name));
    assert(tables.has('users'), 'Table "users" exists');
    assert(tables.has('games'), 'Table "games" exists');
    assert(tables.has('releases'), 'Table "releases" exists');
    assert(tables.has('products'), 'Table "products" exists');
    assert(tables.has('studio_settings'), 'Table "studio_settings" exists');
    assert(tables.has('_test_environment_marker'), 'Table "_test_environment_marker" exists');
    console.log(`  Total tables in public schema: ${tables.size}\n`);

    // 3. Indexes & Constraints Verification
    console.log('--- 3. Indexes & Constraints Verification ---');
    const indexesRes = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY indexname;
    `);
    const indexes = new Set(indexesRes.rows.map(r => r.indexname));
    assert(indexes.has('idx_users_username_lower'), 'Index idx_users_username_lower exists');
    assert(indexes.has('idx_games_slug'), 'Index idx_games_slug exists');
    assert(indexes.has('idx_games_status'), 'Index idx_games_status exists');
    assert(indexes.has('idx_games_featured'), 'Index idx_games_featured exists');
    assert(indexes.has('idx_releases_game_id'), 'Index idx_releases_game_id exists');
    assert(indexes.has('idx_releases_version_code'), 'Index idx_releases_version_code exists');
    assert(indexes.has('idx_releases_game_published'), 'Index idx_releases_game_published exists');
    assert(indexes.has('idx_products_slug'), 'Index idx_products_slug exists');
    assert(indexes.has('idx_products_category'), 'Index idx_products_category exists');
    console.log(`  Total indexes verified: ${indexes.size}\n`);

    // 4. Test Environment Marker Verification
    console.log('--- 4. Test Environment Marker Verification ---');
    const markerRes = await client.query('SELECT * FROM _test_environment_marker;');
    assert(markerRes.rows.length === 1, 'Marker table has exactly 1 record');
    assert(markerRes.rows[0].id === 'isolated_test_marker', 'Marker ID is "isolated_test_marker"');
    assert(markerRes.rows[0].environment === 'karsh-tech-local-docker-test', 'Environment is "karsh-tech-local-docker-test"');
    console.log(`  Marker environment value: ${markerRes.rows[0].environment}\n`);

    // 5. Synthetic Fixtures Existence & Counts
    console.log('--- 5. Synthetic Fixture Verification ---');
    const userRes = await client.query('SELECT * FROM users WHERE id = $1;', [TEST_FIXTURES.user.id]);
    assert(userRes.rows.length === 1, 'Admin user fixture exists');
    assert(userRes.rows[0].username === 'test_admin', 'Username matches "test_admin"');
    assert(userRes.rows[0].role === 'superadmin', 'Role matches "superadmin"');

    const gameRes = await client.query('SELECT * FROM games WHERE id = $1;', [TEST_FIXTURES.game.id]);
    assert(gameRes.rows.length === 1, 'Game fixture exists');
    assert(gameRes.rows[0].slug === 'test-space-odyssey', 'Slug matches "test-space-odyssey"');
    assert(gameRes.rows[0].developer === 'Karsh Tech Test Lab', 'Developer matches synthetic value');

    const relRes = await client.query('SELECT * FROM releases WHERE id = $1;', [TEST_FIXTURES.release.id]);
    assert(relRes.rows.length === 1, 'Release fixture exists');
    assert(relRes.rows[0].apk_filename === 'test-space-odyssey-v1.0.0.apk', 'APK filename matches synthetic fixture');
    assert(parseInt(relRes.rows[0].download_count, 10) === 0, 'Release download_count is initially 0');

    const prodRes = await client.query('SELECT * FROM products WHERE id = $1;', [TEST_FIXTURES.product.id]);
    assert(prodRes.rows.length === 1, 'Product fixture exists');
    assert(prodRes.rows[0].name === 'Test Portfolio Engine', 'Product name matches synthetic fixture');

    const settingsRes = await client.query('SELECT * FROM studio_settings WHERE id = 1;');
    assert(settingsRes.rows.length === 1, 'Studio settings row exists');
    assert(settingsRes.rows[0].studio_name === 'Karsh Tech Test Studio', 'Settings studio_name matches synthetic test fixture');
    console.log();

    // 6. Foreign Key Relationships
    console.log('--- 6. Foreign Key Relationship Verification ---');
    const fkJoin = await client.query(`
      SELECT r.id AS release_id, r.version_name, g.id AS game_id, g.title AS game_title
      FROM releases r
      JOIN games g ON r.game_id = g.id
      WHERE r.id = $1;
    `, [TEST_FIXTURES.release.id]);
    assert(fkJoin.rows.length === 1, 'Release joins cleanly with parent Game record');
    assert(fkJoin.rows[0].game_id === TEST_FIXTURES.game.id, 'Joined game_id matches parent game ID');

    // Attempt invalid FK insert (should fail with 23503)
    let fkViolation = false;
    try {
      await client.query(`
        INSERT INTO releases (id, game_id, version_name, apk_filename)
        VALUES ('invalid-fk-rel', 'nonexistent-game-id', '0.0.1', 'x.apk');
      `);
    } catch (e) {
      if (e.code === '23503') fkViolation = true;
    }
    assert(fkViolation, 'Orphan release insertion triggers PostgreSQL foreign key violation (23503)\n');

    // 7. Administrator Authentication Verification
    console.log('--- 7. Administrator Authentication Verification ---');
    const testAdmin = userRes.rows[0];
    const testAdminPass = process.env.TEST_ADMIN_PASSWORD || '';
    const passwordMatch = bcrypt.compareSync(testAdminPass, testAdmin.password_hash);
    assert(passwordMatch, 'Rotated synthetic admin password matches stored bcrypt hash');
    const wrongPasswordMatch = bcrypt.compareSync('WrongPassword!', testAdmin.password_hash);
    assert(!wrongPasswordMatch, 'Invalid password correctly rejected by bcrypt\n');

    // 8. Zero Production Data Verification
    console.log('--- 8. Absence of Production Identifiers Verification ---');
    const checkProdEmail = await client.query(`SELECT * FROM studio_settings WHERE contact_email = 'karshhtech@gmail.com';`);
    assert(checkProdEmail.rows.length === 0, 'Production email "karshhtech@gmail.com" is NOT in test database');

    const checkProdApk = await client.query(`SELECT * FROM releases WHERE apk_filename = 'arrow-puzzle-release-v1.0.0.apk';`);
    assert(checkProdApk.rows.length === 0, 'Production release "arrow-puzzle-release-v1.0.0.apk" is NOT in test database');

    const checkProdGames = await client.query(`SELECT * FROM games WHERE slug = 'arrow-puzzle';`);
    assert(checkProdGames.rows.length === 0, 'Production game "arrow-puzzle" is NOT in test database\n');

    // 9. Provider Compatibility Verification
    console.log('--- 9. SupabasePostgresProvider Compatibility Verification ---');
    const provider = new SupabasePostgresProvider(testDbUrl);
    await provider.init();
    assert(true, 'SupabasePostgresProvider initialized against test database pool');

    const pGames = await provider.getGames();
    assert(Array.isArray(pGames) && pGames.length === 1, 'provider.getGames() returns array of 1 game');
    assert(pGames[0].slug === 'test-space-odyssey', 'provider.getGames() returns test-space-odyssey');

    const pGame = await provider.getGameBySlug('test-space-odyssey');
    assert(pGame !== null && pGame.id === TEST_FIXTURES.game.id, 'provider.getGameBySlug() successfully retrieves game');

    const pReleases = await provider.getReleases();
    assert(Array.isArray(pReleases) && pReleases.length === 1, 'provider.getReleases() returns 1 release');

    const pGameReleases = await provider.getReleasesByGameId(TEST_FIXTURES.game.id);
    assert(pGameReleases.length === 1, 'provider.getReleasesByGameId() returns matching release');

    const pProducts = await provider.getProducts();
    assert(Array.isArray(pProducts) && pProducts.length === 1, 'provider.getProducts() returns 1 product');

    const pSettings = await provider.getSettings();
    assert(pSettings.studio_name === 'Karsh Tech Test Studio', 'provider.getSettings() returns test studio name');

    const pUser = await provider.getUserByUsername('test_admin');
    assert(pUser !== null && pUser.role === 'superadmin', 'provider.getUserByUsername() retrieves test superadmin user');

    await provider.close();
    console.log('  [PASS] SupabasePostgresProvider closed gracefully.\n');

    console.log('================================================================');
    console.log('[SUCCESS] ALL POST-MIGRATION VERIFICATION CHECKS PASSED (100%)');
    console.log('================================================================');

  } finally {
    await client.end();
  }
}

verifyMigratedTestDatabase().catch(err => {
  console.error('[FATAL ERROR IN VERIFICATION]', err);
  process.exit(1);
});
