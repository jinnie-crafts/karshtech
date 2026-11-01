import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { assertTestDatabaseIsolation, validateTestDatabaseUrl } from './testDatabaseGuard.js';
import { TEST_FIXTURES } from './testFixtures.js';
import { MockStorageService } from './MockStorageService.js';

const { Pool } = pg;

export interface TestHarnessOptions {
  testDatabaseUrl?: string;
  allowWrites?: boolean;
}

export class TestHarness {
  private pool: pg.Pool | null = null;
  private mockStorage: MockStorageService | null = null;
  private testDbUrl: string;

  constructor(options?: TestHarnessOptions) {
    this.testDbUrl = options?.testDatabaseUrl || process.env.TEST_DATABASE_URL || '';
  }

  public getMockStorage(): MockStorageService {
    if (!this.mockStorage) {
      this.mockStorage = new MockStorageService();
    }
    return this.mockStorage;
  }

  public async getTestDatabasePool(): Promise<pg.Pool> {
    if (this.pool) return this.pool;

    if (!this.testDbUrl) {
      throw new Error(
        '[TestHarness FATAL] TEST_DATABASE_URL is not set. A dedicated isolated test database is required.'
      );
    }

    // Fail-closed guard: ensure URL does not target production
    const prodUrl = process.env.DATABASE_URL;
    const valResult = validateTestDatabaseUrl(this.testDbUrl, prodUrl);
    if (!valResult.allowed) {
      throw new Error(valResult.reason);
    }

    const isLocalhost =
      this.testDbUrl.includes('localhost') ||
      this.testDbUrl.includes('127.0.0.1') ||
      this.testDbUrl.includes('::1');

    this.pool = new Pool({
      connectionString: this.testDbUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 5000,
    });

    // Runtime guard: verify connected database identity
    await assertTestDatabaseIsolation(this.pool, {
      candidateUrl: this.testDbUrl,
      productionUrl: prodUrl,
    });

    return this.pool;
  }

