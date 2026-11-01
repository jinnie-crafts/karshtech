import http from 'http';
import { app } from '../server/index.js';
import { setDatabaseProvider } from '../server/db.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
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

export async function runSecurityTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.4 SECURITY, AUTH & INJECTION VERIFICATION');
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

  const editorToken = generateToken({
    userId: 'test_user_editor',
    username: 'test_editor_account',
    role: 'editor',
  });

  const adminToken = generateToken({
    userId: TEST_FIXTURES.user.id,
    username: TEST_FIXTURES.user.username,
    role: 'admin',
  });

  try {
    // --- 1. Authorization Controls ---
    console.log('--- 1. Role-Based Authorization Enforcement ---');

    await run('Authorization', 'GET /api/admin/games without token returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/admin/games`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await run('Authorization', 'POST /api/admin/games with non-admin token returns HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${editorToken}`,
        },
        body: JSON.stringify({ title: 'Exploit' }),
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await run('Authorization', 'GET /api/admin/settings with non-admin token returns HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${editorToken}` },
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    // --- 2. CSRF Mitigation ---
    console.log('\n--- 2. CSRF Mitigation on Admin Routes ---');

    await run('CSRFDefense', 'Cookie-based state-changing request from unauthorized origin returns HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://malicious-attacker-site.com',
          Cookie: `karsh_session=${adminToken}`,
        },
        body: JSON.stringify({ studio_name: 'Hacked' }),
      });
      assert(res.status === 403, `Expected 403 for cross-site cookie request, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('CSRF') === true, 'Error identifies CSRF protection');
    });

    await run('CSRFDefense', 'Bearer token request is immune to CSRF rejection regardless of origin', async () => {
      const res = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://random-allowed-origin.com',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ tagline: 'CSRF Immune with Bearer Token' }),
      });
      assert(res.status === 200, `Expected 200 for Bearer authenticated request, got ${res.status}`);
    });

    // --- 3. Input Sanitization & Attack Payloads ---
    console.log('\n--- 3. Input Validation & Injection Defense ---');

    await run('SQLInjection', 'SQL injection tautology in slug returns HTTP 404 safely', async () => {
      const res = await fetch(`${baseUrl}/api/games/' OR 1=1 --`);
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('not found') === true, 'Handled as non-existent slug');
    });

    await run('SQLInjection', 'UNION-based SQL injection in search query returns empty or safe catalog', async () => {
      const res = await fetch(`${baseUrl}/api/games?search=' UNION SELECT 1,2,3,4,5,6,7,8,9,10 --`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(Array.isArray(body.games), 'Returned games is array');
    });

    await run('InputValidation', 'Malformed JSON payload in request body returns HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/admin/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: '{ "title": "Broken unclosed JSON',
      });
      assert(res.status === 400, `Expected 400 for malformed JSON, got ${res.status}`);
    });

    await run('InputValidation', 'Oversized request payload (> 10 MB) is rejected with 413 or 400', async () => {
      const hugeData = 'A'.repeat(11 * 1024 * 1024); // 11 MB string
      const res = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ announcement: hugeData }),
      });
      assert(res.status === 413 || res.status === 400, `Expected 413 or 400, got ${res.status}`);
    });

    // --- 4. Information Disclosure Check ---
    console.log('\n--- 4. Information Disclosure Defense ---');

    await run('InfoDisclosure', 'Database errors never leak connection strings, passwords, or stack traces', async () => {
      const res = await fetch(`${baseUrl}/api/products/invalid_slug_causing_no_error`);
      const bodyText = await res.text();
      assert(!bodyText.includes('postgres://'), 'Does not leak postgres connection URL');
      assert(!bodyText.includes('postgresql://'), 'Does not leak postgresql connection URL');
      assert(!bodyText.includes('KarshTestSecurePassword'), 'Does not leak test password');
      assert(!bodyText.includes('at ModuleJob.run'), 'Does not leak Node stack trace');
    });

  } finally {
    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`SECURITY SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Security Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_e2e_security.ts')) {
  runSecurityTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN SECURITY SUITE]', err);
      process.exit(1);
    });
}
