import pg from 'pg';
import type { IDatabaseProvider } from './IDatabaseProvider.js';
import type {
  GameRecord,
  ReleaseRecord,
  ProductRecord,
  UserRecord,
  StudioSettings,
  StorageInfo,
} from './types.js';

const { Pool } = pg;

export class SupabasePostgresProvider implements IDatabaseProvider {
  private pool: pg.Pool;
  private initialized = false;

  constructor(connectionString?: string) {
    const connStr = connectionString || process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error('[DB-Postgres FATAL] DATABASE_URL must be defined for SupabasePostgresProvider');
    }

    // Determine SSL requirement: Cloud databases (Supabase) require SSL with rejectUnauthorized: false
    const isLocalhost = connStr.includes('localhost') || connStr.includes('127.0.0.1');
    const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };

    this.pool = new Pool({
      connectionString: connStr,
      ssl: sslConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('[DB-Postgres CRITICAL] Unexpected idle client error:', err.message);
    });
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // 1. Connectivity check
      const pingRes = await this.pool.query('SELECT 1 AS alive;');
      if (!pingRes || pingRes.rows[0]?.alive !== 1) {
        throw new Error('Database ping query failed');
      }

      // 2. Accessibility validation for all 5 required tables
      const tablesRes = await this.pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('users', 'games', 'releases', 'products', 'studio_settings');
      `);

      const foundTables = new Set(tablesRes.rows.map((r: any) => r.table_name));
      const requiredTables = ['users', 'games', 'releases', 'products', 'studio_settings'];
      const missing = requiredTables.filter((t) => !foundTables.has(t));

      if (missing.length > 0) {
        throw new Error(`Missing expected database table(s): ${missing.join(', ')}`);
      }

      this.initialized = true;
      console.log('[DB-Postgres] Supabase PostgreSQL connection pool initialized and verified (5/5 tables online).');
    } catch (err: any) {
      console.error('[DB-Postgres FATAL] Database initialization failed:', err.message);
      throw err;
    }
  }

  public async close(): Promise<void> {
    try {
      await this.pool.end();
      this.initialized = false;
      console.log('[DB-Postgres] PostgreSQL connection pool gracefully closed.');
    } catch (err: any) {
      console.warn('[DB-Postgres] Warning during pool close:', err.message);
    }
  }

  public getProviderName(): string {
    return 'postgres';
  }

  // Row Mappers to ensure TypeScript interface compliance and date serialization parity
  private mapGame(row: any): GameRecord {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      tagline: row.tagline || '',
      description: row.description || '',
      genre: Array.isArray(row.genre) ? row.genre : [],
      platforms: Array.isArray(row.platforms) ? row.platforms : [],
      status: row.status,
      featured: Boolean(row.featured),
      cover_image: row.cover_image || '',
      banner_image: row.banner_image || undefined,
      screenshots: Array.isArray(row.screenshots) ? row.screenshots : [],
      trailer_url: row.trailer_url || undefined,
      features: Array.isArray(row.features) ? row.features : [],
      controls: Array.isArray(row.controls) ? row.controls : [],
      requirements: row.requirements && typeof row.requirements === 'object' ? row.requirements : {},
      developer: row.developer || 'Karsh Tech Studio',
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  private mapRelease(row: any): ReleaseRecord {
    let releaseDateStr = '';
    if (row.release_date instanceof Date) {
      releaseDateStr = row.release_date.toISOString().split('T')[0];
    } else if (typeof row.release_date === 'string') {
      releaseDateStr = row.release_date.split('T')[0];
    }

    return {
      id: row.id,
      game_id: row.game_id,
      version_name: row.version_name,
      version_code: Number(row.version_code) || 1,
      release_date: releaseDateStr,
      release_notes: row.release_notes || '',
      apk_filename: row.apk_filename,
      original_filename: row.original_filename || row.apk_filename,
      apk_file_size: Number(row.apk_file_size) || 0,
      apk_download_url: row.apk_download_url || '',
      min_sdk: Number(row.min_sdk) || 26,
      target_sdk: Number(row.target_sdk) || 35,
      is_published: Boolean(row.is_published),
      download_count: Number(row.download_count) || 0,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private mapProduct(row: any): ProductRecord {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      short_description: row.short_description || '',
      description: row.description || '',
      category: row.category,
      cover_image: row.cover_image || '',
      gallery: Array.isArray(row.gallery) ? row.gallery : [],
      technologies: Array.isArray(row.technologies) ? row.technologies : [],
      project_url: row.project_url || undefined,
      github_url: row.github_url || undefined,
      play_store_url: row.play_store_url || undefined,
      apk_download_url: row.apk_download_url || undefined,
      platform: row.platform,
      status: row.status,
      featured: Boolean(row.featured),
      display_order: Number(row.display_order) || 0,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      published_at: row.published_at ? (row.published_at instanceof Date ? row.published_at.toISOString() : String(row.published_at)) : undefined,
    };
  }

  private mapUser(row: any): UserRecord {
    return {
      id: row.id,
      username: row.username,
      password_hash: row.password_hash,
      role: row.role,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private mapSettings(row: any): StudioSettings {
    return {
      studio_name: row.studio_name,
      tagline: row.tagline,
      contact_email: row.contact_email,
      announcement: row.announcement || undefined,
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      initial_seeded: Boolean(row.initial_seeded),
    };
  }

  public async getStorageInfo(): Promise<StorageInfo> {
    const res = await this.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM games)::int AS games_count,
        (SELECT COUNT(*) FROM releases)::int AS releases_count,
        (SELECT COUNT(*) FROM products)::int AS products_count,
        (SELECT COUNT(*) FROM users)::int AS users_count;
    `);
    const r = res.rows[0] || {};
    return {
      provider: 'postgres',
      gamesCount: r.games_count || 0,
      releasesCount: r.releases_count || 0,
      productsCount: r.products_count || 0,
      usersCount: r.users_count || 0,
    };
  }

  // Games Operations
  public async getGames(): Promise<GameRecord[]> {
    const res = await this.pool.query('SELECT * FROM games ORDER BY created_at DESC;');
    return res.rows.map((r) => this.mapGame(r));
  }

  public async getGameById(id: string): Promise<GameRecord | undefined> {
    const res = await this.pool.query('SELECT * FROM games WHERE id = $1;', [id]);
    if (res.rows.length === 0) return undefined;
    return this.mapGame(res.rows[0]);
  }

  public async getGameBySlug(slug: string): Promise<GameRecord | undefined> {
    const res = await this.pool.query('SELECT * FROM games WHERE LOWER(slug) = LOWER($1);', [slug]);
    if (res.rows.length === 0) return undefined;
    return this.mapGame(res.rows[0]);
  }

  public async createGame(game: Omit<GameRecord, 'id' | 'created_at' | 'updated_at'>): Promise<GameRecord> {
    const id = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const query = `
      INSERT INTO games (
        id, title, slug, tagline, description, genre, platforms,
        status, featured, cover_image, banner_image, screenshots,
        trailer_url, features, controls, requirements, developer,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19
      ) RETURNING *;
    `;
    const values = [
      id,
      game.title,
      game.slug,
      game.tagline || '',
      game.description || '',
      game.genre || [],
      game.platforms || ['Android'],
      game.status || 'Available',
      Boolean(game.featured),
      game.cover_image || '',
      game.banner_image || null,
      game.screenshots || [],
      game.trailer_url || null,
      game.features || [],
      game.controls || [],
      JSON.stringify(game.requirements || {}),
      game.developer || 'Karsh Tech Studio',
      now,
      now,
    ];

    const res = await this.pool.query(query, values);
    return this.mapGame(res.rows[0]);
  }

  public async updateGame(id: string, updates: Partial<Omit<GameRecord, 'id' | 'created_at'>>): Promise<GameRecord | null> {
    const allowedKeys: (keyof Omit<GameRecord, 'id' | 'created_at'>)[] = [
      'title', 'slug', 'tagline', 'description', 'genre', 'platforms',
      'status', 'featured', 'cover_image', 'banner_image', 'screenshots',
      'trailer_url', 'features', 'controls', 'requirements', 'developer',
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const key of allowedKeys) {
      if (key in updates) {
        let val = updates[key];
        if (key === 'requirements') {
          val = JSON.stringify(val || {});
        }
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(val);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return (await this.getGameById(id)) || null;
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE games
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const res = await this.pool.query(query, values);
    if (res.rows.length === 0) return null;
    return this.mapGame(res.rows[0]);
  }

  public async deleteGame(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM games WHERE id = $1;', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // Releases Operations
  public async getReleases(): Promise<ReleaseRecord[]> {
    const res = await this.pool.query('SELECT * FROM releases ORDER BY created_at DESC;');
    return res.rows.map((r) => this.mapRelease(r));
  }

  public async getReleasesByGameId(gameId: string): Promise<ReleaseRecord[]> {
    // Check if gameId matches directly, or if it's a slug
    const directRes = await this.pool.query(
      'SELECT * FROM releases WHERE game_id = $1 ORDER BY version_code DESC;',
      [gameId]
    );
    if (directRes.rows.length > 0) {
      return directRes.rows.map((r) => this.mapRelease(r));
    }

    // Try finding game by slug
    const game = await this.getGameBySlug(gameId);
    if (game) {
      const slugRes = await this.pool.query(
        'SELECT * FROM releases WHERE game_id = $1 ORDER BY version_code DESC;',
        [game.id]
      );
      return slugRes.rows.map((r) => this.mapRelease(r));
    }

    return [];
  }

  public async getLatestReleaseByGameId(gameId: string, onlyPublished = true): Promise<ReleaseRecord | undefined> {
    let targetGameId = gameId;
    const directGame = await this.getGameById(gameId);
    if (!directGame) {
      const slugGame = await this.getGameBySlug(gameId);
      if (slugGame) {
        targetGameId = slugGame.id;
      }
    }

    const query = `
      SELECT * FROM releases
      WHERE game_id = $1
      ${onlyPublished ? 'AND is_published = TRUE' : ''}
      ORDER BY version_code DESC
      LIMIT 1;
    `;
    const res = await this.pool.query(query, [targetGameId]);
    if (res.rows.length === 0) return undefined;
    return this.mapRelease(res.rows[0]);
  }

  public async getReleaseById(id: string): Promise<ReleaseRecord | undefined> {
    const res = await this.pool.query('SELECT * FROM releases WHERE id = $1;', [id]);
    if (res.rows.length === 0) return undefined;
    return this.mapRelease(res.rows[0]);
  }

  public async createRelease(release: Omit<ReleaseRecord, 'id' | 'download_count' | 'created_at'>): Promise<ReleaseRecord> {
    const id = `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const releaseDate = release.release_date || now.split('T')[0];

    const query = `
      INSERT INTO releases (
        id, game_id, version_name, version_code, release_date,
        release_notes, apk_filename, original_filename, apk_file_size,
        apk_download_url, min_sdk, target_sdk, is_published,
        download_count, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        0, $14
      ) RETURNING *;
    `;
    const values = [
      id,
      release.game_id,
      release.version_name,
      Number(release.version_code) || 1,
      releaseDate,
      release.release_notes || '',
      release.apk_filename,
      release.original_filename || release.apk_filename,
      Number(release.apk_file_size) || 0,
      release.apk_download_url || '',
      Number(release.min_sdk) || 26,
      Number(release.target_sdk) || 35,
      Boolean(release.is_published ?? true),
      now,
    ];

    const res = await this.pool.query(query, values);
    return this.mapRelease(res.rows[0]);
  }

  public async updateRelease(id: string, updates: Partial<Omit<ReleaseRecord, 'id' | 'created_at'>>): Promise<ReleaseRecord | null> {
    const allowedKeys: (keyof Omit<ReleaseRecord, 'id' | 'created_at'>)[] = [
      'game_id', 'version_name', 'version_code', 'release_date',
      'release_notes', 'apk_filename', 'original_filename', 'apk_file_size',
      'apk_download_url', 'min_sdk', 'target_sdk', 'is_published', 'download_count',
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const key of allowedKeys) {
      if (key in updates) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push((updates as any)[key]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return (await this.getReleaseById(id)) || null;
    }

    values.push(id);
    const query = `
      UPDATE releases
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const res = await this.pool.query(query, values);
    if (res.rows.length === 0) return null;
    return this.mapRelease(res.rows[0]);
  }

  public async deleteRelease(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM releases WHERE id = $1;', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  public async incrementDownload(id: string): Promise<number> {
    // Atomic SQL increment to avoid read-modify-write race conditions
    const query = `
      UPDATE releases
      SET download_count = download_count + 1
      WHERE id = $1
      RETURNING download_count;
    `;
    const res = await this.pool.query(query, [id]);
    if (res.rows.length === 0) return 0;
    return Number(res.rows[0].download_count);
  }

  // Users Operations
  public async getUsers(): Promise<UserRecord[]> {
    const res = await this.pool.query('SELECT * FROM users ORDER BY created_at ASC;');
    return res.rows.map((r) => this.mapUser(r));
  }

  public async getUserByUsername(username: string): Promise<UserRecord | undefined> {
    const res = await this.pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1);', [username]);
    if (res.rows.length === 0) return undefined;
    return this.mapUser(res.rows[0]);
  }

  public async getUserById(id: string): Promise<UserRecord | undefined> {
    const res = await this.pool.query('SELECT * FROM users WHERE id = $1;', [id]);
    if (res.rows.length === 0) return undefined;
    return this.mapUser(res.rows[0]);
  }

  public async createUser(user: Omit<UserRecord, 'id' | 'created_at'>): Promise<UserRecord> {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const query = `
      INSERT INTO users (id, username, password_hash, role, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const res = await this.pool.query(query, [
      id,
      user.username,
      user.password_hash,
      user.role,
      now,
    ]);
    return this.mapUser(res.rows[0]);
  }

  public async updateUserPassword(id: string, newHash: string): Promise<boolean> {
    const res = await this.pool.query(
      'UPDATE users SET password_hash = $2 WHERE id = $1;',
      [id, newHash]
    );
    return (res.rowCount ?? 0) > 0;
  }

  public async updateUserUsername(id: string, newUsername: string): Promise<boolean> {
    const res = await this.pool.query(
      'UPDATE users SET username = $2 WHERE id = $1;',
      [id, newUsername]
    );
    return (res.rowCount ?? 0) > 0;
  }

  // Products Operations
  public async getProducts(includeDrafts: boolean = false): Promise<ProductRecord[]> {
    const query = includeDrafts
      ? 'SELECT * FROM products ORDER BY created_at DESC, id DESC;'
      : "SELECT * FROM products WHERE status = 'Published' ORDER BY created_at DESC, id DESC;";
    const res = await this.pool.query(query);
    return res.rows.map((r) => this.mapProduct(r));
  }

  public async getProductById(id: string): Promise<ProductRecord | undefined> {
    const res = await this.pool.query('SELECT * FROM products WHERE id = $1;', [id]);
    if (res.rows.length === 0) return undefined;
    return this.mapProduct(res.rows[0]);
  }

  public async getProductBySlug(slug: string, includeDrafts: boolean = false): Promise<ProductRecord | undefined> {
    const query = includeDrafts
      ? 'SELECT * FROM products WHERE LOWER(slug) = LOWER($1) LIMIT 1;'
      : "SELECT * FROM products WHERE LOWER(slug) = LOWER($1) AND status = 'Published' LIMIT 1;";
    const res = await this.pool.query(query, [slug]);
    if (res.rows.length === 0) return undefined;
    return this.mapProduct(res.rows[0]);
  }

  public async createProduct(product: Omit<ProductRecord, 'id' | 'created_at' | 'updated_at'>): Promise<ProductRecord> {
    const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const isPublished = product.status === 'Published';

    const query = `
      INSERT INTO products (
        id, name, slug, short_description, description, category,
        cover_image, gallery, technologies, project_url, github_url,
        play_store_url, apk_download_url, platform, status,
        featured, display_order, created_at, updated_at, published_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20
      ) RETURNING *;
    `;

    const values = [
      id,
      product.name,
      product.slug,
      product.short_description || '',
      product.description || '',
      product.category,
      product.cover_image || '',
      product.gallery || [],
      product.technologies || [],
      product.project_url || null,
      product.github_url || null,
      product.play_store_url || null,
      product.apk_download_url || null,
      product.platform || 'Web',
      product.status || 'Draft',
      Boolean(product.featured),
      Number(product.display_order) || 0,
      now,
      now,
      isPublished ? now : null,
    ];

    const res = await this.pool.query(query, values);
    return this.mapProduct(res.rows[0]);
  }

  public async updateProduct(id: string, updates: Partial<Omit<ProductRecord, 'id' | 'created_at'>>): Promise<ProductRecord | null> {
    const existing = await this.getProductById(id);
    if (!existing) return null;

    const allowedKeys: (keyof Omit<ProductRecord, 'id' | 'created_at'>)[] = [
      'name', 'slug', 'short_description', 'description', 'category',
      'cover_image', 'gallery', 'technologies', 'project_url', 'github_url',
      'play_store_url', 'apk_download_url', 'platform', 'status',
      'featured', 'display_order', 'published_at',
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const key of allowedKeys) {
      if (key in updates) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push((updates as any)[key]);
        paramIndex++;
      }
    }

    // Handle status change published_at lifecycle parity
    if (updates.status === 'Published' && existing.status !== 'Published' && !('published_at' in updates)) {
      setClauses.push(`published_at = NOW()`);
    } else if (updates.status === 'Draft' && !('published_at' in updates)) {
      setClauses.push(`published_at = NULL`);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE products
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const res = await this.pool.query(query, values);
    if (res.rows.length === 0) return null;
    return this.mapProduct(res.rows[0]);
  }

  public async deleteProduct(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM products WHERE id = $1;', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // Settings Operations
  public async getSettings(): Promise<StudioSettings> {
    const res = await this.pool.query('SELECT * FROM studio_settings WHERE id = 1;');
    if (res.rows.length === 0) {
      return {
        studio_name: 'Karsh Tech',
        tagline: 'Turning Ideas into Digital Reality',
        contact_email: 'karshhtech@gmail.com',
        updated_at: new Date().toISOString(),
        initial_seeded: true,
      };
    }
    return this.mapSettings(res.rows[0]);
  }

  public async updateSettings(settings: Partial<StudioSettings>): Promise<StudioSettings> {
    const allowedKeys: (keyof StudioSettings)[] = [
      'studio_name', 'tagline', 'contact_email', 'announcement', 'initial_seeded',
    ];

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const key of allowedKeys) {
      if (key in settings) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push((settings as any)[key]);
        paramIndex++;
      }
    }

    setClauses.push('updated_at = NOW()');

    const query = `
      UPDATE studio_settings
      SET ${setClauses.join(', ')}
      WHERE id = 1
      RETURNING *;
    `;

    const res = await this.pool.query(query, values);
    if (res.rows.length === 0) {
      return this.getSettings();
    }
    return this.mapSettings(res.rows[0]);
  }
}