  public async applySchema(): Promise<void> {
    const pool = await this.getTestDatabasePool();
    const migration001Path = path.resolve(process.cwd(), 'supabase/migrations/001_initial_schema.sql');
    const migration002Path = path.resolve(process.cwd(), 'supabase/migrations/002_grant_permissions.sql');
    if (!fs.existsSync(migration001Path)) {
      throw new Error(`[TestHarness] Migration 001 not found at: ${migration001Path}`);
    }

    const sql001 = fs.readFileSync(migration001Path, 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');
      await client.query(sql001);

      // Create test-only environment marker table (Section 5)
      await client.query(`
        CREATE TABLE IF NOT EXISTS _test_environment_marker (
          id TEXT PRIMARY KEY DEFAULT 'isolated_test_marker',
          environment TEXT NOT NULL DEFAULT 'karsh-tech-local-docker-test',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        INSERT INTO _test_environment_marker (id, environment)
        VALUES ('isolated_test_marker', 'karsh-tech-local-docker-test')
        ON CONFLICT (id) DO UPDATE SET environment = 'karsh-tech-local-docker-test';
      `);

      // Adapt test-only dummy Supabase & system roles to satisfy 002_grant_permissions.sql without editing production SQL
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
            CREATE ROLE postgres NOLOGIN;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role NOLOGIN;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            CREATE ROLE anon NOLOGIN;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated NOLOGIN;
          END IF;
        END $$;
      `);

      if (fs.existsSync(migration002Path)) {
        const sql002 = fs.readFileSync(migration002Path, 'utf8');
        await client.query(sql002);
      }

      await client.query('COMMIT;');
      console.log('[TestHarness] Test schema (001 + 002) and isolation marker applied successfully.');
    } catch (err: any) {
      await client.query('ROLLBACK;');
      throw new Error(`[TestHarness FATAL] Failed to apply test schema: ${err.message}`);
    } finally {
      client.release();
    }
  }

  public async seedFixtures(): Promise<void> {
    const pool = await this.getTestDatabasePool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      // 1. Settings
      await client.query(`
        INSERT INTO studio_settings (id, studio_name, tagline, contact_email, announcement, updated_at, initial_seeded)
        VALUES (1, $1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          studio_name = EXCLUDED.studio_name,
          tagline = EXCLUDED.tagline,
          contact_email = EXCLUDED.contact_email,
          announcement = EXCLUDED.announcement,
          updated_at = EXCLUDED.updated_at,
          initial_seeded = EXCLUDED.initial_seeded;
      `, [
        TEST_FIXTURES.settings.studio_name,
        TEST_FIXTURES.settings.tagline,
        TEST_FIXTURES.settings.contact_email,
        TEST_FIXTURES.settings.announcement,
        TEST_FIXTURES.settings.updated_at,
        TEST_FIXTURES.settings.initial_seeded,
      ]);

      // 2. User
      await client.query(`
        INSERT INTO users (id, username, password_hash, role, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role;
      `, [
        TEST_FIXTURES.user.id,
        TEST_FIXTURES.user.username,
        TEST_FIXTURES.user.password_hash,
        TEST_FIXTURES.user.role,
        TEST_FIXTURES.user.created_at,
      ]);

      // 3. Game
      await client.query(`
        INSERT INTO games (id, title, slug, tagline, description, genre, platforms, status, featured, cover_image, banner_image, screenshots, trailer_url, features, controls, requirements, developer, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          slug = EXCLUDED.slug,
          tagline = EXCLUDED.tagline,
          description = EXCLUDED.description,
          genre = EXCLUDED.genre,
          platforms = EXCLUDED.platforms,
          status = EXCLUDED.status,
          featured = EXCLUDED.featured,
          cover_image = EXCLUDED.cover_image,
          banner_image = EXCLUDED.banner_image,
          screenshots = EXCLUDED.screenshots,
          trailer_url = EXCLUDED.trailer_url,
          features = EXCLUDED.features,
          controls = EXCLUDED.controls,
          requirements = EXCLUDED.requirements,
          developer = EXCLUDED.developer,
          updated_at = EXCLUDED.updated_at;
      `, [
        TEST_FIXTURES.game.id,
        TEST_FIXTURES.game.title,
        TEST_FIXTURES.game.slug,
        TEST_FIXTURES.game.tagline,
        TEST_FIXTURES.game.description,
        TEST_FIXTURES.game.genre,
        TEST_FIXTURES.game.platforms,
        TEST_FIXTURES.game.status,
        TEST_FIXTURES.game.featured,
        TEST_FIXTURES.game.cover_image,
        TEST_FIXTURES.game.banner_image,
        TEST_FIXTURES.game.screenshots,
        TEST_FIXTURES.game.trailer_url,
        TEST_FIXTURES.game.features,
        TEST_FIXTURES.game.controls,
        JSON.stringify(TEST_FIXTURES.game.requirements),
        TEST_FIXTURES.game.developer,
        TEST_FIXTURES.game.created_at,
        TEST_FIXTURES.game.updated_at,
      ]);

      // 4. Release
      await client.query(`
        INSERT INTO releases (id, game_id, version_name, version_code, release_date, release_notes, apk_filename, apk_file_size, apk_download_url, min_sdk, target_sdk, is_published, download_count, created_at, original_filename)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          game_id = EXCLUDED.game_id,
          version_name = EXCLUDED.version_name,
          version_code = EXCLUDED.version_code,
          release_date = EXCLUDED.release_date,
          release_notes = EXCLUDED.release_notes,
          apk_filename = EXCLUDED.apk_filename,
          apk_file_size = EXCLUDED.apk_file_size,
          apk_download_url = EXCLUDED.apk_download_url,
          min_sdk = EXCLUDED.min_sdk,
          target_sdk = EXCLUDED.target_sdk,
          is_published = EXCLUDED.is_published,
          download_count = EXCLUDED.download_count,
          original_filename = EXCLUDED.original_filename;
      `, [
        TEST_FIXTURES.release.id,
        TEST_FIXTURES.release.game_id,
        TEST_FIXTURES.release.version_name,
        TEST_FIXTURES.release.version_code,
        TEST_FIXTURES.release.release_date,
        TEST_FIXTURES.release.release_notes,
        TEST_FIXTURES.release.apk_filename,
        TEST_FIXTURES.release.apk_file_size,
        TEST_FIXTURES.release.apk_download_url,
        TEST_FIXTURES.release.min_sdk,
        TEST_FIXTURES.release.target_sdk,
        TEST_FIXTURES.release.is_published,
        TEST_FIXTURES.release.download_count,
        TEST_FIXTURES.release.created_at,
        TEST_FIXTURES.release.original_filename,
      ]);

      // 5. Product
      await client.query(`
        INSERT INTO products (id, name, slug, short_description, description, category, cover_image, gallery, technologies, project_url, github_url, play_store_url, apk_download_url, platform, status, featured, display_order, created_at, updated_at, published_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          slug = EXCLUDED.slug,
          short_description = EXCLUDED.short_description,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          cover_image = EXCLUDED.cover_image,
          gallery = EXCLUDED.gallery,
          technologies = EXCLUDED.technologies,
          project_url = EXCLUDED.project_url,
          github_url = EXCLUDED.github_url,
          play_store_url = EXCLUDED.play_store_url,
          apk_download_url = EXCLUDED.apk_download_url,
          platform = EXCLUDED.platform,
          status = EXCLUDED.status,
          featured = EXCLUDED.featured,
          display_order = EXCLUDED.display_order,
          updated_at = EXCLUDED.updated_at,
          published_at = EXCLUDED.published_at;
      `, [
        TEST_FIXTURES.product.id,
        TEST_FIXTURES.product.name,
        TEST_FIXTURES.product.slug,
        TEST_FIXTURES.product.short_description,
        TEST_FIXTURES.product.description,
        TEST_FIXTURES.product.category,
        TEST_FIXTURES.product.cover_image,
        TEST_FIXTURES.product.gallery,
        TEST_FIXTURES.product.technologies,
        TEST_FIXTURES.product.project_url,
        TEST_FIXTURES.product.github_url,
        TEST_FIXTURES.product.play_store_url,
        TEST_FIXTURES.product.apk_download_url,
        TEST_FIXTURES.product.platform,
        TEST_FIXTURES.product.status,
        TEST_FIXTURES.product.featured,
        TEST_FIXTURES.product.display_order,
        TEST_FIXTURES.product.created_at,
        TEST_FIXTURES.product.updated_at,
        TEST_FIXTURES.product.published_at,
      ]);

      await client.query('COMMIT;');
      console.log('[TestHarness] Test fixtures seeded into isolated test database.');
    } catch (err: any) {
      await client.query('ROLLBACK;');
      throw new Error(`[TestHarness FATAL] Failed to seed test fixtures: ${err.message}`);
    } finally {
      client.release();
    }
  }

  public async cleanDatabase(): Promise<void> {
    const pool = await this.getTestDatabasePool();
    const client = await pool.connect();
    try {
      await client.query(`
        TRUNCATE TABLE releases, games, products, users CASCADE;
      `);
      console.log('[TestHarness] Isolated test database cleaned successfully.');
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.mockStorage) {
      this.mockStorage.reset();
      this.mockStorage = null;
    }
  }
}
