import type pg from 'pg';

export const KNOWN_PRODUCTION_IDENTIFIERS = [
  'dqdgotivffhvtpwjqlsf',
  'aws-0-ap-south-1.pooler.supabase.com',
  'karsh-tech-production',
];

export const REQUIRED_DOCKER_TEST_CONFIG = {
  host: '127.0.0.1',
  port: '5433',
  databaseName: 'karsh_tech_test',
  username: 'karsh_test_user',
  markerTable: '_test_environment_marker',
  markerEnvironment: 'karsh-tech-local-docker-test',
};

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  databaseHost?: string;
  databasePort?: string;
  databaseName?: string;
  databaseUser?: string;
}

/**
 * Validates whether a PostgreSQL connection string targets a genuinely isolated test database.
 * Strictly rejects any connection string that matches, resembles, or points to production.
 * When strictDockerMode is enabled, verifies exact match with Docker test container specifications.
 */
export function validateTestDatabaseUrl(
  candidateUrl: string | undefined,
  productionUrl?: string,
  strictDockerMode = false
): ValidationResult {
  if (!candidateUrl || candidateUrl.trim().length === 0) {
    return {
      allowed: false,
      reason: '[Guard FATAL] No test database connection string provided.',
    };
  }

  const cleanUrl = candidateUrl.trim();

  // 1. Rejection if identical to production URL
  if (productionUrl && cleanUrl === productionUrl.trim()) {
    return {
      allowed: false,
      reason: '[Guard CRITICAL REJECTION] Candidate test database URL is IDENTICAL to production DATABASE_URL. Immediate abort.',
    };
  }

  // 2. Rejection if contains known production project reference or host
  for (const prodId of KNOWN_PRODUCTION_IDENTIFIERS) {
    if (cleanUrl.toLowerCase().includes(prodId.toLowerCase())) {
      return {
        allowed: false,
        reason: `[Guard CRITICAL REJECTION] Candidate URL contains production identifier "${prodId}". Immediate abort.`,
      };
    }
  }

  // 3. Parse URL and inspect host, port, user and database name
  try {
    const parsed = new URL(cleanUrl);
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port || '5432';
    const username = decodeURIComponent(parsed.username || '').toLowerCase();
    const pathname = parsed.pathname.replace(/^\/+/, '');
    const dbName = pathname || 'postgres';

    // Disallow connections to cloud poolers unless explicitly non-production
    if (host.includes('supabase.com') || host.includes('pooler.supabase.com')) {
      for (const prodId of KNOWN_PRODUCTION_IDENTIFIERS) {
        if (username.toLowerCase().includes(prodId.toLowerCase())) {
          return {
            allowed: false,
            reason: `[Guard CRITICAL REJECTION] Supabase username contains production project reference: "${username}".`,
          };
        }
      }
    }

    // Strict Docker Mode enforcement (Section 6)
    if (strictDockerMode) {
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
      if (!isLocalhost) {
        return {
          allowed: false,
          reason: `[Guard Strict Docker Mode] Host must be localhost or 127.0.0.1 (actual: "${host}").`,
        };
      }
      if (port !== REQUIRED_DOCKER_TEST_CONFIG.port) {
        return {
          allowed: false,
          reason: `[Guard Strict Docker Mode] Port must be ${REQUIRED_DOCKER_TEST_CONFIG.port} (actual: "${port}").`,
        };
      }
      if (dbName !== REQUIRED_DOCKER_TEST_CONFIG.databaseName) {
        return {
          allowed: false,
          reason: `[Guard Strict Docker Mode] Database name must be "${REQUIRED_DOCKER_TEST_CONFIG.databaseName}" (actual: "${dbName}").`,
        };
      }
      if (username !== REQUIRED_DOCKER_TEST_CONFIG.username) {
        return {
          allowed: false,
          reason: `[Guard Strict Docker Mode] User must be "${REQUIRED_DOCKER_TEST_CONFIG.username}" (actual: "${username}").`,
        };
      }
    }

    return {
      allowed: true,
      databaseHost: host,
      databasePort: port,
      databaseName: dbName,
      databaseUser: username,
    };
  } catch (err: any) {
    return {
      allowed: false,
      reason: `[Guard FATAL] Failed to parse candidate database URL: ${err.message}`,
    };
  }
}

