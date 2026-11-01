import http from 'http';
import { app } from '../server/index.js';
import { setDatabaseProvider } from '../server/db.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { resolveProviderType, createDatabaseProvider } from '../server/database/databaseFactory.js';
import { setSessionCookie } from '../server/auth.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';

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

export async function runRenderConfigurationAudit(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.4 RENDER DEPLOYMENT CONFIGURATION AUDIT');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard rejected test URL: ${guard.reason}`);

  const postgresProvider = new SupabasePostgresProvider(testDbUrl);
  await postgresProvider.init();
  setDatabaseProvider(postgresProvider);

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
    // --- 1. Production Database Enforcement ---
    console.log('--- 1. Production Database Provider Enforcement ---');

    await run('DatabaseEnforcement', 'Production mode strictly defaults to postgres provider', async () => {
      const prevNodeEnv = process.env.NODE_ENV;
      const prevDbProvider = process.env.DB_PROVIDER;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.DB_PROVIDER;

        const resolved = resolveProviderType();
        assert(resolved === 'postgres', `Expected 'postgres' in production, got '${resolved}'`);
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
        if (prevDbProvider) process.env.DB_PROVIDER = prevDbProvider;
      }
    });

    await run('DatabaseEnforcement', 'Missing DATABASE_URL in production throws and fails closed without JSON fallback', async () => {
      const prevNodeEnv = process.env.NODE_ENV;
      const prevDbProvider = process.env.DB_PROVIDER;
      const prevDbUrl = process.env.DATABASE_URL;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.DB_PROVIDER;
        delete process.env.DATABASE_URL;

        let threw = false;
        try {
          createDatabaseProvider();
        } catch (err: any) {
          threw = true;
          assert(err.message.includes('DATABASE_URL is missing or empty'), 'Error message mentions missing DATABASE_URL');
          assert(err.message.includes('Silent fallback to JSON is strictly disabled'), 'Explicitly notes JSON fallback is disabled');
        }
        assert(threw, 'Must throw when DATABASE_URL is missing in production');
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
        if (prevDbProvider) process.env.DB_PROVIDER = prevDbProvider;
        if (prevDbUrl) process.env.DATABASE_URL = prevDbUrl;
      }
    });

    // --- 2. CORS Allowlist & Preflight Options ---
    console.log('\n--- 2. CORS Allowlist & Preflight Verification ---');

    await run('CORS', 'Preflight OPTIONS with production domain returns 204 with CORS credentials', async () => {
      const res = await fetch(`${baseUrl}/api/games`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://tech.aadirishi.in',
          'Access-Control-Request-Method': 'GET',
        },
      });

      assert(res.status === 204, `Expected 204, got ${res.status}`);
      assert(res.headers.get('access-control-allow-origin') === 'https://tech.aadirishi.in', 'Allows production origin');
      assert(res.headers.get('access-control-allow-credentials') === 'true', 'Allows credentials');
    });

    await run('CORS', 'GET request from allowed origin returns Access-Control-Allow-Origin', async () => {
      const res = await fetch(`${baseUrl}/api/games`, {
        headers: {
          Origin: 'https://tech.aadirishi.in',
        },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.headers.get('access-control-allow-origin') === 'https://tech.aadirishi.in', 'Origin reflected');
      assert(res.headers.get('access-control-allow-credentials') === 'true', 'Credentials reflected');
    });

    await run('CORS', 'Disallowed origin does NOT receive Access-Control-Allow-Origin header', async () => {
      const res = await fetch(`${baseUrl}/api/games`, {
        headers: {
          Origin: 'https://malicious-external-site.evil',
        },
      });

      assert(res.headers.get('access-control-allow-origin') === null, 'No allow-origin header for disallowed origin');
    });

    await run('CORS', 'Wildcard * origin is never paired with credentials: true', async () => {
      const res = await fetch(`${baseUrl}/api/games`, {
        headers: {
          Origin: 'https://tech.aadirishi.in',
        },
      });

      const allowOrigin = res.headers.get('access-control-allow-origin');
      assert(allowOrigin !== '*', 'Allow origin must never be wildcard *');
    });

    // --- 3. Session Cookie Security Flags ---
    console.log('\n--- 3. Session Cookie Security Configuration ---');

    await run('CookieSecurity', 'setSessionCookie configures httpOnly, sameSite=lax, and secure in production', async () => {
      const prevNodeEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        let capturedOptions: any = null;
        const fakeRes = {
          cookie: (_name: string, _val: string, opts: any) => {
            capturedOptions = opts;
          },
        } as any;

        setSessionCookie(fakeRes, 'sample-jwt-token');

        assert(capturedOptions !== null, 'Cookie was set');
        assert(capturedOptions.httpOnly === true, 'Cookie is httpOnly');
        assert(capturedOptions.secure === true, 'Cookie is secure in production');
        assert(capturedOptions.sameSite === 'lax', 'Cookie sameSite is lax');
        assert(capturedOptions.path === '/', 'Cookie path is /');
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
      }
    });

  } finally {
    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`RENDER CONFIG SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Render Configuration Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_render_configuration_audit.ts')) {
  runRenderConfigurationAudit()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN RENDER CONFIG SUITE]', err);
      process.exit(1);
    });
}
