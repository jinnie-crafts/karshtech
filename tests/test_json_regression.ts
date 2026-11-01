import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { JsonDatabaseProvider } from '../server/database/JsonDatabaseProvider.js';

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

export async function runJsonRegressionTests(): Promise<TestReport[]> {
  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.2 JSON PROVIDER REGRESSION TESTS');
  console.log('================================================================\n');

  // Verify authoritative server/data/db.json initial hash
  const authoritativeDbPath = path.resolve(process.cwd(), 'server/data/db.json');
  const initialHash = crypto.createHash('sha256').update(fs.readFileSync(authoritativeDbPath)).digest('hex');

  const tempDir = path.resolve(process.cwd(), 'tests/scratch_json_test');
  const tempDbFile = path.join(tempDir, 'data', 'temp_db.json');
  const tempBackupsDir = path.join(tempDir, 'backups');

  // Clean scratch directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(tempDir, 'data'), { recursive: true });
  fs.mkdirSync(tempBackupsDir, { recursive: true });

  const provider = new JsonDatabaseProvider(tempDbFile, tempBackupsDir);

  try {
    // ------------------------------------------------------------------------
    // INITIALIZATION & METADATA
    // ------------------------------------------------------------------------
    console.log('--- 1. Provider Initialization & Storage Info ---');

    await run(1, 'JsonInit', 'Initialize in isolated temporary directory', async () => {
      await provider.init();
      assert(provider.getProviderName() === 'json', 'Provider name is json');
      const info = await provider.getStorageInfo();
      assert(info.dbFile === tempDbFile, 'Custom dbFile respected');
      assert(info.backupsDir === tempBackupsDir, 'Custom backupsDir respected');
    });

    // ------------------------------------------------------------------------
    // CRUD OPERATIONS
    // ------------------------------------------------------------------------
    console.log('\n--- 2. JSON CRUD Operations ---');

    let createdGameId = '';
    await run(2, 'JsonCRUD', 'Create and Retrieve Game', async () => {
      const game = await provider.createGame({
        title: 'JSON Space Quest',
        slug: 'json-space-quest',
        tagline: 'Test JSON game',
        description: 'Testing JSON engine',
        genre: ['Adventure'],
        platforms: ['Android'],
        status: 'Available',
        featured: true,
        cover_image: '/images/json.jpg',
        screenshots: [],
        features: ['Offline'],
        controls: ['Tap'],
        requirements: {},
        developer: 'JSON Dev',
      });
      assert(game.id.length > 0, 'Game created');
      createdGameId = game.id;

      const retrieved = await provider.getGameById(game.id);
      assert(retrieved !== undefined && retrieved.slug === 'json-space-quest', 'Retrieved by ID');
      const bySlug = await provider.getGameBySlug('json-space-quest');
      assert(bySlug !== undefined && bySlug.id === game.id, 'Retrieved by slug');
    });

    await run(3, 'JsonCRUD', 'Create and Increment Release Download', async () => {
      const rel = await provider.createRelease({
        game_id: createdGameId,
        version_name: '1.0.0-json',
        version_code: 1,
        release_date: '2026-11-01',
        release_notes: 'Initial release',
        apk_filename: 'json.apk',
        apk_file_size: 1024,
        apk_download_url: '/api/releases/json/download',
        min_sdk: 26,
        target_sdk: 35,
        is_published: true,
      });

      assert(rel.download_count === 0, 'Initial count is 0');
      const newCount = await provider.incrementDownload(rel.id);
      assert(newCount === 1, `Count incremented to 1 (got ${newCount})`);
    });

    await run(4, 'JsonCRUD', 'Create, Update and Filter Products', async () => {
      const prod = await provider.createProduct({
        name: 'JSON Product',
        slug: 'json-product',
        short_description: 'Short',
        description: 'Long description',
        category: 'Web Applications',
        platform: 'Web',
        status: 'Draft',
        featured: false,
        technologies: ['TypeScript'],
        cover_image: '',
        gallery: [],
        display_order: 1,
      });

      assert(prod.status === 'Draft', 'Status is Draft');
      const drafts = await provider.getProducts(true);
      assert(drafts.some(p => p.id === prod.id), 'Draft product listed with includeDrafts=true');

      const updated = await provider.updateProduct(prod.id, { status: 'Published' });
      assert(updated!.status === 'Published', 'Updated to Published');
      assert(updated!.published_at !== null && updated!.published_at !== undefined, 'published_at set');
    });

    await run(5, 'JsonCRUD', 'Create User and Verify Case-Insensitive Lookup', async () => {
      const user = await provider.createUser({
        username: 'JsonTestAdmin',
        password_hash: 'mockhash123',
        role: 'admin',
      });

      const exact = await provider.getUserByUsername('JsonTestAdmin');
      assert(exact !== undefined && exact.id === user.id, 'Exact match');
      const lower = await provider.getUserByUsername('jsontestadmin');
      assert(lower !== undefined && lower.id === user.id, 'Lowercase match');
      const upper = await provider.getUserByUsername('JSONTESTADMIN');
      assert(upper !== undefined && upper.id === user.id, 'Uppercase match');
    });

    // ------------------------------------------------------------------------
    // ATOMIC PERSISTENCE & BACKUP
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Atomic File Writes & Backup Creation ---');

    await run(6, 'Persistence', 'save() atomically persists data to temp_db.json', async () => {
      provider.save();
      assert(fs.existsSync(tempDbFile), 'File exists on disk');
      const raw = fs.readFileSync(tempDbFile, 'utf-8');
      const parsed = JSON.parse(raw);
      assert(parsed.games.length === 1, 'File content contains 1 game');
      assert(parsed.games[0].id === createdGameId, 'Game ID matches');
    });

    let backupFilePath: string | null = null;
    await run(7, 'Backup', 'createBackup() generates valid snapshot in custom backups directory', async () => {
      backupFilePath = provider.createBackup('test_tag');
      assert(backupFilePath !== null && fs.existsSync(backupFilePath), 'Backup file was created');
      const backupContent = fs.readFileSync(backupFilePath!, 'utf-8');
      const parsedBackup = JSON.parse(backupContent);
      assert(parsedBackup.games.length === 1, 'Backup contains valid game records');
    });

    // ------------------------------------------------------------------------
    // CORRUPTION RECOVERY
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Corruption Recovery from Backup ---');

    await run(8, 'Recovery', 'Recovers valid database state from backup when temp_db.json is corrupted', async () => {
      // Corrupt temp_db.json intentionally with malformed JSON
      fs.writeFileSync(tempDbFile, '{{{corrupted invalid json content!###', 'utf-8');

      // Create new provider pointing to the same corrupted file
      const recoveryProvider = new JsonDatabaseProvider(tempDbFile, tempBackupsDir);
      await recoveryProvider.init();

      const recoveredGames = await recoveryProvider.getGames();
      assert(recoveredGames.length === 1, 'Recovery provider restored 1 game from backup');
      assert(recoveredGames[0].id === createdGameId, 'Recovered game ID matches');

      await recoveryProvider.close();
    });

    // ------------------------------------------------------------------------
    // AUTHORITATIVE DB.JSON INTEGRITY CHECK
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Authoritative Production db.json Integrity ---');

    await run(9, 'Safety', 'server/data/db.json was NOT modified during JSON provider tests', async () => {
      const finalHash = crypto.createHash('sha256').update(fs.readFileSync(authoritativeDbPath)).digest('hex');
      assert(finalHash === initialHash, `Authoritative db.json was modified! Initial: ${initialHash}, Final: ${finalHash}`);
    });

  } finally {
    await provider.close();

    // Clean scratch directory
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`JSON REGRESSION SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in JSON Regression Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_json_regression.ts')) {
  runJsonRegressionTests().catch(err => {
    console.error('[FATAL ERROR IN JSON REGRESSION SUITE]', err);
    process.exit(1);
  });
}