/**
 * Runtime guard executed against an active database connection before executing any test writes.
 * Verifies that the connected database is isolated, that test write permissions are explicitly granted,
 * and that test markers are verified.
 */
export async function assertTestDatabaseIsolation(
  clientOrPool: pg.Pool | pg.PoolClient,
  options?: {
    candidateUrl?: string;
    productionUrl?: string;
    requireMarker?: boolean;
    strictDockerMode?: boolean;
  }
): Promise<{ currentDatabase: string; currentHost?: string; currentUser: string }> {
  // 1. Verify explicit test write authorization flag
  const allowWrites = process.env.ALLOW_TEST_DATABASE_WRITES === 'true';
  if (!allowWrites) {
    throw new Error(
      '[Guard FATAL] ALLOW_TEST_DATABASE_WRITES is not "true". All write operations against databases are disabled by default.'
    );
  }

  // 2. Validate URL safety if supplied
  if (options?.candidateUrl) {
    const valResult = validateTestDatabaseUrl(
      options.candidateUrl,
      options.productionUrl,
      options.strictDockerMode
    );
    if (!valResult.allowed) {
      throw new Error(valResult.reason);
    }
  }

  // 3. Query current database identity at runtime
  const res = await clientOrPool.query(`
    SELECT 
      current_database() AS db_name,
      inet_server_addr() AS server_addr,
      current_user AS user_name
  `);

  const row = res.rows[0];
  const dbName = (row?.db_name || '').toLowerCase();
  const userName = (row?.user_name || '').toLowerCase();

  // If connected to a Supabase project, verify user does not contain production project ref
  for (const prodId of KNOWN_PRODUCTION_IDENTIFIERS) {
    if (userName.includes(prodId.toLowerCase())) {
      throw new Error(
        `[Guard CRITICAL REJECTION] Connected PostgreSQL session user "${userName}" contains production identifier "${prodId}". Aborting immediately.`
      );
    }
  }

  // Strict Docker Mode runtime check
  if (options?.strictDockerMode) {
    if (dbName !== REQUIRED_DOCKER_TEST_CONFIG.databaseName) {
      throw new Error(
        `[Guard Strict Docker Mode] Connected database is "${dbName}", expected "${REQUIRED_DOCKER_TEST_CONFIG.databaseName}".`
      );
    }
    if (userName !== REQUIRED_DOCKER_TEST_CONFIG.username) {
      throw new Error(
        `[Guard Strict Docker Mode] Connected session user is "${userName}", expected "${REQUIRED_DOCKER_TEST_CONFIG.username}".`
      );
    }
  }

  // 4. Test marker verification if required
  if (options?.requireMarker) {
    const markerRes = await clientOrPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = '${REQUIRED_DOCKER_TEST_CONFIG.markerTable}'
      ) AS has_marker;
    `);
    if (!markerRes.rows[0]?.has_marker) {
      throw new Error(
        `[Guard FATAL] Required test marker table "${REQUIRED_DOCKER_TEST_CONFIG.markerTable}" is missing in target database. Write operations aborted.`
      );
    }

    const markerRowRes = await clientOrPool.query(`
      SELECT environment FROM ${REQUIRED_DOCKER_TEST_CONFIG.markerTable} 
      WHERE id = 'isolated_test_marker' LIMIT 1;
    `);
    const envVal = markerRowRes.rows[0]?.environment;
    if (envVal !== REQUIRED_DOCKER_TEST_CONFIG.markerEnvironment) {
      throw new Error(
        `[Guard FATAL] Test environment marker value mismatch: expected "${REQUIRED_DOCKER_TEST_CONFIG.markerEnvironment}", found "${envVal}". Write operations aborted.`
      );
    }
  }

  return {
    currentDatabase: row?.db_name,
    currentHost: row?.server_addr ? String(row.server_addr) : undefined,
    currentUser: row?.user_name,
  };
}
